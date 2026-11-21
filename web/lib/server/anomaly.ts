import 'server-only';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import type { AiMeta } from '../shared/types';
import { evidenceHash } from '../shared/commit';
import { generate } from './ai';
import { controllerRegister } from './controller-register';
import { anomalyPrompt } from './prompts';
import { scoreAgency, templateAudit, type AgencyFeatures, type Lang, type Scored } from './anomaly-score';

export type { Signal, SignalCode } from './anomaly-score';

// Per-agency access patterns, straight from the database: what was sealed, how fast, when, and in what shape.
// Pending rows are drafts anyone with a citizen code can create, so they only count once they are old and unsealed.
async function accessPatterns() {
  const rows = await db().execute<{ controller_id: string; total: string; outward: string; off_hours: string; slow_seals: string;
    stale: string; burst: string | null }>(sql`
    with live as (
      select controller_id, created_at, event_type, status, block_time
      from access_events where status in ('submitted', 'anchored')
    ), windows as (
      select controller_id,
        count(*) over (partition by controller_id order by created_at range between interval '10 minutes' preceding and current row) as n
      from live
    )
    select c.id as controller_id,
      (select count(*) from live l where l.controller_id = c.id) as total,
      (select count(*) from live l where l.controller_id = c.id and l.event_type in (2, 3)) as outward,
      (select count(*) from live l where l.controller_id = c.id
        and extract(hour from l.created_at at time zone 'Asia/Jakarta') not between 6 and 19) as off_hours,
      (select count(*) from live l where l.controller_id = c.id and l.status = 'anchored'
        and l.block_time - extract(epoch from l.created_at) > 900) as slow_seals,
      (select count(*) from access_events a where a.controller_id = c.id and a.status = 'pending'
        and a.created_at < now() - interval '15 minutes') as stale,
      (select max(n) from windows w where w.controller_id = c.id) as burst
    from controllers c`);
  const list = Array.isArray(rows) ? rows : (rows as unknown as { rows: typeof rows }).rows;
  return new Map([...list].map((r) => [r.controller_id.toLowerCase(), {
    total: Number(r.total), outward: Number(r.outward), offHours: Number(r.off_hours), slowSeals: Number(r.slow_seals),
    staleDrafts: Number(r.stale), burst: Number(r.burst ?? 0),
  }]));
}

const LEGAL = /\b(lawful(ly)?|unlawful(ly)?|legal(ly)?|illegal(ly)?|violat\w*|breach(ed|es)? the law|guilty|criminal|crime|sah|ilegal|melanggar|pelanggaran|bersalah|pidana|melawan hukum)\b/i;
const numbersIn = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];

/** The model writes the words only; refs, numbers and the no-legal-conclusion rule are checked here, on every answer. */
function auditSchema(refs: string[], allowedNumbers: Set<string>) {
  const text = (max: number) => z.string().trim().min(1).max(max);
  return z.strictObject({
    summary: text(500),
    items: z.array(z.strictObject({ ref: z.string(), reason: text(400), nextStep: text(300) })),
  }).refine(({ items }) => items.length === refs.length && refs.every((ref) => items.some((i) => i.ref === ref)))
    .refine(({ summary, items }) => [summary, ...items.flatMap((i) => [i.reason, i.nextStep])]
      .every((t) => !LEGAL.test(t) && numbersIn(t).every((n) => allowedNumbers.has(n.replace(',', '.')))));
}

export type AuditItem = Scored & { id: string; name: string; status: 'active' | 'revoked'; reason: string; nextStep: string };
export type AuditPriority = { items: AuditItem[]; summary: string; ai: AiMeta; watchKnown: boolean; checkedAt: string };

const TOP = 6;
let cache: Partial<Record<Lang, { at: number; key: string; value: AuditPriority }>> = {};
const inFlight = new Map<string, Promise<AuditPriority>>();

/**
 * GET /api/regulator/anomalies: every agency scored by code from what Saksi witnessed (tampering found by Watch,
 * late breach notices, open citizen reports, exports and shares, bursts, off-hours access, slow sealing, unsealed
 * drafts). The AI only explains the top of the list and suggests one audit step each; it sees agency names and
 * counts, never a citizen, a pseudonym or a purpose text. The same input reuses the answer for 10 minutes.
 */
export async function auditPriority(lang: Lang): Promise<AuditPriority> {
  const hit = cache[lang];
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const [register, patterns] = await Promise.all([controllerRegister(), accessPatterns()]);
  const watchKnown = register.watch !== null;
  const scored = register.controllers.map((c) => {
    const p = patterns.get(c.id.toLowerCase());
    const f: AgencyFeatures = {
      tampered: (c.altered ?? 0) + (c.deleted ?? 0), lateBreach: c.breachesLate, openReports: c.openReports ?? 0,
      total: p?.total ?? 0, outward: p?.outward ?? 0, burst: p?.burst ?? 0, offHours: p?.offHours ?? 0,
      slowSeals: p?.slowSeals ?? 0, staleDrafts: p?.staleDrafts ?? 0,
    };
    return { id: c.id, name: c.name.replace(/ \((fictional|fiktif)\)$/, ''), status: c.status, ...scoreAgency(f) };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const flagged = scored.filter((s) => s.level !== 'low').slice(0, TOP);
  const input = {
    language: lang === 'id' ? 'Indonesian' : 'English',
    agencies: flagged.map((s, i) => ({ ref: `A${i + 1}`, name: s.name, level: s.level,
      signals: s.signals.map(({ code, value, total }) => (total === undefined ? { code, value } : { code, value, total })) })),
    agenciesChecked: scored.length,
  };
  const key = evidenceHash(input);
  if (hit && hit.key === key && Date.now() - hit.at < 600_000) {
    cache[lang] = { ...hit, at: Date.now() };
    return hit.value;
  }
  let pending = inFlight.get(key);
  if (!pending) {
    pending = (async () => {
      const template = templateAudit(lang, flagged, scored.length);
      const allowed = new Set(['3', '24', '72', '10', '15', '20', '00', '20:00', '06', '6', '06:00', '1', '2',
        String(scored.length), String(flagged.length), ...flagged.flatMap((s) => s.signals.flatMap((g) => [String(g.value), String(g.total ?? '')]))]);
      const refs = input.agencies.map((a) => a.ref);
      const answer = flagged.length
        ? await generate('anomaly', anomalyPrompt, input, auditSchema(refs, allowed), template)
        : { value: template, ai: { provider: 'local', model: 'rules', fallbackLevel: 'template' as const, latencyMs: 0 } };
      const words = new Map(answer.value.items.map((i) => [i.ref, i]));
      const items: AuditItem[] = scored.map((s) => {
        const ref = flagged.indexOf(s) >= 0 ? `A${flagged.indexOf(s) + 1}` : '';
        const w = words.get(ref);
        return { ...s, reason: w?.reason ?? '', nextStep: w?.nextStep ?? '' };
      });
      const value: AuditPriority = { items, summary: answer.value.summary, ai: answer.ai, watchKnown, checkedAt: new Date().toISOString() };
      cache = { ...cache, [lang]: { at: Date.now(), key, value } };
      return value;
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}
