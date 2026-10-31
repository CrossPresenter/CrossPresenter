//! Multi-monitor discovery and live-output projection.
//!
//! Physical display enumeration goes through Tauri's monitor APIs, which wrap
//! the platform window server (Win32 `EnumDisplayMonitors`, `NSScreen`,
//! Wayland/X11 outputs). The operator display is filtered out of the
//! projection candidates so a stray click can never mirror the control surface
//! onto the house screen.
//!
//! Live windows are borderless, undecorated, always-on-top webviews positioned
//! over the target monitor's work area (the panel minus the taskbar and other
//! reserved edges). They share the SPA bundle with the operator window and
//! identify their role from the window label prefix, which avoids a second HTML
//! entry point and keeps first paint on the GPU path.

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, LogicalSize, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

/// Window label prefix for projection outputs. The frontend matches on this to
/// decide whether to mount the operator shell or the bare live canvas.
pub const LIVE_LABEL_PREFIX: &str = "live-";
/// Window label prefix for the interactive browser-deck modal.
pub const BROWSER_LABEL_PREFIX: &str = "browser-";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    /// Stable synthetic id derived from geometry. Platform monitor names are
    /// not unique (two identical panels often report the same string), so
    /// geometry is the reliable discriminator across a session.
    pub id: String,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
    /// True when a live window is currently projecting onto this monitor.
    pub is_projecting: bool,
}

fn slugify(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect()
}

/// A window-label-safe, session-stable id. Geometry alone is not a reliable
/// discriminator on the mirror/copy rigs common in worship setups (two
/// identical panels at the same position both report the same rect), so the
/// display name is folded in. Both halves are stable for a physical panel
/// during a session.
fn monitor_id(m: &Monitor) -> String {
    let p = m.position();
    let s = m.size();
    let name = match m.name() {
        Some(n) if !n.trim().is_empty() => slugify(n),
        _ => "display".to_string(),
    };
    format!("{name}:{}:{}:{}x{}", p.x, p.y, s.width, s.height)
}

fn monitor_name(m: &Monitor, index: usize) -> String {
    match m.name() {
        Some(n) if !n.trim().is_empty() => n.clone(),
        _ => format!("Display {}", index + 1),
    }
}

/// Label of the live window projecting onto `id`, if any.
fn live_label_for(id: &str) -> String {
    // Window labels may only contain ASCII letters, digits, '-' and '_'.
    // Monitor ids carry colons and 'x' (geometry), so sanitize them here.
    let safe: String = id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    format!("{LIVE_LABEL_PREFIX}{safe}")
}

/// Enumerate every physical display attached to the machine.
///
/// The primary display is included but flagged, so the UI can present it as
/// "Operator screen" and refuse to project onto it.
#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    // If the platform cannot tell us which panel is primary we must not guess:
    // guessing the wrong one could expose the operator surface as a projection
    // target. Fail loudly instead of falling back to an empty string.
    let primary_id = app
        .primary_monitor()
        .map_err(|e| format!("cannot determine primary display: {e}"))?
        .map(|m| monitor_id(&m))
        .ok_or_else(|| "no primary display detected".to_string())?;

    Ok(monitors
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let id = monitor_id(m);
            let p = m.position();
            let s = m.size();
            MonitorInfo {
                is_primary: id == primary_id,
                is_projecting: app.get_webview_window(&live_label_for(&id)).is_some(),
                name: monitor_name(m, i),
                x: p.x,
                y: p.y,
                width: s.width,
                height: s.height,
                scale_factor: m.scale_factor(),
                id,
            }
        })
        .collect())
}

/// Secondary displays only — the set that is legal to project onto.
///
/// When the machine has exactly one display, this returns empty: the caller is
/// expected to fall back to a windowed preview rather than covering the
/// operator's own screen.
#[tauri::command]
pub fn list_projection_targets(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    Ok(list_monitors(app)?
        .into_iter()
        .filter(|m| !m.is_primary)
        .collect())
}

fn find_monitor(app: &AppHandle, id: &str) -> Result<(PhysicalPosition<i32>, PhysicalSize<u32>), String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    monitors
        .iter()
        .find(|m| monitor_id(m) == id)
        .map(|m| (*m.position(), *m.size()))
        .ok_or_else(|| format!("display '{id}' is no longer attached"))
}

/// The usable area of the display at `pos`/`size` — the panel minus any
/// reserved edges such as the taskbar.
///
/// A true Windows fullscreen window always paints over a transparent taskbar.
/// Sizing a borderless window to this rectangle keeps the audience canvas
/// above the taskbar's top edge instead of underneath it, for any taskbar
/// position (top, bottom, left or right).
#[cfg(target_os = "windows")]
fn monitor_work_area(
    pos: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> Option<(PhysicalPosition<i32>, PhysicalSize<u32>)> {
    use windows::Win32::Foundation::{POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    // The display containing the panel's centre is the one we want, even when
    // two panels overlap or sit at negative coordinates.
    let centre = POINT {
        x: pos.x.saturating_add(size.width as i32 / 2),
        y: pos.y.saturating_add(size.height as i32 / 2),
    };

    unsafe {
        let monitor = MonitorFromPoint(centre, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            rcMonitor: RECT { left: 0, top: 0, right: 0, bottom: 0 },
            rcWork: RECT { left: 0, top: 0, right: 0, bottom: 0 },
            dwFlags: 0,
        };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return None;
        }
        let width = info.rcWork.right.saturating_sub(info.rcWork.left) as u32;
        let height = info.rcWork.bottom.saturating_sub(info.rcWork.top) as u32;
        if width == 0 || height == 0 {
            return None;
        }
        Some((
            PhysicalPosition::new(info.rcWork.left, info.rcWork.top),
            PhysicalSize::new(width, height),
        ))
    }
}

#[cfg(not(target_os = "windows"))]
fn monitor_work_area(
    pos: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> Option<(PhysicalPosition<i32>, PhysicalSize<u32>)> {
    Some((pos, size))
}

/// Keep the operator window inside the display's usable area.
///
/// The window is configured at a fixed size in *logical* pixels (1600×980). On
/// a 1080p panel at 125–150% scaling — or on a 768p panel — that is physically
/// larger than the screen, so the bottom of the window, including its bottom
/// bar, is pushed underneath the taskbar. Shrink only when it does not fit,
/// lower the minimum size to match the work area (so Windows can still
/// maximise the window at high scaling) and re-centre it above the taskbar.
pub fn fit_operator_window(window: &WebviewWindow) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else { return };

    let Some((work_pos, work_size)) = monitor_work_area(*monitor.position(), *monitor.size()) else {
        return;
    };

    let (Ok(inner), Ok(outer)) = (window.inner_size(), window.outer_size()) else {
        return;
    };
    // Title bar and borders sit outside the client area, so reserve room for
    // them when fitting the window into the work area.
    let chrome_w = outer.width.saturating_sub(inner.width);
    let chrome_h = outer.height.saturating_sub(inner.height);
    let max_w = work_size.width.saturating_sub(chrome_w).max(1);
    let max_h = work_size.height.saturating_sub(chrome_h).max(1);

    // A minimum size can itself be taller than the work area at high scaling
    // (700 logical px at 150% is 1050 physical on a 1080p panel). Lower it so
    // the OS cannot force the window back underneath the taskbar.
    let scale = monitor.scale_factor();
    let min_w = ((max_w as f64 / scale).floor() as u32).clamp(320, 1180);
    let min_h = ((max_h as f64 / scale).floor() as u32).clamp(240, 700);
    let _ = window.set_min_size(Some(LogicalSize::new(min_w as f64, min_h as f64)));

    let target_w = inner.width.min(max_w);
    let target_h = inner.height.min(max_h);
    if target_w != inner.width || target_h != inner.height {
        let _ = window.set_size(PhysicalSize::new(target_w, target_h));
    }

    // Centre the visual window (client area + chrome) inside the usable area,
    // which starts above the taskbar rather than at the panel origin.
    let outer_w = target_w + chrome_w;
    let outer_h = target_h + chrome_h;
    let x = work_pos.x + (work_size.width.saturating_sub(outer_w) / 2) as i32;
    let y = work_pos.y + (work_size.height.saturating_sub(outer_h) / 2) as i32;
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

/// Project the live canvas onto a secondary display as a borderless window
/// covering that display's work area.
///
/// Refuses to target the primary display. If a live window already exists for
/// this monitor it is focused rather than duplicated.
///
/// Deliberately *not* async: Tauri runs sync commands with an `AppHandle` on
/// the main thread, which is where webview windows must be created anyway.
#[tauri::command]
pub fn open_live_output(app: AppHandle, monitor_id: String) -> Result<String, String> {
    let all = list_monitors(app.clone())?;
    let target = all
        .iter()
        .find(|m| m.id == monitor_id)
        .ok_or_else(|| format!("display '{monitor_id}' is no longer attached"))?;

    if target.is_primary {
        return Err(
            "Refusing to project onto the operator display. Connect a second screen or use the preview.".into(),
        );
    }

    let label = live_label_for(&monitor_id);
    if let Some(existing) = app.get_webview_window(&label) {
        existing.show().map_err(|e| format!("could not show live window: {e}"))?;
        existing.set_focus().map_err(|e| format!("could not focus live window: {e}"))?;
        return Ok(label);
    }

    let (pos, size) = find_monitor(&app, &monitor_id)?;
    // Windows fullscreen always paints underneath a transparent taskbar, so
    // project into the display's work area: the canvas then stops at the
    // taskbar edge instead of disappearing behind it.
    let (pos, size) = monitor_work_area(pos, size).unwrap_or((pos, size));

    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title("CrossPresenter Live")
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        // Position first at physical coordinates, then size to the work area.
        // Doing this at build time avoids a visible frame at the wrong origin.
        .position(pos.x as f64, pos.y as f64)
        .inner_size(size.width as f64, size.height as f64)
        .visible(false)
        .build()
        .map_err(|e| format!("could not create live window: {e}"))?;

    // Physical placement must be re-applied after creation: builder coordinates
    // are logical, so on a display with a scale factor other than 1.0 the
    // window would land short of the panel origin.
    window
        .set_position(pos)
        .map_err(|e| format!("could not position live window: {e}"))?;
    window
        .set_size(size)
        .map_err(|e| format!("could not size live window: {e}"))?;

    // The audience must never see the operator's pointer. CSS `cursor: none`
    // covers the document; this covers the window chrome and the moment before
    // first paint.
    window
        .set_cursor_visible(false)
        .map_err(|e| format!("could not hide cursor on live window: {e}"))?;
    window
        .show()
        .map_err(|e| format!("could not show live window: {e}"))?;

    Ok(label)
}

/// Tear down the live window for a specific monitor.
#[tauri::command]
pub fn close_live_output(app: AppHandle, monitor_id: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(&live_label_for(&monitor_id)) {
        w.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Tear down every live window. Bound to the "Go Live" toggle turning off and
/// used as a safety net on shutdown. Every window is attempted even if some
/// closes fail, so a single stuck webview cannot leave the auditorium lit.
#[tauri::command]
pub fn close_all_live_outputs(app: AppHandle) -> Result<usize, String> {
    let labels: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|l| l.starts_with(LIVE_LABEL_PREFIX))
        .cloned()
        .collect();

    let count = labels.len();
    let mut failures: Vec<String> = Vec::new();
    for label in labels {
        if let Some(w) = app.get_webview_window(&label) {
            if let Err(e) = w.close() {
                failures.push(format!("{label}: {e}"));
            }
        }
    }
    if let Some(first) = failures.first() {
        return Err(format!(
            "{first} — {} live window(s) may still be open",
            failures.len()
        ));
    }
    Ok(count)
}

/// Labels of all currently open live windows.
#[tauri::command]
pub fn active_live_outputs(app: AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .filter(|l| l.starts_with(LIVE_LABEL_PREFIX))
        .cloned()
        .collect()
}

/// Open an interactive webview for the Browser deck.
///
/// This window is for the *operator*: it accepts clicks, scrolling and text
/// entry. What the audience sees is driven separately by the live windows, so
/// the operator can navigate to the right part of a page before sending it out.
#[tauri::command]
pub async fn open_browser_window(
    app: AppHandle,
    url: String,
    asset_id: String,
) -> Result<String, String> {
    let parsed: tauri::Url = url
        .parse()
        .map_err(|_| format!("'{url}' is not a valid URL"))?;

    match parsed.scheme() {
        "http" | "https" => {}
        other => return Err(format!("refusing to open '{other}://' — only http and https are allowed")),
    }

    // Window labels must be filesystem-safe; the asset id is a nanoid.
    let label = format!("{BROWSER_LABEL_PREFIX}{asset_id}");
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(label);
    }

    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed))
        .title(format!("Browser — {url}"))
        .inner_size(1280.0, 800.0)
        .min_inner_size(480.0, 360.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| format!("could not open browser window: {e}"))?;

    let _ = window.set_size(LogicalSize::new(1280.0, 800.0));
    Ok(label)
}

#[tauri::command]
pub fn close_browser_window(app: AppHandle, asset_id: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(&format!("{BROWSER_LABEL_PREFIX}{asset_id}")) {
        w.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
