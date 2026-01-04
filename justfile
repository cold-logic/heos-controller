# Heos Controller - Just Command Runner
# Usage: just <recipe>
# Run 'just --list' to see all available recipes

# Default recipe - shows available commands
default:
    @just --list

# Install dependencies
install:
    pnpm install

# Start development server
dev:
    pnpm run dev

# Build the application (production)
# Automatically creates universal binary on macOS (Intel + Apple Silicon)
build:
    pnpm run build

# Build Vite only (frontend)
build-vite:
    pnpm run build:vite

# Preview the production build
preview:
    pnpm run preview

# Run Tauri CLI directly
tauri *args:
    pnpm run tauri {{args}}

# Sign the application
sign:
    pnpm run sign

# Open the built macOS application
open:
    pnpm run open

# Clean build artifacts
clean:
    rm -rf dist
    rm -rf src-tauri/target

# Clean and reinstall dependencies
clean-deps:
    rm -rf node_modules
    pnpm install

# Full clean (build artifacts and dependencies)
clean-all: clean clean-deps

# Build and sign the application
release: build sign

# Build, sign, and open the application
release-open: release open

# Check Tauri info
info:
    pnpm run tauri info

# Dev with auto-reload
watch:
    pnpm run dev
