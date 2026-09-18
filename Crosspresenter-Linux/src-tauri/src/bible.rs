//! The Bible module's storage and import engine.
//!
//! CrossPresenter ships with no Scripture text at all — the same
//! bring-your-own-library principle the song importer follows, and the only
//! way to avoid bundling a translation under a license the operator never
//! agreed to. A translation is imported once from a Zefania XML file (the
//! format used by most free/public-domain modules in circulation), parsed
//! into a compact JSON shape, and cached under the app data directory so
//! every later launch is a plain file read instead of a re-parse.
//!
//! Storage layout, under `<app_data_dir>/bibles/`:
//! ```text
//! index.json        Vec<BibleTranslationSummary>, the catalogue shown in the UI
//! <id>.json         one full BibleTranslation per imported file
//! ```

use std::fs;
use std::path::{Path, PathBuf};

use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const INDEX_FILE: &str = "index.json";

/// Generous upper bounds for a real Bible module — Psalms has 150 chapters and
/// its longest chapter 176 verses. Clamping keeps a crafted `cnumber` /
/// `vnumber` attribute from forcing a multi-gigabyte `Vec::resize` (OOM) or an
/// index underflow, both of which would abort the process mid-service.
const MAX_BIBLE_CHAPTERS: usize = 200;
const MAX_BIBLE_VERSES: usize = 500;

/// Storage ids are UUIDs minted by this module. Restricting the accepted
/// charset keeps `{id}.json` from escaping the `bibles/` directory via `..`
/// or a path separator.
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Map a parsed 1-based Zefania index to a clamped 1-based count. Anything
/// outside `1..=max` (including a missing or zero attribute) falls back to the
/// next sequential position, so the result is always in `1..=max`.
fn bounded_index(parsed: Option<usize>, next: usize, max: usize) -> usize {
    match parsed {
        Some(n) if (1..=max).contains(&n) => n,
        _ => next.clamp(1, max),
    }
}

/// One book of a translation. `chapters[c][v]` is the text of chapter `c + 1`,
/// verse `v + 1` — both indices zero-based so the frontend can index straight
/// into the arrays without an off-by-one at every call site.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BibleBook {
    pub name: String,
    pub chapters: Vec<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BibleTranslation {
    pub id: String,
    pub name: String,
    pub language: String,
    pub books: Vec<BibleBook>,
}

/// The lightweight catalogue entry shown before a translation's full text is
/// fetched — cheap to list even when several large translations are installed.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BibleTranslationSummary {
    pub id: String,
    pub name: String,
    pub language: String,
    pub book_count: usize,
}

fn summarize(t: &BibleTranslation) -> BibleTranslationSummary {
    BibleTranslationSummary {
        id: t.id.clone(),
        name: t.name.clone(),
        language: t.language.clone(),
        book_count: t.books.len(),
    }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

fn bibles_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no data directory available: {e}"))?
        .join("bibles");
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create bible storage: {e}"))?;
    Ok(dir)
}

fn read_index(dir: &Path) -> Vec<BibleTranslationSummary> {
    let path = dir.join(INDEX_FILE);
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_index(dir: &Path, entries: &[BibleTranslationSummary]) -> Result<(), String> {
    let json = serde_json::to_string(entries).map_err(|e| format!("cannot encode index: {e}"))?;
    atomic_write(&dir.join(INDEX_FILE), &json)
}

/// Write via a temp file + rename so a crash mid-write can't leave a truncated
/// `index.json` (which would silently reset the catalogue to empty).
fn atomic_write(path: &Path, contents: &str) -> Result<(), String> {
    let tmp = path.with_file_name(format!(
        ".{}.{}.tmp",
        path.file_stem().and_then(|s| s.to_str()).unwrap_or("index"),
        uuid::Uuid::new_v4()
    ));
    fs::write(&tmp, contents).map_err(|e| format!("cannot write {}: {e}", tmp.display()))?;
    match fs::rename(&tmp, path) {
        Ok(_) => Ok(()),
        Err(_) if cfg!(windows) => {
            // Windows refuses to rename over an existing file, so replace it.
            let _ = fs::remove_file(path);
            fs::rename(&tmp, path).map_err(|e| format!("cannot replace {}: {e}", path.display()))
        }
        Err(e) => Err(format!("cannot replace {}: {e}", path.display())),
    }
}

fn translation_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.json"))
}

// ---------------------------------------------------------------------------
// Zefania XML parsing
// ---------------------------------------------------------------------------

fn read_source_text(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("cannot open: {e}"))?;
    if bytes.starts_with(&[0xFF, 0xFE]) || bytes.starts_with(&[0xFE, 0xFF]) {
        let (text, _, _) = encoding_rs::UTF_16LE.decode(&bytes);
        return Ok(text.into_owned());
    }
    match String::from_utf8(bytes.clone()) {
        Ok(s) => Ok(s),
        Err(_) => {
            let (text, _, _) = encoding_rs::WINDOWS_1252.decode(&bytes);
            Ok(text.into_owned())
        }
    }
}

fn attr_value(e: &quick_xml::events::BytesStart<'_>, key: &str) -> Option<String> {
    e.attributes().flatten().find_map(|a| {
        if a.key.as_ref().eq_ignore_ascii_case(key.as_bytes()) {
            a.unescape_value().ok().map(|v| v.into_owned())
        } else {
            None
        }
    })
}

fn ensure_len<T: Default + Clone>(v: &mut Vec<T>, len: usize) {
    if v.len() < len {
        v.resize(len, T::default());
    }
}

/// Parse a Zefania-XML Bible module (`<XMLBIBLE>` root, `<BIBLEBOOK>` /
/// `<CHAPTER>` / `<VERS>` elements). This is the format used by SWORD, MySword
/// and most freely redistributable public-domain modules.
fn parse_zefania(xml: &str, source_name: &str) -> Result<BibleTranslation, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut name = String::new();
    let mut language = String::new();
    let mut books: Vec<BibleBook> = Vec::new();

    let mut in_information = false;
    let mut info_field: Option<String> = None;

    let mut current_chapter: Option<usize> = None;
    let mut verse_number: Option<usize> = None;
    let mut verse_text = String::new();
    let mut in_verse = false;
    let mut verse_depth = 0u32;

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Err(e) => return Err(format!("malformed XML: {e}")),
            Ok(Event::Eof) => break,

            Ok(Event::Start(e)) => {
                let tag = e.local_name().as_ref().to_ascii_uppercase();
                let tag = String::from_utf8_lossy(&tag).into_owned();

                if in_verse {
                    verse_depth += 1;
                    continue;
                }

                match tag.as_str() {
                    "INFORMATION" => in_information = true,
                    "TITLE" if in_information => info_field = Some("title".into()),
                    "LANGUAGE" if in_information => info_field = Some("language".into()),
                    "BIBLEBOOK" => {
                        let book_name = attr_value(&e, "bname")
                            .or_else(|| attr_value(&e, "bsname"))
                            .unwrap_or_else(|| format!("Book {}", books.len() + 1));
                        books.push(BibleBook { name: book_name, chapters: Vec::new() });
                        current_chapter = None;
                    }
                    "CHAPTER" => {
                        let Some(book) = books.last_mut() else { continue };
                        let n = bounded_index(
                            attr_value(&e, "cnumber").and_then(|s| s.trim().parse().ok()),
                            book.chapters.len() + 1,
                            MAX_BIBLE_CHAPTERS,
                        );
                        ensure_len(&mut book.chapters, n);
                        current_chapter = Some(n - 1);
                    }
                    "VERS" => {
                        verse_number = attr_value(&e, "vnumber").and_then(|s| s.parse().ok());
                        verse_text.clear();
                        in_verse = true;
                        verse_depth = 0;
                    }
                    _ => {}
                }
            }

            Ok(Event::Empty(e)) => {
                if in_verse {
                    continue;
                }
                let tag = e.local_name().as_ref().to_ascii_uppercase();
                if tag == b"BR" {
                    verse_text.push(' ');
                }
            }

            Ok(Event::Text(t)) => {
                let text = t.unescape().unwrap_or_default().into_owned();
                if in_verse {
                    verse_text.push_str(&text);
                } else if let Some(field) = &info_field {
                    match field.as_str() {
                        "title" => name.push_str(text.trim()),
                        "language" => language.push_str(text.trim()),
                        _ => {}
                    }
                }
            }

            Ok(Event::End(e)) => {
                let tag = e.local_name().as_ref().to_ascii_uppercase();
                let tag = String::from_utf8_lossy(&tag).into_owned();

                if in_verse {
                    if tag == "VERS" && verse_depth == 0 {
                        in_verse = false;
                        if let (Some(book), Some(chapter_idx)) = (books.last_mut(), current_chapter) {
                            if let Some(chapter) = book.chapters.get_mut(chapter_idx) {
                                let n = bounded_index(
                                    verse_number,
                                    chapter.len() + 1,
                                    MAX_BIBLE_VERSES,
                                );
                                ensure_len(chapter, n);
                                chapter[n - 1] = verse_text.trim().to_string();
                            }
                        }
                    } else if verse_depth > 0 {
                        verse_depth -= 1;
                    }
                    continue;
                }

                match tag.as_str() {
                    "INFORMATION" => in_information = false,
                    "TITLE" | "LANGUAGE" => info_field = None,
                    _ => {}
                }
            }

            _ => {}
        }
        buf.clear();
    }

    if books.is_empty() {
        return Err("no books found — is this a Zefania-XML Bible module?".into());
    }

    Ok(BibleTranslation {
        id: uuid::Uuid::new_v4().to_string(),
        name: if name.is_empty() { source_name.to_string() } else { name },
        language: if language.is_empty() { "Unknown".into() } else { language },
        books,
    })
}

fn parse_source(path: &Path) -> Result<BibleTranslation, String> {
    let xml = read_source_text(path)?;
    let head: String = xml.chars().take(2048).collect::<String>().to_uppercase();
    if !head.contains("<XMLBIBLE") {
        return Err(
            "Unrecognised Bible file format. CrossPresenter reads Zefania-XML modules (the format used by SWORD, MySword and most public-domain exports)."
                .into(),
        );
    }
    let source_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Imported Bible");
    parse_zefania(&xml, source_name)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

fn import_blocking(app: AppHandle, source_path: PathBuf) -> Result<BibleTranslationSummary, String> {
    let translation = parse_source(&source_path)?;
    let dir = bibles_dir(&app)?;

    let json = serde_json::to_string(&translation).map_err(|e| format!("cannot encode translation: {e}"))?;
    fs::write(translation_path(&dir, &translation.id), json)
        .map_err(|e| format!("cannot write translation: {e}"))?;

    let summary = summarize(&translation);
    let mut index = read_index(&dir);
    index.push(summary.clone());
    index.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    write_index(&dir, &index)?;

    Ok(summary)
}

/// Parse a Bible translation file and add it to the installed catalogue.
#[tauri::command]
pub async fn import_bible_translation(app: AppHandle, source_path: String) -> Result<BibleTranslationSummary, String> {
    tauri::async_runtime::spawn_blocking(move || import_blocking(app, PathBuf::from(source_path)))
        .await
        .map_err(|e| format!("import task failed: {e}"))?
}

/// The catalogue of installed translations, for the Bible module's picker.
#[tauri::command]
pub async fn list_bible_translations(app: AppHandle) -> Result<Vec<BibleTranslationSummary>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = bibles_dir(&app)?;
        Ok(read_index(&dir))
    })
    .await
    .map_err(|e| format!("list task failed: {e}"))?
}

/// The full text of one installed translation.
#[tauri::command]
pub async fn get_bible_translation(app: AppHandle, id: String) -> Result<BibleTranslation, String> {
    if !valid_id(&id) {
        return Err("invalid translation id".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let dir = bibles_dir(&app)?;
        let path = translation_path(&dir, &id);
        let json = fs::read_to_string(&path).map_err(|_| "translation not found".to_string())?;
        serde_json::from_str(&json).map_err(|e| format!("corrupt translation cache: {e}"))
    })
    .await
    .map_err(|e| format!("fetch task failed: {e}"))?
}

/// Remove an installed translation from the catalogue and delete its cache.
#[tauri::command]
pub async fn remove_bible_translation(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("invalid translation id".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let dir = bibles_dir(&app)?;
        match fs::remove_file(translation_path(&dir, &id)) {
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(format!("cannot delete translation cache: {e}")),
        }
        let index: Vec<BibleTranslationSummary> =
            read_index(&dir).into_iter().filter(|s| s.id != id).collect();
        write_index(&dir, &index)
    })
    .await
    .map_err(|e| format!("remove task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<XMLBIBLE biblename="Test Version">
  <INFORMATION>
    <title>Test Version</title>
    <language>English</language>
  </INFORMATION>
  <BIBLEBOOK bnumber="1" bname="Genesis">
    <CHAPTER cnumber="1">
      <VERS vnumber="1">In the beginning God created the heaven and the earth.</VERS>
      <VERS vnumber="2">And the earth was without form, and void.</VERS>
    </CHAPTER>
  </BIBLEBOOK>
</XMLBIBLE>"#;

    #[test]
    fn parses_zefania_sample() {
        let t = parse_zefania(SAMPLE, "fallback").unwrap();
        assert_eq!(t.name, "Test Version");
        assert_eq!(t.language, "English");
        assert_eq!(t.books.len(), 1);
        assert_eq!(t.books[0].name, "Genesis");
        assert_eq!(t.books[0].chapters.len(), 1);
        assert_eq!(t.books[0].chapters[0][0], "In the beginning God created the heaven and the earth.");
        assert_eq!(t.books[0].chapters[0][1], "And the earth was without form, and void.");
    }

    #[test]
    fn rejects_non_bible_xml() {
        assert!(parse_source(Path::new("Cargo.toml")).is_err());
    }
}
