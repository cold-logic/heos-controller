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

## Git LFS & Jujutsu (jj) Warning

*   **Git LFS Required:** This repository uses Git LFS to track binaries (like `.icns`, `.png`, and `.ico` files).
*   **Jujutsu (jj) Incompatibility:** Jujutsu does **not** support Git LFS. If you use Jujutsu (`jj`) to commit changes, it will commit raw binary files directly to Git, bypassing the LFS pointer mechanism and corrupting the Git LFS database.
*   **Guideline:** AI agents and developers must use standard Git CLI (`git commit`, `git push`) instead of Jujutsu (`jj`) for making and pushing commits in this repository.
