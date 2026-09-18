//! The `.cpshow` archive engine.
//!
//! A `.cpshow` file is a ZIP container:
//!
//! ```text
//! show.json            the full Show document, with archive-relative asset paths
//! media/<name>         every referenced image / video / audio / presentation
//! fonts/<name>         font binaries backing the document's @font-face records
//! ```
//!
//! Export rewrites every absolute path in the document down to an
//! archive-relative one, so a show opens identically on a machine that has
//! never seen the original media. Import reverses the mapping against a cache
//! directory under the app data root.
//!
//! All filesystem and compression work happens on a blocking worker thread via
//! `spawn_blocking`, so a multi-gigabyte service export never stalls the
//! operator UI.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::model::{Background, Layer, MediaKind, Show, SHOW_SCHEMA_VERSION};

const SHOW_ENTRY: &str = "show.json";
const MEDIA_DIR: &str = "media";
const FONT_DIR: &str = "fonts";

/// A `.cpshow` document is at most a few MB of JSON. Bounding the declared
/// size before allocating stops a crafted zip header from forcing a
/// multi-gigabyte allocation (OOM). The uncompressed size in a zip header is
/// attacker-controlled, so it must never be trusted as a Vec capacity.
const MAX_SHOW_JSON_BYTES: u64 = 32 * 1024 * 1024;

/// Upper bound on total bytes extracted from one archive. Media can be large,
/// but a small crafted archive must not be able to fill the disk.
const MAX_EXTRACT_TOTAL_BYTES: u64 = 32 * 1024 * 1024 * 1024;

/// Import cache directories untouched for this long are swept on the next
/// import, so repeated imports don't accumulate unbounded app data.
const IMPORT_CACHE_MAX_AGE_DAYS: u64 = 30;

/// Age out old `.cpshow` extraction cache directories (uuid-named dirs under
/// the shows cache root), best effort.
fn cleanup_import_cache(cache_root: &Path) {
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(IMPORT_CACHE_MAX_AGE_DAYS * 24 * 60 * 60))
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
    let Ok(entries) = fs::read_dir(cache_root) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if let Ok(meta) = entry.metadata() {
            if meta.is_dir() {
                if let Ok(modified) = meta.modified() {
                    if modified < cutoff {
                        let _ = fs::remove_dir_all(path);
                    }
                }
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExportReport {
    pub path: String,
    pub bytes_written: u64,
    pub media_embedded: usize,
    pub fonts_embedded: usize,
    /// Assets that could not be found on disk. The show still exports; these
    /// references are preserved verbatim so a re-link can fix them later.
    pub missing_assets: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub show: Show,
    pub cache_dir: String,
    pub media_extracted: usize,
    pub fonts_extracted: usize,
}

/// Formats that are already entropy-coded. Re-deflating them burns CPU for
/// ~0% gain, so they are stored raw and the export finishes far faster.
fn is_precompressed(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    const EXTS: [&str; 16] = [
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".m4v", ".mov", ".mkv", ".webm", ".avi",
        ".mp3", ".m4a", ".aac", ".ogg", ".woff2",
    ];
    EXTS.iter().any(|e| lower.ends_with(e))
}

fn options_for(path: &str) -> SimpleFileOptions {
    let method = if is_precompressed(path) {
        CompressionMethod::Stored
    } else {
        CompressionMethod::Deflated
    };
    SimpleFileOptions::default()
        .compression_method(method)
        .large_file(true)
}

/// Strip anything that could escape the extraction root when a hostile or
/// simply malformed archive is opened. Returns `None` for entries that must be
/// ignored outright.
fn sanitize_entry_name(name: &str) -> Option<PathBuf> {
    let mut out = PathBuf::new();
    for part in name.split(['/', '\\']) {
        match part {
            "" | "." => continue,
            ".." => return None,
            p if p.contains(':') => return None,
            p => out.push(p),
        }
    }
    if out.as_os_str().is_empty() {
        None
    } else {
        Some(out)
    }
}

/// Allocate a collision-free name inside the archive for `source`.
fn archive_name(source: &Path, taken: &mut HashMap<String, ()>) -> String {
    let stem = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("asset")
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();
    let ext = source
        .extension()
        .and_then(|s| s.to_str())
        .map(|e| format!(".{}", e.to_ascii_lowercase()))
        .unwrap_or_default();

    let mut candidate = format!("{stem}{ext}");
    let mut n = 1u32;
    while taken.contains_key(&candidate) {
        candidate = format!("{stem}-{n}{ext}");
        n += 1;
    }
    taken.insert(candidate.clone(), ());
    candidate
}

/// Every asset path referenced anywhere in the document, in document order.
fn collect_asset_paths(show: &Show) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut push = |p: &str| {
        if !p.is_empty() && !p.starts_with("http://") && !p.starts_with("https://") {
            out.push(p.to_string());
        }
    };

    for item in &show.items {
        if let Some(bg) = &item.background {
            if let Some(s) = bg.src() {
                push(s);
            }
        }
        for slide in &item.slides {
            if let Some(bg) = &slide.background {
                if let Some(s) = bg.src() {
                    push(s);
                }
            }
            for layer in &slide.layers {
                if let Some(s) = layer.src() {
                    push(s);
                }
            }
        }
    }
    for asset in &show.media {
        if asset.kind != MediaKind::Url {
            push(&asset.path);
        }
    }
    out
}

/// Apply `map` (absolute path -> new path) across every asset reference.
fn rewrite_asset_paths(show: &mut Show, map: &HashMap<String, String>) {
    fn rewrite_bg(bg: &mut Background, map: &HashMap<String, String>) {
        if let Some(src) = bg.src() {
            if let Some(next) = map.get(src) {
                bg.set_src(next.clone());
            }
        }
    }

    for item in &mut show.items {
        if let Some(bg) = &mut item.background {
            rewrite_bg(bg, map);
        }
        for slide in &mut item.slides {
            if let Some(bg) = &mut slide.background {
                rewrite_bg(bg, map);
            }
            for layer in &mut slide.layers {
                if let Layer::Image { src, .. } = layer {
                    if let Some(next) = map.get(src.as_str()) {
                        *src = next.clone();
                    }
                }
            }
        }
    }
    for asset in &mut show.media {
        if asset.kind == MediaKind::Url {
            continue;
        }
        if let Some(next) = map.get(&asset.path) {
            asset.path = next.clone();
        }
    }
}

fn write_entry(zip: &mut ZipWriter<BufWriter<File>>, name: &str, source: &Path) -> std::io::Result<()> {
    zip.start_file(name, options_for(name))?;
    let mut reader = BufReader::with_capacity(1 << 20, File::open(source)?);
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        zip.write_all(&buf[..n])?;
    }
    Ok(())
}

fn export_blocking(mut show: Show, dest: PathBuf) -> Result<ExportReport, String> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("cannot create {}: {e}", parent.display()))?;
    }

    let file = File::create(&dest).map_err(|e| format!("cannot write {}: {e}", dest.display()))?;
    let mut zip = ZipWriter::new(BufWriter::with_capacity(1 << 20, file));

    let mut taken: HashMap<String, ()> = HashMap::new();
    let mut path_map: HashMap<String, String> = HashMap::new();
    let mut missing: Vec<String> = Vec::new();
    let mut media_count = 0usize;

    // ---- media -----------------------------------------------------------
    for original in collect_asset_paths(&show) {
        if path_map.contains_key(&original) {
            continue;
        }
        // Already archive-relative (re-exporting an imported show whose cache
        // was cleared) — leave it alone.
        if original.starts_with(&format!("{MEDIA_DIR}/")) {
            continue;
        }

        let source = PathBuf::from(&original);
        if !source.is_file() {
            missing.push(original);
            continue;
        }

        let name = archive_name(&source, &mut taken);
        let entry = format!("{MEDIA_DIR}/{name}");
        write_entry(&mut zip, &entry, &source)
            .map_err(|e| format!("cannot embed {}: {e}", source.display()))?;
        path_map.insert(original, entry);
        media_count += 1;
    }

    // ---- fonts -----------------------------------------------------------
    let mut font_count = 0usize;
    let mut font_taken: HashMap<String, ()> = HashMap::new();
    for font in &mut show.fonts {
        let source = PathBuf::from(&font.file_name);
        if !source.is_file() {
            // A family that resolves from the OS font book needs no binary.
            continue;
        }
        let name = archive_name(&source, &mut font_taken);
        let entry = format!("{FONT_DIR}/{name}");
        write_entry(&mut zip, &entry, &source)
            .map_err(|e| format!("cannot embed font {}: {e}", source.display()))?;
        font.file_name = entry;
        font_count += 1;
    }

    // ---- document --------------------------------------------------------
    rewrite_asset_paths(&mut show, &path_map);
    show.schema_version = SHOW_SCHEMA_VERSION;
    show.app_version = env!("CARGO_PKG_VERSION").into();

    let json = serde_json::to_vec_pretty(&show).map_err(|e| format!("cannot serialise show: {e}"))?;
    zip.start_file(SHOW_ENTRY, options_for(SHOW_ENTRY))
        .map_err(|e| format!("cannot write show.json: {e}"))?;
    zip.write_all(&json)
        .map_err(|e| format!("cannot write show.json: {e}"))?;

    let inner = zip.finish().map_err(|e| format!("cannot finalise archive: {e}"))?;
    inner
        .into_inner()
        .map_err(|e| format!("cannot flush archive: {e}"))?
        .sync_all()
        .map_err(|e| format!("cannot flush archive: {e}"))?;

    let bytes_written = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);

    Ok(ExportReport {
        path: dest.to_string_lossy().into_owned(),
        bytes_written,
        media_embedded: media_count,
        fonts_embedded: font_count,
        missing_assets: missing,
    })
}

fn import_blocking(source: PathBuf, cache_root: PathBuf) -> Result<ImportReport, String> {
    let file = File::open(&source).map_err(|e| format!("cannot open {}: {e}", source.display()))?;
    let mut zip = ZipArchive::new(BufReader::with_capacity(1 << 20, file))
        .map_err(|e| format!("{} is not a readable .cpshow archive: {e}", source.display()))?;

    // Each import gets its own cache directory keyed by a fresh id, so
    // re-importing an edited show never collides with the previous extraction.
    let cache_dir = cache_root.join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("cannot create cache dir {}: {e}", cache_dir.display()))?;

    let mut show_json: Option<Vec<u8>> = None;
    let mut media_extracted = 0usize;
    let mut fonts_extracted = 0usize;
    let mut path_map: HashMap<String, String> = HashMap::new();
    let mut total_extracted = 0u64;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| format!("corrupt archive entry {i}: {e}"))?;
        if entry.is_dir() {
            continue;
        }
        let raw_name = entry.name().to_string();
        let declared = entry.size();

        if raw_name == SHOW_ENTRY {
            if declared > MAX_SHOW_JSON_BYTES {
                return Err(format!(
                    "show.json is {declared} bytes — refusing to read more than {MAX_SHOW_JSON_BYTES}"
                ));
            }
            let mut buf = Vec::with_capacity(declared as usize);
            entry.read_to_end(&mut buf).map_err(|e| format!("cannot read show.json: {e}"))?;
            show_json = Some(buf);
            continue;
        }

        let Some(rel) = sanitize_entry_name(&raw_name) else {
            // Path-traversal attempt or unusable name — skip it rather than
            // aborting the whole import.
            continue;
        };

        let is_media = raw_name.starts_with(&format!("{MEDIA_DIR}/"));
        let is_font = raw_name.starts_with(&format!("{FONT_DIR}/"));
        if !is_media && !is_font {
            continue;
        }

        if declared > MAX_EXTRACT_TOTAL_BYTES {
            return Err(format!(
                "entry '{raw_name}' declares {declared} bytes — larger than the {} byte import limit",
                MAX_EXTRACT_TOTAL_BYTES
            ));
        }

        let dest = cache_dir.join(&rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("cannot create {}: {e}", parent.display()))?;
        }

        let mut out = BufWriter::with_capacity(1 << 20, File::create(&dest)
            .map_err(|e| format!("cannot extract {}: {e}", dest.display()))?);
        let written = std::io::copy(&mut entry, &mut out)
            .map_err(|e| format!("cannot extract {}: {e}", dest.display()))?;
        out.flush().map_err(|e| format!("cannot extract {}: {e}", dest.display()))?;

        total_extracted += written;
        if total_extracted > MAX_EXTRACT_TOTAL_BYTES {
            return Err(format!("archive expands past the {MAX_EXTRACT_TOTAL_BYTES} byte import limit"));
        }

        path_map.insert(raw_name, dest.to_string_lossy().into_owned());
        if is_media {
            media_extracted += 1;
        } else {
            fonts_extracted += 1;
        }
    }

    let json = show_json.ok_or_else(|| {
        format!("{} contains no show.json — it is not a CrossPresenter archive", source.display())
    })?;

    let mut show: Show = serde_json::from_slice(&json)
        .map_err(|e| format!("show.json is malformed: {e}"))?;

    if show.schema_version > SHOW_SCHEMA_VERSION {
        return Err(format!(
            "This show was saved by a newer version of CrossPresenter (format {}, this build reads {}). Update the app to open it.",
            show.schema_version, SHOW_SCHEMA_VERSION
        ));
    }

    // Point every reference at the freshly extracted file.
    rewrite_asset_paths(&mut show, &path_map);
    for font in &mut show.fonts {
        if let Some(next) = path_map.get(&font.file_name) {
            font.file_name = next.clone();
        }
    }

    Ok(ImportReport {
        show,
        cache_dir: cache_dir.to_string_lossy().into_owned(),
        media_extracted,
        fonts_extracted,
    })
}

/// Package the active service into a compressed `.cpshow` archive.
#[tauri::command]
pub async fn export_show(show: Show, dest_path: String) -> Result<ExportReport, String> {
    let dest = PathBuf::from(dest_path);
    tauri::async_runtime::spawn_blocking(move || export_blocking(show, dest))
        .await
        .map_err(|e| format!("export task failed: {e}"))?
}

/// Read a `.cpshow` archive, extract its assets into the app cache, and return
/// the restored document with every path re-linked.
#[tauri::command]
pub async fn import_show(app: AppHandle, source_path: String) -> Result<ImportReport, String> {
    let cache_root = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("no cache directory available: {e}"))?
        .join("shows");

    let source = PathBuf::from(source_path);
    let root = cache_root.clone();
    tauri::async_runtime::spawn_blocking(move || {
        cleanup_import_cache(&root);
        import_blocking(source, root)
    })
    .await
    .map_err(|e| format!("import task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_traversal_entries() {
        assert!(sanitize_entry_name("../../etc/passwd").is_none());
        assert!(sanitize_entry_name("media/../../x").is_none());
        assert_eq!(
            sanitize_entry_name("media/bg.jpg").unwrap(),
            PathBuf::from("media").join("bg.jpg")
        );
    }

    #[test]
    fn dedupes_archive_names() {
        let mut taken = HashMap::new();
        let a = archive_name(Path::new("/a/logo.png"), &mut taken);
        let b = archive_name(Path::new("/b/logo.png"), &mut taken);
        assert_eq!(a, "logo.png");
        assert_eq!(b, "logo-1.png");
    }

    #[test]
    fn stores_precompressed_media_raw() {
        assert!(is_precompressed("media/clip.MP4"));
        assert!(!is_precompressed("media/deck.pptx"));
    }
}
