import { Music, BookOpen, Image, Video, FileText, ChevronRight, ChevronDown, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";

const SERVICE_ITEMS = [
  { id: 1, type: "song", title: "How Great Is Our God", detail: "Chris Tomlin", icon: Music },
  { id: 2, type: "reading", title: "Psalm 23", detail: "Scripture Reading", icon: BookOpen },
  { id: 3, type: "song", title: "Amazing Grace (My Chains)", detail: "Chris Tomlin", icon: Music },
  { id: 4, type: "image", title: "Announcements Slide", detail: "Image", icon: Image },
  { id: 5, type: "song", title: "What A Beautiful Name", detail: "Hillsong Worship", icon: Music },
  { id: 6, type: "video", title: "Offering Video", detail: "MP4 · 2:14", icon: Video },
  { id: 7, type: "song", title: "Cornerstone", detail: "Hillsong Worship", icon: Music },
  { id: 8, type: "custom", title: "Closing Slide", detail: "Custom Slide", icon: FileText },
];

interface ServicePanelProps {
  activeServiceItem: number;
  setActiveServiceItem: (i: number) => void;
}

export function ServicePanel({ activeServiceItem, setActiveServiceItem }: ServicePanelProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="flex flex-col border-l border-white/10 bg-[#16162a]" style={{ width: 300, minWidth: 220 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#13131f]">
        <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">Service Order</span>
        <div className="flex gap-1">
          <button className="p-1 text-white/40 hover:text-white/80 transition-colors rounded hover:bg-white/5">
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {SERVICE_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const isActive = activeServiceItem === idx;
          const isExpanded = expanded === idx;
          return (
            <div key={item.id}>
              <button
                onClick={() => { setActiveServiceItem(idx); setExpanded(isExpanded ? null : idx); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-white/5 group ${
                  isActive
                    ? "bg-[#7c6af7]/20 border-l-2 border-l-[#7c6af7]"
                    : "hover:bg-white/5 border-l-2 border-l-transparent"
                }`}
              >
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
                  <span className="text-[10px] text-white/30">
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </span>
                </div>
              </button>
              {isExpanded && (
                <div className="bg-black/20 px-3 py-2 border-b border-white/5 flex gap-1.5 flex-wrap">
                  {["Verse 1","Verse 2","Chorus","Bridge","Ending"].map(s => (
                    <button key={s} className="text-[10px] px-2 py-0.5 rounded bg-white/8 text-white/50 hover:bg-[#7c6af7]/30 hover:text-white/80 transition-colors border border-white/10">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 bg-[#13131f]">
        <span className="text-[10px] text-white/30">{SERVICE_ITEMS.length} items</span>
        <div className="flex gap-1">
          <button className="p-1 text-white/30 hover:text-white/70 transition-colors"><ArrowUp size={12} /></button>
          <button className="p-1 text-white/30 hover:text-white/70 transition-colors"><ArrowDown size={12} /></button>
          <button className="p-1 text-red-400/50 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  );
}
