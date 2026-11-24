'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { findInCourse } from '../src/course';
import { glossaryById } from '../src/glossary/entries.ts';
import { enrichGlossary, glossaryDefinition } from '../src/glossary/enrich.ts';
import { lessonStepPath } from '../src/glossary/paths.ts';
import type { Locale } from '../src/i18n';

type TipState = { id: string; x: number; y: number; placement: 'above' | 'below' };

function placeTip(rect: DOMRect): Pick<TipState, 'x' | 'y' | 'placement'> {
  const x = rect.left + rect.width / 2;
  const above = rect.top >= 120;
  return above
    ? { x, y: rect.top - 8, placement: 'above' }
    : { x, y: rect.bottom + 8, placement: 'below' };
}

export function GlossaryHtml({ html }: { html: string }) {
  const enriched = useMemo(() => enrichGlossary(html), [html]);
  return <span dangerouslySetInnerHTML={{ __html: enriched }} />;
}

/** Plain string (no HTML tags) from goals, summary, metrics notes, etc. */
export function GlossaryPlain({ text }: { text: string }) {
  const enriched = useMemo(() => enrichGlossary(text), [text]);
  return <span dangerouslySetInnerHTML={{ __html: enriched }} />;
}

export function GlossaryScope({
  locale,
  className,
  children,
  hidden,
}: {
  locale: Locale;
  className?: string;
  children: ReactNode;
  hidden?: boolean;
}) {
  const t = useTranslations();
  const rootRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | undefined>();
  const pinned = useRef(false);

  const show = useCallback((el: HTMLElement) => {
    const id = el.dataset.gloss;
    if (!id || !glossaryById.has(id)) return;
    setTip({ id, ...placeTip(el.getBoundingClientRect()) });
  }, []);

  const hide = useCallback(() => {
    if (!pinned.current) setTip(undefined);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onOver = (event: Event) => {
      const el = (event.target as HTMLElement | null)?.closest('.gloss');
      if (el && root.contains(el)) show(el as HTMLElement);
    };

    const onOut = (event: Event) => {
      const rel = (event as MouseEvent).relatedTarget as Node | null;
      const el = (event.target as HTMLElement | null)?.closest('.gloss');
      if (el && root.contains(el) && rel && !el.contains(rel)) hide();
    };

    const onFocus = (event: FocusEvent) => {
      const el = (event.target as HTMLElement | null)?.closest('.gloss');
      if (el && root.contains(el)) show(el as HTMLElement);
    };

    const onBlur = (event: FocusEvent) => {
      const el = (event.target as HTMLElement | null)?.closest('.gloss');
      const rel = event.relatedTarget as Node | null;
      if (el && root.contains(el) && (!rel || !el.contains(rel))) hide();
    };

    const onClick = (event: MouseEvent) => {
      const el = (event.target as HTMLElement | null)?.closest('.gloss');
      if (el && root.contains(el)) {
        pinned.current = !pinned.current;
        if (pinned.current) show(el as HTMLElement);
        else setTip(undefined);
        event.preventDefault();
        return;
      }
      if (pinned.current) {
        pinned.current = false;
        setTip(undefined);
      }
    };

    root.addEventListener('mouseover', onOver);
    root.addEventListener('mouseout', onOut);
    root.addEventListener('focusin', onFocus);
    root.addEventListener('focusout', onBlur);
    root.addEventListener('click', onClick);
    return () => {
      root.removeEventListener('mouseover', onOver);
      root.removeEventListener('mouseout', onOut);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('focusout', onBlur);
      root.removeEventListener('click', onClick);
    };
  }, [hide, show]);

  const entry = tip ? glossaryById.get(tip.id) : undefined;
  const place = entry?.lessonId ? findInCourse(entry.lessonId) : undefined;
  const href =
    entry?.lessonId && entry.step && place?.entry.lesson
      ? lessonStepPath(locale, entry.lessonId, entry.step)
      : undefined;

  const popover =
    entry && tip ? (
      <div
        className={`glossary-popover is-${tip.placement}`}
        role="tooltip"
        style={{ left: tip.x, top: tip.y }}
        onMouseEnter={() => {
          pinned.current = true;
        }}
        onMouseLeave={() => {
          pinned.current = false;
          setTip(undefined);
        }}
      >
        <p className="glossary-popover-def">{glossaryDefinition(entry, locale)}</p>
        {href && place && (
          <Link className="glossary-popover-link" href={href} onClick={() => setTip(undefined)}>
            {t('glossary.openLesson', { title: place.entry.title[locale] })}
          </Link>
        )}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={className} hidden={hidden}>
      {children}
      {popover && createPortal(popover, document.body)}
    </div>
  );
}