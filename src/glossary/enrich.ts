import { glossaryById, glossaryEntries } from './entries.ts';
import type { GlossaryEntry } from './entries.ts';

type MatchRule = { id: string; re: RegExp };

const SKIP_TAGS = new Set(['code', 'pre', 'kbd']);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function boundaryRegex(term: string): RegExp {
  const body = escapeRegex(term);
  const start = /^\w/.test(term) ? '\\b' : '(?<![\\w])';
  const end = /\w$/.test(term) ? '\\b' : '(?![\\w])';
  return new RegExp(`${start}${body}${end}`, 'i');
}

const matchRules: MatchRule[] = glossaryEntries
  .flatMap((e) => e.match.map((m) => ({ id: e.id, term: m, len: m.length })))
  .sort((a, b) => b.len - a.len)
  .map(({ id, term }) => ({ id, re: boundaryRegex(term) }));

function wrapGloss(raw: string, id: string): string {
  if (!glossaryById.has(id)) return raw;
  return `<span class="gloss" tabindex="0" data-gloss="${id}">${escapeHtml(raw)}</span>`;
}

export function glossPlainText(text: string): string {
  if (!text || !/[A-Za-z0-9]/.test(text)) return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    let best: { len: number; id: string; raw: string } | undefined;
    for (const rule of matchRules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(text);
      if (m?.index === i && m[0]) {
        const raw = m[0];
        if (!best || raw.length > best.len) best = { len: raw.length, id: rule.id, raw };
      }
    }
    if (best) {
      out += wrapGloss(best.raw, best.id);
      i += best.len;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

function tagName(tag: string): string | undefined {
  const m = tag.match(/^<\/?([a-zA-Z][\w-]*)/);
  return m?.[1]?.toLowerCase();
}

function opensGloss(tag: string): boolean {
  return /^<span\b/i.test(tag) && /\bdata-gloss=/.test(tag);
}

function isVoid(tag: string): boolean {
  return /\/>\s*$/.test(tag) || /^<(br|hr|img)\b/i.test(tag);
}

function hasGlossClass(tag: string): boolean {
  return /\bclass=["'][^"']*\bgloss\b/.test(tag);
}

function ensureGlossSpan(tag: string): string {
  let out = tag;
  if (!hasGlossClass(out)) {
    if (/\bclass="/.test(out)) out = out.replace(/\bclass="/, 'class="gloss ');
    else out = out.replace(/^(<span\b)/i, '$1 class="gloss"');
  }
  if (!/\btabindex=/.test(out)) out = out.replace(/^(<span\b)/i, '$1 tabindex="0"');
  return out;
}

/** Wrap known terms in step prose HTML. Skips `code`/`pre` and existing `data-gloss` spans. */
export function enrichGlossary(html: string): string {
  const prepared = html.replace(/<span\b[^>]*\bdata-gloss="[^"]+"[^>]*>/gi, ensureGlossSpan);

  const parts = prepared.split(/(<[^>]+>)/);
  const stack: string[] = [];
  let glossDepth = 0;

  return parts
    .map((part) => {
      if (!part.startsWith('<')) {
        if (glossDepth > 0) return part;
        if (stack.some((t) => SKIP_TAGS.has(t))) return part;
        return glossPlainText(part);
      }

      const name = tagName(part);
      const closing = part.startsWith('</');
      if (closing && name) {
        if (stack.at(-1) === name) stack.pop();
        if (name === 'span' && glossDepth > 0) glossDepth -= 1;
      } else if (name && !isVoid(part)) {
        if (opensGloss(part)) glossDepth += 1;
        stack.push(name);
      }
      return part;
    })
    .join('');
}

export function glossaryDefinition(entry: GlossaryEntry, locale: 'en' | 'id'): string {
  return entry.definition[locale];
}

export function glossaryExpansion(entry: GlossaryEntry, locale: 'en' | 'id'): string | undefined {
  return entry.expansion?.[locale];
}

/** Short surface form for stage list, e.g. TCP, DNS, N+1. */
export function glossaryAbbrevLabel(entry: GlossaryEntry): string {
  const caps = entry.match.find((m) => /^[A-Z0-9][A-Z0-9+./-]*$/.test(m));
  if (caps) return caps;
  const short = entry.match.find((m) => m.length <= 12);
  return short ?? entry.match[0] ?? entry.id;
}

/** Glossary entries (with expansion) mentioned in prose HTML, in order of first appearance. */
export function glossaryInProse(...chunks: string[]): GlossaryEntry[] {
  const plain = chunks.join(' ').replace(/<[^>]+>/g, ' ');
  if (!plain.trim()) return [];
  const hits: { index: number; id: string }[] = [];
  for (const rule of matchRules) {
    const entry = glossaryById.get(rule.id);
    if (!entry?.expansion) continue;
    rule.re.lastIndex = 0;
    const m = rule.re.exec(plain);
    if (m?.index !== undefined) hits.push({ index: m.index, id: rule.id });
    rule.re.lastIndex = 0;
  }
  hits.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const out: GlossaryEntry[] = [];
  for (const h of hits) {
    if (seen.has(h.id)) continue;
    const e = glossaryById.get(h.id);
    if (e) {
      seen.add(h.id);
      out.push(e);
    }
  }
  return out;
}