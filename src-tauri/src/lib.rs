use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_store::StoreExt;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpStream, UdpSocket};
use tokio::sync::Mutex as AsyncMutex;

// State to hold the write half of the TCP stream
struct ConnectionState {
    writer: Arc<AsyncMutex<Option<tokio::net::tcp::OwnedWriteHalf>>>,
}

#[derive(serde::Serialize)]
struct NetworkInterface {
    name: String,
    ip: String,
}

#[tauri::command]
async fn get_network_interfaces() -> Result<Vec<NetworkInterface>, String> {
    let interfaces = get_if_addrs::get_if_addrs().map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for iface in interfaces {
        if iface.is_loopback() {
            continue;
        }
        if let get_if_addrs::IfAddr::V4(addr) = iface.addr {
            list.push(NetworkInterface {
                name: iface.name,
                ip: addr.ip.to_string(),
            });
        }
    }
    Ok(list)
}

const HEOS_BROADCAST_ADDR: &str = "239.255.255.250";
const HEOS_PORT: u16 = 1900;

#[tauri::command]
async fn discover_speakers(app: AppHandle) -> Result<(), String> {
    // Check for a preferred network interface in settings
    let preferred_ip = app.store("settings.json").ok().and_then(|store| {
        store
            .get("preferred_interface")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
    });

    let local_ip = if let Some(ip) = preferred_ip {
        if ip != "auto" {
            ip.parse()
                .map_err(|_| "Invalid IP in settings".to_string())?
        } else {
            // Determine valid local IP by "connecting" to an external address
            match UdpSocket::bind("0.0.0.0:0").await {
                Ok(s) => {
                    if s.connect("8.8.8.8:80").await.is_ok() {
                        s.local_addr()
                            .ok()
                            .map(|a| a.ip())
                            .unwrap_or("0.0.0.0".parse().unwrap())
                    } else {
                        "0.0.0.0".parse().unwrap() // Fallback
                    }
                }
                Err(_) => "0.0.0.0".parse().unwrap(),
            }
        }
    } else {
        // Determine valid local IP by "connecting" to an external address
        match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => {
                if s.connect("8.8.8.8:80").await.is_ok() {
                    s.local_addr()
                        .ok()
                        .map(|a| a.ip())
                        .unwrap_or("0.0.0.0".parse().unwrap())
                } else {
                    "0.0.0.0".parse().unwrap() // Fallback
                }
            }
            Err(_) => "0.0.0.0".parse().unwrap(),
        }
    };

    println!("Determined local IP: {}", local_ip);

    // Helper macro to emit debug logs
    let app_log = app.clone();
    let log = move |msg: String| {
        let _ = app_log.emit("heos-debug", msg);
    };

    // Try to bind to local IP first
    let socket = match UdpSocket::bind(SocketAddr::new(local_ip, 0)).await {
        Ok(s) => s,
        Err(e) => {
            log(format!(
                "Failed to bind to local IP: {}. Falling back to 0.0.0.0",
                e
            ));
            UdpSocket::bind("0.0.0.0:0")
                .await
                .map_err(|e| e.to_string())?
        }
    };

    socket.set_broadcast(true).map_err(|e| e.to_string())?;

    let socket = Arc::new(socket);
    let recv_socket = socket.clone();
    let app_handle = app.clone();
    let _log_recv = log.clone();

    // Spawn a listener task
    tauri::async_runtime::spawn(async move {
        let mut buf = [0u8; 2048];
        let start = std::time::Instant::now();
        let _ = app_handle.emit(
            "heos-debug",
            format!("Listening on {:?}...", recv_socket.local_addr()),
        );

        while start.elapsed() < Duration::from_secs(5) {
            match tokio::time::timeout(Duration::from_secs(1), recv_socket.recv_from(&mut buf))
                .await
            {
                Ok(Ok((len, addr))) => {
                    let resp = String::from_utf8_lossy(&buf[..len]);
                    if resp.contains("ST: urn:schemas-denon-com:device:ACT-Denon:1") {
                        let _ =
                            app_handle.emit("heos-debug", format!("Found device at {}", addr.ip()));
                        let _ = app_handle.emit("speaker-discovered", addr.ip().to_string());
                    }
                }
                Ok(Err(e)) => {
                    let _ = app_handle.emit("heos-debug", format!("UDP recv error: {}", e));
                }
                Err(_) => {}
            }
        }
        let _ = app_handle.emit("heos-debug", "Listener finished.".to_string());
    });

    tokio::time::sleep(Duration::from_millis(100)).await;

    let multicast_addr: SocketAddr = format!("{}:{}", HEOS_BROADCAST_ADDR, HEOS_PORT)
        .parse()
        .unwrap();

    let msg = format!(
        "M-SEARCH * HTTP/1.1\r\nHOST: {}:{}\r\nMAN: \"ssdp:discover\"\r\nST: urn:schemas-denon-com:device:ACT-Denon:1\r\nMX: 1\r\n\r\n",
        HEOS_BROADCAST_ADDR, HEOS_PORT
    );

    // Attempt to send
    if let Err(e) = socket.send_to(msg.as_bytes(), multicast_addr).await {
        log(format!("Send error ({}). Retrying with 0.0.0.0...", e));

        if let Ok(fallback_sock) = UdpSocket::bind("0.0.0.0:0").await {
            let _ = fallback_sock.set_broadcast(true);
            match fallback_sock.send_to(msg.as_bytes(), multicast_addr).await {
                Ok(_) => log("Fallback M-SEARCH sent successfully.".to_string()),
                Err(e) => log(format!("Fallback M-SEARCH failed: {}", e)),
            }

            let fb_recv = Arc::new(fallback_sock);
            let fb_app = app.clone();
            let _fb_log = log.clone();

            tauri::async_runtime::spawn(async move {
                let mut buf = [0u8; 2048];
                let start = std::time::Instant::now();
                let _ = fb_app.emit("heos-debug", "Fallback listener started.".to_string());

                while start.elapsed() < Duration::from_secs(5) {
                    match tokio::time::timeout(Duration::from_secs(1), fb_recv.recv_from(&mut buf))
                        .await
                    {
                        Ok(Ok((len, addr))) => {
                            let resp = String::from_utf8_lossy(&buf[..len]);
                            if resp.contains("ST: urn:schemas-denon-com:device:ACT-Denon:1") {
                                let _ = fb_app.emit("speaker-discovered", addr.ip().to_string());
                                let _ = fb_app.emit(
                                    "heos-debug",
                                    format!("Fallback found device at {}", addr.ip()),
                                );
                            }
                        }
                        Ok(Err(e)) => {
                            let _ = fb_app
                                .emit("heos-debug", format!("Fallback UDP recv error: {}", e));
                        }
                        Err(_) => {}
                    }
                }
                let _ = fb_app.emit("heos-debug", "Fallback listener finished.".to_string());
            });
        } else {
            log("Failed to bind fallback socket.".to_string());
            return Err(e.to_string());
        }
    } else {
        log(format!("Sent M-SEARCH to {}", multicast_addr));
    }

    Ok(())
}

#[tauri::command]
async fn connect_speaker(
    app: AppHandle,
    state: State<'_, ConnectionState>,
    ip: String,
) -> Result<(), String> {
    println!("Connecting to {}", ip);
    let stream = TcpStream::connect(format!("{}:1255", ip))
        .await
        .map_err(|e| e.to_string())?;

    println!("Connected!");
    let (reader, writer) = stream.into_split();

    // Store writer
    *state.writer.lock().await = Some(writer);

    // Spawn reader task
    tauri::async_runtime::spawn(async move {
        let mut reader = BufReader::new(reader);
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    println!("Connection closed by peer");
                    let _ = app.emit("heos-disconnected", ());
                    break;
                }
                Ok(_) => {
                    // Emit raw message
                    // println!("Received: {}", line);
                    let _ = app.emit("heos-message", line.clone());
                }
                Err(e) => {
                    println!("Error reading: {}", e);
                    let _ = app.emit("heos-error", e.to_string());
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn send_command(
    state: State<'_, ConnectionState>,
    command: String,
    args: Option<std::collections::HashMap<String, String>>,
) -> Result<(), String> {
    let mut cmd_str = format!("heos://{}", command);
    if let Some(args) = args {
        let query: Vec<String> = args.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
        if !query.is_empty() {
            cmd_str.push('?');
            cmd_str.push_str(&query.join("&"));
        }
    }
    cmd_str.push_str("\r\n");

    let mut writer_guard = state.writer.lock().await;
    if let Some(writer) = writer_guard.as_mut() {
        writer
            .write_all(cmd_str.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        writer.flush().await.map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Not connected".to_string())
    }
}

fn create_menu(app: &AppHandle, mode: &str) -> Result<Menu<tauri::Wry>, String> {
    // App Menu
    let app_menu = Submenu::with_items(
        app,
        "Heos Controller",
        true,
        &[
            &PredefinedMenuItem::about(app, None, None).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::services(app, None).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::hide(app, None).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::hide_others(app, None).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::quit(app, None).map_err(|e| e.to_string())?,
        ],
    )
    .map_err(|e| e.to_string())?;

    let devtools_i = MenuItem::with_id(
        app,
        "devtools",
        "Toggle Developer Tools",
        true,
        Some("CmdOrCtrl+Option+I"),
    )
    .map_err(|e| e.to_string())?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &PredefinedMenuItem::fullscreen(app, None).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
            &devtools_i,
        ],
    )
    .map_err(|e| e.to_string())?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None).map_err(|e| e.to_string())?,
            &PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Help Menu
    let doc_i = MenuItem::with_id(app, "doc", "Documentation", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let help_menu = Submenu::with_items(app, "Help", true, &[&doc_i]).map_err(|e| e.to_string())?;

    if mode == "settings" {
        let file_menu = Submenu::with_items(
            app,
            "File",
            true,
            &[&PredefinedMenuItem::close_window(app, None).map_err(|e| e.to_string())?],
        )
        .map_err(|e| e.to_string())?;

        let edit_menu = Submenu::with_items(
            app,
            "Edit",
            true,
            &[
                &PredefinedMenuItem::undo(app, None).map_err(|e| e.to_string())?,
                &PredefinedMenuItem::redo(app, None).map_err(|e| e.to_string())?,
                &PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?,
                &PredefinedMenuItem::cut(app, None).map_err(|e| e.to_string())?,
                &PredefinedMenuItem::copy(app, None).map_err(|e| e.to_string())?,
                &PredefinedMenuItem::paste(app, None).map_err(|e| e.to_string())?,
                &PredefinedMenuItem::select_all(app, None).map_err(|e| e.to_string())?,
            ],
        )
        .map_err(|e| e.to_string())?;

        Menu::with_items(
            app,
            &[
                &app_menu,
                &file_menu,
                &edit_menu,
                &view_menu,
                &window_menu,
                &help_menu,
            ],
        )
        .map_err(|e| e.to_string())
    } else {
        Menu::with_items(app, &[&app_menu, &view_menu, &window_menu, &help_menu])
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn set_menu_mode(app: AppHandle, mode: String) -> Result<(), String> {
    let menu = create_menu(&app, &mode)?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // Create initial menu
            let menu = create_menu(app.handle(), "default")?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                if event.id() == "doc" {
                    use tauri_plugin_opener::OpenerExt;
                    let _ = app.opener().open_url(
                        "https://github.com/cold-logic/heos-controller/wiki",
                        None::<&str>,
                    );
                }
                if event.id() == "devtools" {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_devtools_open() {
                            window.close_devtools();
                        } else {
                            window.open_devtools();
                        }
                    }
                }
            });

            Ok(())
        })
        .manage(ConnectionState {
            writer: Arc::new(AsyncMutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            discover_speakers,
            connect_speaker,
            send_command,
            get_network_interfaces,
            set_menu_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
