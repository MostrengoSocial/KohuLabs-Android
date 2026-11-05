# Kō on the desktop

Kō as a small transparent window that roams your screen, with a Today window you open by clicking him. Windows first.
Built with [Tauri 2](https://tauri.app): Rust in `src-tauri/`, plain JavaScript in `ui/`. Kō's renderer and the fonts
come from `web/` at build time (`scripts/copy-web.mjs`), so the phone and the desktop share one Kō.

- **Roaming** (`ui/roam.js`): the phone's behaviours. He stops when the pointer is on him, can be dragged anywhere, and
  naps after 5 minutes without input (nothing is drawn while he sleeps).
- **Clicks** (`src-tauri/src/main.rs`, the watcher): pass through to the windows below everywhere except on Kō.
- **Out of the way** (`src-tauri/src/platform.rs`): hidden when Windows reports a full-screen app, a presentation or
  "busy". A call in a normal window is not detected; use "Show Kō" in the tray.
- **Coming to you** (`ui/day.js`): 10 minutes before a meeting, and when a chunk starts.
- **Your day** (`src-tauri/src/day.rs`): pulled through the Worker's `/api/sync`, the same as the phone. Read-only: the
  desktop pushes nothing yet. A copy is kept in the app's data folder for when you're offline.
- **Sign-in** (`src-tauri/src/auth.rs`): Google, in your browser, back to a `127.0.0.1` address with PKCE. The token
  is kept in Windows Credential Manager. Needs the Worker change in `api/index.js` to be deployed.

## Build and try

Needs Rust, Node 20+ and the Windows build tools (see Tauri's prerequisites).

```
cd desktop
npm install
npm run tauri -- dev      # run it
npm run tauri -- build    # the installer lands in src-tauri/target/release/bundle/nsis/
npm test                  # roaming and day logic; `cargo test` in src-tauri/ for the Rust side
```

CI builds the installer on every pull request (artifact `ko-windows-installer`). It isn't code-signed yet, so Windows
SmartScreen warns the first time: More info → Run anyway.

To try the screens in a browser: `node scripts/copy-web.mjs`, `cd ui && python3 -m http.server`, then open
`/ko.html?demo` or `/panel.html?demo` (a sample day; nothing is signed in).
