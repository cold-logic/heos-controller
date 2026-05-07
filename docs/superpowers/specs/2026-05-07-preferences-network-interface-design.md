# Design Spec: Preferences Screen & Network Interface Selection

**Date**: 2026-05-07
**Status**: Draft
**Feature**: Preferences screen to allow users to manually select a network interface for HEOS speaker discovery.

## 1. Overview
Currently, the Heos Controller attempts to auto-detect the best network interface for SSDP discovery by "connecting" to a public IP. While effective, this can fail on complex network setups (VPNs, multiple active NICs). This feature introduces a preferences screen to allow users to override the auto-detection.

## 2. User Interface (Frontend)
- **Entry Point**: A gear icon (⚙️) added to the right side of the main card header.
- **Settings Screen**: A Bootstrap 5 Modal containing:
  - A dropdown menu for "Network Interface".
  - Options: "Auto-Detect (Recommended)" (default) + list of active local IPv4 interfaces with friendly names and IPs.
  - "Apply" and "Cancel" buttons.
- **Visuals**: Consistent with the existing Bootstrap 4/5 theme and interactive patterns.

## 3. Backend & Logic (Rust)
- **Interface Listing**: A new command `get_network_interfaces` will use the `get_if_addrs` crate to return a list of active network interfaces.
- **Persistent Storage**: Use `tauri-plugin-store` to save the user's preference to a `settings.json` file in the OS-standard config directory.
  - **Setup**: Install `@tauri-apps/plugin-store` (JS) and `tauri-plugin-store` (Rust).
  - Key: `preferred_interface` (stores the IP address or "auto").
- **Discovery Update**: The `discover_speakers` command will be updated to:
  1. Check the Store for a `preferred_interface`.
  2. If set to a specific IP, bind the UDP socket to that IP.
  3. If set to "auto" (or not set), use the existing connection-based auto-detection logic.

## 4. Data Flow
1. **App Start**: UI loads existing preference from Store.
2. **User Opens Settings**: Frontend calls `get_network_interfaces`.
3. **User Saves**: Frontend calls `tauri-plugin-store` to save preference and triggers `discover_speakers`.
4. **Rust**: Reads preference and binds discovery socket accordingly.

## 5. Security & Permissions
- No new permissions required; the app already has `com.apple.security.network.client` and `com.apple.security.network.server` entitlements for discovery.

## 6. Success Criteria
- Users can see a list of available network interfaces.
- Selecting an interface persists across app restarts.
- Discovery works correctly when a specific interface is selected.
