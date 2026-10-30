//! PPTX slide import.
//!
//! A `.pptx` file is a zip of OOXML parts. This module reads the presentation
//! relationship graph (`ppt/_rels/presentation.xml.rels` + the slide id list in
//! `ppt/presentation.xml`) so slides come back in *presentation* order rather
//! than on-disk `slideN.xml` numbering, then parses each slide's shape tree
//! (`p:spTree`) into CrossPresenter layers:
//!
//! * `p:sp` with text  -> a `Text` layer (position, font, colour, bold/italic/
//!   underline, alignment, and per-run spans preserved)
//! * `p:pic`           -> an `Image` layer whose media bytes are extracted to a
//!   temp folder the webview can read through the asset protocol
//! * autoshapes        -> a `Shape` layer (solid fill / outline); a full-slide
//!   solid rectangle is promoted to the slide background
//!
//! Tables, charts, SmartArt and grouped shapes are flattened to nothing rather
//! than failing the slide, because a real deck carries plenty of each and a
//! worship presentation rarely needs them. Unrecognised elements are skipped
//! rather than aborting the whole import.

use std::collections::HashMap;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

use quick_xml::events::Event;
use quick_xml::Reader;
use tauri::Manager;

use crate::model::{Layer, Rect, Slide, TextAlign, TextSpan, TextStyle, VerticalAlign};

// ---------------------------------------------------------------------------
// EMU (English Metric Units) -> normalised / pixel space
// ---------------------------------------------------------------------------

/// EMU per inch; 914400 EMU == 1in == 96px at the CSS reference resolution.
const EMU_PER_PX: f32 = 9525.0;
/// Fallback slide size when `presentation.xml` is missing (`<p:sldSz>`).
const DEFAULT_SLIDE_W_EMU: f32 = 9144000.0; // 10in
const DEFAULT_SLIDE_H_EMU: f32 = 6858000.0; // 7.5in (4:3)
/// CrossPresenter authors text against a 1080px-tall canvas.
const CANVAS_HEIGHT: f32 = 1080.0;

/// Map an EMU length to a 0..1 fraction of `axis` (presentation width/height).
fn emu_frac(v: f32, axis: f32) -> f32 {
    if axis <= 0.0 {
        0.0
    } else {
        (v / axis).clamp(0.0, 1.0)
    }
}

/// Map a font point size to a canvas-pixel size so a slide looks the same at
/// 1080p regardless of the source deck's physical slide dimensions.
fn pt_to_canvas_px(pt: f32, slide_h_emu: f32) -> f32 {
    if slide_h_emu <= 0.0 {
        return pt * (96.0 / 72.0);
    }
    let px_in_slide = (pt * 12700.0) / EMU_PER_PX;
    (px_in_slide / (slide_h_emu / EMU_PER_PX)) * CANVAS_HEIGHT
}

// ---------------------------------------------------------------------------
// Colour / geometry primitives
// ---------------------------------------------------------------------------

/// `srgbClr val="RRGGBB"` -> `#RRGGBB`.
fn hex_rgb(v: &[u8]) -> String {
    let s = String::from_utf8_lossy(v);
    let s = s.trim();
    if s.len() >= 6 && s.chars().all(|c| c.is_ascii_hexdigit()) {
        format!("#{}", s[..6].to_ascii_uppercase())
    } else {
        "#FFFFFF".into()
    }
}

/// `a:sysClr` with `lastClr`, `a:schemeClr` (approximate) or `a:prstClr`.
fn preset_color(name: &str) -> Option<&'static str> {
    Some(match name {
        "black" => "#000000",
        "white" => "#FFFFFF",
        "red" => "#FF0000",
        "green" => "#00FF00",
        "blue" => "#0000FF",
        "yellow" => "#FFFF00",
        "cyan" => "#00FFFF",
        "magenta" => "#FF00FF",
        "gray" | "grey" => "#808080",
        "dkGray" | "dkGrey" => "#404040",
        "ltGray" | "ltGrey" => "#C0C0C0",
        _ => return None,
    })
}

/// Theme colour slot -> the Office default palette, used only when a slide
/// inherits its colour from the master theme (which this importer does not
/// resolve). Close enough that a deck looks right; never exact for custom
/// themes.
fn scheme_color(name: &str) -> Option<&'static str> {
    Some(match name {
        "tx1" | "dk1" => "#000000",
        "tx2" | "dk2" => "#44546A",
        "bg1" | "lt1" => "#FFFFFF",
        "bg2" | "lt2" => "#E7E6E6",
        "accent1" => "#4472C4",
        "accent2" => "#ED7D31",
        "accent3" => "#A5A5A5",
        "accent4" => "#FFC000",
        "accent5" => "#5B9BD5",
        "accent6" => "#70AD47",
        "hlink" => "#0563C1",
        "folHlink" => "#954F72",
        _ => return None,
    })
}

#[derive(Clone, Copy, Default)]
struct RectEmu {
    x: f32,
    y: f32,
    cx: f32,
    cy: f32,
}

impl RectEmu {
    fn is_empty(&self) -> bool {
        self.cx <= 0.0 || self.cy <= 0.0
    }
    fn is_full_slide(&self, w: f32, h: f32) -> bool {
        self.cx >= w * 0.98 && self.cy >= h * 0.98 && self.x <= w * 0.01 && self.y <= h * 0.01
    }
    fn normalized(self, w: f32, h: f32) -> Rect {
        Rect {
            x: emu_frac(self.x, w),
            y: emu_frac(self.y, h),
            width: emu_frac(self.cx, w).max(0.02),
            height: emu_frac(self.cy, h).max(0.02),
        }
    }
}

/// A span of text sharing one run's formatting. Pixel font sizes are resolved
/// later (once the slide height is known), so raw point sizes are carried here.
struct RawSpan {
    start: usize,
    end: usize,
    bold: Option<bool>,
    italic: Option<bool>,
    underline: Option<bool>,
    color: Option<String>,
    size_pt: Option<f32>,
    font: Option<String>,
}

/// A text body parsed off one shape.
#[derive(Default)]
struct TextBody {
    text: String,
    spans: Vec<RawSpan>,
    align: TextAlign,
    vertical: VerticalAlign,
    size_pt: Option<f32>,
    color: Option<String>,
    font: Option<String>,
    bold: Option<bool>,
    italic: Option<bool>,
    underline: Option<bool>,
    line_height: Option<f32>,
    letter_spacing: Option<f32>,
}

/// Everything a slide's shape tree yields.
#[derive(Default)]
struct SlideContent {
    shapes: Vec<RawShape>,
    /// Solid colour from the slide's own `<p:bg>` element, if present.
    background: Option<String>,
}

struct RawShape {
    kind: RawKind,
    rect: RectEmu,
    rotation: f32,
}

enum RawKind {
    Text(TextBody),
    Image {
        path: String,
        opacity: f32,
    },
    Shape {
        fill: String,
        fill_alpha: f32,
        stroke: String,
        stroke_width: f32,
    },
}

// ---------------------------------------------------------------------------
// Shape-tree parser
// ---------------------------------------------------------------------------

/// Parse one `slideN.xml` shape tree into ordered `RawShape`s plus any solid
/// background, resolving image relationships via `rels`.
fn parse_slide(xml: &str, rels: &HashMap<String, String>) -> Result<SlideContent, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut buf = Vec::new();

    let mut out = SlideContent::default();
    // `stack` records the currently-open container so text and geometry can be
    // attributed to the right shape.
    let mut stack: Vec<String> = Vec::new();
    let mut in_txbody = false;

    let mut cur_rect = RectEmu::default();
    let mut cur_rot = 0.0f32;
    let mut cur_text: Option<TextBody> = None;
    let mut cur_img: Option<RawShape> = None;
    let mut cur_shape_fill: Option<(String, f32)> = None;
    let mut cur_shape_stroke: Option<(String, f32)> = None;
    let mut span_start = 0usize;
    let mut in_bg = false;

    let top = |stack: &Vec<String>| stack.last().cloned().unwrap_or_default();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).into_owned();
                stack.push(name.clone());
                // A `<p:bg>` solid fill is the slide background; flag it so a
                // following colour element lands there instead of on a shape.
                if name == "bg" {
                    in_bg = true;
                }
                match name.as_str() {
                    "sp" => {
                        cur_rect = RectEmu::default();
                        cur_rot = 0.0;
                        cur_text = None;
                    }
                    "pic" => {
                        cur_rect = RectEmu::default();
                        cur_rot = 0.0;
                        cur_img = None;
                    }
                    "txBody" => {
                        in_txbody = true;
                        if cur_text.is_none() {
                            cur_text = Some(TextBody::default());
                        }
                    }
                    "rPr" => {
                        if in_txbody {
                            span_start = cur_text.as_ref().map(|t| t.text.len()).unwrap_or(0);
                        } else {
                            // Shape-level default run properties (p:sp's first rPr).
                            span_start = usize::MAX;
                        }
                    }
                    "r" => {
                        if in_txbody {
                            span_start = cur_text.as_ref().map(|t| t.text.len()).unwrap_or(0);
                        }
                    }
                    "br" => {
                        if let Some(t) = cur_text.as_mut() {
                            t.text.push('\n');
                        }
                    }
                    "ln" => {
                        cur_shape_stroke = None;
                    }
                    _ => {}
                }

                // Attributes handled on Start (and Empty) elements.
                for a in e.attributes().flatten() {
                    let key = String::from_utf8_lossy(a.key.as_ref()).into_owned();
                    // Strip any namespace prefix (`r:embed` -> `embed`) so the
                    // match arms stay prefix-agnostic.
                    let key = key.rsplit(':').next().unwrap_or(&key).to_string();
                    let val = String::from_utf8_lossy(a.value.as_ref()).into_owned();
                    match (name.as_str(), key.as_str()) {
                        ("off", "x") => cur_rect.x = val.parse().unwrap_or(cur_rect.x),
                        ("off", "y") => cur_rect.y = val.parse().unwrap_or(cur_rect.y),
                        ("ext", "cx") => cur_rect.cx = val.parse().unwrap_or(cur_rect.cx),
                        ("ext", "cy") => cur_rect.cy = val.parse().unwrap_or(cur_rect.cy),
                        ("xfrm", "rot") => cur_rot = val.parse::<f32>().unwrap_or(0.0) / 60000.0,
                        ("srgbClr", "val") => {
                            if in_txbody {
                                if let Some(t) = cur_text.as_mut() {
                                    let c = hex_rgb(val.as_bytes());
                                    set_run_color(t, span_start, c);
                                }
                            } else if top(&stack) == "ln" {
                                cur_shape_stroke = Some((hex_rgb(val.as_bytes()), 1.0));
                            } else {
                                cur_shape_fill = Some((hex_rgb(val.as_bytes()), 1.0));
                            }
                        }
                        ("sysClr", "lastClr") => {
                            let c = hex_rgb(val.as_bytes());
                            if in_txbody {
                                if let Some(t) = cur_text.as_mut() {
                                    set_run_color(t, span_start, c);
                                }
                            } else if top(&stack) == "ln" {
                                cur_shape_stroke = Some((c, 1.0));
                            } else {
                                cur_shape_fill = Some((c, 1.0));
                            }
                        }
                        ("schemeClr", "val") => {
                            if let Some(c) = scheme_color(&val) {
                                let c = c.to_string();
                                if in_txbody {
                                    if let Some(t) = cur_text.as_mut() {
                                        set_run_color(t, span_start, c);
                                    }
                                } else if top(&stack) == "ln" {
                                    cur_shape_stroke = Some((c, 1.0));
                                } else {
                                    cur_shape_fill = Some((c, 1.0));
                                }
                            }
                        }
                        ("prstClr", "val") => {
                            if let Some(c) = preset_color(&val) {
                                let c = c.to_string();
                                if in_txbody {
                                    if let Some(t) = cur_text.as_mut() {
                                        set_run_color(t, span_start, c);
                                    }
                                } else {
                                    cur_shape_fill = Some((c, 1.0));
                                }
                            }
                        }
                        ("rPr", "sz") => {
                            let pt = val.parse::<f32>().unwrap_or(0.0) / 100.0;
                            if let Some(t) = cur_text.as_mut() {
                                if span_start == usize::MAX {
                                    t.size_pt = Some(pt);
                                } else {
                                    // The first run also seeds the box default so a
                                    // single-run text box carries its true size.
                                    if t.size_pt.is_none() {
                                        t.size_pt = Some(pt);
                                    }
                                    push_span_size(t, span_start, pt);
                                }
                            }
                        }
                        ("rPr", "b") => {
                            let b = val == "1" || val.eq_ignore_ascii_case("true");
                            if let Some(t) = cur_text.as_mut() {
                                if span_start != usize::MAX {
                                    if t.bold.is_none() {
                                        t.bold = Some(b);
                                    }
                                    push_span_bold(t, span_start, b);
                                } else {
                                    t.bold = Some(b);
                                }
                            }
                        }
                        ("rPr", "i") => {
                            let i = val == "1" || val.eq_ignore_ascii_case("true");
                            if let Some(t) = cur_text.as_mut() {
                                if span_start != usize::MAX {
                                    if t.italic.is_none() {
                                        t.italic = Some(i);
                                    }
                                    push_span_italic(t, span_start, i);
                                } else {
                                    t.italic = Some(i);
                                }
                            }
                        }
                        ("rPr", "u") => {
                            let u = val != "none";
                            if let Some(t) = cur_text.as_mut() {
                                if span_start != usize::MAX {
                                    if t.underline.is_none() {
                                        t.underline = Some(u);
                                    }
                                    push_span_underline(t, span_start, u);
                                } else {
                                    t.underline = Some(u);
                                }
                            }
                        }
                        ("rPr", "spc") => {
                            let spc = val.parse::<f32>().unwrap_or(0.0) / 100.0;
                            if let Some(t) = cur_text.as_mut() {
                                t.letter_spacing = Some(spc);
                            }
                        }
                        ("latin", "typeface") => {
                            if let Some(t) = cur_text.as_mut() {
                                if t.font.is_none() {
                                    t.font = Some(val.clone());
                                }
                            }
                        }
                        ("spcPct", "val") => {
                            // `spcPct val` is thousandths of a percent (100000 = 100%).
                            let pct = val.parse::<f32>().unwrap_or(100000.0) / 100000.0;
                            if let Some(t) = cur_text.as_mut() {
                                t.line_height = Some(pct);
                            }
                        }
                        ("pPr", "algn") => {
                            if let Some(t) = cur_text.as_mut() {
                                t.align = match val.as_str() {
                                    "l" => TextAlign::Left,
                                    "r" => TextAlign::Right,
                                    "just" | "dist" => TextAlign::Justify,
                                    _ => TextAlign::Center,
                                };
                            }
                        }
                        ("bodyPr", "anchor") => {
                            if let Some(t) = cur_text.as_mut() {
                                t.vertical = match val.as_str() {
                                    "t" => VerticalAlign::Top,
                                    "b" => VerticalAlign::Bottom,
                                    _ => VerticalAlign::Middle,
                                };
                            }
                        }
                        ("ln", "w") => {
                            let w = val.parse::<f32>().unwrap_or(0.0);
                            if let Some((c, _)) = cur_shape_stroke.take() {
                                cur_shape_stroke = Some((c, w / EMU_PER_PX));
                            } else {
                                cur_shape_stroke = Some(("#000000".into(), w / EMU_PER_PX));
                            }
                        }
                        ("blip", "embed") => {
                            if let Some(target) = rels.get(&val) {
                                cur_img = Some(RawShape {
                                    kind: RawKind::Image {
                                        path: target.clone(),
                                        opacity: 1.0,
                                    },
                                    rect: RectEmu::default(),
                                    rotation: 0.0,
                                });
                            }
                        }
                        ("bg", "fillRef") => {
                            if val.starts_with("srgbClr") || val.is_empty() {
                                // Handled elsewhere; ignore refs.
                            }
                        }
                        _ => {}
                    }
                }
            }
            Ok(Event::Empty(e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).into_owned();
                for a in e.attributes().flatten() {
                    let key = String::from_utf8_lossy(a.key.as_ref()).into_owned();
                    let key = key.rsplit(':').next().unwrap_or(&key).to_string();
                    let val = String::from_utf8_lossy(a.value.as_ref()).into_owned();
                    match (name.as_str(), key.as_str()) {
                        ("off", "x") => cur_rect.x = val.parse().unwrap_or(cur_rect.x),
                        ("off", "y") => cur_rect.y = val.parse().unwrap_or(cur_rect.y),
                        ("ext", "cx") => cur_rect.cx = val.parse().unwrap_or(cur_rect.cx),
                        ("ext", "cy") => cur_rect.cy = val.parse().unwrap_or(cur_rect.cy),
                        ("srgbClr", "val") => {
                            let c = hex_rgb(val.as_bytes());
                            if in_bg {
                                out.background = Some(c);
                            } else if top(&stack) == "ln" {
                                let w = cur_shape_stroke.map(|(_, w)| w).unwrap_or(1.0);
                                cur_shape_stroke = Some((c, w));
                            } else {
                                let a = cur_shape_fill.map(|(_, a)| a).unwrap_or(1.0);
                                cur_shape_fill = Some((c, a));
                            }
                        }
                        ("sysClr", "lastClr") => {
                            let c = hex_rgb(val.as_bytes());
                            if top(&stack) == "ln" {
                                cur_shape_stroke = Some((c, 1.0));
                            } else {
                                cur_shape_fill = Some((c, 1.0));
                            }
                        }
                        ("schemeClr", "val") => {
                            if let Some(c) = scheme_color(&val) {
                                if top(&stack) == "ln" {
                                    cur_shape_stroke = Some((c.into(), 1.0));
                                } else {
                                    cur_shape_fill = Some((c.into(), 1.0));
                                }
                            }
                        }
                        ("ln", "w") => {
                            let w = val.parse::<f32>().unwrap_or(0.0) / EMU_PER_PX;
                            let c = cur_shape_stroke.map(|(c, _)| c).unwrap_or_else(|| "#000000".into());
                            cur_shape_stroke = Some((c, w));
                        }
                        ("rPr", "sz") => {
                            let pt = val.parse::<f32>().unwrap_or(0.0) / 100.0;
                            if let Some(t) = cur_text.as_mut() {
                                if span_start == usize::MAX {
                                    t.size_pt = Some(pt);
                                } else {
                                    push_span_size(t, span_start, pt);
                                }
                            }
                        }
                        ("rPr", "b") => {
                            let b = val == "1" || val.eq_ignore_ascii_case("true");
                            if let Some(t) = cur_text.as_mut() {
                                if span_start != usize::MAX {
                                    push_span_bold(t, span_start, b);
                                } else {
                                    t.bold = Some(b);
                                }
                            }
                        }
                        ("rPr", "i") => {
                            let i = val == "1" || val.eq_ignore_ascii_case("true");
                            if let Some(t) = cur_text.as_mut() {
                                if span_start != usize::MAX {
                                    push_span_italic(t, span_start, i);
                                } else {
                                    t.italic = Some(i);
                                }
                            }
                        }
                        ("rPr", "u") => {
                            let u = val != "none";
                            if let Some(t) = cur_text.as_mut() {
                                if span_start != usize::MAX {
                                    push_span_underline(t, span_start, u);
                                } else {
                                    t.underline = Some(u);
                                }
                            }
                        }
                        ("latin", "typeface") => {
                            if let Some(t) = cur_text.as_mut() {
                                t.font = Some(val.clone());
                            }
                        }
                        ("pPr", "algn") => {
                            if let Some(t) = cur_text.as_mut() {
                                t.align = match val.as_str() {
                                    "l" => TextAlign::Left,
                                    "r" => TextAlign::Right,
                                    "just" | "dist" => TextAlign::Justify,
                                    _ => TextAlign::Center,
                                };
                            }
                        }
                        ("bodyPr", "anchor") => {
                            if let Some(t) = cur_text.as_mut() {
                                t.vertical = match val.as_str() {
                                    "t" => VerticalAlign::Top,
                                    "b" => VerticalAlign::Bottom,
                                    _ => VerticalAlign::Middle,
                                };
                            }
                        }
                        ("blip", "embed") => {
                            if let Some(target) = rels.get(&val) {
                                cur_img = Some(RawShape {
                                    kind: RawKind::Image {
                                        path: target.clone(),
                                        opacity: 1.0,
                                    },
                                    rect: RectEmu::default(),
                                    rotation: 0.0,
                                });
                            }
                        }
                        _ => {}
                    }
                }
                // Self-closing structural cues.
                if name == "br" {
                    if let Some(t) = cur_text.as_mut() {
                        t.text.push('\n');
                    }
                }
            }
            Ok(Event::Text(t)) => {
                if stack.last().map(|s| s.as_str()) == Some("t") {
                    if let Some(body) = cur_text.as_mut() {
                        let decoded = t.unescape().map_err(|e| e.to_string())?;
                        body.text.push_str(&decoded);
                    }
                }
            }
            Ok(Event::End(e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).into_owned();
                match name.as_str() {
                    "sp" => {
                        if let Some(body) = cur_text.take() {
                            if !body.text.trim().is_empty() {
                                out.shapes.push(RawShape {
                                    kind: RawKind::Text(body),
                                    rect: cur_rect,
                                    rotation: cur_rot,
                                });
                            }
                        } else if let Some((fill, a)) = cur_shape_fill.take() {
                            let stroke = cur_shape_stroke.take();
                            out.shapes.push(RawShape {
                                kind: RawKind::Shape {
                                    fill,
                                    fill_alpha: a,
                                    stroke: stroke.as_ref().map(|(c, _)| c.clone()).unwrap_or_default(),
                                    stroke_width: stroke.map(|(_, w)| w).unwrap_or(0.0),
                                },
                                rect: cur_rect,
                                rotation: cur_rot,
                            });
                        }
                        cur_shape_stroke = None;
                        cur_shape_fill = None;
                    }
                    "pic" => {
                        if let Some(shape) = cur_img.take() {
                            out.shapes.push(RawShape {
                                kind: shape.kind,
                                rect: cur_rect,
                                rotation: cur_rot,
                            });
                        }
                    }
                    "txBody" => in_txbody = false,
                    "bg" => in_bg = false,
                    "rPr" => span_start = 0,
                    _ => {}
                }
                stack.pop();
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("malformed slide XML: {e}")),
            _ => {}
        }
        buf.clear();
    }

    Ok(out)
}

// Span accumulation helpers: a later `rPr` for the same start extends the run.
fn set_run_color(t: &mut TextBody, start: usize, c: String) {
    if start == usize::MAX {
        t.color = Some(c);
        return;
    }
    // The first run seeds the box default so a single-run box carries colour.
    if t.color.is_none() {
        t.color = Some(c.clone());
    }
    push_span_color(t, start, c);
}
fn push_span_color(t: &mut TextBody, start: usize, c: String) {
    ensure_span(t, start);
    if let Some(s) = t.spans.iter_mut().rev().find(|s| s.start == start) {
        s.color = Some(c);
    }
}
fn push_span_size(t: &mut TextBody, start: usize, pt: f32) {
    ensure_span(t, start);
    if let Some(s) = t.spans.iter_mut().rev().find(|s| s.start == start) {
        s.size_pt = Some(pt);
    }
}
fn push_span_bold(t: &mut TextBody, start: usize, b: bool) {
    ensure_span(t, start);
    if let Some(s) = t.spans.iter_mut().rev().find(|s| s.start == start) {
        s.bold = Some(b);
    }
}
fn push_span_italic(t: &mut TextBody, start: usize, i: bool) {
    ensure_span(t, start);
    if let Some(s) = t.spans.iter_mut().rev().find(|s| s.start == start) {
        s.italic = Some(i);
    }
}
fn push_span_underline(t: &mut TextBody, start: usize, u: bool) {
    ensure_span(t, start);
    if let Some(s) = t.spans.iter_mut().rev().find(|s| s.start == start) {
        s.underline = Some(u);
    }
}
fn ensure_span(t: &mut TextBody, start: usize) {
    if !t.spans.iter().any(|s| s.start == start) {
        t.spans.push(RawSpan {
            start,
            end: start,
            bold: None,
            italic: None,
            underline: None,
            color: None,
            size_pt: None,
            font: None,
        });
    }
}

// ---------------------------------------------------------------------------
// Slide assembly
// ---------------------------------------------------------------------------

/// Turn parsed shape trees into CrossPresenter slides. Runs after all parts are
/// read so the presentation size is known for every conversion.
fn assemble(slides_raw: Vec<SlideContent>, w_emu: f32, h_emu: f32) -> Vec<Slide> {
    let mut slides: Vec<Slide> = Vec::with_capacity(slides_raw.len());

    for (idx, content) in slides_raw.into_iter().enumerate() {
        let id = format!("pptx-{}", idx + 1);
        let mut layers: Vec<Layer> = Vec::new();

        // A decorative full-slide rectangle is a background, not a layer.
        let mut background = content.background.clone();

        for shape in content.shapes {
            if let RawKind::Shape { fill, .. } = &shape.kind {
                if shape.rect.is_full_slide(w_emu, h_emu) {
                    background = Some(fill.clone());
                    continue;
                }
            }

            match shape.kind {
                RawKind::Text(body) => {
                    if body.text.trim().is_empty() {
                        continue;
                    }
                    let rect = shape.rect.normalized(w_emu, h_emu);
                    let style = build_style(&body, h_emu);
                    let spans = build_spans(&body, h_emu);
                    layers.push(Layer::Text {
                        id: format!("{id}-t{}", layers.len()),
                        rect,
                        text: body.text.trim_end().to_string(),
                        style,
                        spans,
                        auto_fit: false,
                        rotation: shape.rotation,
                        visible: true,
                        locked: false,
                    });
                }
                RawKind::Image { path, opacity } => {
                    if shape.rect.is_empty() {
                        continue;
                    }
                    let rect = shape.rect.normalized(w_emu, h_emu);
                    layers.push(Layer::Image {
                        id: format!("{id}-i{}", layers.len()),
                        rect,
                        src: path,
                        opacity: opacity.clamp(0.0, 1.0),
                        rotation: shape.rotation,
                        visible: true,
                        locked: false,
                    });
                }
                RawKind::Shape {
                    fill,
                    fill_alpha,
                    stroke,
                    stroke_width,
                } => {
                    if shape.rect.is_empty() {
                        continue;
                    }
                    let rect = shape.rect.normalized(w_emu, h_emu);
                    layers.push(Layer::Shape {
                        id: format!("{id}-s{}", layers.len()),
                        rect,
                        fill,
                        stroke,
                        stroke_width,
                        corner_radius: 0.0,
                        opacity: fill_alpha.clamp(0.0, 1.0),
                        rotation: shape.rotation,
                        visible: true,
                        locked: false,
                    });
                }
            }
        }

        let background = background.map(|color| crate::model::Background::Color { color });

        slides.push(Slide {
            id,
            label: format!("Slide {}", idx + 1),
            layers,
            background,
            transition: crate::model::Transition::Fade,
            notes: String::new(),
            group_color: String::new(),
        });
    }

    slides
}

fn build_style(body: &TextBody, h_emu: f32) -> TextStyle {
    let style = TextStyle {
        font_family: body.font.clone().unwrap_or_else(|| "Inter".into()),
        font_size: pt_to_canvas_px(body.size_pt.unwrap_or(18.0), h_emu),
        color: body.color.clone().unwrap_or_else(|| "#FFFFFF".into()),
        bold: body.bold.unwrap_or(false),
        italic: body.italic.unwrap_or(false),
        underline: body.underline.unwrap_or(false),
        align: body.align,
        vertical_align: body.vertical,
        line_height: body.line_height.unwrap_or(1.2),
        letter_spacing: body.letter_spacing.unwrap_or(0.0),
        // The deck's own shadow/outline is not resolved; start clean.
        shadow: String::new(),
        stroke_width: 0.0,
        ..TextStyle::default()
    };
    style
}

fn build_spans(body: &TextBody, h_emu: f32) -> Vec<TextSpan> {
    let mut spans: Vec<TextSpan> = Vec::new();
    for raw in &body.spans {
        if raw.start >= body.text.len() {
            continue;
        }
        let end = raw.end.max(raw.start);
        spans.push(TextSpan {
            start: raw.start,
            end,
            bold: raw.bold,
            italic: raw.italic,
            underline: raw.underline,
            color: raw.color.clone(),
            font_size: raw.size_pt.map(|pt| pt_to_canvas_px(pt, h_emu)),
            font_family: raw.font.clone(),
        });
    }
    spans
}

// ---------------------------------------------------------------------------
// Relationship + presentation graph
// ---------------------------------------------------------------------------

/// `ppt/slides/_rels/slideN.xml.rels` -> map of rId -> `media/...` path,
/// resolved to a zip entry name (`ppt/media/image1.png`).
fn media_target(base_dir: &str, target: &str) -> String {
    if target.starts_with('/') {
        return target.trim_start_matches('/').to_string();
    }
    // Resolve `../media/x.png` against the rels' owning part directory.
    let mut parts: Vec<&str> = base_dir.split('/').filter(|s| !s.is_empty()).collect();
    for seg in target.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            other => parts.push(other),
        }
    }
    parts.join("/")
}

fn parse_rels(xml: &str, owner_dir: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                if e.local_name().as_ref() == b"Relationship" {
                    let mut id = String::new();
                    let mut target = String::new();
                    let mut external = false;
                    for a in e.attributes().flatten() {
                        match a.key.as_ref() {
                            b"Id" => id = String::from_utf8_lossy(&a.value).into_owned(),
                            b"Target" => target = String::from_utf8_lossy(&a.value).into_owned(),
                            b"TargetMode" => {
                                external = a.value.as_ref() == b"External";
                            }
                            _ => {}
                        }
                    }
                    if !id.is_empty() && !target.is_empty() && !external {
                        map.insert(id, media_target(owner_dir, &target));
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    map
}

/// Slide id -> `slides/slideN.xml` path, resolved from the presentation part's
/// relationships. Preserves authored order.
fn presentation_slide_order(presentation_xml: &str, rels: &HashMap<String, String>) -> Vec<String> {
    let mut order = Vec::new();
    let mut reader = Reader::from_str(presentation_xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                if e.local_name().as_ref() == b"sldId" {
                    for a in e.attributes().flatten() {
                        if a.key.as_ref() == b"r:id" {
                            let rid = String::from_utf8_lossy(&a.value).into_owned();
                            if let Some(target) = rels.get(&rid) {
                                order.push(target.clone());
                            }
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    order
}

/// `<p:sldSz cx cy>` from `presentation.xml`, falling back to 4:3 defaults.
fn presentation_size(xml: &str) -> (f32, f32) {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut w = DEFAULT_SLIDE_W_EMU;
    let mut h = DEFAULT_SLIDE_H_EMU;
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                if e.local_name().as_ref() == b"sldSz" {
                    for a in e.attributes().flatten() {
                        match a.key.as_ref() {
                            b"cx" => w = String::from_utf8_lossy(&a.value).parse().unwrap_or(w),
                            b"cy" => h = String::from_utf8_lossy(&a.value).parse().unwrap_or(h),
                            _ => {}
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    (w.max(1.0), h.max(1.0))
}

// ---------------------------------------------------------------------------
// Archive driver
// ---------------------------------------------------------------------------

/// A single slide XML part is at most a few hundred KB. The declared size in
/// a zip header is attacker-controlled, so it must never be trusted as a
/// `Vec::with_capacity` without a bound — a crafted `.pptx` could otherwise
/// force a giant allocation (OOM) before a byte is read.
const MAX_SLIDE_PART_BYTES: u64 = 16 * 1024 * 1024;

/// Extracted media is written to disk for the webview to load via the asset
/// protocol; each file is capped so one huge video cannot fill the temp dir.
const MAX_MEDIA_BYTES: u64 = 64 * 1024 * 1024;

fn read_part(zip: &mut zip::ZipArchive<BufReader<std::fs::File>>, name: &str, cap: u64) -> Option<Vec<u8>> {
    let mut entry = zip.by_name(name).ok()?;
    if entry.size() > cap {
        return None;
    }
    let mut buf = Vec::with_capacity(entry.size().min(cap) as usize);
    entry.read_to_end(&mut buf).ok()?;
    Some(buf)
}

fn extract_blocking(path: &Path, temp_root: PathBuf) -> Result<Vec<Slide>, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("cannot open {}: {e}", path.display()))?;
    let mut zip = zip::ZipArchive::new(BufReader::with_capacity(1 << 20, file))
        .map_err(|e| format!("{} is not a readable .pptx file: {e}", path.display()))?;

    // ---- presentation graph ---------------------------------------------
    let presentation = read_part(&mut zip, "ppt/presentation.xml", MAX_SLIDE_PART_BYTES);
    let pres_rels = read_part(&mut zip, "ppt/_rels/presentation.xml.rels", MAX_SLIDE_PART_BYTES)
        .map(|b| parse_rels(&String::from_utf8_lossy(&b), "ppt"))
        .unwrap_or_default();

    let (w_emu, h_emu) = presentation
        .as_ref()
        .map(|b| presentation_size(&String::from_utf8_lossy(b)))
        .unwrap_or((DEFAULT_SLIDE_W_EMU, DEFAULT_SLIDE_H_EMU));

    let ordered: Vec<String> = presentation
        .as_ref()
        .map(|b| presentation_slide_order(&String::from_utf8_lossy(b), &pres_rels))
        .unwrap_or_default();

    // Fall back to on-disk slide order if the graph is missing/unreadable.
    let slide_parts: Vec<String> = if ordered.is_empty() {
        let mut found: Vec<(u32, String)> = Vec::new();
        for i in 0..zip.len() {
            if let Ok(entry) = zip.by_index(i) {
                if let Some(n) = slide_number(entry.name()) {
                    found.push((n, entry.name().to_string()));
                }
            }
        }
        found.sort_by_key(|(n, _)| *n);
        found.into_iter().map(|(_, name)| name).collect()
    } else {
        ordered
    };

    if slide_parts.is_empty() {
        return Err(format!(
            "{} contains no slides — is this a valid .pptx file?",
            path.display()
        ));
    }

    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("deck")
        .to_string();

    // ---- per-slide parse (collect content first) -------------------------
    let mut contents: Vec<SlideContent> = Vec::with_capacity(slide_parts.len().min(512));
    let mut needed_media: Vec<String> = Vec::new();

    for part in &slide_parts {
        let xml = match read_part(&mut zip, part, MAX_SLIDE_PART_BYTES) {
            Some(b) => String::from_utf8_lossy(&b).into_owned(),
            None => continue,
        };
        let owner_dir = part.rsplit_once('/').map(|(d, _)| d).unwrap_or("");
        let rels_name = match part.rsplit_once('/') {
            Some((dir, file)) => format!("{dir}/_rels/{file}.rels"),
            None => String::new(),
        };
        let rels = read_part(&mut zip, &rels_name, MAX_SLIDE_PART_BYTES)
            .map(|b| parse_rels(&String::from_utf8_lossy(&b), owner_dir))
            .unwrap_or_default();

        let mut content = parse_slide(&xml, &rels)?;
        for shape in &content.shapes {
            if let RawKind::Image { path, .. } = &shape.kind {
                if !needed_media.iter().any(|m| m == path) {
                    needed_media.push(path.clone());
                }
            }
        }
        contents.push(std::mem::take(&mut content));
    }

    // ---- extract media to a temp folder ----------------------------------
    let media_dir = temp_root.join(&stem);
    let mut path_map: HashMap<String, String> = HashMap::new();
    if !needed_media.is_empty() {
        std::fs::create_dir_all(&media_dir)
            .map_err(|e| format!("cannot create media cache {}: {e}", media_dir.display()))?;
        for entry_name in &needed_media {
            let Some(bytes) = read_part(&mut zip, entry_name, MAX_MEDIA_BYTES) else {
                continue;
            };
            let file_name = entry_name.rsplit('/').next().unwrap_or("asset");
            let dest = media_dir.join(sanitize_file_name(file_name));
            if std::fs::write(&dest, &bytes).is_ok() {
                path_map.insert(entry_name.clone(), dest.to_string_lossy().into_owned());
            }
        }
    }

    // ---- assemble slides -------------------------------------------------
    // Rewrite the placeholder media paths to their extracted locations.
    for content in &mut contents {
        for shape in &mut content.shapes {
            if let RawKind::Image { path, .. } = &mut shape.kind {
                if let Some(real) = path_map.get(path) {
                    *path = real.clone();
                }
            }
        }
    }

    Ok(assemble(contents, w_emu, h_emu))
}

/// Keep only the final path component, stripped of anything that could escape
/// the cache directory.
fn sanitize_file_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

fn slide_number(name: &str) -> Option<u32> {
    name.strip_prefix("ppt/slides/slide")?.strip_suffix(".xml")?.parse().ok()
}

/// Unzip a `.pptx` and return one editable slide per presentation slide, with
/// text, colours, fonts, positions and images preserved as layers.
#[tauri::command]
pub async fn extract_pptx_slides(app: tauri::AppHandle, path: String) -> Result<Vec<Slide>, String> {
    let temp_root = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("no cache directory available: {e}"))?
        .join("pptx");
    tauri::async_runtime::spawn_blocking(move || extract_blocking(Path::new(&path), temp_root))
        .await
        .map_err(|e| format!("pptx extraction task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_slide_number_from_part_name() {
        assert_eq!(slide_number("ppt/slides/slide1.xml"), Some(1));
        assert_eq!(slide_number("ppt/slides/slide12.xml"), Some(12));
        assert_eq!(slide_number("ppt/slides/_rels/slide1.xml.rels"), None);
        assert_eq!(slide_number("ppt/slideLayouts/slideLayout1.xml"), None);
    }

    #[test]
    fn converts_points_against_canvas_height() {
        // 10in tall slide (16:9 at 13.33in wide) — 72pt should be ~0.1 of it.
        let h = 5486400.0; // 6in
        let px = pt_to_canvas_px(72.0, h);
        // 72pt = 1in = 96px on a 6in-tall slide -> 96/6 * 1080 = 17280? No:
        // 1in/6in = 0.1667 of the canvas, *1080 = 180px.
        assert!((px - 180.0).abs() < 1.0, "got {px}");
    }

    #[test]
    fn reads_text_run_properties() {
        let xml = r#"<p:sld xmlns:p="p" xmlns:a="a">
            <p:cSld><p:spTree>
              <p:sp>
                <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="685800"/></a:xfrm></p:spPr>
                <p:txBody>
                  <a:bodyPr anchor="ctr"/>
                  <a:p><a:pPr algn="ctr"/>
                    <a:r><a:rPr sz="4400" b="1"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>Hello</a:t></a:r>
                  </a:p>
                </p:txBody>
              </p:sp>
            </p:spTree></p:cSld>
        </p:sld>"#;
        let content = parse_slide(xml, &HashMap::new()).unwrap();
        assert_eq!(content.shapes.len(), 1);
        match &content.shapes[0].kind {
            RawKind::Text(body) => {
                assert_eq!(body.text, "Hello");
                assert_eq!(body.size_pt, Some(44.0));
                assert_eq!(body.bold, Some(true));
                assert!(!body.spans.is_empty());
            }
            _ => panic!("expected a text shape"),
        }
        assert!((content.shapes[0].rect.cx - 9144000.0).abs() < 1.0);
    }

    #[test]
    fn resolves_relative_media_targets() {
        assert_eq!(media_target("ppt/slides", "../media/image1.png"), "ppt/media/image1.png");
        assert_eq!(media_target("ppt", "media/image2.jpeg"), "ppt/media/image2.jpeg");
        assert_eq!(media_target("ppt/slides", "/ppt/media/x.png"), "ppt/media/x.png");
    }

    #[test]
    fn reads_presentation_size_and_order() {
        let xml = r#"<p:presentation xmlns:r="r">
            <p:sldSz cx="12192000" cy="6858000"/>
            <p:sldIdLst>
              <p:sldId id="256" r:id="rId2"/>
              <p:sldId id="257" r:id="rId3"/>
            </p:sldIdLst>
        </p:presentation>"#;
        assert_eq!(presentation_size(xml), (12192000.0, 6858000.0));
        let mut rels = HashMap::new();
        rels.insert("rId2".to_string(), "slides/slide1.xml".to_string());
        rels.insert("rId3".to_string(), "slides/slide2.xml".to_string());
        assert_eq!(
            presentation_slide_order(xml, &rels),
            vec!["slides/slide1.xml".to_string(), "slides/slide2.xml".to_string()]
        );
    }

    #[test]
    fn parses_rels_and_skips_external() {
        let xml = r#"<Relationships>
            <Relationship Id="rId1" Type="image" Target="../media/image1.png"/>
            <Relationship Id="rId2" Type="hyperlink" Target="https://x" TargetMode="External"/>
        </Relationships>"#;
        let rels = parse_rels(xml, "ppt/slides");
        assert_eq!(rels.get("rId1").map(String::as_str), Some("ppt/media/image1.png"));
        assert!(rels.get("rId2").is_none());
    }

    /// Reads a structurally-real `.pptx` fixture (built by
    /// `fixtures/make-fixture.mjs`) end-to-end: slide order from the
    /// presentation graph, title text with its colour/size/font, a body run
    /// with an italic span and a manual break, an extracted image and a
    /// full-slide rectangle promoted to the background.
    #[test]
    fn imports_a_real_pptx_fixture() {
        let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("fixtures")
            .join("sample.pptx");
        if !fixture.is_file() {
            eprintln!("skipping: run `node fixtures/make-fixture.mjs` first");
            return;
        }
        let tmp = std::env::temp_dir().join(format!("cp-pptx-test-{}", std::process::id()));
        let slides = extract_blocking(&fixture, tmp).expect("fixture should import");
        assert_eq!(slides.len(), 2, "two slides");

        // Slide 1: background promoted, title + image layers.
        let s1 = &slides[0];
        match &s1.background {
            Some(crate::model::Background::Color { color }) => assert_eq!(color, "#102040"),
            other => panic!("expected colour background, got {other:?}"),
        }
        let texts: Vec<&Layer> = s1.layers.iter().filter(|l| matches!(l, Layer::Text { .. })).collect();
        assert_eq!(texts.len(), 1);
        match texts[0] {
            Layer::Text { text, style, .. } => {
                assert_eq!(text, "Welcome");
                assert_eq!(style.font_family, "Arial");
                assert_eq!(style.color, "#FFFFFF");
                assert!(style.bold);
                assert_eq!(style.align, TextAlign::Center);
                // 44pt on a 7.5in-tall (4:3) slide -> 88px on the 1080 canvas.
                assert!((style.font_size - 88.0).abs() < 0.5, "got {}", style.font_size);
            }
            _ => unreachable!(),
        }
        let images: Vec<&Layer> = s1.layers.iter().filter(|l| matches!(l, Layer::Image { .. })).collect();
        assert_eq!(images.len(), 1, "logo extracted as an image layer");
        if let Layer::Image { src, .. } = images[0] {
            assert!(std::path::Path::new(src).is_file(), "media bytes written to disk");
        }

        // Slide 2: one body box, manual break preserved, italic span present.
        let s2 = &slides[1];
        match &s2.background {
            Some(crate::model::Background::Color { color }) => assert_eq!(color, "#1A2B3C"),
            other => panic!("expected <p:bg> colour background, got {other:?}"),
        }
        let body = s2
            .layers
            .iter()
            .find_map(|l| match l {
                Layer::Text { text, spans, style, .. } => Some((text, spans, style)),
                _ => None,
            })
            .expect("body text");
        assert_eq!(body.0, "Italic line\nSecond line");
        assert_eq!(body.2.align, TextAlign::Left);
        assert!(body.1.iter().any(|sp| sp.italic == Some(true)));
    }
}
