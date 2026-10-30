//! XML song formats: OpenLyrics (OpenLP, Quelea, ShareFaith),
//! OpenSong, Quelea's native export, and Faithlife Proclaim.
//!
//! All four are read with `quick-xml`'s pull parser rather than deserialised
//! into typed structs. Real-world files from these applications routinely carry
//! elements the published schema does not mention, and a pull parser simply
//! ignores what it does not recognise instead of failing the whole document —
//! which matters when a user drops a 4,000-song library on the window and
//! expects all of it to land.

use std::io::Read;
use std::path::Path;

use quick_xml::events::Event;
use quick_xml::Reader;

use super::tags::{normalize_tag, parse_tagged_body, Section};
use super::RawSong;

/// A single member of a `.osz`/`.qsp` export is one song at most a few MB.
/// The uncompressed size in a zip header is attacker-controlled, so cap it
/// before buffering the whole member into RAM (and again on the lossy copy).
const MAX_ZIP_MEMBER_BYTES: u64 = 32 * 1024 * 1024;

/// Root-element fingerprint, used to route a document to the right reader.
#[derive(Debug, PartialEq, Eq)]
enum XmlKind {
    OpenLyrics,
    OpenSong,
    QueleaDatabase,
    Proclaim,
    ProPresenter,
    Unknown,
}

fn detect_kind(xml: &str) -> XmlKind {
    let head: String = xml.chars().take(2048).collect::<String>().to_lowercase();
    // ProPresenter 5/6 store songs as <chart> elements under <charts>. The
    // marker is distinctive and sits near the top of the document (before the
    // templates/layouts/media blocks), so the head check is reliable.
    if head.contains("<charts") {
        return XmlKind::ProPresenter;
    }
    if head.contains("<song") && head.contains("openlyrics") {
        return XmlKind::OpenLyrics;
    }
    if head.contains("<songs") || head.contains("<database") {
        return XmlKind::QueleaDatabase;
    }
    if head.contains("<presentation") || head.contains("proclaim") {
        return XmlKind::Proclaim;
    }
    // OpenSong files start with <song> and carry a <lyrics> element holding
    // bracket-tagged text; OpenLyrics uses nested <verse> elements instead.
    if head.contains("<song") {
        if head.contains("<lyrics") && !head.contains("<verse") {
            return XmlKind::OpenSong;
        }
        return XmlKind::OpenLyrics;
    }
    XmlKind::Unknown
}

fn read_to_string(path: &Path) -> Result<String, String> {
    let mut bytes = Vec::new();
    std::fs::File::open(path)
        .map_err(|e| format!("cannot open: {e}"))?
        .read_to_end(&mut bytes)
        .map_err(|e| format!("cannot read: {e}"))?;

    // These exports are usually UTF-8 but Windows-authored files are often
    // Latin-1 or UTF-16. Decode rather than reject.
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

pub fn read(path: &Path) -> Result<Vec<RawSong>, String> {
    let xml = read_to_string(path)?;
    match detect_kind(&xml) {
        XmlKind::OpenLyrics => read_openlyrics(&xml).map(|s| vec![s]),
        XmlKind::OpenSong => read_opensong(&xml).map(|s| vec![s]),
        XmlKind::QueleaDatabase => read_song_collection(&xml),
        XmlKind::Proclaim => read_proclaim(&xml).map(|s| vec![s]),
        XmlKind::ProPresenter => read_propresenter(&xml),
        XmlKind::Unknown => Err(
            "XML root element is not a recognised song format (expected OpenLyrics, OpenSong, Quelea, Proclaim or ProPresenter).".into(),
        ),
    }
}

/// Read songs out of a ZIP export (`.osz`, `.qsp`) by scanning the member files.
pub fn read_zip(path: &Path) -> Result<Vec<RawSong>, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("cannot open: {e}"))?;
    let mut zip = zip::ZipArchive::new(std::io::BufReader::new(file))
        .map_err(|e| format!("not a readable archive: {e}"))?;

    let mut out = Vec::new();
    let mut last_error: Option<String> = None;

    for i in 0..zip.len() {
        let mut entry = match zip.by_index(i) {
            Ok(e) => e,
            Err(_) => continue,
        };
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_ascii_lowercase();
        let interesting = name.ends_with(".xml")
            || name.ends_with(".json")
            || !name.contains('.');
        if !interesting {
            continue;
        }

        let mut buf = Vec::with_capacity(entry.size().min(MAX_ZIP_MEMBER_BYTES) as usize);
        if entry.size() > MAX_ZIP_MEMBER_BYTES || entry.read_to_end(&mut buf).is_err() {
            continue;
        }
        if buf.len() as u64 > MAX_ZIP_MEMBER_BYTES {
            continue;
        }
        let text = String::from_utf8_lossy(&buf);
        let trimmed = text.trim_start_matches('\u{feff}').trim_start();

        let parsed = if trimmed.starts_with('<') {
            match detect_kind(trimmed) {
                XmlKind::OpenLyrics => read_openlyrics(trimmed).map(|s| vec![s]),
                XmlKind::OpenSong => read_opensong(trimmed).map(|s| vec![s]),
                XmlKind::QueleaDatabase => read_song_collection(trimmed),
                XmlKind::Proclaim => read_proclaim(trimmed).map(|s| vec![s]),
                XmlKind::ProPresenter => read_propresenter(trimmed),
                XmlKind::Unknown => continue,
            }
        } else if trimmed.starts_with('{') || trimmed.starts_with('[') {
            super::json_formats::read_str(trimmed)
        } else {
            continue;
        };

        match parsed {
            Ok(songs) => out.extend(songs),
            Err(e) => last_error = Some(e),
        }
    }

    if out.is_empty() {
        return Err(last_error.unwrap_or_else(|| {
            "Archive contains no readable song files.".to_string()
        }));
    }
    Ok(out)
}

/// Text content of the current element, with entities resolved and child
/// markup flattened. `<br/>` becomes a newline, which is how OpenLyrics
/// encodes line breaks inside a verse line.
fn element_text(reader: &mut Reader<&[u8]>, end_name: &[u8]) -> Result<String, String> {
    let mut buf = Vec::new();
    let mut out = String::new();
    let mut depth = 0usize;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if e.name().as_ref() == end_name {
                    depth += 1;
                }
                if e.name().as_ref() == b"br" {
                    out.push('\n');
                }
                // Quelea and OpenLyrics wrap chords in <chord>; skip the marker
                // but keep any text after it.
            }
            Ok(Event::Empty(e)) => {
                if e.name().as_ref() == b"br" {
                    out.push('\n');
                }
            }
            Ok(Event::Text(t)) => {
                // `unescape` resolves &amp; / &#233; style entities as it decodes.
                let decoded = t.unescape().map_err(|e| e.to_string())?;
                out.push_str(&decoded);
            }
            Ok(Event::CData(t)) => {
                out.push_str(&String::from_utf8_lossy(t.as_ref()));
            }
            Ok(Event::End(e)) => {
                if e.name().as_ref() == end_name {
                    if depth == 0 {
                        break;
                    }
                    depth -= 1;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("malformed XML: {e}")),
            _ => {}
        }
        buf.clear();
    }
    Ok(out)
}

fn attr(e: &quick_xml::events::BytesStart, key: &[u8]) -> Option<String> {
    e.attributes().flatten().find(|a| a.key.as_ref() == key).map(|a| {
        String::from_utf8_lossy(a.value.as_ref()).into_owned()
    })
}

/// An attribute value with XML entities resolved. ProPresenter stores lyric
/// bodies in an attribute where `&#10;` marks a line break, so the value must
/// be unescaped before it can be split into slides.
fn attr_text(e: &quick_xml::events::BytesStart, key: &[u8]) -> Option<String> {
    for a in e.attributes().flatten() {
        if a.key.as_ref() == key {
            return a.unescape_value().ok().map(|v| v.into_owned());
        }
    }
    None
}

// ---------------------------------------------------------------------------
// OpenLyrics
// ---------------------------------------------------------------------------

/// OpenLyrics 0.8/0.9 — the interchange format shared by OpenLP, Quelea,
/// ShareFaith Presenter and several others.
fn read_openlyrics(xml: &str) -> Result<RawSong, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);

    let mut song = RawSong {
        source: "OpenLyrics".into(),
        ..Default::default()
    };
    let mut buf = Vec::new();
    // Verse labels can repeat across <lines> blocks; collect then merge.
    let mut pending: Vec<(String, String)> = Vec::new();
    let mut current_label = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"title" if song.title.is_empty() => {
                    song.title = element_text(&mut reader, b"title")?.trim().to_string();
                }
                b"author" => {
                    let a = element_text(&mut reader, b"author")?.trim().to_string();
                    if !a.is_empty() {
                        if song.author.is_empty() {
                            song.author = a;
                        } else {
                            song.author.push_str(", ");
                            song.author.push_str(&a);
                        }
                    }
                }
                b"copyright" => {
                    song.copyright = element_text(&mut reader, b"copyright")?.trim().to_string();
                }
                b"ccliNo" | b"ccliNumber" => {
                    song.ccli = element_text(&mut reader, b"ccliNo")?.trim().to_string();
                }
                b"key" => {
                    song.key = element_text(&mut reader, b"key")?.trim().to_string();
                }
                b"tempo" => {
                    song.tempo = element_text(&mut reader, b"tempo")?.trim().to_string();
                }
                b"theme" => {
                    let t = element_text(&mut reader, b"theme")?.trim().to_string();
                    if !t.is_empty() {
                        song.themes.push(t);
                    }
                }
                b"verse" => {
                    // `name` is the canonical attribute ("v1", "c", "b1");
                    // OpenLP also emits type/label pairs.
                    current_label = attr(&e, b"name")
                        .or_else(|| {
                            let t = attr(&e, b"type").unwrap_or_default();
                            let l = attr(&e, b"label").unwrap_or_default();
                            if t.is_empty() && l.is_empty() {
                                None
                            } else {
                                Some(format!("{t}{l}"))
                            }
                        })
                        .map(|s| normalize_tag(&s))
                        .unwrap_or_default();
                }
                b"lines" => {
                    let text = element_text(&mut reader, b"lines")?;
                    let cleaned = text
                        .lines()
                        .map(|l| l.trim())
                        .filter(|l| !l.is_empty())
                        .collect::<Vec<_>>()
                        .join("\n");
                    if !cleaned.is_empty() {
                        pending.push((current_label.clone(), cleaned));
                    }
                }
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("malformed OpenLyrics XML: {e}")),
            _ => {}
        }
        buf.clear();
    }

    // Merge consecutive <lines> blocks that belong to the same verse, keeping
    // the blank-line separator so the splitter treats them as slide breaks.
    for (label, text) in pending {
        match song.sections.last_mut() {
            Some(last) if last.label == label => {
                last.text.push_str("\n\n");
                last.text.push_str(&text);
            }
            _ => song.sections.push(Section { label, text }),
        }
    }

    if song.sections.is_empty() {
        return Err("OpenLyrics document contains no verses.".into());
    }
    Ok(song)
}

/// Parse the `<lyrics>` XML fragment stored in OpenLP's SQLite `lyrics` column.
///
/// Returns `None` when the fragment is not the expected shape, so the caller
/// can fall back to plain-text parsing.
pub fn sections_from_openlp_lyrics(fragment: &str) -> Option<Vec<Section>> {
    let mut reader = Reader::from_str(fragment);
    reader.config_mut().trim_text(false);
    let mut buf = Vec::new();
    let mut sections: Vec<Section> = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"verse" => {
                let t = attr(&e, b"type").unwrap_or_default();
                let l = attr(&e, b"label").unwrap_or_default();
                let label = normalize_tag(&format!("{t}{l}"));
                let text = element_text(&mut reader, b"verse").ok()?;
                let cleaned = text
                    .lines()
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
                    .join("\n");
                if !cleaned.is_empty() {
                    sections.push(Section { label, text: cleaned });
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => return None,
            _ => {}
        }
        buf.clear();
    }

    if sections.is_empty() {
        None
    } else {
        Some(sections)
    }
}

// ---------------------------------------------------------------------------
// OpenSong
// ---------------------------------------------------------------------------

/// OpenSong stores the whole song body as bracket-tagged text inside a single
/// `<lyrics>` element, with `.`-prefixed chord lines interleaved.
fn read_opensong(xml: &str) -> Result<RawSong, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);

    let mut song = RawSong {
        source: "OpenSong".into(),
        ..Default::default()
    };
    let mut buf = Vec::new();
    let mut body = String::new();
    let mut presentation = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"title" if song.title.is_empty() => {
                    song.title = element_text(&mut reader, b"title")?.trim().to_string();
                }
                b"author" => song.author = element_text(&mut reader, b"author")?.trim().to_string(),
                b"copyright" => {
                    song.copyright = element_text(&mut reader, b"copyright")?.trim().to_string()
                }
                b"ccli" => song.ccli = element_text(&mut reader, b"ccli")?.trim().to_string(),
                b"key" => song.key = element_text(&mut reader, b"key")?.trim().to_string(),
                b"tempo" => song.tempo = element_text(&mut reader, b"tempo")?.trim().to_string(),
                b"theme" => {
                    let t = element_text(&mut reader, b"theme")?.trim().to_string();
                    if !t.is_empty() {
                        song.themes.push(t);
                    }
                }
                b"presentation" => {
                    presentation = element_text(&mut reader, b"presentation")?.trim().to_string()
                }
                b"lyrics" => body = element_text(&mut reader, b"lyrics")?,
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("malformed OpenSong XML: {e}")),
            _ => {}
        }
        buf.clear();
    }

    song.sections = parse_tagged_body(&body);
    song.arrangement = presentation
        .split_whitespace()
        .map(normalize_tag)
        .filter(|s| !s.is_empty())
        .collect();

    if song.sections.is_empty() {
        return Err("OpenSong document contains no lyrics.".into());
    }
    Ok(song)
}

// ---------------------------------------------------------------------------
// Multi-song documents (Quelea database exports)
// ---------------------------------------------------------------------------

/// A document holding many `<song>` children. Each child is handed to the
/// single-song readers, so a mixed export still imports fully.
fn read_song_collection(xml: &str) -> Result<Vec<RawSong>, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut buf = Vec::new();
    let mut out = Vec::new();
    let mut depth = 0usize;
    let mut current = String::new();
    let mut capturing = false;

    // Re-serialise each <song> subtree, then reuse the single-song parsers
    // rather than duplicating their field handling here.
    loop {
        let ev = reader.read_event_into(&mut buf);
        match ev {
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"song" => {
                if capturing {
                    depth += 1;
                } else {
                    capturing = true;
                    depth = 0;
                    current.clear();
                }
                current.push_str(&reconstruct_start(e));
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"song" => {
                current.push_str("</song>");
                if depth == 0 {
                    capturing = false;
                    let parsed = match detect_kind(&current) {
                        XmlKind::OpenSong => read_opensong(&current),
                        _ => read_openlyrics(&current),
                    };
                    if let Ok(mut s) = parsed {
                        if s.source == "OpenLyrics" {
                            s.source = "Quelea".into();
                        }
                        out.push(s);
                    }
                } else {
                    depth -= 1;
                }
            }
            Ok(Event::Start(ref e)) if capturing => current.push_str(&reconstruct_start(e)),
            Ok(Event::Empty(ref e)) if capturing => {
                let s = reconstruct_start(e);
                current.push_str(&s[..s.len() - 1]);
                current.push_str("/>");
            }
            Ok(Event::End(ref e)) if capturing => {
                current.push_str(&format!("</{}>", String::from_utf8_lossy(e.name().as_ref())));
            }
            Ok(Event::Text(ref t)) if capturing => {
                let decoded = t.unescape().map_err(|e| e.to_string())?;
                current.push_str(&escape_text(&decoded));
            }
            Ok(Event::CData(ref t)) if capturing => {
                current.push_str(&escape_text(&String::from_utf8_lossy(t.as_ref())));
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("malformed XML: {e}")),
            _ => {}
        }
        buf.clear();
    }

    if out.is_empty() {
        return Err("Document contains no readable <song> elements.".into());
    }
    Ok(out)
}

fn reconstruct_start(e: &quick_xml::events::BytesStart) -> String {
    let mut s = String::from("<");
    s.push_str(&String::from_utf8_lossy(e.name().as_ref()));
    for a in e.attributes().flatten() {
        s.push(' ');
        s.push_str(&String::from_utf8_lossy(a.key.as_ref()));
        s.push_str("=\"");
        s.push_str(&escape_text(&String::from_utf8_lossy(a.value.as_ref())));
        s.push('"');
    }
    s.push('>');
    s
}

fn escape_text(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// ---------------------------------------------------------------------------
// Faithlife Proclaim
// ---------------------------------------------------------------------------

/// Proclaim presentation XML. Slide bodies live in `<Content>` /
/// `<TextElement>` nodes; section names, when present, come from slide labels.
fn read_proclaim(xml: &str) -> Result<RawSong, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);

    let mut song = RawSong {
        source: "Faithlife Proclaim".into(),
        ..Default::default()
    };
    let mut buf = Vec::new();
    let mut pending_label = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = e.name().as_ref().to_ascii_lowercase();
                match name.as_slice() {
                    b"title" | b"songtitle" if song.title.is_empty() => {
                        let raw = e.name().as_ref().to_vec();
                        song.title = element_text(&mut reader, &raw)?.trim().to_string();
                    }
                    b"author" | b"songauthor" => {
                        let raw = e.name().as_ref().to_vec();
                        song.author = element_text(&mut reader, &raw)?.trim().to_string();
                    }
                    b"copyright" => {
                        let raw = e.name().as_ref().to_vec();
                        song.copyright = element_text(&mut reader, &raw)?.trim().to_string();
                    }
                    b"ccli" | b"cclinumber" => {
                        let raw = e.name().as_ref().to_vec();
                        song.ccli = element_text(&mut reader, &raw)?.trim().to_string();
                    }
                    b"slide" | b"presentationslide" => {
                        pending_label = attr(&e, b"label")
                            .or_else(|| attr(&e, b"name"))
                            .or_else(|| attr(&e, b"Label"))
                            .map(|s| normalize_tag(&s))
                            .unwrap_or_default();
                    }
                    b"content" | b"textelement" | b"body" | b"text" => {
                        let raw = e.name().as_ref().to_vec();
                        let text = element_text(&mut reader, &raw)?;
                        let cleaned = text
                            .lines()
                            .map(|l| l.trim())
                            .filter(|l| !l.is_empty())
                            .collect::<Vec<_>>()
                            .join("\n");
                        if !cleaned.is_empty() {
                            let label = if pending_label.is_empty() {
                                format!("Slide {}", song.sections.len() + 1)
                            } else {
                                std::mem::take(&mut pending_label)
                            };
                            song.sections.push(Section { label, text: cleaned });
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("malformed Proclaim XML: {e}")),
            _ => {}
        }
        buf.clear();
    }

    if song.sections.is_empty() {
        return Err("Proclaim document contains no slide text.".into());
    }
    Ok(song)
}

// ---------------------------------------------------------------------------
// ProPresenter (5 & 6)
// ---------------------------------------------------------------------------

/// ProPresenter 5 (`.pro5`, plain XML) and ProPresenter 6 (`.pro6`, a ZIP whose
/// `Pro6Document.xml` carries the same shape). Songs are `<chart>` elements
/// under `<charts>`; each chart's lyrics are `<section>` nodes whose text lives
/// in an attribute, with slides separated by blank lines (`&#10;&#10;`).
///
/// A single document often holds a whole set list, so every chart is returned.
fn read_propresenter(xml: &str) -> Result<Vec<RawSong>, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut buf = Vec::new();
    let mut out: Vec<RawSong> = Vec::new();
    let mut song: Option<RawSong> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"chart" => song = Some(propresenter_chart(&e)),
                b"section" => {
                    if let Some(s) = song.as_mut() {
                        if let Some(sec) = propresenter_section(&e) {
                            s.sections.push(sec);
                        }
                    }
                }
                _ => {}
            },
            // Sections are almost always self-closing: <section ... text="…"/>.
            Ok(Event::Empty(e)) => {
                if e.name().as_ref() == b"section" {
                    if let Some(s) = song.as_mut() {
                        if let Some(sec) = propresenter_section(&e) {
                            s.sections.push(sec);
                        }
                    }
                }
            }
            Ok(Event::End(e)) => {
                if e.name().as_ref() == b"chart" {
                    if let Some(s) = song.take() {
                        // A chart with no lyrics is a media/staging placeholder,
                        // not a song — skip it the way the other readers do.
                        if s.sections.iter().any(|x| !x.text.trim().is_empty()) {
                            out.push(s);
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("malformed ProPresenter XML: {e}")),
            _ => {}
        }
        buf.clear();
    }

    if out.is_empty() {
        return Err("ProPresenter document contains no charts with lyrics.".into());
    }
    Ok(out)
}

/// Pull the metadata off a `<chart>` element into a fresh song.
fn propresenter_chart(e: &quick_xml::events::BytesStart) -> RawSong {
    let artist = attr_text(e, b"artist")
        .filter(|s| !s.trim().is_empty())
        .or_else(|| attr_text(e, b"author"))
        .unwrap_or_default();

    let mut song = RawSong {
        title: attr_text(e, b"name").unwrap_or_default().trim().to_string(),
        author: artist.trim().to_string(),
        copyright: attr_text(e, b"copyright").unwrap_or_default().trim().to_string(),
        ccli: attr_text(e, b"ccli").unwrap_or_default().trim().to_string(),
        key: attr_text(e, b"key").unwrap_or_default().trim().to_string(),
        source: "ProPresenter".into(),
        ..Default::default()
    };

    if let Some(album) = attr_text(e, b"album").filter(|s| !s.trim().is_empty()) {
        song.themes.push(album.trim().to_string());
    }
    // `arrangement` is a comma-separated playback order ("Verse 1,Chorus,…");
    // section names contain spaces, so only commas/semicolons are delimiters.
    song.arrangement = attr_text(e, b"arrangement")
        .unwrap_or_default()
        .split([',', ';'])
        .map(normalize_tag)
        .filter(|s| !s.is_empty())
        .collect();
    song
}

/// Turn a `<section>` element into a lyric section, resolving `&#10;` line
/// breaks. Returns `None` for empty placeholder sections.
fn propresenter_section(e: &quick_xml::events::BytesStart) -> Option<Section> {
    let text = attr_text(e, b"text")?;
    let text = text.replace("\r\n", "\n").replace('\r', "\n");
    let text = text.trim_matches('\n').to_string();
    if text.trim().is_empty() {
        return None;
    }
    // Prefer the human `name`; fall back to the machine `type`.
    let label_src = attr_text(e, b"name")
        .filter(|s| !s.trim().is_empty())
        .or_else(|| attr_text(e, b"type"))
        .unwrap_or_default();
    Some(Section {
        label: normalize_tag(&label_src),
        text,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_openlyrics() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.8">
  <properties>
    <titles><title>Be Thou My Vision</title></titles>
    <authors><author>Dallan Forgaill</author><author>Mary Byrne</author></authors>
    <copyright>Public Domain</copyright>
    <ccliNo>30639</ccliNo>
  </properties>
  <lyrics>
    <verse name="v1"><lines>Be Thou my Vision<br/>O Lord of my heart</lines></verse>
    <verse name="c"><lines>Thou my best thought</lines></verse>
  </lyrics>
</song>"#;
        let song = read_openlyrics(xml).unwrap();
        assert_eq!(song.title, "Be Thou My Vision");
        assert_eq!(song.author, "Dallan Forgaill, Mary Byrne");
        assert_eq!(song.ccli, "30639");
        assert_eq!(song.sections.len(), 2);
        assert_eq!(song.sections[0].label, "Verse 1");
        assert_eq!(song.sections[0].text, "Be Thou my Vision\nO Lord of my heart");
        assert_eq!(song.sections[1].label, "Chorus");
    }

    #[test]
    fn merges_repeated_verse_blocks() {
        let xml = r#"<song xmlns="http://openlyrics.info/namespace/2009/song">
  <properties><titles><title>T</title></titles></properties>
  <lyrics>
    <verse name="v1"><lines>one</lines><lines>two</lines></verse>
  </lyrics></song>"#;
        let song = read_openlyrics(xml).unwrap();
        assert_eq!(song.sections.len(), 1);
        assert_eq!(song.sections[0].text, "one\n\ntwo");
    }

    #[test]
    fn reads_opensong() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<song>
  <title>Amazing Grace</title>
  <author>John Newton</author>
  <copyright>Public Domain</copyright>
  <ccli>22025</ccli>
  <presentation>V1 C V2</presentation>
  <lyrics>[V1]
.G       C
Amazing grace how sweet the sound
That saved a wretch like me
[C]
Praise God
[V2]
Twas grace that taught
</lyrics>
</song>"#;
        let song = read_opensong(xml).unwrap();
        assert_eq!(song.title, "Amazing Grace");
        assert_eq!(song.arrangement, vec!["Verse 1", "Chorus", "Verse 2"]);
        assert_eq!(song.sections.len(), 3);
        assert_eq!(song.sections[0].label, "Verse 1");
        assert!(!song.sections[0].text.contains('G'), "chord line must be stripped");
    }

    #[test]
    fn detects_kinds() {
        assert_eq!(
            detect_kind(r#"<song xmlns="http://openlyrics.info/namespace/2009/song">"#),
            XmlKind::OpenLyrics
        );
        assert_eq!(detect_kind("<song><title>x</title><lyrics>[V1]</lyrics></song>"), XmlKind::OpenSong);
        assert_eq!(detect_kind("<songs><song/></songs>"), XmlKind::QueleaDatabase);
    }

    #[test]
    fn reads_openlp_lyrics_fragment() {
        let frag = r#"<song><lyrics><verse type="v" label="1">line a
line b</verse><verse type="c">hook</verse></lyrics></song>"#;
        let sections = sections_from_openlp_lyrics(frag).unwrap();
        assert_eq!(sections.len(), 2);
        assert_eq!(sections[0].label, "Verse 1");
        assert_eq!(sections[0].text, "line a\nline b");
        assert_eq!(sections[1].label, "Chorus");
    }

    #[test]
    fn reads_multi_song_collection() {
        let xml = r#"<songs>
  <song xmlns="http://openlyrics.info/namespace/2009/song">
    <properties><titles><title>First</title></titles></properties>
    <lyrics><verse name="v1"><lines>a</lines></verse></lyrics>
  </song>
  <song xmlns="http://openlyrics.info/namespace/2009/song">
    <properties><titles><title>Second</title></titles></properties>
    <lyrics><verse name="v1"><lines>b</lines></verse></lyrics>
  </song>
</songs>"#;
        let songs = read_song_collection(xml).unwrap();
        assert_eq!(songs.len(), 2);
        assert_eq!(songs[0].title, "First");
        assert_eq!(songs[1].title, "Second");
        assert_eq!(songs[0].source, "Quelea");
    }

    #[test]
    fn reads_propresenter_charts() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<document version="600">
  <header/>
  <charts>
    <chart name="Amazing Grace" artist="John Newton" copyright="Public Domain" ccli="22025" key="G" arrangement="Verse 1,Chorus">
      <lyrics>
        <section name="Verse 1" type="verse" text="Amazing grace how sweet the sound&#10;That saved a wretch like me"/>
        <section name="Chorus" type="chorus" text="Praise God&#10;Praise God"/>
      </lyrics>
    </chart>
  </charts>
</document>"#;
        let songs = read_propresenter(xml).unwrap();
        assert_eq!(songs.len(), 1);
        let s = &songs[0];
        assert_eq!(s.title, "Amazing Grace");
        assert_eq!(s.author, "John Newton");
        assert_eq!(s.ccli, "22025");
        assert_eq!(s.key, "G");
        assert_eq!(s.arrangement, vec!["Verse 1", "Chorus"]);
        assert_eq!(s.sections.len(), 2);
        assert_eq!(s.sections[0].label, "Verse 1");
        assert_eq!(
            s.sections[0].text,
            "Amazing grace how sweet the sound\nThat saved a wretch like me"
        );
        assert_eq!(s.sections[1].label, "Chorus");
        assert_eq!(s.source, "ProPresenter");
    }

    #[test]
    fn propresenter_multi_chart_setlist() {
        let xml = r#"<document><charts>
  <chart name="One" artist="A"><lyrics><section type="verse" text="alpha"/></lyrics></chart>
  <chart name="Two" artist="B"><lyrics><section type="chorus" text="beta"/></lyrics></chart>
</charts></document>"#;
        let songs = read_propresenter(xml).unwrap();
        assert_eq!(songs.len(), 2);
        assert_eq!(songs[0].title, "One");
        assert_eq!(songs[1].title, "Two");
        assert_eq!(songs[1].sections[0].label, "Chorus");
    }

    #[test]
    fn detects_propresenter_kind() {
        assert_eq!(
            detect_kind(r#"<document version="600"><header/><charts><chart/></charts></document>"#),
            XmlKind::ProPresenter
        );
    }
}
