# Heos Controller

Desktop controller for [Denon Heos](http://heosbydenon.denon.com) wifi speakers.

**Now built with [Tauri v2](https://v2.tauri.app/)!** 🚀

## Screenshot

![](screenshot.png)

## Features
* Automatic SSDP detection of speakers
* User friendly volume dial
* Playback controls (previous, play/pause, next)
* Native macOS menubar & shortcuts

## Usage

1. **Development**: Run `pnpm dev` to start the app in development mode.
2. **Build**: Run `pnpm build` to compile a production-ready application.
3. **Open**: Run `pnpm run open` to launch the built application.

## Development

This project uses `pnpm`.

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Run in Development Mode**:
   ```bash
   pnpm dev
   ```
   *   Hot-reloading is enabled for the frontend.
   *   The Rust backend will recompile on changes.

3. **Build for Production**:
   ```bash
   pnpm build
   ```
   This command will:
   *   Compile the Vite frontend.
   *   Compile the Rust backend.
   *   Bundle the macOS application (`.app`).
   *   **Automatically Sign** the bundle (Ad-Hoc) to ensure network permissions work.

   > **Note**: On macOS, you **must** have the app signed with `entitlements` to allow local network discovery (SSDP). The build script handles this for you automatically via `scripts/sign.js`.

### Build Output

The compiled application is located at:
`src-tauri/target/release/bundle/macos/heos-controller.app`

## Technical Details

*   **Frontend**: JavaScript, jQuery, Bootstrap-icons (Vite)
*   **Backend**: Rust (Tauri v2)
*   **Protocol**: [HEOS CLI Protocol](https://rn.dmglobal.com/usmodel/HEOS_CLI_ProtocolSpecification-Version-1.16.pdf)

## ToDo
* Detection and control of grouped speakers
* Details about the currently playing stream
* A slider to scrub and track playback position
* A "sources" media stream picker
