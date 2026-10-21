# Graktor Offline

A standalone installable version of Graktor that runs entirely on the machine it's installed on —
its own local database, no cloud account and no ongoing internet connection needed for day-to-day
use. Activated once with a 14-digit license key, an existing paid Graktor account, or by buying a
key on the spot. Optional cloud backup once activated: a licensed install can back its database up
to Zendoria's cloud (at most once every 6 hours, plus up to 2 emergency backups a day), restorable
onto a replacement machine by activating with the same key.

This repo holds the thin desktop wrapper (an [Electron](https://www.electronjs.org/) app that
spawns a bundled local server and opens it in a window); the server itself is closed source.

## Downloads

The [latest release](https://github.com/graktor/graktor-offline/releases/tag/latest) has an
installer for each platform:

- **Windows** — `Graktor-Offline-Setup-*.exe` (NSIS installer, 64-bit). Unsigned, so SmartScreen
  will show an "unrecognized app" warning on first run — click "More info" → "Run anyway".
- **Linux** — `Graktor-Offline-*.AppImage` (x86_64). Make it executable
  (`chmod +x Graktor-Offline-*.AppImage`) and run it directly.
- **macOS** — `Graktor-Offline-*.dmg` (universal, Intel + Apple Silicon). Unsigned, so Gatekeeper
  will say it's from an unidentified developer — right-click the app and choose "Open" to bypass
  that the first time.

## What's in scope

Core POS, inventory, customers, reports, staff accounts — a single branch, running fully locally.
Cameras, the online store, SMS/email notifications, and multi-branch are cloud-only features and
aren't part of this build.

## Getting a license key

Keys are issued from Graktor's own platform console. If you don't have one, the app's own
activation screen can buy one on the spot (needs internet for that one step), or you can activate
instead with an existing paid Graktor account login.
