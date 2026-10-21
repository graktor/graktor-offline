// Graktor Offline's desktop wrapper. Unlike graktor-desktop (a thin window around the live
// cloud app), there's no remote server to load here -- this spawns the bundled
// ZendoriaOfflineHost executable (see offline/ZendoriaOfflineHost) as a child process on
// startup, waits for it to come up, then loads its local page. Everything after that is the
// same web app the cloud product uses, just running entirely on this machine.
const { app, BrowserWindow, Menu, shell, session } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const PORT = 5257;
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
const STATE_FILE = path.join(app.getPath("userData"), "window-state.json");

// In a packaged build the host executable ships under resources/host (see package.json's
// extraResources, one per platform target); in dev (npm start, no package step) it's read
// straight from the sibling offline/ZendoriaOfflineHost/publish folder instead.
function hostExecutablePath() {
  const exeName = process.platform === "win32" ? "Zendoria.Api.exe" : "Zendoria.Api";
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "host", exeName);
  }
  const rid = process.platform === "win32" ? "win-x64" : process.platform === "darwin" ? (process.arch === "arm64" ? "osx-arm64" : "osx-x64") : "linux-x64";
  return path.join(__dirname, "..", "..", "offline", "ZendoriaOfflineHost", "publish", rid, exeName);
}

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { width: 1400, height: 900 };
  }
}

function saveWindowState(win) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(win.getBounds()));
  } catch {
    // Not remembering window position/size next launch is harmless -- never worth crashing over.
  }
}

/**
 * Polls the local host until it answers (or gives up), rather than guessing a fixed delay --
 * startup time varies by machine, and the very first launch ever is its own slow case again:
 * EnsureCreatedAsync builds the whole schema from scratch then, which measured ~25-30s on a
 * real machine during testing (a normal restart just opens the existing file, well under 5s).
 * 60s covers that first-run case with real margin, not just the common case.
 */
function waitForHost(timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      const req = http.get(LOCAL_URL, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) return reject(new Error("Graktor Offline didn't start in time."));
        setTimeout(poll, 300);
      });
    })();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let mainWindow = null;
  let hostProcess = null;

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function startHost() {
    const exe = hostExecutablePath();
    if (!fs.existsSync(exe)) {
      throw new Error(`Graktor Offline's local server wasn't found at ${exe}. Reinstall the app.`);
    }
    // cwd = the exe's own folder -- it writes graktor-offline.db and its license/signing-key
    // files right next to itself (see OfflineLicenseState / Program.cs), same as running it by
    // double-click would.
    hostProcess = spawn(exe, [], { cwd: path.dirname(exe), stdio: "ignore", windowsHide: true });
    hostProcess.on("exit", async (code) => {
      hostProcess = null;
      // mainWindow is null only when we killed it ourselves on quit (see app.on("before-quit")
      // below, which nulls it first) -- nothing to do then.
      if (!mainWindow) return;
      // Any other exit -- a real crash, or a deliberate one after a cloud-backup restore stages
      // a new database file (see OfflineLicenseController.Restore's own doc comment) -- gets
      // the same response: try bringing the host back up. A genuine crash will typically fail to
      // restart cleanly too, which is what actually falls through to crashed.html below; a
      // restore-triggered exit comes back up fine, now serving the restored data, and the
      // frontend reload naturally re-checks its licence/setup status and moves on from there.
      try {
        startHost();
        await waitForHost();
        mainWindow.loadURL(LOCAL_URL);
      } catch {
        mainWindow.loadFile(path.join(__dirname, "crashed.html"));
      }
    });
  }

  function createWindow() {
    const state = loadWindowState();
    mainWindow = new BrowserWindow({
      ...state,
      minWidth: 900,
      minHeight: 600,
      title: "Graktor Offline",
      backgroundColor: "#111318",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    mainWindow.once("ready-to-show", () => mainWindow.show());
    mainWindow.on("resize", () => saveWindowState(mainWindow));
    mainWindow.on("move", () => saveWindowState(mainWindow));

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    mainWindow.loadFile(path.join(__dirname, "starting.html"));
    mainWindow.setMenu(null);
  }

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

    createWindow();

    try {
      startHost();
      await waitForHost();
      mainWindow.loadURL(LOCAL_URL);
    } catch (err) {
      mainWindow.loadFile(path.join(__dirname, "crashed.html"));
    }

    Menu.setApplicationMenu(null);

    const { globalShortcut } = require("electron");
    globalShortcut.register("CommandOrControl+R", () => mainWindow?.loadURL(LOCAL_URL));
    globalShortcut.register("CommandOrControl+Shift+I", () => mainWindow?.webContents.toggleDevTools());
  });

  function stopHost() {
    if (hostProcess) {
      hostProcess.kill();
      hostProcess = null;
    }
  }

  app.on("before-quit", () => {
    mainWindow = null; // so the host's own "exit" handler above doesn't show a crash screen on a normal quit
    stopHost();
  });

  app.on("window-all-closed", () => app.quit());
}
