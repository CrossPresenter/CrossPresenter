// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Works around a WebView2 GPU-compositor bug (common on hybrid-GPU laptops
    // and some Intel iGPU driver versions) where the window paints once and
    // then goes solid black on every load/reload. Must be set before the
    // WebView2 environment is created.
    #[cfg(target_os = "windows")]
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-gpu");

    crosspresenter_lib::run()
}
