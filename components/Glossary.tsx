'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { findInCourse } from '../src/course';
import { glossaryById } from '../src/glossary/entries.ts';
import { enrichGlossary, glossaryDefinition, glossaryExpansion } from '../src/glossary/enrich.ts';
import { lessonStepPath } from '../src/glossary/paths.ts';
import type { Locale } from '../src/i18n';

const VIEW_PAD = 12;
const ANCHOR_GAP = 8;

type TipAnchor = { top: number; bottom: number; left: number; width: number };
type TipState = {
  id: string;
  anchor: TipAnchor;
  x: number;
  y: number;
  placement: 'above' | 'below';
  placed: boolean;
};

function anchorOf(rect: DOMRect): TipAnchor {
  return { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width };
}

function pickPlacement(anchor: TipAnchor, popH: number): 'above' | 'below' {
  const above = anchor.top - VIEW_PAD;
  const below = window.innerHeight - VIEW_PAD - anchor.bottom;
  const need = popH + ANCHOR_GAP;
  if (need <= above) return 'above';
  if (need <= below) return 'below';
  return below >= above ? 'below' : 'above';
}

function alignPopover(pop: HTMLElement, anchor: TipAnchor) {
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  let place = pickPlacement(anchor, h);
  let y = place === 'above' ? anchor.top - ANCHOR_GAP : anchor.bottom + ANCHOR_GAP;

  if (place === 'above') {
    const top = y - h;
    if (top < VIEW_PAD) {
      if (anchor.bottom + ANCHOR_GAP + h <= window.innerHeight - VIEW_PAD) {
        place = 'below';
        y = anchor.bottom + ANCHOR_GAP;
      } else {
        y = VIEW_PAD + h;
      }
    }
  } else if (y + h > window.innerHeight - VIEW_PAD) {
    y = Math.max(VIEW_PAD, window.innerHeight - VIEW_PAD - h);
  }

  const half = w / 2;
  let x = anchor.left + anchor.width / 2;
  x = Math.max(VIEW_PAD + half, Math.min(window.innerWidth - VIEW_PAD - half, x));

  return { x, y, placement: place };
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
  const popRef = useRef<HTMLDivElement>(null);
  const anchorEl = useRef<HTMLElement | null>(null);
  const [tip, setTip] = useState<TipState | undefined>();
  const pinned = useRef(false);

  const show = useCallback((el: HTMLElement) => {
    const id = el.dataset.gloss;
    if (!id || !glossaryById.has(id)) return;
    anchorEl.current = el;
    const rect = el.getBoundingClientRect();
    const anchor = anchorOf(rect);
    setTip({
      id,
      anchor,
      x: anchor.left + anchor.width / 2,
      y: rect.bottom + ANCHOR_GAP,
      placement: 'below',
      placed: false,
    });
  }, []);

  const hide = useCallback(() => {
    if (!pinned.current) {
      setTip(undefined);
      anchorEl.current = null;
    }
  }, []);

  const relayout = useCallback(() => {
    const pop = popRef.current;
    const state = tip;
    const el = anchorEl.current;
    if (!pop || !state || !el) return;
    const next = alignPopover(pop, anchorOf(el.getBoundingClientRect()));
    setTip((prev) =>
      prev && prev.id === state.id
        ? { ...prev, anchor: anchorOf(el.getBoundingClientRect()), ...next, placed: true }
        : prev,
    );
  }, [tip]);

  useLayoutEffect(() => {
    if (!tip || tip.placed) return;
    relayout();
  }, [tip, relayout, locale]);

  useEffect(() => {
    if (!tip) return;
    const onMove = () => {
      if (!anchorEl.current) return;
      const pop = popRef.current;
      if (!pop) return;
      const next = alignPopover(pop, anchorOf(anchorEl.current.getBoundingClientRect()));
      setTip((prev) => (prev ? { ...prev, anchor: anchorOf(anchorEl.current!.getBoundingClientRect()), ...next, placed: true } : prev));
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [tip?.id]);

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
        anchorEl.current = null;
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
        ref={popRef}
        className={`glossary-popover is-${tip.placement}${tip.placed ? '' : ' is-measuring'}`}
        role="tooltip"
        style={{ left: tip.x, top: tip.y }}
        onMouseEnter={() => {
          pinned.current = true;
        }}
        onMouseLeave={() => {
          pinned.current = false;
          setTip(undefined);
          anchorEl.current = null;
        }}
      >
        {glossaryExpansion(entry, locale) && (
          <p className="glossary-popover-expansion">{glossaryExpansion(entry, locale)}</p>
        )}
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