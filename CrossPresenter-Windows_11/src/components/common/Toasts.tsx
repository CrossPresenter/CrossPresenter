import { useStore } from "../../state/store";

const KIND_STYLE: Record<string, string> = {
  info: "border-shell-600",
  success: "border-accent-500",
  error: "border-live-500",
};

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`cp-panel pointer-events-auto flex items-start gap-2 border-l-[3px] px-3 py-2.5 text-[12px] text-ink-200 shadow-lg ${KIND_STYLE[t.kind]}`}
        >
          <span className="flex-1 leading-snug">{t.message}</span>
          <button className="cp-btn-ghost cp-btn !px-1.5 !py-0.5" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
