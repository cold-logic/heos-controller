# Heos Controller Agent

This document provides instructions and context for AI coding agents to work on the Heos Controller project.

## Introduction

This project is a desktop controller for Denon Heos wifi speakers, refactored from Electron to **Tauri v2**.
It uses **Rust** for the backend (networking, discovery) and **JavaScript/Vite** for the frontend.

## Project Structure

*   `src/`: Front-end code (Renderer).
    *   `main.js`: Main logic using Tauri APIs (`invoke`, `listen`).
    *   `index.html`: Entry point.
    *   `assets/`: Styles and icons.
*   `src-tauri/`: Back-end code (Core).
    *   `src/lib.rs`: Rust implementation of HEOS protocol (SSDP discovery, TCP control).
    *   `tauri.conf.json`: Tauri configuration (permissions, windows, build settings).
    *   `Entitlements.plist`: macOS permissions (network client/server).
    *   `capabilities/`: Tauri permission capabilities.
*   `scripts/`: Utility scripts.
    *   `sign.js`: Cross-platform signing logic.
*   `dist/`: Compiled frontend assets.
*   `package.json`: Dependencies and scripts.

## Commands

This project uses `pnpm` exclusively.

*   **Development**: `pnpm dev` (Runs Tauri in development mode)
*   **Build**: `pnpm build` (Builds Frontend + Rust + Signs bundle)
*   **Build Frontend Only**: `pnpm build:vite`
*   **Sign Bundle**: `pnpm run sign` (Automatic post-build, or manual)
*   **Open Release**: `pnpm run open` (Launches the compiled macOS app)

## Architecture

*   **Frontend (JS)**: Handles UI state, inputs, and renders the interface. Uses `jquery` and `bootstrap`. Communicates with Rust via `invoke('command')` and listens for events `listen('event')`.
*   **Backend (Rust)**:
    *   **Discovery**: SSDP (UDP) listener on `239.255.255.250:1900`. Emits `speaker-discovered`.
    *   **Control**: TCP connection to speaker port 1255. Emits `heos-message`, `heos-error`.
    *   **Menu**: Native macOS menu implementation.

## Security & Signing

*   **macOS**: The release bundle (`.app`) MUST be signed with `Entitlements.plist` to access the network (due to App Sandbox).
*   The `pnpm build` command handles this automatically via `scripts/sign.js`.

## Git LFS & Jujutsu (jj)

Jujutsu (jj) does not natively support Git LFS. It lacks the internal data representations and the "clean/smudge" text filters required to parse, download, or track LFS pointer files natively. 
Because jj automatically snapshots and commits changes from your working directory continuously, using it directly in an LFS-heavy repository can cause significant problems. 

### The Issues with Mixing jj and Git LFS
If you attempt to use jj in an LFS repository, you will likely experience the following breakages:
* **Accidental Large Commits:** Instead of checking in a lightweight text pointer file, jj may snapshot and track the raw, massive binary file directly into your native Git history.
* **Hook Failures:** Git LFS heavily relies on Git hooks (like pre-push) to upload your large assets to an external server. Because jj bypasses traditional Git hooks during its operations, your LFS files may never actually get uploaded to GitHub, GitLab, or your storage backend.
* **Spurious Merge Conflicts:** Pulling down changes can leave jj completely confused by the LFS pointer files, resulting in persistent metadata or tree conflicts that standard Git doesn't show.

### How to Work Around It (The Dual-Tool Workflow)
If you must work in a repository that uses Git LFS but still want the benefits of jj's history rewriting and conflict management, you have to use a colocated workspace. This approach relies on a hybrid model where both a `.jj` and a `.git` folder exist in the same working directory.

Follow these specific rules to keep your repository healthy:
1. **Use Git for Ingestion and Synchronization:** Always use standard git commands to pull down updates or download large files.
   ```bash
   git fetch
   git lfs pull
   ```
2. **Let jj Automatically Import the State:** Once Git has correctly swapped out the pointer files for the actual large assets in your working directory, jj will automatically detect and sync those changes into its internal view.
3. **Use Git for Final Pushes:** Do not use `jj git push`. If you use jj to push, the LFS binary assets will not be intercepted by the Git LFS hooks. Instead, export your jj state back to a Git branch and push using standard Git:
   ```bash
   # Ensure your bookmarks/branches are updated
   jj bookmark export 
   # Push via native Git so the LFS hooks trigger normally
   git push origin main
   ```

### Future Roadmap
The Jujutsu community is actively tracking Git LFS support under [GitHub Issue #80](https://github.com/jj-vcs/jj/issues/80). The developers are exploring whether to implement Git-style clean/smudge filters or to build a more robust, native large-file architecture into jj's pluggable backend data model. Until version 1.0 or formal LFS integration arrives, the dual-tool workflow remains mandatory.

