//! CrossPresenter — Rust core.
//!
//! Everything expensive lives here: filesystem traversal, ZIP compression,
//! SQLite and XML parsing, OOXML unpacking, image decoding and monitor
//! enumeration. The webview is left to do nothing but composite, which is what
//! keeps the operator UI pinned at display refresh rate while a
//! multi-thousand-song import runs.

pub mod archive;
pub mod bible;
pub mod importers;
pub mod model;
pub mod monitors;
pub mod pptx;

/// Build and run the desktop application.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Monitors + projection
            monitors::list_monitors,
            monitors::list_projection_targets,
            monitors::open_live_output,
            monitors::close_live_output,
            monitors::close_all_live_outputs,
            monitors::active_live_outputs,
            monitors::open_browser_window,
            monitors::close_browser_window,
            // Archive engine
            archive::export_show,
            archive::import_show,
            // Song import engine
            importers::import_songs,
            importers::list_supported_song_formats,
            // PPTX text extraction
            pptx::extract_pptx_slides,
            // Bible module
            bible::import_bible_translation,
            bible::list_bible_translations,
            bible::get_bible_translation,
            bible::remove_bible_translation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CrossPresenter");
}
