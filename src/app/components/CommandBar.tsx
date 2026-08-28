import React, { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";

export interface CommandDef {
  id: string;
  label: string;
  keywords: string[];
  icon?: LucideIcon;
  run: () => void;
  /** Return a confirmation message to gate the action, or null to run immediately. */
  confirm?: () => string | null;
}

interface CommandBarProps {
  commands: CommandDef[];
  value: string;
  onChange: (v: string) => void;
  onRun?: (cmd: CommandDef) => void;
  /** Build extra dynamic commands from the raw query text (e.g. a Bible ref). */
  matchText?: (query: string) => CommandDef[];
}

const MAX_RESULTS = 10;

function score(query: string, cmd: CommandDef): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const hay = (cmd.label + " " + cmd.keywords.join(" ") + " " + cmd.id).toLowerCase();
  const idx = hay.indexOf(q);
  if (idx === 0) return 100;
  if (idx > 0) return 60;
  // Partial word match (e.g. "proj" -> projector)
  const words = q.split(/\s+/);
  if (words.every(w => hay.includes(w))) return 40;
  return 0;
}

export function CommandBar({ commands, value, onChange, onRun, matchText }: CommandBarProps) {
  const { settings } = useSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlight, setHighlight] = useState(0);

  const results = useMemo(() => {
    const dynamic: CommandDef[] = (matchText && value.trim())
      ? matchText(value)
      : [];
    const scored = commands
      .map(cmd => ({ cmd, s: score(value, cmd) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_RESULTS)
      .map(x => x.cmd);
    // Dynamic (e.g. scripture-badge) matches take priority over static commands.
    return [...dynamic, ...scored].slice(0, MAX_RESULTS);
  }, [commands, value, matchText]);
  const submit = (cmd: CommandDef) => {
    if (!cmd.confirm) {
      cmd.run();
      if (onRun) onRun(cmd);
      onChange("");
      setHighlight(0);
      return;
    }
    const msg = cmd.confirm();
    if (msg && !window.confirm(msg)) return;
    cmd.run();
    if (onRun) onRun(cmd);
    onChange("");
    setHighlight(0);
  };

  const theme = settings.app.theme;
  const barBg = theme === "light" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.06)";
  const textColor = theme === "light" ? "#111827" : "rgba(255,255,255,0.85)";
  const borderColor = theme === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const itemHover = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";
  const subColor = theme === "light" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.45)";

  return (
    <div className="relative" style={{ width: 320 }}>
      <div
        className="flex items-center gap-2 rounded-full px-3 py-1.5 border"
        style={{ background: barBg, borderColor, color: textColor }}
      >
        <Search size={13} className="shrink-0" style={{ opacity: 0.5 }} />
        <input
          ref={inputRef}
          value={value}
          onChange={e => { onChange(e.target.value); setHighlight(0); }}
          onFocus={() => setHighlight(0)}
          onKeyDown={e => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight(h => Math.min(results.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight(h => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const cmd = results[highlight] || results[0];
              if (cmd) submit(cmd);
            } else if (e.key === "Escape") {
              onChange("");
            }
          }}
          placeholder="Search anything… (e.g. TV, projector, slide)"
          className="w-full bg-transparent outline-none text-xs"
          style={{ color: textColor }}
          spellCheck={false}
        />
      </div>

      {value.trim() && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-lg border shadow-2xl overflow-hidden z-[200]"
          style={{ background: theme === "light" ? "#ffffff" : "#16162a", borderColor }}
        >
          {results.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                type="button"
                onClick={() => submit(cmd)}
                onMouseEnter={() => setHighlight(i)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs"
                style={{
                  background: i === highlight ? itemHover : "transparent",
                  color: theme === "light" ? "#111827" : "rgba(255,255,255,0.9)",
                }}
              >
                {Icon && <Icon size={14} className="shrink-0" style={{ color: "#7c6af7" }} />}
                <span className="truncate">{cmd.label}</span>
                <span className="ml-auto shrink-0 text-[9px]" style={{ color: subColor }}>{cmd.keywords[0]}</span>
              </button>
            );
          })}
        </div>
      )}
      {value.trim() && results.length === 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-lg border shadow-2xl px-3 py-2 text-[11px]"
          style={{ background: theme === "light" ? "#ffffff" : "#16162a", borderColor, color: subColor }}
          data-modal="true"
        >
          No matches. Try “TV”, “live”, “blank”, “next”…
        </div>
      )}
    </div>
  );
}
