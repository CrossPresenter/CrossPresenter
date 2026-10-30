//! Wireless remote-control server.
//!
//! The operator's phone connects over the LAN with a WebSocket. This module
//! owns the listener, pairing token, connected clients and the broadcast of
//! state snapshots. Command handling is deliberately thin: every command is
//! forwarded to the webview (`remote://command`) where it runs against the
//! same Zustand store the operator UI uses, and the webview publishes the
//! resulting state back through `remote_publish_state`. One source of truth.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, mpsc, Mutex, RwLock};
use tokio_tungstenite::tungstenite::Message;

const PROTOCOL: i64 = 1;
const DEFAULT_PORT: u16 = 37645;
const MAX_COMMANDS_PER_SECOND: u32 = 120;

#[derive(Serialize, Clone)]
pub struct RemoteInfo {
    pub running: bool,
    pub host: String,
    pub port: u16,
    pub token: String,
    pub pair_uri: String,
    pub addresses: Vec<String>,
    pub connected: usize,
}

pub struct RemoteManager(pub Arc<Mutex<Option<ServerState>>>);

struct Client {
    tx: mpsc::UnboundedSender<String>,
}

pub struct ServerState {
    port: u16,
    token: String,
    clients: Arc<Mutex<HashMap<u64, Client>>>,
    latest_state: Arc<RwLock<Option<String>>>,
    broadcast_tx: broadcast::Sender<String>,
    _task: tokio::task::JoinHandle<()>,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn list_addresses() -> Vec<String> {
    let mut addresses = Vec::new();
    if let Ok(ifaces) = if_addrs::get_if_addrs() {
        for iface in ifaces {
            if iface.is_loopback() {
                continue;
            }
            if let std::net::IpAddr::V4(ip) = iface.addr.ip() {
                addresses.push(ip.to_string());
            }
        }
    }
    if addresses.is_empty() {
        if let Ok(ip) = local_ip_address::local_ip() {
            if let std::net::IpAddr::V4(ip) = ip {
                addresses.push(ip.to_string());
            }
        }
    }
    addresses.sort();
    addresses.dedup();
    addresses
}

fn load_or_create(app: &AppHandle) -> Result<(String, u16), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).ok();
    let file = dir.join("remote.json");
    if file.exists() {
        if let Ok(contents) = std::fs::read_to_string(&file) {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&contents) {
                let token = value
                    .get("token")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let port = value.get("port").and_then(|v| v.as_u64()).map(|n| n as u16);
                if let (Some(token), Some(port)) = (token, port) {
                    return Ok((token, port));
                }
            }
        }
    }

    use rand::RngCore;
    let mut bytes = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, bytes);
    let port = DEFAULT_PORT;
    let json = serde_json::json!({ "token": token, "port": port });
    let _ = std::fs::write(&file, json.to_string());
    Ok((token, port))
}

fn save_token(app: &AppHandle, token: &str, port: u16) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).ok();
    let file = dir.join("remote.json");
    let json = serde_json::json!({ "token": token, "port": port });
    std::fs::write(&file, json.to_string()).map_err(|e| e.to_string())
}

fn query_param(uri: &str, key: &str) -> Option<String> {
    let query = uri.split('?').nth(1)?;
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let name = parts.next()?;
        let value = parts.next().unwrap_or("");
        if name == key {
            return Some(value.to_string());
        }
    }
    None
}

async fn build_info(state: &ServerState, _app: &AppHandle) -> RemoteInfo {
    let clients = state.clients.lock().await;
    let connected = clients.len();
    let addresses = list_addresses();
    let host = addresses.first().cloned().unwrap_or_else(|| "127.0.0.1".to_string());
    let pair_uri = format!(
        "crosspresenter://pair?host={}&port={}&token={}&name=CrossPresenter",
        host, state.port, state.token
    );
    RemoteInfo {
        running: true,
        host,
        port: state.port,
        token: state.token.clone(),
        pair_uri,
        addresses,
        connected,
    }
}

pub async fn start(app: AppHandle) -> Result<RemoteInfo, String> {
    let manager = app.state::<RemoteManager>();
    {
        let guard = manager.0.lock().await;
        if let Some(state) = guard.as_ref() {
            return Ok(build_info(state, &app).await);
        }
    }

    let (token, requested_port) = load_or_create(&app)?;

    // Find a free port in a small range so a stale process does not block us.
    let mut listener: Option<TcpListener> = None;
    let mut bound_port = requested_port;
    for port in requested_port..=requested_port.saturating_add(10) {
        if let Ok(bound) = TcpListener::bind(("0.0.0.0", port)).await {
            listener = Some(bound);
            bound_port = port;
            break;
        }
    }
    let listener = listener.ok_or_else(|| "Could not bind a remote-control port".to_string())?;

    let (broadcast_tx, _) = broadcast::channel::<String>(64);
    let clients: Arc<Mutex<HashMap<u64, Client>>> = Arc::new(Mutex::new(HashMap::new()));
    let latest_state: Arc<RwLock<Option<String>>> = Arc::new(RwLock::new(None));

    let clients_task = clients.clone();
    let latest_task = latest_state.clone();
    let broadcast_task = broadcast_tx.clone();
    let token_task = token.clone();
    let app_task = app.clone();

    let task = tokio::spawn(async move {
        let mut next_id: u64 = 1;
        loop {
            match listener.accept().await {
                Ok((stream, _addr)) => {
                    let client_id = next_id;
                    next_id = next_id.wrapping_add(1);
                    let clients = clients_task.clone();
                    let latest = latest_task.clone();
                    let broadcast_rx = broadcast_task.subscribe();
                    let app = app_task.clone();
                    let token = token_task.clone();
                    tokio::spawn(async move {
                        handle_connection(
                            stream,
                            client_id,
                            token,
                            clients,
                            latest,
                            broadcast_rx,
                            app,
                        )
                        .await;
                    });
                }
                Err(_) => {
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
            }
        }
    });

    let state = ServerState {
        port: bound_port,
        token: token.clone(),
        clients,
        latest_state,
        broadcast_tx,
        _task: task,
    };

    {
        let mut guard = manager.0.lock().await;
        *guard = Some(state);
    }

    let info_state_guard = manager.0.lock().await;
    let state_ref = info_state_guard.as_ref().unwrap();
    let info = build_info(state_ref, &app).await;
    drop(info_state_guard);
    Ok(info)
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    client_id: u64,
    token: String,
    clients: Arc<Mutex<HashMap<u64, Client>>>,
    latest_state: Arc<RwLock<Option<String>>>,
    mut broadcast_rx: broadcast::Receiver<String>,
    app: AppHandle,
) {
    use futures_util::{SinkExt, StreamExt};
    use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request};

    let ws_stream = match tokio_tungstenite::accept_hdr_async(stream, move |req: &Request, response| {
        let uri = req.uri().to_string();
        let provided = query_param(&uri, "token").unwrap_or_default();
        if provided != token {
            return Err(ErrorResponse::new(Some("unauthorized".to_string())));
        }
        Ok(response)
    })
    .await
    {
        Ok(s) => s,
        Err(_) => return,
    };

    let (mut write, mut read) = ws_stream.split();

    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    {
        let mut guard = clients.lock().await;
        guard.insert(client_id, Client { tx: tx.clone() });
    }

    // Hello.
    let hello = serde_json::json!({
        "type": "hello",
        "protocol": PROTOCOL,
        "appVersion": env!("CARGO_PKG_VERSION"),
        "serverName": "CrossPresenter",
        "capabilities": ["slide", "library", "audio", "overlay", "monitor"],
    });
    let _ = tx.send(hello.to_string());

    // Latest state, if we have one.
    if let Some(state) = latest_state.read().await.clone() {
        let _ = tx.send(state);
    }

    let _ = app.emit("remote://clients", clients.lock().await.len());

    // Writer task.
    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Also forward broadcast messages to this client.
    let tx_broadcast = tx.clone();
    let broadcast_forwarder = tokio::spawn(async move {
        while let Ok(msg) = broadcast_rx.recv().await {
            if tx_broadcast.send(msg).is_err() {
                break;
            }
        }
    });

    let mut cmd_count: u32 = 0;
    let mut window_start = Instant::now();

    while let Some(Ok(msg)) = read.next().await {
        match msg {
            Message::Text(text) => {
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                    match value.get("type").and_then(|v| v.as_str()) {
                        Some("ping") => {
                            let client_time =
                                value.get("t").and_then(|v| v.as_i64()).unwrap_or(0);
                            let pong = serde_json::json!({
                                "type": "pong",
                                "t": client_time,
                                "serverT": now_ms(),
                            });
                            let _ = tx.send(pong.to_string());
                        }
                        Some("cmd") => {
                            if window_start.elapsed() > Duration::from_secs(1) {
                                cmd_count = 0;
                                window_start = Instant::now();
                            }
                            cmd_count += 1;
                            if cmd_count > MAX_COMMANDS_PER_SECOND {
                                let err = serde_json::json!({
                                    "type": "err",
                                    "id": value.get("id").cloned().unwrap_or(serde_json::Value::Null),
                                    "code": "rate_limited",
                                    "message": "Too many commands. Slow down.",
                                });
                                let _ = tx.send(err.to_string());
                                break;
                            }

                            let id = value
                                .get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let seq = value.get("seq").and_then(|v| v.as_u64()).unwrap_or(0);
                            let action = value
                                .get("action")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let args = value.get("args").cloned().unwrap_or(serde_json::json!({}));

                            let payload = serde_json::json!({
                                "clientId": client_id,
                                "id": id,
                                "seq": seq,
                                "action": action,
                                "args": args,
                            });
                            let _ = app.emit("remote://command", payload);
                        }
                        _ => {}
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // Cleanup.
    {
        let mut guard = clients.lock().await;
        guard.remove(&client_id);
    }
    writer.abort();
    broadcast_forwarder.abort();
    let _ = app.emit("remote://clients", clients.lock().await.len());
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn remote_start(app: AppHandle) -> Result<RemoteInfo, String> {
    start(app).await
}

#[tauri::command]
pub async fn remote_info(app: AppHandle) -> Result<RemoteInfo, String> {
    let manager = app.state::<RemoteManager>();
    {
        let guard = manager.0.lock().await;
        if guard.is_some() {
            let state = guard.as_ref().unwrap();
            return Ok(build_info(state, &app).await);
        }
    }
    start(app).await
}

#[tauri::command]
pub async fn remote_regenerate_token(app: AppHandle) -> Result<RemoteInfo, String> {
    let manager = app.state::<RemoteManager>();

    // Disconnect every client first.
    {
        let guard = manager.0.lock().await;
        if let Some(state) = guard.as_ref() {
            let clients = state.clients.lock().await;
            for client in clients.values() {
                let _ = client.tx.send(
                    serde_json::json!({"type":"err","id":"","code":"replaced","message":"Pairing was rotated."})
                        .to_string(),
                );
            }
        }
    }

    // New token, same port.
    let port = {
        let guard = manager.0.lock().await;
        guard.as_ref().map(|s| s.port).unwrap_or(DEFAULT_PORT)
    };
    use rand::RngCore;
    let mut bytes = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, bytes);
    save_token(&app, &token, port)?;

    // Restart the server with the new token.
    {
        let mut guard = manager.0.lock().await;
        if let Some(state) = guard.take() {
            state._task.abort();
        }
    }
    start(app).await
}

#[tauri::command]
pub async fn remote_publish_state(app: AppHandle, state: String) -> Result<(), String> {
    let manager = app.state::<RemoteManager>();
    let guard = manager.0.lock().await;
    if let Some(server) = guard.as_ref() {
        *server.latest_state.write().await = Some(state.clone());
        let _ = server.broadcast_tx.send(state);
    }
    Ok(())
}

#[tauri::command]
pub async fn remote_publish_library(
    app: AppHandle,
    query_id: String,
    songs: String,
) -> Result<(), String> {
    let manager = app.state::<RemoteManager>();
    let guard = manager.0.lock().await;
    if let Some(server) = guard.as_ref() {
        let payload = serde_json::json!({
            "type": "library",
            "queryId": query_id,
            "songs": serde_json::from_str::<serde_json::Value>(&songs).unwrap_or(serde_json::json!([])),
        });
        let _ = server.broadcast_tx.send(payload.to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn remote_command_result(
    app: AppHandle,
    client_id: u64,
    id: String,
    seq: u64,
    ok: bool,
    error: Option<String>,
    rev: Option<u64>,
) -> Result<(), String> {
    let manager = app.state::<RemoteManager>();
    let guard = manager.0.lock().await;
    if let Some(server) = guard.as_ref() {
        let clients = server.clients.lock().await;
        if let Some(client) = clients.get(&client_id) {
            let msg = if ok {
                serde_json::json!({"type":"ack","id":id,"seq":seq,"rev":rev.unwrap_or(0)})
            } else {
                serde_json::json!({"type":"err","id":id,"code":"rejected","message":error.unwrap_or_else(|| "Command failed".to_string())})
            };
            let _ = client.tx.send(msg.to_string());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn remote_connected_count(app: AppHandle) -> Result<usize, String> {
    let manager = app.state::<RemoteManager>();
    let guard = manager.0.lock().await;
    if let Some(server) = guard.as_ref() {
        Ok(server.clients.lock().await.len())
    } else {
        Ok(0)
    }
}
