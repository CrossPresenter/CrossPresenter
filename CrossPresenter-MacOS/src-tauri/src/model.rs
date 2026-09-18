//! Shared data model for CrossPresenter.
//!
//! These types are the single source of truth for both the `.cpshow` archive
//! format and the JSON payloads handed to the frontend. Every struct is
//! `camelCase` on the wire so the TypeScript layer consumes it directly
//! without an adapter pass.

use serde::{Deserialize, Serialize};

/// Current on-disk schema version for `.cpshow` archives. Bump this whenever a
/// breaking change lands so `archive::import_show` can migrate older payloads.
pub const SHOW_SCHEMA_VERSION: u32 = 2;

fn default_true() -> bool {
    true
}

fn default_opacity() -> f32 {
    1.0
}

// ---------------------------------------------------------------------------
// Text + layer primitives
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TextAlign {
    Left,
    #[default]
    Center,
    Right,
    Justify,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum VerticalAlign {
    Top,
    #[default]
    Middle,
    Bottom,
}

/// Typography for a whole text box. Per-range overrides live in `TextSpan`.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TextStyle {
    pub font_family: String,
    pub font_size: f32,
    pub color: String,
    #[serde(default)]
    pub bold: bool,
    #[serde(default)]
    pub italic: bool,
    #[serde(default)]
    pub underline: bool,
    #[serde(default)]
    pub uppercase: bool,
    #[serde(default)]
    pub align: TextAlign,
    #[serde(default)]
    pub vertical_align: VerticalAlign,
    pub line_height: f32,
    #[serde(default)]
    pub letter_spacing: f32,
    /// CSS `text-shadow` value; empty string disables it.
    #[serde(default)]
    pub shadow: String,
    /// Outline width in pixels; `0.0` disables the stroke.
    #[serde(default)]
    pub stroke_width: f32,
    #[serde(default)]
    pub stroke_color: String,
}

impl Default for TextStyle {
    fn default() -> Self {
        Self {
            font_family: "Inter".into(),
            font_size: 64.0,
            color: "#FFFFFF".into(),
            bold: true,
            italic: false,
            underline: false,
            uppercase: false,
            align: TextAlign::Center,
            vertical_align: VerticalAlign::Middle,
            line_height: 1.2,
            letter_spacing: 0.0,
            shadow: "0 4px 18px rgba(0,0,0,0.65)".into(),
            stroke_width: 0.0,
            stroke_color: "#000000".into(),
        }
    }
}

/// Normalised rectangle (each field `0.0..=1.0` of the canvas) so layers
/// survive any output resolution without re-layout.
#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl Default for Rect {
    fn default() -> Self {
        Self {
            x: 0.06,
            y: 0.12,
            width: 0.88,
            height: 0.76,
        }
    }
}

/// A styled character range inside a text layer. `end` is exclusive.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TextSpan {
    pub start: usize,
    pub end: usize,
    #[serde(default)]
    pub bold: Option<bool>,
    #[serde(default)]
    pub italic: Option<bool>,
    #[serde(default)]
    pub underline: Option<bool>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub font_size: Option<f32>,
    #[serde(default)]
    pub font_family: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Layer {
    #[serde(rename_all = "camelCase")]
    Text {
        id: String,
        #[serde(default)]
        rect: Rect,
        /// Plain text with `\n` line breaks.
        text: String,
        #[serde(default)]
        style: TextStyle,
        /// Per-range overrides produced by selection-aware styling.
        #[serde(default)]
        spans: Vec<TextSpan>,
        #[serde(default = "default_true")]
        auto_fit: bool,
        #[serde(default)]
        rotation: f32,
        #[serde(default = "default_true")]
        visible: bool,
        #[serde(default)]
        locked: bool,
    },
    #[serde(rename_all = "camelCase")]
    Image {
        id: String,
        #[serde(default)]
        rect: Rect,
        /// Path relative to the archive root, or an absolute local path.
        src: String,
        #[serde(default = "default_opacity")]
        opacity: f32,
        #[serde(default)]
        rotation: f32,
        #[serde(default = "default_true")]
        visible: bool,
        #[serde(default)]
        locked: bool,
    },
    #[serde(rename_all = "camelCase")]
    Shape {
        id: String,
        #[serde(default)]
        rect: Rect,
        fill: String,
        #[serde(default)]
        stroke: String,
        #[serde(default)]
        stroke_width: f32,
        #[serde(default)]
        corner_radius: f32,
        #[serde(default = "default_opacity")]
        opacity: f32,
        #[serde(default)]
        rotation: f32,
        #[serde(default = "default_true")]
        visible: bool,
        #[serde(default)]
        locked: bool,
    },
}

impl Layer {
    pub fn id(&self) -> &str {
        match self {
            Layer::Text { id, .. } | Layer::Image { id, .. } | Layer::Shape { id, .. } => id,
        }
    }

    /// Rewrite an asset-backed layer's `src`. Used by the archive engine when
    /// packing absolute paths down to archive-relative ones and back.
    pub fn set_src(&mut self, new_src: String) {
        if let Layer::Image { src, .. } = self {
            *src = new_src;
        }
    }

    pub fn src(&self) -> Option<&str> {
        match self {
            Layer::Image { src, .. } => Some(src.as_str()),
            _ => None,
        }
    }
}

// ---------------------------------------------------------------------------
// Backgrounds + transitions
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Background {
    #[serde(rename_all = "camelCase")]
    Color { color: String },
    #[serde(rename_all = "camelCase")]
    Image {
        src: String,
        #[serde(default)]
        fit: String,
    },
    #[serde(rename_all = "camelCase")]
    Video {
        src: String,
        #[serde(default)]
        fit: String,
        #[serde(default = "default_true")]
        loop_playback: bool,
        #[serde(default = "default_true")]
        muted: bool,
    },
    #[serde(rename_all = "camelCase")]
    Gradient {
        from: String,
        to: String,
        #[serde(default)]
        angle: f32,
    },
}

impl Background {
    pub fn src(&self) -> Option<&str> {
        match self {
            Background::Image { src, .. } | Background::Video { src, .. } => Some(src.as_str()),
            _ => None,
        }
    }

    pub fn set_src(&mut self, new_src: String) {
        match self {
            Background::Image { src, .. } | Background::Video { src, .. } => *src = new_src,
            _ => {}
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum Transition {
    Cut,
    #[default]
    Fade,
    CrossFade,
    SlideLeft,
    SlideRight,
    SlideUp,
    SlideDown,
    Zoom,
    Dissolve,
}

// ---------------------------------------------------------------------------
// Slides + service items
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Slide {
    pub id: String,
    /// Section label: "Verse 1", "Chorus", "John 3:16", "Slide 4"…
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub layers: Vec<Layer>,
    #[serde(default)]
    pub background: Option<Background>,
    #[serde(default)]
    pub transition: Transition,
    #[serde(default)]
    pub notes: String,
    /// Colour tag used by the slide grid for section grouping.
    #[serde(default)]
    pub group_color: String,
}

impl Slide {
    /// Build a lyric-style slide: one centred, auto-fitting text box.
    pub fn from_text(
        id: impl Into<String>,
        label: impl Into<String>,
        text: impl Into<String>,
    ) -> Self {
        let id = id.into();
        Self {
            layers: vec![Layer::Text {
                id: format!("{id}-t0"),
                rect: Rect::default(),
                text: text.into(),
                style: TextStyle::default(),
                spans: Vec::new(),
                auto_fit: true,
                rotation: 0.0,
                visible: true,
                locked: false,
            }],
            id,
            label: label.into(),
            background: None,
            transition: Transition::default(),
            notes: String::new(),
            group_color: String::new(),
        }
    }

    /// Concatenated plain text of every visible text layer — used for search
    /// and for the compact slide-grid preview.
    pub fn plain_text(&self) -> String {
        self.layers
            .iter()
            .filter_map(|l| match l {
                Layer::Text { text, visible, .. } if *visible => Some(text.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ItemKind {
    Song,
    Presentation,
    Media,
    Bible,
    Announcement,
    Web,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct SongMeta {
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub copyright: String,
    #[serde(default)]
    pub ccli: String,
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub tempo: String,
    #[serde(default)]
    pub themes: Vec<String>,
    /// Playback order of section labels, e.g. `["Verse 1","Chorus","Verse 2"]`.
    #[serde(default)]
    pub arrangement: Vec<String>,
    /// Which importer produced this record.
    #[serde(default)]
    pub source: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServiceItem {
    pub id: String,
    pub kind: ItemKind,
    pub title: String,
    #[serde(default)]
    pub slides: Vec<Slide>,
    #[serde(default)]
    pub meta: SongMeta,
    /// Item-level background inherited by slides that define none.
    #[serde(default)]
    pub background: Option<Background>,
    #[serde(default)]
    pub color: String,
    /// Original file this item was imported from, when applicable.
    #[serde(default)]
    pub source_path: String,
}

// ---------------------------------------------------------------------------
// Media pool
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum Deck {
    /// "Images/Videos" — the general-purpose foreground deck.
    Media,
    /// "BG" — looping motion and still backgrounds.
    Bg,
    /// "Graphics" — lower-thirds, logos and overlays with alpha.
    Graphics,
    /// "Browser" — saved URLs opened as interactive webviews.
    Browser,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MediaKind {
    Image,
    Video,
    Audio,
    Presentation,
    Url,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MediaAsset {
    pub id: String,
    pub deck: Deck,
    pub kind: MediaKind,
    pub name: String,
    /// Absolute local path, or the URL itself for `MediaKind::Url`.
    pub path: String,
    /// Data-URI thumbnail generated in Rust so the grid never decodes
    /// full-resolution media on the UI thread.
    #[serde(default)]
    pub thumbnail: String,
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
    #[serde(default)]
    pub duration_seconds: f32,
    #[serde(default)]
    pub size_bytes: u64,
}

// ---------------------------------------------------------------------------
// Fonts + document root
// ---------------------------------------------------------------------------

/// An embedded `@font-face` definition. The bytes live in the archive under
/// `fonts/<file_name>`; the frontend registers them via the FontFace API.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FontFace {
    pub family: String,
    pub file_name: String,
    #[serde(default)]
    pub weight: String,
    #[serde(default)]
    pub style: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Show {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    pub title: String,
    #[serde(default)]
    pub items: Vec<ServiceItem>,
    #[serde(default)]
    pub media: Vec<MediaAsset>,
    #[serde(default)]
    pub fonts: Vec<FontFace>,
    /// ISO-8601 timestamp stamped by the frontend at save time.
    #[serde(default)]
    pub saved_at: String,
    #[serde(default)]
    pub app_version: String,
}

fn default_schema_version() -> u32 {
    SHOW_SCHEMA_VERSION
}

impl Default for Show {
    fn default() -> Self {
        Self {
            schema_version: SHOW_SCHEMA_VERSION,
            title: "Untitled Service".into(),
            items: Vec::new(),
            media: Vec::new(),
            fonts: Vec::new(),
            saved_at: String::new(),
            app_version: env!("CARGO_PKG_VERSION").into(),
        }
    }
}
