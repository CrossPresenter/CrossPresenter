//! JSON song formats: VideoPsalm, FreeShow, Holyrics, WorshipTools Presenter,
//! ShareFaith exports.
//!
//! These formats have no shared schema and their key names differ by vendor and
//! locale (`Text`/`text`/`letra`, `Verses`/`slides`/`groups`). Deserialising
//! into a typed struct per vendor would break the moment a key is renamed, so
//! this reader walks `serde_json::Value` and recognises song-shaped objects
//! structurally: an object with a title-ish key and either a body-ish string or
//! a collection of verse-ish children.
//!
//! VideoPsalm files additionally use single-quoted, trailing-comma "relaxed"
//! JSON in some versions, which is repaired before parsing.

use std::path::Path;

use serde_json::Value;

use super::tags::{normalize_tag, parse_tagged_body, rtf_to_plain, Section};
use super::RawSong;

const TITLE_KEYS: [&str; 8] = ["title", "name", "songtitle", "titulo", "título", "titre", "caption", "text_title"];
const BODY_KEYS: [&str; 9] = ["lyrics", "words", "text", "content", "letra", "body", "plaintext", "rawtext", "lyric"];
const VERSE_COLLECTION_KEYS: [&str; 9] = ["verses", "slides", "groups", "sections", "parts", "stanzas", "items", "blocks", "lines"];
const LABEL_KEYS: [&str; 7] = ["tag", "label", "type", "name", "kind", "part", "section"];

pub fn read(path: &Path) -> Result<Vec<RawSong>, String> {
    let text = std::fs::read_to_string(path).or_else(|_| {
        let bytes = std::fs::read(path).map_err(|e| format!("cannot read: {e}"))?;
        let (decoded, _, _) = encoding_rs::WINDOWS_1252.decode(&bytes);
        Ok::<String, String>(decoded.into_owned())
    })?;
    read_str(&text)
}

pub fn read_str(text: &str) -> Result<Vec<RawSong>, String> {
    let value: Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(first_err) => {
            // VideoPsalm and some Holyrics exports are not strict JSON.
            let repaired = relax_json(text);
            serde_json::from_str(&repaired)
                .map_err(|_| format!("not valid JSON: {first_err}"))?
        }
    };

    let mut out = Vec::new();
    collect_songs(&value, &mut out, 0);

    if out.is_empty() {
        return Err(
            "JSON contains no song-shaped objects (need a title field plus lyrics text or a verse collection).".into(),
        );
    }
    Ok(out)
}

/// Repair the relaxed-JSON dialect VideoPsalm emits: single-quoted strings,
/// unquoted keys and trailing commas.
fn relax_json(input: &str) -> String {
    let mut out = String::with_capacity(input.len() + 64);
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    // Which quote character opened the current string.
    let mut quote = '"';

    while let Some(c) = chars.next() {
        if in_string {
            if c == '\\' {
                out.push(c);
                if let Some(next) = chars.next() {
                    out.push(next);
                }
                continue;
            }
            if c == quote {
                in_string = false;
                out.push('"');
                continue;
            }
            // A double quote inside a single-quoted string must be escaped once
            // the string is re-emitted with double quotes.
            if c == '"' {
                out.push_str("\\\"");
                continue;
            }
            out.push(c);
            continue;
        }

        match c {
            '\'' | '"' => {
                in_string = true;
                quote = c;
                out.push('"');
            }
            // Trailing comma before a closer.
            ',' => {
                let mut lookahead = chars.clone();
                let mut next_significant = None;
                while let Some(n) = lookahead.next() {
                    if !n.is_whitespace() {
                        next_significant = Some(n);
                        break;
                    }
                }
                match next_significant {
                    Some('}') | Some(']') => { /* drop it */ }
                    _ => out.push(','),
                }
            }
            _ => out.push(c),
        }
    }
    out
}

/// Case-insensitive key lookup.
fn get<'a>(obj: &'a serde_json::Map<String, Value>, keys: &[&str]) -> Option<&'a Value> {
    for key in keys {
        for (k, v) in obj {
            if k.to_lowercase() == *key {
                return Some(v);
            }
        }
    }
    // Substring pass for prefixed variants like "song_title".
    for key in keys {
        for (k, v) in obj {
            if k.to_lowercase().contains(key) {
                return Some(v);
            }
        }
    }
    None
}

fn as_text(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        // Some formats store a body as an array of lines.
        Value::Array(a) => a.iter().map(as_text).filter(|s| !s.is_empty()).collect::<Vec<_>>().join("\n"),
        Value::Object(o) => get(o, &BODY_KEYS).map(as_text).unwrap_or_default(),
        Value::Null => String::new(),
    }
}

/// Recursively find song-shaped objects. `depth` guards against pathological
/// nesting in machine-generated files.
fn collect_songs(value: &Value, out: &mut Vec<RawSong>, depth: usize) {
    if depth > 12 {
        return;
    }
    match value {
        Value::Array(items) => {
            for item in items {
                collect_songs(item, out, depth + 1);
            }
        }
        Value::Object(obj) => {
            if let Some(song) = song_from_object(obj) {
                out.push(song);
                return;
            }
            // Not a song itself — descend into containers such as
            // {"Songs":[...]} or {"library":{"songs":[...]}}.
            for v in obj.values() {
                if v.is_array() || v.is_object() {
                    collect_songs(v, out, depth + 1);
                }
            }
        }
        _ => {}
    }
}

fn song_from_object(obj: &serde_json::Map<String, Value>) -> Option<RawSong> {
    let title = get(obj, &TITLE_KEYS).map(as_text).unwrap_or_default();

    // Extract sections from a verse collection if there is one, otherwise from
    // a single body string.
    let sections = get(obj, &VERSE_COLLECTION_KEYS)
        .and_then(sections_from_collection)
        .or_else(|| {
            let body = get(obj, &BODY_KEYS).map(as_text).unwrap_or_default();
            if body.trim().is_empty() {
                None
            } else {
                Some(sections_from_body(&body))
            }
        })?;

    if sections.is_empty() || sections.iter().all(|s| s.text.trim().is_empty()) {
        return None;
    }
    // An object with lyrics but no title at all is more likely a nested slide
    // than a song; require at least one of the two to be present.
    if title.trim().is_empty() && sections.len() < 2 {
        return None;
    }

    let author = get(obj, &["author", "artist", "writer", "autor", "composer"])
        .map(as_text)
        .unwrap_or_default();
    let copyright = get(obj, &["copyright", "direitos"]).map(as_text).unwrap_or_default();
    let ccli = get(obj, &["ccli", "cclinumber", "reference_number", "songnumber"])
        .map(as_text)
        .unwrap_or_default();
    let key = get(obj, &["key", "tom", "tonalidade"]).map(as_text).unwrap_or_default();
    let tempo = get(obj, &["tempo", "bpm"]).map(as_text).unwrap_or_default();

    let themes = match get(obj, &["themes", "tags", "categories", "temas"]) {
        Some(Value::Array(a)) => a.iter().map(as_text).filter(|s| !s.is_empty()).collect(),
        Some(Value::String(s)) => s
            .split([',', ';'])
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect(),
        _ => Vec::new(),
    };

    let arrangement = match get(obj, &["arrangement", "order", "sequence", "verseorder", "presentation"]) {
        Some(Value::Array(a)) => a.iter().map(|v| normalize_tag(&as_text(v))).filter(|s| !s.is_empty()).collect(),
        Some(Value::String(s)) => s.split_whitespace().map(normalize_tag).filter(|s| !s.is_empty()).collect(),
        _ => Vec::new(),
    };

    Some(RawSong {
        title,
        author,
        copyright,
        ccli,
        key,
        tempo,
        themes,
        sections,
        arrangement,
        source: detect_source(obj),
    })
}

/// Name the originating application from telltale keys, so the operator can see
/// where a song came from in the item inspector.
fn detect_source(obj: &serde_json::Map<String, Value>) -> String {
    let keys: Vec<String> = obj.keys().map(|k| k.to_lowercase()).collect();
    let has = |k: &str| keys.iter().any(|x| x == k);

    if has("versepacks") || has("videopsalm") || (has("verses") && has("composer")) {
        "VideoPsalm".into()
    } else if has("groups") || has("layouts") || has("timeline") {
        "FreeShow".into()
    } else if has("letra") || has("grupo") || has("id_musica") {
        "Holyrics".into()
    } else if has("arrangement") && has("sequence") {
        "WorshipTools Presenter".into()
    } else {
        "JSON import".into()
    }
}

/// Build sections from a verse/slide collection, which may be an array of
/// objects, an array of strings, or an object keyed by label.
fn sections_from_collection(value: &Value) -> Option<Vec<Section>> {
    let mut out: Vec<Section> = Vec::new();

    match value {
        Value::Array(items) => {
            for (i, item) in items.iter().enumerate() {
                match item {
                    Value::String(s) => {
                        if !s.trim().is_empty() {
                            out.push(Section {
                                label: format!("Section {}", i + 1),
                                text: clean_body(s),
                            });
                        }
                    }
                    Value::Object(o) => {
                        let text = get(o, &BODY_KEYS).map(as_text).unwrap_or_default();
                        if text.trim().is_empty() {
                            continue;
                        }
                        let label = get(o, &LABEL_KEYS)
                            .map(as_text)
                            .map(|l| normalize_tag(&l))
                            .filter(|l| !l.is_empty())
                            .unwrap_or_else(|| format!("Section {}", i + 1));
                        out.push(Section { label, text: clean_body(&text) });
                    }
                    _ => {}
                }
            }
        }
        Value::Object(o) => {
            // {"v1": "…", "c": "…"} — the label is the key.
            for (k, v) in o {
                let text = as_text(v);
                if text.trim().is_empty() {
                    continue;
                }
                out.push(Section {
                    label: normalize_tag(k),
                    text: clean_body(&text),
                });
            }
        }
        _ => return None,
    }

    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

/// Normalise a body string: decode RTF if present and drop empty lines.
fn clean_body(text: &str) -> String {
    let decoded = if text.trim_start().starts_with("{\\rtf") {
        rtf_to_plain(text)
    } else {
        text.replace("\r\n", "\n").replace('\r', "\n")
    };
    decoded
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn sections_from_body(body: &str) -> Vec<Section> {
    let cleaned = if body.trim_start().starts_with("{\\rtf") {
        rtf_to_plain(body)
    } else {
        body.to_string()
    };
    parse_tagged_body(&cleaned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_videopsalm_shape() {
        let json = r#"{"Songs":[{"Title":"Holy Holy Holy","Composer":"John Dykes",
          "Verses":[{"Tag":"v1","Text":"Holy holy holy\nLord God almighty"},
                    {"Tag":"c","Text":"Praise"}]}]}"#;
        let songs = read_str(json).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "Holy Holy Holy");
        assert_eq!(songs[0].author, "John Dykes");
        assert_eq!(songs[0].sections.len(), 2);
        assert_eq!(songs[0].sections[0].label, "Verse 1");
        assert_eq!(songs[0].source, "VideoPsalm");
    }

    #[test]
    fn repairs_relaxed_json() {
        let json = "{'Songs':[{'Title':'X','Verses':[{'Tag':'v1','Text':'a',},],},]}";
        let songs = read_str(json).unwrap();
        assert_eq!(songs[0].title, "X");
    }

    #[test]
    fn reads_label_keyed_object() {
        let json = r#"{"title":"Keyed","lyrics":{"v1":"one","c":"two"}}"#;
        let songs = read_str(json).unwrap();
        assert_eq!(songs[0].sections.len(), 2);
        let labels: Vec<&str> = songs[0].sections.iter().map(|s| s.label.as_str()).collect();
        assert!(labels.contains(&"Verse 1"));
        assert!(labels.contains(&"Chorus"));
    }

    #[test]
    fn reads_bracket_tagged_body() {
        let json = r#"{"name":"Tagged","text":"[V1]\nline one\n[C]\nhook"}"#;
        let songs = read_str(json).unwrap();
        assert_eq!(songs[0].sections.len(), 2);
        assert_eq!(songs[0].sections[0].label, "Verse 1");
    }

    #[test]
    fn decodes_rtf_bodies_in_json() {
        let json = r#"{"title":"RTF","lyrics":"{\\rtf1\\ansi [V1]\\par hello\\par}"}"#;
        let songs = read_str(json).unwrap();
        assert_eq!(songs[0].sections[0].text, "hello");
    }

    #[test]
    fn rejects_json_without_songs() {
        let err = read_str(r#"{"settings":{"theme":"dark"}}"#).unwrap_err();
        assert!(err.contains("no song-shaped objects"));
    }

    #[test]
    fn array_of_lines_becomes_body() {
        let json = r#"{"title":"Lines","lyrics":["[V1]","a","b"]}"#;
        let songs = read_str(json).unwrap();
        assert_eq!(songs[0].sections[0].text, "a\nb");
    }
}
