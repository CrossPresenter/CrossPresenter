/**
 * The Bible module: a Books → Chapters → Verses grid selector.
 *
 * CrossPresenter ships with no Scripture text (see `bible.rs`'s module doc) —
 * every translation shown here was imported by the operator from a Zefania-XML
 * file. Clicking a verse calls `projectAdHocSlide`, which only ever touches
 * `live`/`liveSlideId`, never `activeItemId`/`selectedSlideId` — so reading a
 * verse mid-service never disturbs whatever Home slide is selected underneath.
 */

import { useEffect, useMemo, useState } from "react";

import { KIND_COLORS, newSlide } from "../../lib/defaults";
import { errorMessage, getBibleTranslation } from "../../lib/tauri";
import type { BibleTranslation } from "../../lib/types";
import { useStore } from "../../state/store";
import { BookIcon, ChevronLeftIcon, PlusIcon, TrashIcon, UploadIcon } from "../common/Icons";
import { Modal } from "../common/Modal";

type Stage = "books" | "chapters" | "verses";

export function BibleModal() {
  const setBibleOpen = useStore((s) => s.setBibleOpen);
  const translations = useStore((s) => s.bibleTranslations);
  const refreshBibleTranslations = useStore((s) => s.refreshBibleTranslations);
  const importBibleFromPicker = useStore((s) => s.importBibleFromPicker);
  const removeInstalledBibleTranslation = useStore((s) => s.removeInstalledBibleTranslation);
  const projectAdHocSlide = useStore((s) => s.projectAdHocSlide);
  const busy = useStore((s) => s.busy);
  const toast = useStore((s) => s.toast);

  const [translationId, setTranslationId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, BibleTranslation>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("books");
  const [bookIndex, setBookIndex] = useState<number | null>(null);
  const [chapterIndex, setChapterIndex] = useState<number | null>(null);

  useEffect(() => {
    refreshBibleTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (translationId || translations.length === 0) return;
    setTranslationId(translations[0].id);
  }, [translations, translationId]);

  useEffect(() => {
    if (!translationId || cache[translationId] || loadingId === translationId) return;
    setLoadingId(translationId);
    getBibleTranslation(translationId)
      .then((full) => setCache((c) => ({ ...c, [translationId]: full })))
      .catch((err) => toast("error", errorMessage(err)))
      .finally(() => setLoadingId((id) => (id === translationId ? null : id)));
  }, [translationId, cache, loadingId, toast]);

  const translation = translationId ? cache[translationId] : undefined;
  const book = bookIndex != null ? translation?.books[bookIndex] : undefined;
  const chapter = chapterIndex != null ? book?.chapters[chapterIndex] : undefined;

  const reference = useMemo(() => {
    if (!book) return "";
    if (chapterIndex == null) return book.name;
    return `${book.name} ${chapterIndex + 1}`;
  }, [book, chapterIndex]);

  function selectTranslation(id: string) {
    setTranslationId(id);
    setStage("books");
    setBookIndex(null);
    setChapterIndex(null);
  }

  function selectBook(index: number) {
    setBookIndex(index);
    setChapterIndex(null);
    setStage("chapters");
  }

  function selectChapter(index: number) {
    setChapterIndex(index);
    setStage("verses");
  }

  function projectVerse(verseIndex: number) {
    if (!book || chapterIndex == null || !chapter) return;
    const text = chapter[verseIndex] ?? "";
    const label = `${book.name} ${chapterIndex + 1}:${verseIndex + 1}`;
    const slide = { ...newSlide(text, label), groupColor: KIND_COLORS.bible };
    projectAdHocSlide(slide);
  }

  async function removeTranslation(id: string) {
    await removeInstalledBibleTranslation(id);
    setCache((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
    if (translationId === id) {
      setTranslationId(null);
      setStage("books");
      setBookIndex(null);
      setChapterIndex(null);
    }
  }

  const breadcrumb: { label: string; onClick: () => void }[] = [
    { label: "Books", onClick: () => setStage("books") },
  ];
  if (stage !== "books" && book) {
    breadcrumb.push({ label: book.name, onClick: () => setStage("chapters") });
  }
  if (stage === "verses" && chapterIndex != null) {
    breadcrumb.push({ label: `Chapter ${chapterIndex + 1}`, onClick: () => setStage("verses") });
  }

  return (
    <Modal title="Bible" onClose={() => setBibleOpen(false)} widthClassName="max-w-3xl">
      <div className="flex flex-col gap-3">
        {/* Translation switcher ------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-1.5">
          {translations.map((t) => (
            <div key={t.id} className="group relative">
              <button
                className="cp-tab !pr-6"
                aria-selected={t.id === translationId}
                onClick={() => selectTranslation(t.id)}
                title={`${t.language} · ${t.bookCount} books`}
              >
                {t.name}
              </button>
              <button
                className="absolute right-1 top-1/2 -translate-y-1/2 text-ink-500 opacity-0 hover:text-live-500 group-hover:opacity-100"
                title="Remove translation"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTranslation(t.id);
                }}
              >
                <TrashIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            className="cp-btn-ghost cp-btn !px-2 !py-1"
            disabled={busy != null}
            onClick={() => importBibleFromPicker()}
            title="Import a Zefania-XML translation"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Import
          </button>
        </div>

        {translations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <BookIcon className="h-8 w-8 text-ink-600" />
            <div className="text-[13px] font-medium text-ink-200">No Bible translations installed</div>
            <p className="max-w-sm text-[12px] leading-relaxed text-ink-500">
              Import a Zefania-XML module — the format used by SWORD, MySword and most free
              public-domain translations — to start projecting Scripture.
            </p>
            <button className="cp-btn cp-btn-primary" onClick={() => importBibleFromPicker()}>
              <UploadIcon className="h-3.5 w-3.5" /> Import Translation
            </button>
          </div>
        ) : loadingId === translationId && !translation ? (
          <div className="px-6 py-14 text-center text-[12px] text-ink-500">Loading translation…</div>
        ) : translation ? (
          <>
            {/* Breadcrumb ---------------------------------------------------- */}
            <div className="flex items-center gap-1.5 text-[12px] text-ink-400">
              {stage !== "books" && (
                <button
                  className="cp-btn-ghost cp-btn !px-1.5 !py-1"
                  onClick={() => {
                    if (stage === "verses") setStage("chapters");
                    else setStage("books");
                  }}
                  title="Back"
                >
                  <ChevronLeftIcon />
                </button>
              )}
              {breadcrumb.map((b, i) => (
                <span key={b.label} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-ink-600">/</span>}
                  <button className="hover:text-ink-50" onClick={b.onClick}>
                    {b.label}
                  </button>
                </span>
              ))}
            </div>

            {stage === "books" && (
              <div className="grid max-h-[52vh] grid-cols-4 gap-1.5 overflow-y-auto">
                {translation.books.map((b, i) => (
                  <button
                    key={`${b.name}-${i}`}
                    className="cp-btn justify-start truncate text-left"
                    onClick={() => selectBook(i)}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}

            {stage === "chapters" && book && (
              <div className="grid max-h-[52vh] grid-cols-8 gap-1.5 overflow-y-auto">
                {book.chapters.map((_, i) => (
                  <button key={i} className="cp-btn justify-center" onClick={() => selectChapter(i)}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            {stage === "verses" && chapter && (
              <div className="flex max-h-[52vh] flex-col gap-1 overflow-y-auto">
                {chapter.map((text, i) => (
                  <button
                    key={i}
                    className="cp-panel flex items-start gap-2.5 px-3 py-2 text-left text-[13px] leading-snug text-ink-200 hover:border-accent-500"
                    onClick={() => projectVerse(i)}
                    title={`Project ${reference}:${i + 1}`}
                  >
                    <span className="mt-0.5 flex-none text-[11px] font-semibold text-accent-500">{i + 1}</span>
                    <span className="flex-1">{text || "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
