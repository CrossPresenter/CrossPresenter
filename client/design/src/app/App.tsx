import { useState } from "react";
import { TopBar } from "./components/TopBar";
import { LyricsPanel } from "./components/LyricsPanel";
import { ServicePanel } from "./components/ServicePanel";
import { MediaPanel } from "./components/MediaPanel";

export interface LiveContent {
  type: "song" | "bible";
  text: string;
  reference?: string; // e.g. "John 3:16"
}

export default function App() {
  const [activeServiceItem, setActiveServiceItem] = useState(0);
  const [activeLyricSlide, setActiveLyricSlide] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [isBlank, setIsBlank] = useState(false);
  const [isTheme, setIsTheme] = useState(false);
  const [liveOverride, setLiveOverride] = useState<LiveContent | null>(null);

  return (
    <div
      className="size-full flex flex-col overflow-hidden"
      style={{ background: "#1e1e2e", color: "#e2e2f0", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <TopBar
        isLive={isLive} setIsLive={setIsLive}
        isBlank={isBlank} setIsBlank={setIsBlank}
        isTheme={isTheme} setIsTheme={setIsTheme}
      />

      <div className="flex overflow-hidden" style={{ flex: 1 }}>
        <LyricsPanel
          activeServiceItem={activeServiceItem}
          activeLyricSlide={activeLyricSlide}
          setActiveLyricSlide={setActiveLyricSlide}
          isBlank={isBlank}
          liveOverride={liveOverride}
          clearOverride={() => setLiveOverride(null)}
        />
        <ServicePanel
          activeServiceItem={activeServiceItem}
          setActiveServiceItem={(i) => { setActiveServiceItem(i); setActiveLyricSlide(0); setLiveOverride(null); }}
        />
      </div>

      <MediaPanel onBibleVerse={setLiveOverride} />
    </div>
  );
}
