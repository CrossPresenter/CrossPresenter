import { ChevronLeft, ChevronRight, Monitor, Eye, BookOpen, X } from "lucide-react";
import type { LiveContent } from "../App";

const SONGS: Record<number, { title: string; author: string; slides: string[] }> = {
  0: {
    title: "How Great Is Our God",
    author: "Chris Tomlin",
    slides: [
      "The splendor of the King\nClothed in majesty\nLet all the earth rejoice\nAll the earth rejoice",
      "He wraps Himself in light\nAnd darkness tries to hide\nAnd trembles at His voice\nTrembles at His voice",
      "How great is our God\nSing with me\nHow great is our God\nAnd all will see how great\nHow great is our God",
      "And age to age He stands\nAnd time is in His hands\nBeginning and the End\nBeginning and the End",
      "The Godhead three in one\nFather Spirit Son\nThe Lion and the Lamb\nThe Lion and the Lamb",
      "Name above all names\nWorthy of all praise\nMy heart will sing\nHow great is our God",
    ],
  },
  1: {
    title: "Psalm 23",
    author: "Scripture Reading",
    slides: [
      "The Lord is my shepherd;\nI shall not want.",
      "He makes me lie down\nin green pastures.\nHe leads me beside\nstill waters.",
      "He restores my soul.\nHe leads me in paths\nof righteousness\nfor his name's sake.",
      "Even though I walk\nthrough the valley\nof the shadow of death,\nI will fear no evil.",
      "You prepare a table\nbefore me in the presence\nof my enemies.",
      "Surely goodness and mercy\nshall follow me all the days\nof my life, and I shall dwell\nin the house of the Lord forever.",
    ],
  },
  2: {
    title: "Amazing Grace (My Chains)",
    author: "Chris Tomlin",
    slides: [
      "Amazing grace\nHow sweet the sound\nThat saved a wretch like me",
      "I once was lost\nBut now I'm found\nWas blind but now I see",
      "My chains are gone\nI've been set free\nMy God my Savior has ransomed me",
      "And like a flood\nHis mercy reigns\nUnending love\nAmazing grace",
      "The Lord has promised\nGood to me\nHis word my hope secures",
    ],
  },
  4: {
    title: "What A Beautiful Name",
    author: "Hillsong Worship",
    slides: [
      "You were the Word\nat the beginning\nOne with God the Lord\nmost high",
      "Your hidden glory\nin creation\nNow revealed in You\nour Christ",
      "What a beautiful name it is\nWhat a beautiful name it is\nThe name of Jesus Christ\nmy King",
      "What a beautiful name it is\nNothing compares to this\nWhat a beautiful name it is\nThe name of Jesus",
      "You didn't want heaven\nwithout us\nSo Jesus You brought\nheaven down",
    ],
  },
  6: {
    title: "Cornerstone",
    author: "Hillsong Worship",
    slides: [
      "My hope is built\non nothing less\nThan Jesus' blood\nand righteousness",
      "I dare not trust\nthe sweetest frame\nBut wholly trust\nin Jesus' name",
      "Christ alone cornerstone\nWeak made strong\nin the Saviour's love",
      "Through the storm\nHe is Lord\nLord of all",
      "When darkness seems\nto hide His face\nI rest on His\nunchanging grace",
    ],
  },
};

const DEFAULT_SLIDE = { title: "—", author: "—", slides: ["(No lyrics for this item)"] };

interface LyricsPanelProps {
  activeServiceItem: number;
  activeLyricSlide: number;
  setActiveLyricSlide: (i: number) => void;
  isBlank: boolean;
  liveOverride: LiveContent | null;
  clearOverride: () => void;
}

export function LyricsPanel({ activeServiceItem, activeLyricSlide, setActiveLyricSlide, isBlank, liveOverride, clearOverride }: LyricsPanelProps) {
  const song = SONGS[activeServiceItem] ?? DEFAULT_SLIDE;
  const slides = song.slides;
  const current = liveOverride ? liveOverride.text : (slides[activeLyricSlide] ?? "");
  const prev = !liveOverride && activeLyricSlide > 0 ? slides[activeLyricSlide - 1] : null;
  const next = !liveOverride && activeLyricSlide < slides.length - 1 ? slides[activeLyricSlide + 1] : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Top: slide list + live preview side by side */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slide thumbnails */}
        <div className="flex flex-col border-r border-white/10 overflow-y-auto bg-[#16162a]" style={{ width: 190, minWidth: 160 }}>
          <div className="px-3 py-2 border-b border-white/10 bg-[#13131f]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Slides</p>
            <p className="text-xs text-white/80 font-medium truncate mt-0.5">{song.title}</p>
            <p className="text-[10px] text-white/35">{song.author}</p>
          </div>
          <div className="flex-1 p-2 flex flex-col gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={i}
                onClick={() => setActiveLyricSlide(i)}
                className={`w-full text-left rounded p-2 border transition-all ${
                  i === activeLyricSlide
                    ? "border-[#7c6af7]/60 bg-[#7c6af7]/15 text-white"
                    : "border-white/8 bg-white/3 text-white/50 hover:text-white/80 hover:border-white/15"
                }`}
              >
                <div className="w-full aspect-video rounded bg-black/40 flex items-center justify-center mb-1.5 p-1 overflow-hidden">
                  <p className="text-[7px] leading-tight text-center text-white/70 whitespace-pre-line line-clamp-4">{slide}</p>
                </div>
                <p className="text-[9px] text-white/40">{i + 1} / {slides.length}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d1a]">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-[#13131f]">
            <div className="flex items-center gap-1.5">
              <Monitor size={12} className="text-[#7c6af7]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Live Output Preview</span>
            </div>
            <div className="flex items-center gap-1.5">
              {liveOverride?.type === "bible" && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                    <BookOpen size={9} /> {liveOverride.reference}
                  </span>
                  <button onClick={clearOverride} className="text-white/25 hover:text-white/60 transition-colors">
                    <X size={11} />
                  </button>
                </div>
              )}
              {isBlank && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">BLANK</span>
              )}
              <Eye size={12} className="text-white/30" />
            </div>
          </div>

          {/* Preview screen */}
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-2xl aspect-video rounded-lg bg-black border border-white/10 relative overflow-hidden shadow-2xl flex items-center justify-center">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a2e] via-black to-[#1a0a2e]" />
              {!isBlank ? (
                <p className="relative z-10 text-white text-center whitespace-pre-line leading-relaxed px-10 drop-shadow-lg"
                  style={{ fontSize: "clamp(14px, 2.2vw, 28px)", textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>
                  {current}
                </p>
              ) : (
                <div className="absolute inset-0 bg-black z-10" />
              )}
              {/* Screen corners */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/20 rounded-tl" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/20 rounded-tr" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/20 rounded-bl" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/20 rounded-br" />
            </div>
          </div>

          {/* Prev / next text hints */}
          <div className="grid grid-cols-2 gap-3 px-4 pb-3">
            <div className="rounded bg-white/3 border border-white/8 p-2 min-h-[52px]">
              <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Previous</p>
              <p className="text-[10px] text-white/35 whitespace-pre-line leading-tight line-clamp-3">{prev ?? "—"}</p>
            </div>
            <div className="rounded bg-white/3 border border-white/8 p-2 min-h-[52px]">
              <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Next</p>
              <p className="text-[10px] text-white/35 whitespace-pre-line leading-tight line-clamp-3">{next ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-[#13131f]">
        <button
          onClick={() => setActiveLyricSlide(Math.max(0, activeLyricSlide - 1))}
          disabled={activeLyricSlide === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:border-white/20 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={13} /> Previous
        </button>
        <span className="text-xs text-white/35">
          Slide {activeLyricSlide + 1} of {slides.length}
        </span>
        <button
          onClick={() => setActiveLyricSlide(Math.min(slides.length - 1, activeLyricSlide + 1))}
          disabled={activeLyricSlide === slides.length - 1}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#7c6af7] border border-[#7c6af7] text-xs text-white hover:bg-[#6a58e0] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          Next <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
