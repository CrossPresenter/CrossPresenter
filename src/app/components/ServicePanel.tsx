import { Music, BookOpen, Image, Video, FileText, ChevronRight, ChevronDown, Plus, Trash2, ArrowUp, ArrowDown, Save, FolderOpen, PenTool, X, GripVertical } from "lucide-react";
import React, { useState, useRef } from "react";
import type { ServiceItem } from "../App";

interface ServicePanelProps {
  items: ServiceItem[];
  setItems: (items: ServiceItem[]) => void;
  activeServiceItem: number;
  setActiveServiceItem: (i: number) => void;
  onQuickAdd?: () => void;
  width?: number;
}

export const ServicePanel = React.memo(function ServicePanel({ items, setItems, activeServiceItem, setActiveServiceItem, onQuickAdd, width }: ServicePanelProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editLyrics, setEditLyrics] = useState("");
  const lyricsTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Drag-to-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const reorderItems = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const activeId = items[activeServiceItem]?.id;
    const newItems = [...items];
    const [moved] = newItems.splice(from, 1);
    newItems.splice(to, 0, moved);
    setItems(newItems);
    const newIdx = newItems.findIndex(i => i.id === activeId);
    setActiveServiceItem(Math.max(0, newIdx));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "song": return Music;
      case "reading": return BookOpen;
      case "image": return Image;
      case "video": return Video;
      default: return FileText;
    }
  };

  const openEditor = (item: ServiceItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDetail(item.detail);
    setEditLyrics(item.slides.join('\n\n'));
  };

  const closeEditor = () => {
    setEditingItem(null);
  };

  const saveItem = () => {
    if (!editingItem) return;
    const slides = editLyrics.split(/\n\s*\n/).filter(s => s.trim().length > 0);
    const newItem: ServiceItem = {
      ...editingItem,
      title: editTitle || "Untitled",
      detail: editDetail || "Custom",
      slides: slides.length > 0 ? slides : ["(Blank)"],
      lastModified: Date.now(),
      size: editLyrics.length,
    };

    const newItems = [...items];
    const idx = newItems.findIndex(i => i.id === editingItem.id);
    if (idx >= 0) newItems[idx] = newItem;
    setItems(newItems);
    closeEditor();
  };

  const handleSplit = () => {
    if (!lyricsTextareaRef.current) return;
    const el = lyricsTextareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = editLyrics;
    const newText = text.substring(0, start) + "\n\n" + text.substring(end);
    setEditLyrics(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + 2, start + 2);
    }, 0);
  };

  const removeItem = (idx: number) => {
    const newItems = [...items];
    newItems.splice(idx, 1);
    setItems(newItems);
    if (activeServiceItem >= newItems.length) {
      setActiveServiceItem(Math.max(0, newItems.length - 1));
    }
  };

  const moveItem = (idx: number, direction: -1 | 1) => {
    if (idx + direction < 0 || idx + direction >= items.length) return;
    const newItems = [...items];
    const temp = newItems[idx];
    newItems[idx] = newItems[idx + direction];
    newItems[idx + direction] = temp;
    setItems(newItems);
    if (activeServiceItem === idx) setActiveServiceItem(idx + direction);
    else if (activeServiceItem === idx + direction) setActiveServiceItem(idx);
  };

  const saveService = async () => {
    try {
      const data = JSON.stringify(items, null, 2);
      
      // Attempt to use the modern File System Access API if available
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `Service_Order_${new Date().toISOString().split('T')[0]}.oflow`,
          types: [{
            description: 'CrossPresenter Service File',
            accept: { 'application/json': ['.oflow'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
      } else {
        // Fallback for older environments / Electron basic webview
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Service_Order_${new Date().toISOString().split('T')[0]}.oflow`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to save service:", err);
    }
  };

  const loadService = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          setItems(data);
          setActiveServiceItem(0);
        }
      } catch (err) {
        console.error("Failed to load service file:", err);
        alert("Invalid .oflow file.");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col border-l border-white/10 bg-[#16162a]" style={{ width: width ?? 300, minWidth: 220 }}>
      {/* Hidden file input for loading .oflow */}
      <input type="file" accept=".oflow" className="hidden" ref={fileInputRef} onChange={loadService} />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#13131f]">
        <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">Service Order</span>
        <div className="flex gap-1">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-white/40 hover:text-white transition-colors rounded hover:bg-white/10"
            title="Open Service (.oflow)"
          >
            <FolderOpen size={13} />
          </button>
          <button 
            onClick={saveService}
            className="p-1 text-white/40 hover:text-white transition-colors rounded hover:bg-white/10"
            title="Save Service (.oflow)"
          >
            <Save size={13} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-0.5 my-auto" />
          <button 
            onClick={onQuickAdd}
            className="p-1 text-white/40 hover:text-white transition-colors rounded hover:bg-white/10"
            title="Add blank slide or placeholder"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-6 flex flex-col items-center text-center opacity-40 mt-10">
            <FileText size={32} className="mb-3" />
            <p className="text-xs">Service order is empty.</p>
            <p className="text-[10px] mt-1">Double-click songs in the Song Bank to add them here.</p>
          </div>
        ) : (
          items.map((item, idx) => {
            const Icon = getIcon(item.type);
            const isActive = activeServiceItem === idx;
            const isExpanded = expanded === idx;
            return (
              <div
                key={`${item.id}-${idx}`}
                draggable
                onDragStart={(e) => {
                  setDragIndex(idx);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(idx));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overIndex !== idx) setOverIndex(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) reorderItems(dragIndex, idx);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={`${dragIndex === idx ? "opacity-40" : ""} ${overIndex === idx && dragIndex !== idx && dragIndex !== null ? "border-t-2 border-t-[#7c6af7]" : ""}`}
                title="Drag to reorder"
              >
                <button
                  onClick={() => { setActiveServiceItem(idx); setExpanded(isExpanded ? null : idx); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-white/5 group ${
                    isActive
                      ? "bg-[#7c6af7]/20 border-l-2 border-l-[#7c6af7]"
                      : "hover:bg-white/5 border-l-2 border-l-transparent"
                  }`}
                >
                  <GripVertical size={11} className="text-white/15 group-hover:text-white/40 flex-shrink-0" />
                  <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center ${
                    item.type === "song" ? "bg-[#7c6af7]/20 text-[#a89cf7]"
                    : item.type === "reading" ? "bg-blue-500/20 text-blue-300"
                    : item.type === "video" ? "bg-red-500/20 text-red-300"
                    : item.type === "image" ? "bg-green-500/20 text-green-300"
                    : "bg-white/10 text-white/50"
                  }`}>
                    <Icon size={11} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isActive ? "text-white" : "text-white/75"}`}>{item.title}</p>
                    <p className="text-[10px] text-white/35 truncate">{item.detail}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); openEditor(item); }} className="p-1 rounded hover:bg-white/10 hover:text-white text-white/50 transition-colors" title="Edit Item">
                      <PenTool size={11} />
                    </button>
                    <span className="text-[10px] text-white/30">
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </span>
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 bg-[#13131f]">
        <span className="text-[10px] text-white/30">{items.length} items</span>
        <div className="flex gap-1">
          <button onClick={() => moveItem(activeServiceItem, -1)} className="p-1 text-white/30 hover:text-white/70 transition-colors"><ArrowUp size={12} /></button>
          <button onClick={() => moveItem(activeServiceItem, 1)} className="p-1 text-white/30 hover:text-white/70 transition-colors"><ArrowDown size={12} /></button>
          <button onClick={() => removeItem(activeServiceItem)} className="p-1 text-red-400/50 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Editor Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16162a] border border-white/10 rounded-xl shadow-2xl w-full max-w-[500px] flex flex-col max-h-full max-h-[85vh]">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="text-sm font-semibold text-white">Edit Service Item</span>
              <button onClick={closeEditor} className="p-1 text-white/50 hover:text-white rounded hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 flex flex-col gap-3 overflow-y-auto">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-white/50 uppercase font-semibold mb-1 block">Title</label>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#7c6af7] transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-white/50 uppercase font-semibold mb-1 block">Detail</label>
                  <input 
                    type="text" 
                    value={editDetail}
                    onChange={(e) => setEditDetail(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#7c6af7] transition-colors"
                  />
                </div>
              </div>
              <div className="flex flex-col flex-1 mt-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-white/50 uppercase font-semibold">Content / Lyrics</label>
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
                onClick={saveItem}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#7c6af7] hover:bg-[#6855d9] rounded flex items-center gap-1.5 transition-colors shadow-lg"
              >
                <Save size={14} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
