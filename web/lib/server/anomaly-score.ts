// Pure scoring for the regulator's "Audit priority" panel (lib/server/anomaly.ts). No database, chain or model here:
// the priority is decided by these rules alone, so the same numbers always give the same order. Kept free of
// server-only imports so tests can load it directly.

export type Lang = 'en' | 'id';
export type SignalCode = 'tampered' | 'lateBreach' | 'openReports' | 'outward' | 'burst' | 'offHours' | 'slowSeal' | 'staleDrafts';
export type Signal = { code: SignalCode; value: number; total?: number; points: number };
export type AgencyFeatures = {
  tampered: number; lateBreach: number; openReports: number; total: number; outward: number;
  burst: number; offHours: number; slowSeals: number; staleDrafts: number;
};
export type Level = 'high' | 'medium' | 'low';
export type Scored = { score: number; level: Level; signals: Signal[] };

/** Points per signal; a signal only counts once it crosses its threshold. High at 40, medium at 15. */
export function scoreAgency(f: AgencyFeatures): Scored {
  const signals: Signal[] = [];
  const add = (code: SignalCode, value: number, points: number, total?: number) => {
    if (points > 0) signals.push(total === undefined ? { code, value, points } : { code, value, total, points });
  };
  add('tampered', f.tampered, f.tampered > 0 ? 40 : 0);
  add('lateBreach', f.lateBreach, Math.min(f.lateBreach * 25, 50));
  add('openReports', f.openReports, Math.min(f.openReports * 10, 30));
  add('outward', f.outward, f.total >= 3 && f.outward / f.total >= 0.5 ? 15 : 0, f.total);
  add('burst', f.burst, f.burst >= 5 ? 15 : 0);
  add('offHours', f.offHours, f.offHours >= 3 && f.total > 0 && f.offHours / f.total >= 0.3 ? 10 : 0, f.total);
  add('slowSeal', f.slowSeals, f.slowSeals > 0 ? 15 : 0);
  add('staleDrafts', f.staleDrafts, f.staleDrafts > 0 ? 5 : 0);
  signals.sort((a, b) => b.points - a.points);
  const score = Math.min(100, signals.reduce((s, g) => s + g.points, 0));
  return { score, level: score >= 40 ? 'high' : score >= 15 ? 'medium' : 'low', signals };
}

const REASON: Record<Lang, Record<SignalCode, (s: Signal) => string>> = {
  en: {
    tampered: (s) => `${s.value} sealed record${s.value === 1 ? ' was' : 's were'} changed or deleted after sealing (found by Watch).`,
    lateBreach: (s) => `${s.value} breach notice${s.value === 1 ? ' was' : 's were'} sealed after the 3×24 h limit.`,
    openReports: (s) => `${s.value} citizen report${s.value === 1 ? ' is' : 's are'} still open.`,
    outward: (s) => `${s.value} of ${s.total} accesses were exports or third-party shares.`,
    burst: (s) => `${s.value} accesses within 10 minutes.`,
    offHours: (s) => `${s.value} of ${s.total} accesses were recorded between 20:00 and 06:00 WIB.`,
    slowSeal: (s) => `${s.value} receipt${s.value === 1 ? ' was' : 's were'} sealed more than 15 minutes after the access was recorded.`,
    staleDrafts: (s) => `${s.value} access${s.value === 1 ? ' was' : 'es were'} prepared but never sealed.`,
  },
  id: {
    tampered: (s) => `${s.value} catatan tersegel diubah atau dihapus setelah disegel (ditemukan Watch).`,
    lateBreach: (s) => `${s.value} pemberitahuan kebocoran disegel melewati batas 3×24 jam.`,
    openReports: (s) => `${s.value} laporan warga masih terbuka.`,
    outward: (s) => `${s.value} dari ${s.total} akses berupa ekspor atau berbagi ke pihak ketiga.`,
    burst: (s) => `${s.value} akses dalam 10 menit.`,
    offHours: (s) => `${s.value} dari ${s.total} akses tercatat antara pukul 20:00 dan 06:00 WIB.`,
    slowSeal: (s) => `${s.value} bukti akses disegel lebih dari 15 menit setelah aksesnya dicatat.`,
    staleDrafts: (s) => `${s.value} akses disiapkan tetapi tidak pernah disegel.`,
  },
};

const NEXT: Record<Lang, Record<SignalCode, string>> = {
  en: {
    tampered: 'Ask the agency to explain each changed record and compare its answer with Watch.',
    lateBreach: 'Request the incident timeline and the reason the notice came late.',
    openReports: 'Review the open citizen reports and sign a decision.',
    outward: 'Ask for the recipients and the legal basis of the exports and shares.',
    burst: 'Ask for the staff access log for that 10-minute window.',
    offHours: 'Ask for the staff access log for those night-time accesses.',
    slowSeal: 'Ask why those receipts were sealed late and whether other accesses were held back.',
    staleDrafts: 'Ask the agency whether the unsealed accesses took place.',
  },
  id: {
    tampered: 'Minta instansi menjelaskan setiap catatan yang berubah dan cocokkan jawabannya dengan Watch.',
    lateBreach: 'Minta kronologi insiden dan alasan pemberitahuannya terlambat.',
    openReports: 'Tinjau laporan warga yang terbuka dan tandatangani keputusannya.',
    outward: 'Minta daftar penerima dan dasar hukum ekspor serta berbagi data itu.',
    burst: 'Minta log akses petugas untuk rentang 10 menit itu.',
    offHours: 'Minta log akses petugas untuk akses pada malam hari itu.',
    slowSeal: 'Tanyakan mengapa bukti itu terlambat disegel dan apakah ada akses lain yang ditahan.',
    staleDrafts: 'Tanyakan kepada instansi apakah akses yang belum disegel itu benar terjadi.',
  },
};

export const LEGAL = /\b(lawful(ly)?|unlawful(ly)?|legal(ly)?|illegal(ly)?|violat\w*|breach(ed|es)? the law|guilty|criminal|crime|sah|ilegal|melanggar|pelanggaran|bersalah|pidana|melawan hukum)\b/i;
// "Legal basis" (a field the regulator asks for) and "pelanggaran data" (Indonesian for a data breach) name things;
// they are not conclusions, so the guard ignores those two phrases.
export const legalConclusion = (text: string) => LEGAL.test(text.replace(/\blegal bas(is|es)\b|\bpelanggaran data\b/gi, ''));

export const signalReason = (lang: Lang, s: Signal) => REASON[lang][s.code](s);

/** The words without the model: the top two signals as the reason, the top signal's step as the next step. */
export function templateAudit(lang: Lang, flagged: (Scored & { name: string })[], checked: number) {
  const items = flagged.map((s, i) => ({
    ref: `A${i + 1}`,
    reason: s.signals.slice(0, 2).map((g) => signalReason(lang, g)).join(' '),
    nextStep: s.signals[0] ? NEXT[lang][s.signals[0].code] : '',
  }));
  const high = flagged.filter((s) => s.level === 'high').length;
  const first = flagged[0]?.name;
  const summary = lang === 'id'
    ? first ? `${high} instansi prioritas tinggi dan ${flagged.length - high} sedang dari ${checked} yang diperiksa. Mulai dari ${first}.` : `Tidak ada pola yang perlu didahulukan dari ${checked} instansi yang diperiksa.`
    : first ? `${high} high and ${flagged.length - high} medium priority out of ${checked} agencies checked. Start with ${first}.` : `No pattern needs attention first across the ${checked} agencies checked.`;
  return { summary, items };
}
