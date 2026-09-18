//! PPTX slide text extraction.
//!
//! A `.pptx` file is a zip of OOXML parts. Each slide's text lives in
//! `ppt/slides/slideN.xml` as `<a:t>` runs nested inside `<a:p>` paragraphs.
//! This reads those parts directly rather than resolving the full
//! presentation relationship graph (`presentation.xml` + its `.rels`), so
//! slide order follows the on-disk `slideN.xml` numbering rather than any
//! later manual reordering in the authoring app — an accepted trade-off for
//! turning a Graphics-deck drop into real slide content instead of an empty
//! item.

use std::io::{BufReader, Read};
use std::path::Path;

use quick_xml::events::Event;
use quick_xml::Reader;

use crate::model::Slide;

fn slide_number(name: &str) -> Option<u32> {
    name.strip_prefix("ppt/slides/slide")?.strip_suffix(".xml")?.parse().ok()
}

/// Plain text of one slide part: one line per paragraph (`<a:p>`), runs
/// (`<a:t>`) within a paragraph concatenated in document order, `<a:br/>`
/// forcing an extra line break inside a paragraph.
fn extract_slide_text(xml: &str) -> Result<String, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut buf = Vec::new();

    let mut paragraphs: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut in_text = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.local_name().as_ref() {
                b"p" => current.clear(),
                b"t" => in_text = true,
                _ => {}
            },
            Ok(Event::Empty(e)) => {
                if e.local_name().as_ref() == b"br" {
                    current.push('\n');
                }
            }
            Ok(Event::Text(t)) => {
                if in_text {
                    let decoded = t.unescape().map_err(|e| e.to_string())?;
                    current.push_str(&decoded);
                }
            }
            Ok(Event::End(e)) => match e.local_name().as_ref() {
                b"t" => in_text = false,
                b"p" => paragraphs.push(std::mem::take(&mut current)),
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("malformed slide XML: {e}")),
            _ => {}
        }
        buf.clear();
    }

    Ok(paragraphs
        .into_iter()
        .map(|p| p.trim_end().to_string())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string())
}

/// A single slide XML part is at most a few hundred KB. The declared size in
/// a zip header is attacker-controlled, so it must never be trusted as a
/// `Vec::with_capacity` without a bound — a crafted `.pptx` could otherwise
/// force a giant allocation (OOM) before a byte is read.
const MAX_SLIDE_PART_BYTES: u64 = 16 * 1024 * 1024;

fn extract_blocking(path: &Path) -> Result<Vec<Slide>, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("cannot open {}: {e}", path.display()))?;
    let mut zip = zip::ZipArchive::new(BufReader::with_capacity(1 << 20, file))
        .map_err(|e| format!("{} is not a readable .pptx file: {e}", path.display()))?;

    let mut slide_files: Vec<(u32, usize)> = Vec::new();
    for i in 0..zip.len() {
        let entry = zip.by_index(i).map_err(|e| format!("corrupt archive entry {i}: {e}"))?;
        if let Some(n) = slide_number(entry.name()) {
            slide_files.push((n, i));
        }
    }
    if slide_files.is_empty() {
        return Err(format!(
            "{} contains no ppt/slides parts — is this a valid .pptx file?",
            path.display()
        ));
    }
    slide_files.sort_by_key(|(n, _)| *n);

    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("slide").to_string();

    let mut slides = Vec::with_capacity(slide_files.len().min(512));
    for (display_index, (_, zip_index)) in slide_files.into_iter().enumerate() {
        let mut entry = zip
            .by_index(zip_index)
            .map_err(|e| format!("corrupt archive entry: {e}"))?;
        if entry.size() > MAX_SLIDE_PART_BYTES {
            return Err(format!(
                "slide part declares {} bytes — refusing to read more than {MAX_SLIDE_PART_BYTES}",
                entry.size()
            ));
        }
        let mut raw = Vec::with_capacity(entry.size() as usize);
        entry
            .read_to_end(&mut raw)
            .map_err(|e| format!("cannot read slide {}: {e}", display_index + 1))?;

        // OOXML parts always declare UTF-8; lossy decoding is a defensive
        // fallback rather than the expected path.
        let xml = String::from_utf8_lossy(&raw).into_owned();
        let text = extract_slide_text(&xml)?;
        let id = format!("{stem}-pptx-{}", display_index + 1);
        slides.push(Slide::from_text(id, format!("Slide {}", display_index + 1), text));
    }

    Ok(slides)
}

/// Unzip a `.pptx` and return one auto-fit text slide per presentation slide.
#[tauri::command]
pub async fn extract_pptx_slides(path: String) -> Result<Vec<Slide>, String> {
    tauri::async_runtime::spawn_blocking(move || extract_blocking(Path::new(&path)))
        .await
        .map_err(|e| format!("pptx extraction task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_runs_across_a_paragraph() {
        let xml = r#"<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:p><a:r><a:t>Hello </a:t></a:r><a:r><a:t>world</a:t></a:r></a:p>
            <a:p><a:r><a:t>Second line</a:t></a:r></a:p>
        </p:sld>"#;
        assert_eq!(extract_slide_text(xml).unwrap(), "Hello world\nSecond line");
    }

    #[test]
    fn treats_manual_break_as_newline() {
        let xml = r#"<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:p><a:r><a:t>First</a:t></a:r><a:br/><a:r><a:t>Second</a:t></a:r></a:p>
        </p:sld>"#;
        assert_eq!(extract_slide_text(xml).unwrap(), "First\nSecond");
    }

    #[test]
    fn empty_slide_yields_empty_string() {
        let xml = r#"<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p/></p:sld>"#;
        assert_eq!(extract_slide_text(xml).unwrap(), "");
    }

    #[test]
    fn parses_slide_number_from_part_name() {
        assert_eq!(slide_number("ppt/slides/slide1.xml"), Some(1));
        assert_eq!(slide_number("ppt/slides/slide12.xml"), Some(12));
        assert_eq!(slide_number("ppt/slides/_rels/slide1.xml.rels"), None);
        assert_eq!(slide_number("ppt/slideLayouts/slideLayout1.xml"), None);
    }
}
