//! Section-tag normalisation and lyric-to-slide splitting.
//!
//! Every song format in the wild labels sections differently. OpenLP writes
//! `v1`/`c`/`b`, OpenSong writes `[V1]`/`[C]`, EasyWorship embeds RTF with no
//! tags at all, Quelea uses free text. This module funnels all of them into one
//! canonical vocabulary so an imported song looks native regardless of origin.

/// Canonical section label for a raw tag from any source format.
///
/// Handles the compact forms (`v1` → `Verse 1`, `c` → `Chorus`, `b2` →
/// `Bridge 2`), the spelled-out forms, and localised variants that show up in
/// Holyrics and VideoPsalm exports. Unrecognised tags are title-cased and
/// passed through rather than discarded — a custom section name is still
/// meaningful to the operator.
pub fn normalize_tag(raw: &str) -> String {
    let t = raw.trim().trim_matches(|c| c == '[' || c == ']').trim();
    if t.is_empty() {
        return String::new();
    }

    let lower = t.to_ascii_lowercase();

    // Split a leading alphabetic prefix from a trailing number: "verse2" and
    // "v2" and "verse 2" all decompose the same way.
    let alpha: String = lower.chars().take_while(|c| c.is_alphabetic()).collect();
    let digits: String = lower.chars().filter(|c| c.is_ascii_digit()).collect();

    let base = match alpha.as_str() {
        "v" | "verse" | "vers" | "versum" | "estrofe" | "verso" => "Verse",
        "c" | "ch" | "cho" | "chorus" | "refrain" | "refrão" | "refrao" | "coro" | "estribillo" => {
            "Chorus"
        }
        "b" | "br" | "bridge" | "ponte" | "puente" => "Bridge",
        "p" | "pre" | "prechorus" | "pre-chorus" => "Pre-Chorus",
        "t" | "tag" => "Tag",
        "e" | "end" | "ending" | "outro" | "final" => "Ending",
        "i" | "intro" | "introduction" => "Intro",
        "in" | "interlude" | "instrumental" => "Interlude",
        "vamp" => "Vamp",
        "o" => "Other",
        "s" | "sr" | "scripture" => "Scripture",
        "coda" => "Coda",
        "" => return title_case(t),
        _ => return title_case(t),
    };

    if digits.is_empty() {
        base.to_string()
    } else {
        format!("{base} {digits}")
    }
}

fn title_case(s: &str) -> String {
    s.split_whitespace()
        .map(|w| {
            let mut ch = w.chars();
            match ch.next() {
                Some(f) => f.to_uppercase().collect::<String>() + &ch.as_str().to_lowercase(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Colour tag applied to a slide so the grid groups sections visually.
pub fn group_color(label: &str) -> &'static str {
    let l = label.to_ascii_lowercase();
    if l.starts_with("verse") {
        "#3B82F6"
    } else if l.starts_with("chorus") {
        "#F59E0B"
    } else if l.starts_with("pre-chorus") {
        "#8B5CF6"
    } else if l.starts_with("bridge") {
        "#10B981"
    } else if l.starts_with("tag") || l.starts_with("vamp") {
        "#EC4899"
    } else if l.starts_with("ending") || l.starts_with("outro") || l.starts_with("coda") {
        "#EF4444"
    } else if l.starts_with("intro") || l.starts_with("interlude") {
        "#6B7280"
    } else {
        "#475569"
    }
}

/// Maximum lines placed on a single slide before the section is split across
/// several. Four is the practical ceiling for readable projection at a
/// reasonable font size.
pub const DEFAULT_LINES_PER_SLIDE: usize = 4;

/// A parsed lyric section: a canonical label plus its raw text block.
#[derive(Debug, Clone)]
pub struct Section {
    pub label: String,
    pub text: String,
}

/// Split a section's text into projection-sized chunks.
///
/// A blank line inside a section is an explicit slide break authored by whoever
/// entered the song, so it always wins. Absent explicit breaks, lines are
/// grouped `lines_per_slide` at a time.
pub fn split_section(text: &str, lines_per_slide: usize) -> Vec<String> {
    let per = lines_per_slide.max(1);
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");

    // Explicit breaks: two or more consecutive newlines.
    let explicit: Vec<&str> = normalized
        .split("\n\n")
        .map(|b| b.trim_matches('\n'))
        .filter(|b| !b.trim().is_empty())
        .collect();

    // Whether the author supplied explicit breaks decides how strictly the
    // line budget is applied below, so record it before `explicit` is consumed.
    let author_broke_blocks = explicit.len() > 1;
    let blocks: Vec<&str> = if author_broke_blocks {
        explicit
    } else {
        vec![normalized.trim_matches('\n')]
    };

    let mut out = Vec::new();
    for block in blocks {
        let lines: Vec<&str> = block
            .lines()
            .map(|l| l.trim_end())
            .filter(|l| !l.trim().is_empty())
            .collect();

        if lines.is_empty() {
            continue;
        }
        if author_broke_blocks && lines.len() <= per {
            // Author-specified block that already fits — respect it exactly.
            out.push(lines.join("\n"));
            continue;
        }
        for chunk in lines.chunks(per) {
            out.push(chunk.join("\n"));
        }
    }
    out
}

/// Parse a lyric body that uses inline bracket tags, the format shared by
/// OpenSong, Quelea, VideoPsalm and most hand-authored text files:
///
/// ```text
/// [V1]
/// Amazing grace how sweet the sound
/// ...
/// [C]
/// ...
/// ```
///
/// Text appearing before any tag becomes an untitled leading section rather
/// than being dropped.
pub fn parse_tagged_body(body: &str) -> Vec<Section> {
    let normalized = body.replace("\r\n", "\n").replace('\r', "\n");
    let mut sections: Vec<Section> = Vec::new();
    let mut current_label: Option<String> = None;
    let mut buffer: Vec<String> = Vec::new();

    let flush = |label: &Option<String>, buffer: &mut Vec<String>, out: &mut Vec<Section>| {
        let text = buffer.join("\n").trim_matches('\n').to_string();
        buffer.clear();
        if text.trim().is_empty() {
            return;
        }
        out.push(Section {
            label: label.clone().unwrap_or_default(),
            text,
        });
    };

    for line in normalized.lines() {
        let trimmed = line.trim();
        let is_tag = trimmed.starts_with('[')
            && trimmed.ends_with(']')
            && trimmed.len() > 2
            && !trimmed[1..trimmed.len() - 1].contains('[');

        if is_tag {
            flush(&current_label, &mut buffer, &mut sections);
            current_label = Some(normalize_tag(trimmed));
        } else {
            // OpenSong prefixes chord lines with '.' and comments with ';'.
            if trimmed.starts_with('.') || trimmed.starts_with(';') {
                continue;
            }
            buffer.push(line.trim_end().to_string());
        }
    }
    flush(&current_label, &mut buffer, &mut sections);

    // Number repeated bare labels so two `[V]` blocks become Verse 1 / Verse 2.
    autonumber(sections)
}

/// Give repeated identical labels ordinals, and label untitled sections.
fn autonumber(mut sections: Vec<Section>) -> Vec<Section> {
    use std::collections::HashMap;
    let mut counts: HashMap<String, usize> = HashMap::new();
    for s in &sections {
        if !s.label.is_empty() {
            *counts.entry(s.label.clone()).or_insert(0) += 1;
        }
    }

    let mut seen: HashMap<String, usize> = HashMap::new();
    let mut untitled = 0usize;
    for s in &mut sections {
        if s.label.is_empty() {
            untitled += 1;
            s.label = format!("Section {untitled}");
            continue;
        }
        // Only add an ordinal when the bare label genuinely repeats and does
        // not already carry a number.
        let repeats = counts.get(&s.label).copied().unwrap_or(0) > 1;
        let has_number = s.label.chars().any(|c| c.is_ascii_digit());
        if repeats && !has_number {
            let n = seen.entry(s.label.clone()).or_insert(0);
            *n += 1;
            s.label = format!("{} {}", s.label, *n);
        }
    }
    sections
}

/// Strip RTF down to plain text.
///
/// EasyWorship stores slide bodies as RTF blobs. This is deliberately a
/// pragmatic reader, not a full RTF engine: it resolves the control words that
/// carry line structure and character encoding, and discards the rest.
pub fn rtf_to_plain(rtf: &str) -> String {
    let bytes = rtf.as_bytes();
    let mut out = String::with_capacity(rtf.len() / 2);
    let mut i = 0usize;
    let mut skip_depth: i32 = -1;
    let mut depth: i32 = 0;

    while i < bytes.len() {
        match bytes[i] {
            b'{' => {
                depth += 1;
                i += 1;
            }
            b'}' => {
                if skip_depth >= 0 && depth <= skip_depth {
                    skip_depth = -1;
                }
                depth -= 1;
                i += 1;
            }
            b'\\' => {
                i += 1;
                if i >= bytes.len() {
                    break;
                }
                match bytes[i] {
                    // Escaped literal characters.
                    b'\\' | b'{' | b'}' => {
                        if skip_depth < 0 {
                            out.push(bytes[i] as char);
                        }
                        i += 1;
                    }
                    // Hex-escaped byte: \'e9
                    b'\'' => {
                        if i + 2 < bytes.len() {
                            let hex = &rtf[i + 1..i + 3];
                            if let Ok(b) = u8::from_str_radix(hex, 16) {
                                if skip_depth < 0 {
                                    // Windows-1252 is EasyWorship's default codepage.
                                    let raw = [b];
                                    let (decoded, _, _) = encoding_rs::WINDOWS_1252.decode(&raw);
                                    out.push_str(&decoded);
                                }
                            }
                            i += 3;
                        } else {
                            i += 1;
                        }
                    }
                    // Control word.
                    _ => {
                        let start = i;
                        while i < bytes.len() && (bytes[i] as char).is_ascii_alphabetic() {
                            i += 1;
                        }
                        let word = &rtf[start..i];
                        // Optional numeric parameter.
                        let num_start = i;
                        if i < bytes.len() && (bytes[i] == b'-' || bytes[i].is_ascii_digit()) {
                            i += 1;
                            while i < bytes.len() && bytes[i].is_ascii_digit() {
                                i += 1;
                            }
                        }
                        let param: Option<i32> = rtf[num_start..i].parse().ok();
                        // A single trailing space is part of the control word.
                        if i < bytes.len() && bytes[i] == b' ' {
                            i += 1;
                        }

                        match word {
                            "par" | "line" | "sect" => {
                                if skip_depth < 0 {
                                    out.push('\n');
                                }
                            }
                            "tab" => {
                                if skip_depth < 0 {
                                    out.push('\t');
                                }
                            }
                            // Unicode escape: 舗? — the trailing char is a
                            // fallback we must discard.
                            "u" => {
                                if let Some(cp) = param {
                                    let cp = if cp < 0 { (cp + 65536) as u32 } else { cp as u32 };
                                    if skip_depth < 0 {
                                        if let Some(c) = char::from_u32(cp) {
                                            out.push(c);
                                        }
                                    }
                                }
                                if i < bytes.len() && bytes[i] != b'\\' && bytes[i] != b'}' {
                                    i += 1;
                                }
                            }
                            // Metadata groups whose contents are not lyrics.
                            "fonttbl" | "colortbl" | "stylesheet" | "info" | "pict" | "object"
                            | "themedata" | "colorschememapping" | "datastore" | "generator" => {
                                if skip_depth < 0 {
                                    skip_depth = depth;
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            b'\n' | b'\r' => {
                i += 1;
            }
            _ => {
                if skip_depth < 0 {
                    // Walk the whole UTF-8 sequence, not just one byte.
                    let ch = rtf[i..].chars().next().unwrap_or(' ');
                    out.push(ch);
                    i += ch.len_utf8();
                } else {
                    i += 1;
                }
            }
        }
    }

    out.lines()
        .map(|l| l.trim())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_compact_tags() {
        assert_eq!(normalize_tag("v1"), "Verse 1");
        assert_eq!(normalize_tag("V1"), "Verse 1");
        assert_eq!(normalize_tag("[c1]"), "Chorus 1");
        assert_eq!(normalize_tag("c"), "Chorus");
        assert_eq!(normalize_tag("b"), "Bridge");
        assert_eq!(normalize_tag("b2"), "Bridge 2");
        assert_eq!(normalize_tag("pre"), "Pre-Chorus");
        assert_eq!(normalize_tag("verse 3"), "Verse 3");
        assert_eq!(normalize_tag("Refrão"), "Chorus");
    }

    #[test]
    fn passes_through_custom_tags() {
        assert_eq!(normalize_tag("rap break"), "Rap Break");
    }

    #[test]
    fn splits_on_line_budget() {
        let text = "l1\nl2\nl3\nl4\nl5\nl6";
        let out = split_section(text, 4);
        assert_eq!(out, vec!["l1\nl2\nl3\nl4", "l5\nl6"]);
    }

    #[test]
    fn respects_explicit_blank_line_breaks() {
        let text = "a\nb\n\nc\nd";
        let out = split_section(text, 4);
        assert_eq!(out, vec!["a\nb", "c\nd"]);
    }

    #[test]
    fn parses_tagged_body_and_autonumbers() {
        let body = "[V]\nline one\n[V]\nline two\n[C]\nhook";
        let s = parse_tagged_body(body);
        assert_eq!(s.len(), 3);
        assert_eq!(s[0].label, "Verse 1");
        assert_eq!(s[1].label, "Verse 2");
        assert_eq!(s[2].label, "Chorus");
    }

    #[test]
    fn keeps_text_before_first_tag() {
        let s = parse_tagged_body("orphan line\n[C]\nhook");
        assert_eq!(s[0].label, "Section 1");
        assert_eq!(s[0].text, "orphan line");
    }

    #[test]
    fn strips_opensong_chord_lines() {
        let s = parse_tagged_body("[V1]\n.G   C   D\nAmazing grace");
        assert_eq!(s[0].text, "Amazing grace");
    }

    #[test]
    fn converts_rtf_bodies() {
        let rtf = r"{\rtf1\ansi{\fonttbl{\f0 Arial;}}\f0\fs24 Amazing grace\par how sweet\par}";
        let plain = rtf_to_plain(rtf);
        assert_eq!(plain, "Amazing grace\nhow sweet");
    }

    #[test]
    fn decodes_rtf_unicode_escapes() {
        let rtf = r"{\rtf1 Se\u241?or\par}";
        assert_eq!(rtf_to_plain(rtf), "Señor");
    }
}
