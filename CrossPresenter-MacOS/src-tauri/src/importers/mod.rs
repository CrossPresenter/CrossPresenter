//! The song import engine.
//!
//! Each supported application gets a reader that lowers its native format into
//! [`RawSong`]. From there a single conversion path applies canonical tag
//! mapping and slide splitting, so every import — regardless of origin — yields
//! service items that behave identically.
//!
//! Files are parsed in parallel with rayon. A library of several thousand songs
//! is dominated by per-file I/O and XML parsing, both of which scale nearly
//! linearly across cores, so batch imports finish in a fraction of the time a
//! serial pass would take.

pub mod json_formats;
pub mod sqlite_formats;
pub mod tags;
pub mod xml_formats;

use std::path::{Path, PathBuf};

use rayon::prelude::*;
use serde::{Deserialize, Serialize};

use crate::model::{ItemKind, ServiceItem, Slide, SongMeta};
use tags::{group_color, Section, DEFAULT_LINES_PER_SLIDE};

/// A song lowered out of its source format, before slide splitting.
#[derive(Debug, Clone, Default)]
pub struct RawSong {
    pub title: String,
    pub author: String,
    pub copyright: String,
    pub ccli: String,
    pub key: String,
    pub tempo: String,
    pub themes: Vec<String>,
    pub sections: Vec<Section>,
    /// Section labels in playback order, when the source records one.
    pub arrangement: Vec<String>,
    /// Human-readable name of the originating application.
    pub source: String,
}

/// Every format the engine can read, as reported to the UI.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FormatSupport {
    pub app: String,
    pub extensions: Vec<String>,
    pub notes: String,
}

/// The catalogue shown in the import dialog. Extensions here drive the native
/// file picker's filter list.
pub fn supported_formats() -> Vec<FormatSupport> {
    let f = |app: &str, exts: &[&str], notes: &str| FormatSupport {
        app: app.to_string(),
        extensions: exts.iter().map(|s| s.to_string()).collect(),
        notes: notes.to_string(),
    };

    vec![
        f("OpenLP", &["sqlite", "db", "xml", "osz"], "Song database and OpenLyrics exports."),
        f("OpenSong", &["xml", ""], "Extension-less song files are detected by content."),
        f("EasyWorship", &["db", "sqlite"], "EasyWorship 6/7 SQLite databases; RTF bodies are decoded."),
        f("Quelea", &["xml", "qsp"], "Song database and schedule exports."),
        f("VideoPsalm", &["json", "vps"], "Song library JSON."),
        f("FreeShow", &["fsh", "show", "json", "xml"], "Project and show files."),
        f("Holyrics", &["json", "sqlite", "db"], "Library exports and SQLite databases."),
        f("Faithlife Proclaim", &["xml", "proclaim"], "Presentation XML exports."),
        f("MediaShout", &["sqlite", "db"], "MediaShout 6/7 SQLite databases."),
        f("ShareFaith Presenter", &["xml", "json"], "Song exports."),
        f("WorshipTools Presenter", &["json", "xml"], "Song exports."),
        f("OpenLyrics", &["xml"], "The shared interchange format used by several apps."),
    ]
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/// Lower a [`RawSong`] into a service item, splitting each section into
/// projection-sized slides.
pub fn to_service_item(song: RawSong, lines_per_slide: usize, source_path: &str) -> ServiceItem {
    let item_id = uuid::Uuid::new_v4().to_string();
    let mut slides: Vec<Slide> = Vec::new();

    for section in &song.sections {
        let chunks = tags::split_section(&section.text, lines_per_slide);
        let multi = chunks.len() > 1;

        for (i, chunk) in chunks.into_iter().enumerate() {
            // Continuation slides are numbered so the operator can see that a
            // section spans more than one screen.
            let label = if multi {
                format!("{} ({})", section.label, i + 1)
            } else {
                section.label.clone()
            };
            let slide_id = format!("{item_id}-s{}", slides.len());
            let mut slide = Slide::from_text(slide_id, label, chunk);
            slide.group_color = group_color(&section.label).to_string();
            slides.push(slide);
        }
    }

    let title = if song.title.trim().is_empty() {
        Path::new(source_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled Song")
            .to_string()
    } else {
        song.title.clone()
    };

    ServiceItem {
        id: item_id,
        kind: ItemKind::Song,
        title,
        slides,
        meta: SongMeta {
            author: song.author,
            copyright: song.copyright,
            ccli: song.ccli,
            key: song.key,
            tempo: song.tempo,
            themes: song.themes,
            arrangement: song.arrangement,
            source: song.source,
        },
        background: None,
        color: String::new(),
        source_path: source_path.to_string(),
    }
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/// What kind of reader a path needs. Extension alone is not enough: `.db` is
/// used by three different applications and `.xml` by five, so detection sniffs
/// the file header and, for databases, the table list.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flavor {
    Sqlite,
    Xml,
    Json,
    /// A ZIP container holding one of the above (OpenLP `.osz`, Quelea `.qsp`).
    Zip,
    Unknown,
}

fn sniff(path: &Path) -> Flavor {
    use std::io::Read;

    let mut header = [0u8; 16];
    let read = read_head(path, &mut header);
    if read >= 16 && &header[..15] == b"SQLite format 3" {
        return Flavor::Sqlite;
    }
    if read >= 2 && &header[..2] == b"PK" {
        return Flavor::Zip;
    }

    // Text formats: find the first non-whitespace, non-BOM byte.
    let mut buf = Vec::new();
    if let Ok(mut f) = std::fs::File::open(path) {
        let mut limited = f.by_ref().take(4096);
        let _ = limited.read_to_end(&mut buf);
    }
    let text = String::from_utf8_lossy(&buf);
    let trimmed = text.trim_start_matches('\u{feff}').trim_start();

    if trimmed.starts_with('<') {
        return Flavor::Xml;
    }
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        return Flavor::Json;
    }
    Flavor::Unknown
}

/// Read up to `buf.len()` bytes from the head of `path`, returning the count.
fn read_head(path: &Path, buf: &mut [u8]) -> usize {
    use std::io::Read;
    match std::fs::File::open(path) {
        Ok(mut f) => f.read(buf).unwrap_or(0),
        Err(_) => 0,
    }
}

/// Which file kinds can possibly be songs. Everything else in a dropped folder
/// (binaries, logos, `.exe` files, stray documents) is ignored outright instead
/// of being opened and sniffed, which also keeps a folder walk from bubbling up
/// an error per unrelated file.
fn is_candidate(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
        return false;
    };
    // Editor/temp droppings are never songs.
    if name.starts_with('~') || name.starts_with(".$") || name.starts_with('.') {
        return false;
    }
    match path.extension().and_then(|s| s.to_str()) {
        // OpenSong songs are extension-less and detected by content.
        None => true,
        Some(ext) => matches!(
            ext.to_ascii_lowercase().as_str(),
            "xml" | "json" | "sqlite" | "db" | "osz" | "qsp" | "fsh" | "show" | "vps" | "proclaim"
        ),
    }
}

/// Generous cap for a song source file (song XML/JSON is a few KB; the
/// largest legitimate inputs are full song-library SQLite databases).
const MAX_SONG_FILE_BYTES: u64 = 512 * 1024 * 1024;

/// The backend returns at most this many per-file failures; the UI shows a
/// summary line and the first few, so a 10,000-file folder cannot flood it
/// (or the renderer) with one error per file.
const MAX_IMPORT_ERRORS: usize = 50;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ImportError {
    pub path: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ImportSongsReport {
    pub items: Vec<ServiceItem>,
    pub errors: Vec<ImportError>,
    pub files_scanned: usize,
    pub songs_imported: usize,
}

/// Read one file and return every song it contains.
fn read_file(path: &Path) -> Result<Vec<RawSong>, String> {
    let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    if size > MAX_SONG_FILE_BYTES {
        return Err(format!("file is too large ({size} bytes)"));
    }

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    match sniff(path) {
        Flavor::Sqlite => sqlite_formats::read(path),
        Flavor::Xml => xml_formats::read(path),
        Flavor::Json => json_formats::read(path),
        Flavor::Zip => xml_formats::read_zip(path),
        Flavor::Unknown => Err(format!(
            "Unrecognised file format (.{ext}). CrossPresenter reads SQLite databases, XML, JSON and zipped exports."
        )),
    }
}

/// Import songs from a set of files and/or directories.
///
/// Directories are walked recursively, which is how a whole OpenSong or
/// FreeShow library folder is absorbed in one action. Parsing runs across the
/// rayon thread pool; the UI thread is never involved.
#[tauri::command]
pub async fn import_songs(
    paths: Vec<String>,
    lines_per_slide: Option<usize>,
) -> Result<ImportSongsReport, String> {
    let per_slide = lines_per_slide.unwrap_or(DEFAULT_LINES_PER_SLIDE).clamp(1, 12);

    tauri::async_runtime::spawn_blocking(move || {
        // Expand directories into concrete files first so rayon sees a flat
        // work list and can balance across cores evenly.
        let mut files: Vec<PathBuf> = Vec::new();
        for raw in &paths {
            let p = PathBuf::from(raw);
            if p.is_dir() {
                for entry in walkdir::WalkDir::new(&p)
                    .max_depth(8)
                    .into_iter()
                    .filter_map(Result::ok)
                {
                    if entry.file_type().is_file() && is_candidate(&entry.path()) {
                        files.push(entry.into_path());
                    }
                }
            } else if p.is_file() {
                files.push(p);
            }
        }

        let files_scanned = files.len();

        let results: Vec<(PathBuf, Result<Vec<RawSong>, String>)> = files
            .into_par_iter()
            .map(|path| {
                let outcome = read_file(&path);
                (path, outcome)
            })
            .collect();

        let mut items = Vec::new();
        let mut errors = Vec::new();
        let mut suppressed = 0usize;

        for (path, outcome) in results {
            let display = path.to_string_lossy().into_owned();
            match outcome {
                Ok(songs) => {
                    for song in songs {
                        // A song with no lyrics at all is almost always a
                        // placeholder row in the source database, not content.
                        if song.sections.iter().all(|s| s.text.trim().is_empty()) {
                            continue;
                        }
                        items.push(to_service_item(song, per_slide, &display));
                    }
                }
                Err(message) => {
                    if errors.len() < MAX_IMPORT_ERRORS {
                        errors.push(ImportError { path: display, message });
                    } else {
                        suppressed += 1;
                    }
                }
            }
        }

        if suppressed > 0 {
            errors.push(ImportError {
                path: format!("… and {suppressed} more file(s)"),
                message: "additional files were skipped (see the full log next release)".into(),
            });
        }

        items.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
        let songs_imported = items.len();

        Ok(ImportSongsReport {
            items,
            errors,
            files_scanned,
            songs_imported,
        })
    })
    .await
    .map_err(|e| format!("import task failed: {e}"))?
}

/// The format catalogue, for the import dialog.
#[tauri::command]
pub fn list_supported_song_formats() -> Vec<FormatSupport> {
    supported_formats()
}
