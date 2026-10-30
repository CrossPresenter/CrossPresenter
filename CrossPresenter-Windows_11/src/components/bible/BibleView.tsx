/**
 * The Bible tab in the top bar.
 *
 * This is deliberately a thin view for now: it shows what Scripture the
 * operator has installed and lets them add or remove a translation. Verse
 * selection and projection still run through the full-screen Bible browser
 * (the same one the Main workspace opens), so there is exactly one verse
 * engine and no second copy of the book/chapter/verse state.
 */

import { useEffect } from "react";

import type { BibleTranslationSummary } from "../../lib/types";
import { useStore } from "../../state/store";
import { BibleCrossIcon, PlusIcon, TrashIcon, UploadIcon } from "../common/Icons";

export function BibleView() {
  const translations = useStore((s) => s.bibleTranslations);
  const refreshBibleTranslations = useStore((s) => s.refreshBibleTranslations);
  const importBibleFromPicker = useStore((s) => s.importBibleFromPicker);
  const removeInstalledBibleTranslation = useStore((s) => s.removeInstalledBibleTranslation);
  const setBibleOpen = useStore((s) => s.setBibleOpen);
  const busy = useStore((s) => s.busy);

  useEffect(() => {
    refreshBibleTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="cp-panel-header flex items-center justify-between">
        <span className="flex items-center gap-2">
          <BibleCrossIcon className="h-4 w-4 text-accent-400" />
          Bible
        </span>
        <div className="flex items-center gap-2">
          <button
            className="cp-btn cp-btn-ghost !py-1 !px-2 text-[11.5px]"
            onClick={() => setBibleOpen(true)}
            title="Open the Books → Chapters → Verses browser"
          >
            Verse browser
          </button>
          <button
            className="cp-btn cp-btn-primary !py-1 !px-2 text-[11.5px]"
            disabled={busy != null}
            onClick={() => void importBibleFromPicker()}
          >
            <PlusIcon className="h-3 w-3" /> Import translation
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="rounded-lg border border-shell-700 bg-shell-850 p-4">
            <h2 className="text-[13px] font-semibold text-ink-100">Installed translations</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
              CrossPresenter ships without Scripture text. Import a Zefania-XML translation to read from
              it here; the file stays on this machine.
            </p>

            <div className="mt-3 space-y-1.5">
              {translations.map((t) => (
                <TranslationRow
                  key={t.id}
                  translation={t}
                  onRemove={() => void removeInstalledBibleTranslation(t.id)}
                />
              ))}

              {translations.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-shell-700 py-8 text-center text-[12.5px] text-ink-500">
                  <UploadIcon className="h-5 w-5" />
                  <span>No translations installed yet.</span>
                  <button
                    className="cp-btn cp-btn-primary !py-1 !px-3 text-[11.5px]"
                    disabled={busy != null}
                    onClick={() => void importBibleFromPicker()}
                  >
                    Choose a Zefania-XML file
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="px-1 text-[11.5px] leading-relaxed text-ink-500">
            Verse search, parallel translations and lower-third templates will live in this tab.
            Until then, use <span className="text-ink-300">Verse browser</span> to project a passage.
          </p>
        </div>
      </div>
    </div>
  );
}

function TranslationRow({
  translation,
  onRemove,
}: {
  translation: BibleTranslationSummary;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-md border border-shell-700 bg-shell-900 px-3 py-2">
      <BibleCrossIcon className="h-4 w-4 flex-none text-ink-400" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] text-ink-100">{translation.name}</div>
        <div className="truncate text-[11px] text-ink-500">
          {translation.language || "Unknown language"} · {translation.bookCount} book
          {translation.bookCount === 1 ? "" : "s"}
        </div>
      </div>
      <button
        className="cp-btn-ghost cp-btn invisible !p-1 group-hover:visible"
        title="Remove translation"
        onClick={onRemove}
      >
        <TrashIcon className="h-3 w-3" />
      </button>
    </div>
  );
}
