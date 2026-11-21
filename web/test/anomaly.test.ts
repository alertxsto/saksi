import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scoreAgency, signalReason, templateAudit, type AgencyFeatures } from '../lib/server/anomaly-score';

const quiet: AgencyFeatures = { tampered: 0, lateBreach: 0, openReports: 0, total: 20, outward: 2, burst: 2, offHours: 1, slowSeals: 0, staleDrafts: 0 };

describe('audit priority scoring', () => {
  it('a quiet agency is low with no signals', () => {
    expect(scoreAgency(quiet)).toEqual({ score: 0, level: 'low', signals: [] });
  });

  it('tampering found by Watch alone is high priority', () => {
    const s = scoreAgency({ ...quiet, tampered: 1 });
    expect(s.level).toBe('high');
    expect(s.signals[0]).toEqual({ code: 'tampered', value: 1, points: 40 });
  });

  it('caps repeated late notices and open reports, and the total at 100', () => {
    expect(scoreAgency({ ...quiet, lateBreach: 5 }).score).toBe(50);
    expect(scoreAgency({ ...quiet, openReports: 9 }).score).toBe(30);
    expect(scoreAgency({ ...quiet, tampered: 2, lateBreach: 3, openReports: 4, outward: 15, burst: 9, offHours: 12, slowSeals: 2, staleDrafts: 3 }).score).toBe(100);
  });

  it('ratios need enough volume: two exports out of three count, one export out of one does not', () => {
    expect(scoreAgency({ ...quiet, total: 3, outward: 2 }).signals.map((s) => s.code)).toEqual(['outward']);
    expect(scoreAgency({ ...quiet, total: 1, outward: 1, offHours: 1 }).signals).toEqual([]);
  });

  it('medium starts at 15 points: one slow seal is medium, an old unsealed draft alone is low', () => {
    expect(scoreAgency({ ...quiet, slowSeals: 1 }).level).toBe('medium');
    expect(scoreAgency({ ...quiet, staleDrafts: 4 }).level).toBe('low');
  });

  it('orders signals by weight', () => {
    const s = scoreAgency({ ...quiet, staleDrafts: 1, lateBreach: 1, burst: 6 });
    expect(s.signals.map((g) => g.code)).toEqual(['lateBreach', 'burst', 'staleDrafts']);
  });

  it('the template words both languages from the same numbers, without legal conclusions', () => {
    const flagged = [{ name: 'RSUD Contoh', ...scoreAgency({ ...quiet, tampered: 1, total: 4, outward: 3 }) }];
    for (const lang of ['en', 'id'] as const) {
      const t = templateAudit(lang, flagged, 5);
      expect(t.items).toHaveLength(1);
      expect(t.items[0].ref).toBe('A1');
      expect(t.items[0].reason).toContain('1');
      expect(t.summary).toContain('RSUD Contoh');
      expect(t.summary).toContain('5');
      expect([t.summary, t.items[0].reason, t.items[0].nextStep].join(' ')).not.toMatch(/\b(unlawful|illegal|violat\w*|melanggar|ilegal)\b/i);
    }
    expect(signalReason('en', { code: 'outward', value: 3, total: 4, points: 15 })).toBe('3 of 4 accesses were exports or third-party shares.');
    expect(templateAudit('en', [], 4).summary).toBe('No pattern needs attention first across the 4 agencies checked.');
  });

  it('the prompt keeps the model to wording: no legal conclusions, input numbers only, no code', () => {
    const prompt = readFileSync(new URL('../lib/server/prompts/anomaly.md', import.meta.url), 'utf8');
    expect(prompt).toContain('you never change them');
    expect(prompt).toContain('Use only numbers that appear in the input');
    expect(prompt).toContain('never proof');
    expect(prompt).toContain('Never give code');
  });
});
