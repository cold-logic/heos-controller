# Preferences Screen & Network Interface Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a preferences screen allowing users to manually select a network interface for HEOS speaker discovery, persisting the choice using OS-standard storage.

**Architecture:** 
- Use `get_if_addrs` crate for network interface enumeration in Rust.
- Use `tauri-plugin-store` for persistent configuration storage (OS-standard location).
- Use Bootstrap 5 Modals for the UI.
- Update discovery logic to bind to the selected IP.

**Tech Stack:** Rust (Tauri v2), JavaScript, Bootstrap 5, jQuery.

---

### Task 1: Project Setup (Dependencies)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add Rust dependencies**
Add `get_if_addrs` and `tauri-plugin-store` to `[dependencies]` in `src-tauri/Cargo.toml`.
```toml
get_if_addrs = "0.5"
tauri-plugin-store = "2"
```

- [ ] **Step 2: Add JS dependencies**
Run `pnpm add @tauri-apps/plugin-store`.

- [ ] **Step 3: Register Store plugin in Rust**
Update `run()` function in `src-tauri/src/lib.rs` to include the store plugin.
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        // ... rest of builder
}
```

- [ ] **Step 4: Verify build**
Run `pnpm tauri build --no-bundle` to ensure dependencies are resolved.

- [ ] **Step 5: Commit**
```bash
git add src-tauri/Cargo.toml package.json pnpm-lock.yaml src-tauri/src/lib.rs
git commit -m "chore: add store and networking dependencies"
```

---

### Task 2: Backend - Network Interface Listing

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Define Interface Struct**
Add a serializable struct for network interfaces.
```rust
#[derive(serde::Serialize)]
struct NetworkInterface {
    name: String,
    ip: String,
}
```

- [ ] **Step 2: Implement `get_network_interfaces` command**
```rust
#[tauri::command]
async fn get_network_interfaces() -> Result<Vec<NetworkInterface>, String> {
    let interfaces = get_if_addrs::get_if_addrs().map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for iface in interfaces {
        if iface.is_loopback() { continue; }
        if let get_if_addrs::IfAddr::V4(addr) = iface.addr {
            list.push(NetworkInterface {
                name: iface.name,
                ip: addr.ip.to_string(),
            });
        }
    }
    Ok(list)
}
```

- [ ] **Step 3: Register the command**
Add `get_network_interfaces` to `generate_handler!`.

- [ ] **Step 4: Commit**
```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add get_network_interfaces command"
```

---

### Task 3: Backend - Store Integration & Discovery Update

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Update `discover_speakers` to check preference**
Import `tauri_plugin_store::StoreExt`.
Read `preferred_interface` from the store. If set and not "auto", use it as `local_ip`.
```rust
use tauri_plugin_store::StoreExt;

async fn discover_speakers(app: AppHandle) -> Result<(), String> {
    let stores = app.stores();
    let path = std::path::PathBuf::from("settings.json");
    let store = stores.get(&path).ok_or("Store not found")?;
    
    let preferred_ip = store.get("preferred_interface")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let local_ip = if let Some(ip) = preferred_ip {
        if ip == "auto" {
            // ... existing auto-detect logic ...
        } else {
            ip.parse().map_err(|_| "Invalid IP in settings")?
        }
    } else {
        // ... existing auto-detect logic ...
    };
    // ...
}
```

- [ ] **Step 2: Commit**
```bash
git add src-tauri/src/lib.rs
git commit -m "feat: integrate store preference into discovery"
```

---

### Task 4: Frontend - UI Components

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Add Gear Icon to Header**
```html
<div class="card-header d-flex justify-content-between align-items-center">
  <h3 class="card-title mb-0">Heos Controller</h3>
  <button id="settings-btn" class="btn btn-link p-0 text-decoration-none" aria-label="Settings">
    <i class="bi bi-gear-fill text-body"></i>
  </button>
</div>
```

- [ ] **Step 2: Add Settings Modal Markup**
Add before `</body>`.
```html
<div class="modal fade" id="settingsModal" tabindex="-1" aria-labelledby="settingsModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="settingsModalLabel">Settings</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div class="mb-3">
          <label for="interface-select" class="form-label">Network Interface</label>
          <select id="interface-select" class="form-select">
            <option value="auto">Auto-Detect (Recommended)</option>
          </select>
          <div class="form-text">Select the network used to find your speakers.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" id="save-settings" class="btn btn-primary">Apply</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Commit**
```bash
git add index.html src/index.css
git commit -m "feat: add settings gear and modal UI"
```

---

### Task 5: Frontend - Wiring Logic

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Initialize Store and Modal**
```javascript
import { LazyStore } from '@tauri-apps/plugin-store';
const store = new LazyStore('settings.json');
const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
```

- [ ] **Step 2: Handle Settings Button Click**
Fetch interfaces and populate dropdown. Load current preference.
```javascript
$('#settings-btn').on('click', async () => {
    const interfaces = await invoke('get_network_interfaces');
    const $select = $('#interface-select');
    $select.find('option:not([value="auto"])').remove();
    
    interfaces.forEach(iface => {
        $select.append(`<option value="${iface.ip}">${iface.name} (${iface.ip})</option>`);
    });

    const preferred = await store.get('preferred_interface') || 'auto';
    $select.val(preferred);
    
    settingsModal.show();
});
```

- [ ] **Step 3: Handle Save**
```javascript
$('#save-settings').on('click', async () => {
    const selected = $('#interface-select').val();
    await store.set('preferred_interface', selected);
    await store.save();
    settingsModal.hide();
    
    // Trigger fresh scan
    invoke('discover_speakers');
});
```

- [ ] **Step 4: Commit**
```bash
git add src/main.js
git commit -m "feat: wire up preferences logic"
```

---

### Task 6: Verification

- [ ] **Step 1: Verify persistent storage**
Select an interface, restart the app, and verify the choice is remembered.

- [ ] **Step 2: Verify discovery**
Check the "heos-debug" logs (or console) to ensure it's binding to the selected IP.

- [ ] **Step 3: Final Production Build**
Run `pnpm tauri build`.
