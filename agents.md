# Heos Controller Agent

This document provides instructions and context for AI coding agents to work on the Heos Controller project.

## Introduction

This project is a desktop controller for Denon Heos wifi speakers, built with Electron.

## Project Structure

*   `app/`: Contains the main application code.
    *   `index.js`: The main entry point for the Electron application.
    *   `browser/`: Contains the front-end code for the renderer process.
        *   `index.html`: The main HTML file for the UI.
        *   `index.js`: The main JavaScript file for the UI.
        *   `index.css`: The main CSS file for the UI.
*   `dist/`: The output directory for the compiled application. This directory is ignored by git.
*   `package.json`: Defines the project's dependencies, scripts, and metadata.
*   `.gitignore`: Specifies files and directories that should be ignored by git.

## Commands

This project uses `pnpm` as the package manager.

*   **Install dependencies**: `pnpm install`
*   **Run the app in development mode**: `pnpm start`
*   **Build the application for production**: `pnpm build`
*   **Package the application**: `pnpm pack` or `pnpm dist`

### Testing

There are no automated tests for this project yet.

## Code Style

Please maintain a consistent code style with the existing codebase. Pay attention to formatting, naming conventions, and commenting practices.

## Architecture

This is an Electron application with a standard main/renderer process architecture.

*   **Main Process**: The main process is responsible for creating and managing windows, and interacting with the operating system. The main process code is in `app/index.js`.
*   **Renderer Process**: The renderer process is responsible for rendering the user interface. The renderer process code is in the `app/browser/` directory.

Communication between the main and renderer processes is done using Electron's IPC (Inter-Process Communication) modules.
