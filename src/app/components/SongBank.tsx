import React, { useState, useRef, useEffect } from "react";
import { Music, Search, Upload, Plus, PenTool, Trash2, X, Save } from "lucide-react";
import type { ServiceItem } from "../App";
import { smartFuzzyMatch } from "../utils/search";

interface SongBankProps {
  onAddSongToService: (song: ServiceItem) => void;
  width?: number;
}

export const SongBank = React.memo(function SongBank({ onAddSongToService, width }: SongBankProps) {
  const [songs, setSongs] = useState<ServiceItem[]>(() => {
    if (!window.electron) return [];
    const saved = window.electron.storeGet("oflow_songs");
    return saved ? JSON.parse(saved) : [];
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [editingSong, setEditingSong] = useState<ServiceItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editLyrics, setEditLyrics] = useState("");
  const lyricsTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [sortOption, setSortOption] = useState<"a-z" | "z-a" | "newest" | "oldest" | "largest" | "smallest">("newest");

  useEffect(() => {
    if (window.electron) {
      window.electron.storeSet("oflow_songs", JSON.stringify(songs));
    }
  }, [songs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newSongs: ServiceItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const text = await file.text();
      
      try {
        if (file.name.toLowerCase().endsWith(".xml")) {
          newSongs.push(parseXmlFile(text, file.name));
        } else if (file.name.toLowerCase().endsWith(".txt")) {
          newSongs.push(parseTextFile(text, file.name));
        }
      } catch (err) {
        console.error("Failed to parse file", file.name, err);
      }
    }

    setSongs(prev => [...prev, ...newSongs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditor = (song?: ServiceItem) => {
    if (song) {
      setEditingSong(song);
      setEditTitle(song.title);
      setEditDetail(song.detail);
      setEditLyrics(song.slides.join('\n\n'));
    } else {
      setEditingSong({
        id: crypto.randomUUID(),
        type: "song",
        title: "",
        detail: "",
        slides: []
      });
      setEditTitle("");
      setEditDetail("");
      setEditLyrics("");
    }
  };

  const closeEditor = () => {
    setEditingSong(null);
  };

  const saveSong = () => {
    if (!editingSong) return;
    const slides = editLyrics.split(/\n\s*\n/).filter(s => s.trim().length > 0);
    // If no title given, default to the first line of the lyrics.
    const autoTitle = editLyrics.split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0) || "";
    const newSong: ServiceItem = {
      ...editingSong,
      title: editTitle || autoTitle || "Untitled Song",
      detail: editDetail || "Custom",
      slides: slides.length > 0 ? slides : ["(No lyrics)"],
      lastModified: Date.now(),
      size: editLyrics.length,
    };

    setSongs(prev => {
      const existingIdx = prev.findIndex(s => s.id === editingSong.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = newSong;
        return next;
      }
      return [...prev, newSong];
    });
    closeEditor();
  };

  const deleteSong = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent adding to service order
    if (confirm("Are you sure you want to delete this song?")) {
      setSongs(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleSplit = () => {
    if (!lyricsTextareaRef.current) return;
    const el = lyricsTextareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = editLyrics;
    
    // Insert double newline at the cursor
    const newText = text.substring(0, start) + "\n\n" + text.substring(end);
    setEditLyrics(newText);
    
    // Move cursor after the inserted newlines
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + 2, start + 2);
    }, 0);
  };

  const parseTextFile = (content: string, filename: string): ServiceItem => {
    // Split by double newline to get verses
    const slides = content.split(/\n\s*\n/).filter(s => s.trim().length > 0);
    // Title defaults to the first line of the song text.
    const firstLine = content.split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0) || "";
    return {
      id: crypto.randomUUID(),
      type: "song",
      title: firstLine || filename.replace(/\.txt$/i, ''),
      detail: "Text Import",
      slides: slides.length > 0 ? slides : ["(No lyrics found)"],
      lastModified: Date.now(),
      size: content.length,
    };
  };

  const parseXmlFile = (content: string, filename: string): ServiceItem => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/xml");
    
    const titleNode = doc.querySelector("titles > title");
    const title = titleNode?.textContent || filename.replace(/\.xml$/i, '');
    
    const authorNode = doc.querySelector("authors > author");
    const author = authorNode?.textContent || "XML Import";

    const verses = doc.querySelectorAll("lyrics > verse > lines");
    const slides: string[] = [];
    
    verses.forEach(v => {
      const html = v.innerHTML;
      const text = html.replace(/<br\s*\/?>/gi, '\n');
      const tmp = document.createElement("div");
      tmp.innerHTML = text;
      slides.push((tmp.textContent || "").trim());
    });

    return {
      id: crypto.randomUUID(),
      type: "song",
      title,
      detail: author,
      slides: slides.length > 0 ? slides : ["(No lyrics found)"],
      lastModified: Date.now(),
      size: content.length,
    };
  };

  return (
    <div className="flex flex-col border-r border-white/10 bg-[#16162a]" style={{ width: width ?? 260, minWidth: 200 }}>
      {/* Hidden file input */}
      <input 
        type="file" 
        multiple 
        accept=".txt,.xml" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileUpload}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#13131f]">
        <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">Song Bank</span>
        <div className="flex gap-1">
          <button 
            onClick={() => openEditor()}
            className="p-1 text-[#7c6af7] hover:text-white transition-colors rounded hover:bg-[#7c6af7]/20 flex items-center gap-1"
            title="Create new song manually"
          >
            <PenTool size={13} />
            <span className="text-[10px] font-medium uppercase pr-1">New</span>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-[#7c6af7] hover:text-white transition-colors rounded hover:bg-[#7c6af7]/20 flex items-center gap-1"
            title="Import .txt or .xml files"
          >
            <Plus size={13} />
            <span className="text-[10px] font-medium uppercase pr-1">Import</span>
          </button>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="px-2 py-2 border-b border-white/10 bg-[#16162a] flex flex-col gap-2">
        <input 
          type="text" 
          placeholder="Search songs..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#7c6af7] transition-colors"
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/50 uppercase font-semibold">Sort:</span>
          <select 
            value={sortOption} 
            onChange={(e) => setSortOption(e.target.value as any)}
            className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#7c6af7] transition-colors appearance-none cursor-pointer"
          >
            <option value="newest">Recently Modified</option>
            <option value="oldest">Oldest Modified</option>
            <option value="a-z">Alphabetical (A-Z)</option>
            <option value="z-a">Alphabetical (Z-A)</option>
            <option value="largest">Largest File Size</option>
            <option value="smallest">Smallest File Size</option>
          </select>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {songs.length === 0 ? (
          <div className="p-6 flex flex-col items-center text-center opacity-40 mt-10">
            <Upload size={32} className="mb-3" />
            <p className="text-xs">No songs in your library yet.</p>
            <p className="text-[10px] mt-1">Click Import to add .txt or .xml files, or click New to create a song from scratch.</p>
          </div>
        ) : (
          (() => {
            const visible = songs
              .filter(s => smartFuzzyMatch(searchQuery, s.title) || smartFuzzyMatch(searchQuery, s.detail))
              .sort((a, b) => {
                switch (sortOption) {
                  case "a-z": return a.title.localeCompare(b.title);
                  case "z-a": return b.title.localeCompare(a.title);
                  case "newest": return (b.lastModified || 0) - (a.lastModified || 0);
                  case "oldest": return (a.lastModified || 0) - (b.lastModified || 0);
                  case "largest": return (b.size || 0) - (a.size || 0);
                  case "smallest": return (a.size || 0) - (b.size || 0);
                  default: return 0;
                }
              });
            if (visible.length === 0) {
              return (
                <div className="p-6 flex flex-col items-center text-center opacity-40 mt-10">
                  <Search size={24} className="mb-3" />
                  <p className="text-xs">No songs match “{searchQuery}”.</p>
                  <p className="text-[10px] mt-1">Try a different search term or clear the search box.</p>
                </div>
              );
            }
            return visible.map((song) => (
              <div
                key={song.id}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-white/5 hover:bg-white/5 group select-none relative"
              >
                <div 
                  className="flex-1 flex items-center gap-2.5 cursor-pointer min-w-0" 
                  onClick={() => onAddSongToService(song)}
                  title="Click to add to Service Order"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center bg-[#7c6af7]/20 text-[#a89cf7]">
                    <Music size={11} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-white/80 group-hover:text-white">{song.title}</p>
                    <p className="text-[10px] text-white/35 truncate">{song.detail}</p>
                  </div>
                </div>
                <div className="hidden group-hover:flex items-center gap-1 opacity-80 pl-2">
                  <button onClick={(e) => { e.stopPropagation(); openEditor(song); }} className="p-1.5 rounded hover:bg-white/10 hover:text-white text-white/50 transition-colors" title="Edit Song">
                    <PenTool size={12} />
                  </button>
                  <button onClick={(e) => deleteSong(song.id, e)} className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-400 text-white/50 transition-colors" title="Delete Song">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ));
          })()
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 bg-[#13131f]">
        <span className="text-[10px] text-white/30">{songs.length} songs total</span>
      </div>

      {/* Editor Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16162a] border border-white/10 rounded-xl shadow-2xl w-full max-w-[500px] flex flex-col max-h-full max-h-[85vh]">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="text-sm font-semibold text-white">Song Editor</span>
              <button onClick={closeEditor} className="p-1 text-white/50 hover:text-white rounded hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 flex flex-col gap-3 overflow-y-auto">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-white/50 uppercase font-semibold mb-1 block">Song Title</label>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Amazing Grace"
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#7c6af7] transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-white/50 uppercase font-semibold mb-1 block">Author / Detail</label>
                  <input 
                    type="text" 
                    value={editDetail}
                    onChange={(e) => setEditDetail(e.target.value)}
                    placeholder="e.g. John Newton"
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#7c6af7] transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-col flex-1 mt-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-white/50 uppercase font-semibold">Lyrics</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 normal-case">Or separate slides manually with a blank line</span>
                    <button 
                      onClick={handleSplit}
                      className="px-2 py-1 text-[10px] font-semibold text-white bg-white/10 hover:bg-white/20 rounded transition-colors"
                      title="Insert a slide break at cursor position"
                    >
                      Split Slide
                    </button>
                  </div>
                </div>
                <textarea 
                  ref={lyricsTextareaRef}
                  value={editLyrics}
                  onChange={(e) => setEditLyrics(e.target.value)}
                  placeholder="Verse 1&#10;Amazing grace how sweet the sound&#10;That saved a wretch like me&#10;&#10;Verse 2&#10;I once was lost but now am found..."
                  className="w-full h-[300px] bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#7c6af7] transition-colors resize-y font-mono leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-3 border-t border-white/10 bg-[#13131f] rounded-b-xl shrink-0">
              <button 
                onClick={closeEditor}
                className="px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={saveSong}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#7c6af7] hover:bg-[#6855d9] rounded flex items-center gap-1.5 transition-colors shadow-lg"
              >
                <Save size={14} />
                Save Song
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
