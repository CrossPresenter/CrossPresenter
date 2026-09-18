/**
 * Shared dialog chrome: dimmed backdrop, `cp-panel` frame, header with a close
 * button, scrollable body, optional footer. Every modal in the app (Bible,
 * Settings, and any future one) is built from this so dismiss behaviour —
 * Escape, backdrop click, the × button — only has to be right in one place.
 */

import { useEffect } from "react";

import { XIcon } from "./Icons";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string;
}

export function Modal({ title, onClose, children, footer, widthClassName = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`cp-panel flex max-h-[85vh] w-full flex-col shadow-2xl ${widthClassName}`}>
        <div className="cp-panel-header">
          <span>{title}</span>
          <button className="cp-btn-ghost cp-btn !px-1.5 !py-1" onClick={onClose} title="Close">
            <XIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-shell-800 px-4 py-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
