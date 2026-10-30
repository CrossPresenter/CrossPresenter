//! SQLite-backed song libraries: OpenLP, EasyWorship 6/7, Holyrics,
//! MediaShout 6/7.
//!
//! These applications ship different schemas, and the schemas change between
//! their own major versions. Rather than hard-coding column names per vendor
//! and breaking on the next release, this reader introspects `sqlite_master`,
//! recognises the databases it knows by shape, and falls back to a heuristic
//! column search for everything else. The fallback is what makes an unfamiliar
//! or updated schema import successfully instead of erroring out.
//!
//! Databases are always opened read-only: an operator's live song library must
//! never be mutated by an import, and read-only avoids creating `-wal`
//! sidecar files next to the original.

use std::collections::HashSet;
use std::path::Path;

use rusqlite::{Connection, OpenFlags};

use super::tags::{normalize_tag, parse_tagged_body, rtf_to_plain, Section};
use super::RawSong;

/// Open a library without any possibility of writing to it.
fn open_ro(path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI,
    )
    .map_err(|e| format!("cannot open database: {e}"))
}

fn table_names(conn: &Connection) -> Result<HashSet<String>, String> {
    let mut stmt = conn
        .prepare("SELECT LOWER(name) FROM sqlite_master WHERE type IN ('table','view')")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut out = HashSet::new();
    for r in rows {
        out.insert(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

fn column_names(conn: &Connection, table: &str) -> Result<Vec<String>, String> {
    // `table` always originates from sqlite_master, never from user input, so
    // interpolating it into PRAGMA (which cannot take a bound parameter) is safe.
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info(\"{}\")", table.replace('"', "\"\"")))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| r.get::<_, String>(1))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?.to_lowercase());
    }
    Ok(out)
}

/// Pick the first column whose name matches any candidate, preferring earlier
/// candidates. Returns the column name as it should be quoted in SQL.
fn pick<'a>(columns: &'a [String], candidates: &[&str]) -> Option<&'a String> {
    for cand in candidates {
        if let Some(found) = columns.iter().find(|c| c.as_str() == *cand) {
            return Some(found);
        }
    }
    // Fall back to a substring match: `song_title`, `titre`, `lyrics_rtf`…
    for cand in candidates {
        if let Some(found) = columns.iter().find(|c| c.contains(cand)) {
            return Some(found);
        }
    }
    None
}

/// Body text that may be RTF, bracket-tagged plain text, or OpenLyrics XML.
/// Detect and lower it to sections.
fn sections_from_body(body: &str) -> Vec<Section> {
    let trimmed = body.trim_start();
    if trimmed.starts_with("{\\rtf") {
        let plain = rtf_to_plain(body);
        return parse_tagged_body(&plain);
    }
    if trimmed.starts_with('<') {
        // OpenLP stores verses as an XML fragment in the `lyrics` column.
        if let Some(sections) = super::xml_formats::sections_from_openlp_lyrics(body) {
            return sections;
        }
    }
    parse_tagged_body(body)
}

pub fn read(path: &Path) -> Result<Vec<RawSong>, String> {
    let conn = open_ro(path)?;
    let tables = table_names(&conn)?;

    if tables.contains("songs") && tables.contains("authors") && tables.contains("authors_songs") {
        return read_openlp(&conn);
    }
    // EasyWorship 6/7 splits metadata and bodies across two tables.
    if tables.contains("song") && (tables.contains("song_words") || tables.contains("word")) {
        return read_easyworship(&conn, &tables);
    }
    read_generic(&conn, &tables)
}

// ---------------------------------------------------------------------------
// OpenLP
// ---------------------------------------------------------------------------

/// OpenLP 2.x/3.x `songs.sqlite`. The lyrics column holds an XML fragment of
/// `<verse type="v" label="1">` elements; authors are a many-to-many join.
fn read_openlp(conn: &Connection) -> Result<Vec<RawSong>, String> {
    let cols = column_names(conn, "songs")?;
    let has = |c: &str| cols.iter().any(|x| x == c);

    let ccli_col = if has("ccli_number") { "ccli_number" } else { "song_number" };
    let order_col = if has("verse_order") { "verse_order" } else { "search_title" };

    let sql = format!(
        "SELECT s.id, s.title, s.lyrics, s.copyright, s.{ccli_col}, s.{order_col},
                (SELECT GROUP_CONCAT(a.display_name, ', ')
                   FROM authors a
                   JOIN authors_songs asg ON asg.author_id = a.id
                  WHERE asg.song_id = s.id) AS authors
           FROM songs s"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("OpenLP query failed: {e}"))?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, Option<String>>(1)?.unwrap_or_default(), // title
                r.get::<_, Option<String>>(2)?.unwrap_or_default(), // lyrics
                r.get::<_, Option<String>>(3)?.unwrap_or_default(), // copyright
                r.get::<_, Option<String>>(4)?.unwrap_or_default(), // ccli
                r.get::<_, Option<String>>(5)?.unwrap_or_default(), // verse order
                r.get::<_, Option<String>>(6)?.unwrap_or_default(), // authors
            ))
        })
        .map_err(|e| format!("OpenLP query failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        let (title, lyrics, copyright, ccli, order, authors) =
            row.map_err(|e| format!("OpenLP row failed: {e}"))?;

        let sections = sections_from_body(&lyrics);
        if sections.is_empty() {
            continue;
        }

        out.push(RawSong {
            title,
            author: authors,
            copyright,
            ccli,
            arrangement: order
                .split_whitespace()
                .map(normalize_tag)
                .filter(|s| !s.is_empty())
                .collect(),
            sections,
            source: "OpenLP".into(),
            ..Default::default()
        });
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// EasyWorship 6/7
// ---------------------------------------------------------------------------

/// EasyWorship keeps song metadata in `song` and slide bodies in `song_words`
/// (named `word` in some builds), one row per song, with the body stored as RTF.
fn read_easyworship(conn: &Connection, tables: &HashSet<String>) -> Result<Vec<RawSong>, String> {
    let words_table = if tables.contains("song_words") { "song_words" } else { "word" };

    let song_cols = column_names(conn, "song")?;
    let word_cols = column_names(conn, words_table)?;

    let title_col = pick(&song_cols, &["title", "name"])
        .ok_or("EasyWorship: no title column in `song`")?
        .clone();
    let id_col = pick(&song_cols, &["rowid", "id", "song_id"])
        .cloned()
        .unwrap_or_else(|| "rowid".into());
    let author_col = pick(&song_cols, &["author", "artist", "writer"]).cloned();
    let copyright_col = pick(&song_cols, &["copyright"]).cloned();
    let ccli_col = pick(&song_cols, &["reference_number", "ccli", "song_number"]).cloned();

    let body_col = pick(&word_cols, &["words", "word", "lyrics", "text", "rtf"])
        .ok_or("EasyWorship: no lyrics column in the words table")?
        .clone();
    let fk_col = pick(&word_cols, &["song_id", "songid", "id"])
        .cloned()
        .unwrap_or_else(|| "song_id".into());

    let sel = |opt: &Option<String>| match opt {
        Some(c) => format!("s.\"{c}\""),
        None => "''".to_string(),
    };

    let sql = format!(
        "SELECT s.\"{title_col}\", w.\"{body_col}\", {}, {}, {}
           FROM song s
           LEFT JOIN \"{words_table}\" w ON w.\"{fk_col}\" = s.\"{id_col}\"",
        sel(&author_col),
        sel(&copyright_col),
        sel(&ccli_col),
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("EasyWorship query failed: {e}"))?;

    let rows = stmt
        .query_map([], |r| {
            // Bodies are sometimes stored as BLOBs rather than TEXT.
            let body = match r.get::<_, Option<String>>(1) {
                Ok(Some(s)) => s,
                _ => r
                    .get::<_, Option<Vec<u8>>>(1)
                    .ok()
                    .flatten()
                    .map(|b| String::from_utf8_lossy(&b).into_owned())
                    .unwrap_or_default(),
            };
            Ok((
                r.get::<_, Option<String>>(0)?.unwrap_or_default(),
                body,
                r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                r.get::<_, Option<String>>(4)?.unwrap_or_default(),
            ))
        })
        .map_err(|e| format!("EasyWorship query failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        let (title, body, author, copyright, ccli) =
            row.map_err(|e| format!("EasyWorship row failed: {e}"))?;
        let sections = sections_from_body(&body);
        if sections.is_empty() {
            continue;
        }
        out.push(RawSong {
            title,
            author,
            copyright,
            ccli,
            sections,
            source: "EasyWorship".into(),
            ..Default::default()
        });
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// Heuristic reader
// ---------------------------------------------------------------------------

/// Import from a database whose exact schema is unknown.
///
/// Looks for any table carrying both a title-like and a lyrics-like column.
/// This covers Holyrics, MediaShout and the ShareFaith/WorshipTools exports,
/// and keeps working when a vendor renames columns in a point release.
fn read_generic(conn: &Connection, tables: &HashSet<String>) -> Result<Vec<RawSong>, String> {
    const TITLE_KEYS: [&str; 6] = ["title", "name", "songtitle", "titulo", "titre", "caption"];
    const BODY_KEYS: [&str; 8] = ["lyrics", "words", "text", "content", "letra", "body", "slides", "verses"];

    // Prefer tables whose own name suggests songs, so a database that also
    // stores e.g. scripture does not get scraped from the wrong table.
    let mut candidates: Vec<&String> = tables.iter().collect();
    candidates.sort_by_key(|t| {
        let n = t.as_str();
        let score = if n.contains("song") || n.contains("musica") || n.contains("lyric") {
            0
        } else if n.contains("item") || n.contains("slide") {
            1
        } else {
            2
        };
        (score, n.to_string())
    });

    let mut out = Vec::new();
    let mut examined = Vec::new();

    for table in candidates {
        if table.starts_with("sqlite_") {
            continue;
        }
        let Ok(cols) = column_names(conn, table) else { continue };
        let Some(title_col) = pick(&cols, &TITLE_KEYS).cloned() else { continue };
        let Some(body_col) = pick(&cols, &BODY_KEYS).cloned() else { continue };
        if title_col == body_col {
            continue;
        }
        examined.push(table.clone());

        let author_col = pick(&cols, &["author", "artist", "writer", "autor"]).cloned();
        let copyright_col = pick(&cols, &["copyright", "direitos"]).cloned();
        let ccli_col = pick(&cols, &["ccli", "reference_number", "song_number", "number"]).cloned();
        let key_col = pick(&cols, &["key", "tom", "tonalidade"]).cloned();

        let sel = |opt: &Option<String>| match opt {
            Some(c) => format!("\"{c}\""),
            None => "''".to_string(),
        };

        let sql = format!(
            "SELECT \"{title_col}\", \"{body_col}\", {}, {}, {}, {} FROM \"{table}\"",
            sel(&author_col),
            sel(&copyright_col),
            sel(&ccli_col),
            sel(&key_col),
        );

        let Ok(mut stmt) = conn.prepare(&sql) else { continue };
        let Ok(rows) = stmt.query_map([], |r| {
            let body = match r.get::<_, Option<String>>(1) {
                Ok(Some(s)) => s,
                _ => r
                    .get::<_, Option<Vec<u8>>>(1)
                    .ok()
                    .flatten()
                    .map(|b| String::from_utf8_lossy(&b).into_owned())
                    .unwrap_or_default(),
            };
            Ok((
                r.get::<_, Option<String>>(0)?.unwrap_or_default(),
                body,
                r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                r.get::<_, Option<String>>(4)?.unwrap_or_default(),
                r.get::<_, Option<String>>(5)?.unwrap_or_default(),
            ))
        }) else {
            continue;
        };

        for row in rows.flatten() {
            let (title, body, author, copyright, ccli, key) = row;
            if body.trim().is_empty() {
                continue;
            }
            let sections = sections_from_body(&body);
            if sections.is_empty() {
                continue;
            }
            out.push(RawSong {
                title,
                author,
                copyright,
                ccli,
                key,
                sections,
                source: format!("SQLite ({table})"),
                ..Default::default()
            });
        }

        // One productive table is enough; scraping every table would duplicate
        // songs that appear in both a base table and a view over it.
        if !out.is_empty() {
            break;
        }
    }

    if out.is_empty() {
        return Err(format!(
            "No song table found. Tables present: {}. CrossPresenter looks for a table with both a title-like and a lyrics-like column.",
            {
                let mut names: Vec<&str> = tables.iter().map(|s| s.as_str()).collect();
                names.sort_unstable();
                names.join(", ")
            }
        ));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem(sql: &str) -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(sql).unwrap();
        conn
    }

    #[test]
    fn picks_exact_before_substring() {
        let cols: Vec<String> = ["song_title", "title"].iter().map(|s| s.to_string()).collect();
        assert_eq!(pick(&cols, &["title"]).unwrap(), "title");
    }

    #[test]
    fn picks_substring_when_no_exact_match() {
        let cols: Vec<String> = ["lyrics_rtf"].iter().map(|s| s.to_string()).collect();
        assert_eq!(pick(&cols, &["lyrics"]).unwrap(), "lyrics_rtf");
    }

    #[test]
    fn reads_openlp_shape() {
        let conn = mem(
            "CREATE TABLE songs (id INTEGER PRIMARY KEY, title TEXT, lyrics TEXT,
                                 copyright TEXT, ccli_number TEXT, verse_order TEXT);
             CREATE TABLE authors (id INTEGER PRIMARY KEY, display_name TEXT);
             CREATE TABLE authors_songs (author_id INT, song_id INT);
             INSERT INTO songs VALUES (1,'Amazing Grace',
               '<song><lyrics><verse type=\"v\" label=\"1\">Amazing grace
how sweet</verse><verse type=\"c\">Praise him</verse></lyrics></song>',
               '(c) Public Domain','22025','v1 c');
             INSERT INTO authors VALUES (1,'John Newton');
             INSERT INTO authors_songs VALUES (1,1);",
        );
        let songs = read_openlp(&conn).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "Amazing Grace");
        assert_eq!(songs[0].author, "John Newton");
        assert_eq!(songs[0].arrangement, vec!["Verse 1", "Chorus"]);
        assert_eq!(songs[0].sections[0].label, "Verse 1");
        assert_eq!(songs[0].sections[1].label, "Chorus");
    }

    #[test]
    fn reads_easyworship_rtf_bodies() {
        let conn = mem(
            "CREATE TABLE song (rowid INTEGER PRIMARY KEY, title TEXT, author TEXT,
                                copyright TEXT, reference_number TEXT);
             CREATE TABLE song_words (song_id INT, words TEXT);
             INSERT INTO song VALUES (1,'Test Song','Writer','(c) 2020','12345');
             INSERT INTO song_words VALUES (1,'{\\rtf1\\ansi [V1]\\par line one\\par}');",
        );
        let mut tables = HashSet::new();
        tables.insert("song".to_string());
        tables.insert("song_words".to_string());
        let songs = read_easyworship(&conn, &tables).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "Test Song");
        assert_eq!(songs[0].sections[0].label, "Verse 1");
        assert_eq!(songs[0].sections[0].text, "line one");
    }

    #[test]
    fn heuristic_reader_handles_unknown_schema() {
        let conn = mem(
            "CREATE TABLE musicas (id INTEGER PRIMARY KEY, titulo TEXT, letra TEXT, autor TEXT);
             INSERT INTO musicas VALUES (1,'Grande é o Senhor','[C]
Grande é o Senhor','Autor');",
        );
        let mut tables = HashSet::new();
        tables.insert("musicas".to_string());
        let songs = read_generic(&conn, &tables).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "Grande é o Senhor");
        assert_eq!(songs[0].sections[0].label, "Chorus");
    }

    #[test]
    fn reports_tables_when_nothing_matches() {
        let conn = mem("CREATE TABLE settings (k TEXT, v TEXT);");
        let mut tables = HashSet::new();
        tables.insert("settings".to_string());
        let err = read_generic(&conn, &tables).unwrap_err();
        assert!(err.contains("settings"));
    }
}
