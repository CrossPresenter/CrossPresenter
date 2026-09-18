/**
 * The one true slide renderer.
 *
 * Used, unmodified, for the Slide Grid thumbnails, the Live Output preview,
 * the fullscreen projection window, and the Stage view — so what the operator
 * clicks is pixel-identical to what the audience sees. Sizing is done entirely
 * in CSS container-query units (`cqh`/`cqw`) against the 1920x1080 authoring
 * canvas, so one component scales correctly whether it is a 90px thumbnail or
 * a 4K projector without any JS measuring pass.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../lib/defaults";
import { assetUrl } from "../../lib/tauri";
import type { Background, Layer, Slide, TextLayer, TextSpan, TextStyle } from "../../lib/types";

interface SlideCanvasProps {
  slide: Slide | null;
  /** Falls back to this when the slide itself defines no background. */
  itemBackground?: Background | null;
  black?: boolean;
  textCleared?: boolean;
  backgroundCleared?: boolean;
  webUrl?: string | null;
  className?: string;
  /** Renders selection outlines and forwards layer clicks — Edit view only. */
  interactive?: boolean;
  selectedLayerId?: string | null;
  onSelectLayer?: (layerId: string | null) => void;
}

/** Scale a canvas-space font size (authored against a 1080-tall canvas) to cqh. */
function cqh(px: number): string {
  return `${(px / CANVAS_HEIGHT) * 100}cqh`;
}

export function SlideCanvas({
  slide,
  itemBackground,
  black = false,
  textCleared = false,
  backgroundCleared = false,
  webUrl = null,
  className,
  interactive = false,
  selectedLayerId,
  onSelectLayer,
}: SlideCanvasProps) {
  const background = backgroundCleared ? null : slide?.background ?? itemBackground ?? null;

  return (
    <div
      className={`relative overflow-hidden bg-black ${className ?? ""}`}
      style={{ containerType: "size", aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      onPointerDown={(e) => {
        if (interactive && e.target === e.currentTarget) onSelectLayer?.(null);
      }}
    >
      {!black && webUrl && (
        <iframe
          src={webUrl}
          title="Live web"
          className="absolute inset-0 h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}

      {!black && !webUrl && background && <BackgroundLayer background={background} />}

      {!black && !webUrl && !textCleared && slide?.layers.map((layer) => (
        <LayerView
          key={layer.id}
          layer={layer}
          interactive={interactive}
          selected={interactive && selectedLayerId === layer.id}
          onSelect={() => onSelectLayer?.(layer.id)}
        />
      ))}
    </div>
  );
}

function BackgroundLayer({ background }: { background: Background }) {
  switch (background.kind) {
    case "color":
      return <div className="absolute inset-0" style={{ background: background.color }} />;
    case "gradient":
      return (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`,
          }}
        />
      );
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetUrl(background.src)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: (background.fit as "cover" | "contain") || "cover" }}
        />
      );
    case "video":
      return (
        <video
          src={assetUrl(background.src)}
          autoPlay
          muted={background.muted}
          loop={background.loopPlayback}
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      );
    default:
      return null;
  }
}

function LayerView({
  layer,
  interactive,
  selected,
  onSelect,
}: {
  layer: Layer;
  interactive: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  if (!layer.visible) return null;

  const rectStyle: React.CSSProperties = {
    position: "absolute",
    left: `${layer.rect.x * 100}%`,
    top: `${layer.rect.y * 100}%`,
    width: `${layer.rect.width * 100}%`,
    height: `${layer.rect.height * 100}%`,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    outline: interactive && selected ? "2px solid var(--color-accent-500)" : undefined,
    outlineOffset: interactive && selected ? "2px" : undefined,
    cursor: interactive ? "pointer" : undefined,
  };

  const stop = (e: React.PointerEvent) => interactive && e.stopPropagation();

  if (layer.type === "text") {
    return (
      <div style={rectStyle} onPointerDown={(e) => (stop(e), onSelect())}>
        <TextLayerView layer={layer} />
      </div>
    );
  }

  if (layer.type === "image") {
    return (
      <div style={rectStyle} onPointerDown={(e) => (stop(e), onSelect())}>
        <img
          src={assetUrl(layer.src)}
          alt=""
          draggable={false}
          className="h-full w-full"
          style={{ objectFit: "contain", opacity: layer.opacity }}
        />
      </div>
    );
  }

  // Shape layer
  return (
    <div
      style={{
        ...rectStyle,
        background: layer.fill,
        border: layer.strokeWidth > 0 ? `${layer.strokeWidth}px solid ${layer.stroke}` : undefined,
        borderRadius: layer.cornerRadius,
        opacity: layer.opacity,
      }}
      onPointerDown={(e) => (stop(e), onSelect())}
    />
  );
}

function TextLayerView({ layer }: { layer: TextLayer }) {
  const { style, text, spans, autoFit } = layer;
  const justify =
    style.align === "left" ? "flex-start" : style.align === "right" ? "flex-end" : "center";
  const alignItems =
    style.verticalAlign === "top" ? "flex-start" : style.verticalAlign === "bottom" ? "flex-end" : "center";

  return (
    <div
      className="flex h-full w-full"
      style={{
        justifyContent: style.align === "justify" ? "stretch" : justify,
        alignItems,
        // Auto-fit boxes are authored to grow with content rather than clip it.
        overflow: autoFit ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          textAlign: style.align,
          color: style.color,
          fontFamily: style.fontFamily,
          fontSize: cqh(style.fontSize),
          fontWeight: style.bold ? 700 : 400,
          fontStyle: style.italic ? "italic" : "normal",
          textDecoration: style.underline ? "underline" : "none",
          textTransform: style.uppercase ? "uppercase" : "none",
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
          textShadow: style.shadow || undefined,
          WebkitTextStroke:
            style.strokeWidth > 0 ? `${style.strokeWidth}px ${style.strokeColor}` : undefined,
          whiteSpace: "pre-wrap",
          width: "100%",
        }}
      >
        {renderSpans(text, spans, style)}
      </div>
    </div>
  );
}

/** Split `text` into styled runs at every span boundary. */
function renderSpans(text: string, spans: TextSpan[], base: TextStyle) {
  if (spans.length === 0) return text;

  const cuts = new Set<number>([0, text.length]);
  for (const s of spans) {
    cuts.add(Math.max(0, Math.min(text.length, s.start)));
    cuts.add(Math.max(0, Math.min(text.length, s.end)));
  }
  const points = [...cuts].sort((a, b) => a - b);

  const chunks: React.ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (start === end) continue;
    const covering = spans.filter((s) => s.start <= start && s.end >= end);
    const chunk = text.slice(start, end);

    if (covering.length === 0) {
      chunks.push(chunk);
      continue;
    }

    const bold = covering.some((s) => s.bold != null) ? covering.find((s) => s.bold != null)!.bold : base.bold;
    const italic = covering.some((s) => s.italic != null)
      ? covering.find((s) => s.italic != null)!.italic
      : base.italic;
    const underline = covering.some((s) => s.underline != null)
      ? covering.find((s) => s.underline != null)!.underline
      : base.underline;
    const color = covering.find((s) => s.color != null)?.color ?? undefined;
    const fontSize = covering.find((s) => s.fontSize != null)?.fontSize;
    const fontFamily = covering.find((s) => s.fontFamily != null)?.fontFamily ?? undefined;

    chunks.push(
      <span
        key={start}
        style={{
          fontWeight: bold ? 700 : 400,
          fontStyle: italic ? "italic" : "normal",
          textDecoration: underline ? "underline" : "none",
          color,
          fontSize: fontSize != null ? cqh(fontSize) : undefined,
          fontFamily,
        }}
      >
        {chunk}
      </span>,
    );
  }
  return chunks;
}
