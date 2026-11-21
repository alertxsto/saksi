/**
 * Public evidence behind Saksi's problem statement. Each item was opened and read at its URL; `quote` is the
 * passage the figure comes from, in the source's own language (a `note` says when it summarises a chart
 * instead). Citation numbers on the site are the 1-based
 * position in this list (see `sourceNumber`), so append new items at the end to keep existing numbers stable.
 * Only add an item after reading the source yourself: no unverified numbers.
 */
export type Source = {
  id: string
  /** One-sentence claim the site makes from this source. */
  claim: string
  /** The figure(s) the claim rests on, as the source states them. */
  figure: string
  title: string
  url: string
  publisher: string
  /** Publication date, ISO (YYYY-MM-DD or YYYY-MM or YYYY). */
  date: string
  /** The verified passage the figure comes from. */
  quote: string
  /** Caveat a careful reader should know (scope, age, who is quoted). */
  note?: string
}

export const SOURCES = [
  {
    id: 'bssn-dark-web-2024',
    claim:
      'In 2024 alone, BSSN counted more than 56 million Indonesian data records from 461 organisations exposed on the dark web, with government administration making up 58% of the leaked data.',
    figure: '56,128,160 records; 461 stakeholders; 58.34% government administration (2024)',
    title: 'Data Pemerintah Dominasi 58 Persen Kebocoran di Dark Web, Platform Baru Ini Tawarkan Deteksi Dini',
    url: 'https://www.liputan6.com/tekno/read/6180865',
    publisher: 'Liputan6.com, citing BSSN, Lanskap Keamanan Siber Indonesia 2024',
    date: '2025-10-10',
    quote:
      'mencatat 56.128.160 data dari 461 pemangku kepentingan di Indonesia terekspos ke dark web ... Mayoritas data yang bocor didominasi sektor administrasi pemerintahan (58,34%)',
    note: 'Media report quoting the BSSN annual report; the BSSN PDF itself was not opened.',
  },
  {
    id: 'pdns-ransomware-2024',
    claim:
      'The June 2024 Brain Cipher ransomware attack on the National Data Centre (PDNS 2) hit 282 government tenants at once: one operator holding everyone’s records is a single point of failure.',
    figure: '282 tenants affected',
    title: 'PDNS 2 Diserang Hacker, 3 Layanan Pulih dari Total 282 Korban',
    url: 'https://www.cnnindonesia.com/teknologi/20240626015537-192-1114144/pdns-2-diserang-hacker-3-layanan-pulih-dari-total-282-korban',
    publisher: 'CNN Indonesia, quoting Herlan Wijanarko, Telkom Indonesia',
    date: '2024-06-26',
    quote:
      'Setelah terjadi gangguan di PDNS 2 Surabaya akibat serangan Ransomware Brain Cipher, terdapat 282 tenant yang terdampak.',
  },
  {
    id: 'surfshark-asean-2026',
    claim:
      'Indonesia had more leaked accounts than any other Southeast Asian country in the first half of 2026: 1.22 million.',
    figure: '1.22 million accounts in H1 2026 (Q1 915,746; Q2 300,416); first of 11 Southeast Asian countries',
    title: 'Kebocoran Data Indonesia Terbanyak di Asia Tenggara Semester I 2026',
    url: 'https://databoks.katadata.co.id/teknologi-telekomunikasi/statistik/6a700d3dea214/kebocoran-data-indonesia-terbanyak-di-asia-tenggara-semester-i-2026',
    publisher: 'Databoks / Katadata (data: Surfshark)',
    date: '2026-08-03',
    quote:
      'Indonesia: 1,22 juta akun (Q1 915.746; Q2 300.416), first among 11 Southeast Asian countries; Philippines second with 841.122',
    note: 'The quote summarises the chart rather than copying a sentence. Surfshark notes that 25.8% of leaked accounts carry no country, so national counts may be low.',
  },
  {
    id: 'djp-npwp-2024',
    claim:
      'When NPWP taxpayer data was alleged to have leaked in 2024, the tax authority denied it by citing six years of its own access logs: evidence no outsider could check.',
    figure: 'Denial based on six years of internal access logs',
    title: 'Ditjen Pajak Tegaskan Tidak Ada Indikasi Kebocoran NPWP!',
    url: 'https://www.cnbcindonesia.com/news/20240920152441-4-573379/ditjen-pajak-tegaskan-tidak-ada-indikasi-kebocoran-npwp',
    publisher: 'CNBC Indonesia, quoting DJP spokesperson Dwi Astuti',
    date: '2024-09-20',
    quote:
      'data log access dalam enam tahun terakhir menunjukkan tidak adanya indikasi yang mengarah kepada kebocoran data langsung',
    note: 'The size of the alleged leak is the attacker’s claim and is not repeated here.',
  },
  {
    id: 'komdigi-monitoring-2025',
    claim:
      'Komdigi’s own monitoring found likely personal-data violations on 41% of the websites and 34% of the apps it sampled, and logged 342 complaints and 56 suspected UU PDP violation cases in about a year.',
    figure:
      '342 complaints; 483 consultations; 56 suspected violation cases; 115 of 280 websites (41%) and 24 of 70 apps (34%) with potential violations (Oct 2024 to Nov 2025)',
    title: 'Komdigi Terima Ratusan Aduan soal Perlindungan Data Pribadi',
    url: 'https://inet.detik.com/law-and-policy/d-8281251/komdigi-terima-ratusan-aduan-soal-perlindungan-data-pribadi',
    publisher: 'detikInet, written statement by Alexander Sabar, Komdigi',
    date: '2025-12-28',
    quote: 'Pengelolaan data pribadi pada layanan berbasis website masih menjadi titik rawan',
  },
  {
    id: 'ojk-complaints-2025',
    claim:
      'OJK received 56,620 consumer complaints in 2025, led by fintech (21,886) and banking (20,972): the sectors that most need dispute evidence both sides can trust.',
    figure: '56,620 complaints (1 Jan to 28 Dec 2025); fintech 21,886; banking 20,972',
    title: 'OJK Terima 56.620 Pengaduan Konsumen Sepanjang 2025, Pinjol Ilegal Dominan',
    url: 'https://keuangan.kontan.co.id/news/ojk-terima-56620-pengaduan-konsumen-sepanjang-2025-pinjol-ilegal-dominan',
    publisher: 'Kontan',
    date: '2026-01-09',
    quote:
      '56.620 pengaduan, sejak 1 Januari 2025 hingga 28 Desember 2025 ... 21.886 berasal dari industri financial technology ... sebanyak 20.972 berasal dari industri perbankan',
  },
  {
    id: 'uu-pdp-31',
    claim:
      'UU PDP Article 31 already requires every data controller to record all personal-data processing. Saksi makes that record something outsiders can verify.',
    figure: 'Art. 31: mandatory recording of all processing activities',
    title: 'UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 31',
    url: 'https://pasal.id/peraturan/uu/uu-no-27-tahun-2022/pasal-31',
    publisher: 'Pasal.id (text of UU 27/2022)',
    date: '2022-10-17',
    quote: 'Pengendali Data Pribadi wajib melakukan perekaman terhadap seluruh kegiatan pemrosesan Data Pribadi.',
  },
  {
    id: 'uu-pdp-46',
    claim:
      'UU PDP Article 46 requires a written breach notice to both the data subjects and the authority within 3 × 24 hours, stating which data was exposed, when and how, and what remediation is underway.',
    figure: '3 × 24 hours; notify the data subject and the authority; three mandatory contents',
    title: 'UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 46',
    url: 'https://pasal.id/peraturan/uu/uu-no-27-tahun-2022/pasal-46',
    publisher: 'Pasal.id (text of UU 27/2022)',
    date: '2022-10-17',
    quote: 'paling lambat 3 x 24 (tiga kali dua puluh empat) jam kepada: a. Subjek Data Pribadi; dan b. lembaga.',
  },
  {
    id: 'uu-pdp-20',
    claim:
      'UU PDP Article 20(2) lists exactly six lawful bases for processing (consent, contract, legal obligation, vital interest, public task, legitimate interest), and every Saksi receipt records which one the controller claims.',
    figure: 'Six legal bases, letters a to f',
    title: 'UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 20',
    url: 'https://pasal.id/peraturan/uu/uu-no-27-tahun-2022/pasal-20',
    publisher: 'Pasal.id (text of UU 27/2022)',
    date: '2022-10-17',
    quote:
      'a. persetujuan yang sah secara eksplisit dari Subjek Data Pribadi ... f. pemenuhan kepentingan yang sah lainnya',
  },
  {
    id: 'uu-pdp-57',
    claim:
      'Breaching UU PDP obligations can lead to an administrative fine of up to 2% of annual revenue, plus written warnings, suspension of processing, or deletion of data.',
    figure: 'Up to 2% of annual revenue or receipts',
    title: 'UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 57',
    url: 'https://pasal.id/peraturan/uu/uu-no-27-tahun-2022/pasal-57',
    publisher: 'Pasal.id (text of UU 27/2022)',
    date: '2022-10-17',
    quote: 'paling tinggi 2 (dua) persen dari pendapatan tahunan atau penerimaan tahunan terhadap variabel pelanggaran',
  },
  {
    id: 'pojk-40-2024',
    claim:
      'OJK’s P2P-lending rule (POJK 40/2024) requires non-repudiation when personal data is accessed, a complete audit trail usable for supervision and dispute resolution, and written notice to data owners after a breach.',
    figure:
      'Art. 161(1)(b) non-repudiation; Art. 161(1)(d) written breach notice; Art. 162(1),(3) audit trail for supervision, enforcement, dispute resolution and verification',
    title: 'Peraturan OJK Nomor 40 Tahun 2024 tentang Layanan Pendanaan Bersama Berbasis Teknologi Informasi',
    url: 'https://peraturan.go.id/files/peraturan-ojk-no-40-tahun-2024.pdf',
    publisher: 'Otoritas Jasa Keuangan (via peraturan.go.id)',
    date: '2024-12-24',
    quote:
      'memastikan tersedianya proses autentikasi, verifikasi, dan validasi yang mendukung kenirsangkalan dalam mengakses, memproses, dan mengeksekusi Data Pribadi; Pasal 162(1): Penyelenggara wajib menyediakan rekam jejak audit terhadap seluruh kegiatannya di dalam Sistem Elektronik.',
    note: 'Read from the official PDF. The administrative fine in that chapter is capped at Rp50 million.',
  },
  {
    id: 'pojk-22-2023',
    claim:
      'POJK 22/2023 bars financial institutions from giving consumer data to other parties without a UU PDP legal basis, requires them to give consumers a copy of their data, and fines violations up to Rp15 billion each.',
    figure: 'Up to Rp15,000,000,000 per violation (Art. 19(8), Art. 22(5))',
    title: 'POJK 22 Tahun 2023 tentang Pelindungan Konsumen dan Masyarakat di Sektor Jasa Keuangan',
    url: 'https://www.ojk.go.id/id/regulasi/Documents/Pages/Pelindungan-Konsumen-dan-Masyarakat-di-Sektor-Jasa-Keuangan/POJK%2022%20Tahun%202023%20Pelindungan%20Konsumen%20dan%20Masyarakat%20di%20Sektor%20Jasa%20Keuangan.pdf',
    publisher: 'Otoritas Jasa Keuangan',
    date: '2023-12',
    quote:
      'Pasal 22(1): PUJK dilarang: a. memberikan data dan/atau informasi mengenai Konsumen kepada pihak lain; Pasal 19(8): paling banyak Rp15.000.000.000,00 (lima belas miliar rupiah).',
    note: 'Art. 23(1) exempts institutions that have a lawful processing basis.',
  },
  {
    id: 'pdp-agency-2026',
    claim:
      'Indonesia’s UU PDP enforcement agency still did not exist in November 2026: the draft Presidential Regulation went to the President on 20 May 2026 and was still pending.',
    figure: 'Draft Perpres submitted 20 May 2026; agency not yet formed as of 5 Nov 2026',
    title: 'Kasus Penyadapan dan Urgensi Pembentukan Badan Pelindungan Data Pribadi',
    url: 'https://nasional.kompas.com/read/2026/11/05/17254301/kasus-penyadapan-dan-urgensi-pembentukan-badan-pelindungan-data-pribadi',
    publisher: 'Kompas.com',
    date: '2026-11-05',
    quote: 'Pemerintah jangan menunda-nunda pembentukan Badan Pelindungan Data Pribadi.',
    note: 'The article reports the 20 May 2026 submission and implies, without one explicit sentence, that the agency is not yet formed.',
  },
  {
    id: 'estonia-data-tracker',
    claim:
      'Estonia has let citizens see who looked at their data in government registers, and why, since 2017 (the Data Tracker on eesti.ee).',
    figure: 'Since 2017; government registers only',
    title: 'Data Tracker – tool that builds trust in institutions',
    url: 'https://e-estonia.com/data-tracker-build-citizen-trust/',
    publisher: 'e-Estonia',
    date: '2019-09-18',
    quote:
      'Since 2017, the tool gives citizens the possibility ... always keep an eye on who is accessing their data, and for what reasons.',
    note: 'Limited to government registers, and the logs are held by the state.',
  },
  {
    id: 'kominfo-survey-2021',
    claim:
      'In a Kominfo national survey of 11,305 people, 28.7% (3,246) said their personal data had already leaked, and respondents rated Indonesia’s data protection 6.05 out of 10.',
    figure: '11,305 respondents in 34 provinces, 14–21 July 2021; 3,246 reported leaks (28.7%); protection score 6.05/10',
    title: 'Persepsi Masyarakat atas Pelindungan Data Pribadi – Survei Nasional Tahun 2021',
    url: 'https://cdn1.katadata.co.id/template/frontend_template_v3/images/microsites/pdp/Kominfo_Persepsi%20Masyarakat%20terhadap%20Pelindungan%20Data%20Pribadi%20(1).pdf',
    publisher: 'Kementerian Kominfo & Katadata Insight Center',
    date: '2021',
    quote:
      'Responden yang melaporkan pernah mengalami kebocoran data pribadi berasal dari 34 provinsi di Indonesia, total berjumlah 3.246 orang ... skor rata-rata 6,05 dari skala 10.',
    note: '28.7% is computed as 3,246 / 11,305. The survey predates UU PDP (2022).',
  },
] as const satisfies readonly Source[]

export type SourceId = (typeof SOURCES)[number]['id']

const INDEX = new Map<string, number>(SOURCES.map((s, i) => [s.id, i]))

/** 1-based citation number of a source; throws on an unknown id so a broken citation fails loudly. */
export function sourceNumber(id: SourceId): number {
  const i = INDEX.get(id)
  if (i === undefined) throw new Error(`unknown source: ${id}`)
  return i + 1
}

export function getSource(id: SourceId): Source {
  return SOURCES[sourceNumber(id) - 1]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2025-10-10" → "10 Oct 2025", "2023-12" → "Dec 2023", "2021" → "2021". */
export function formatSourceDate(date: string): string {
  const [y, m, d] = date.split('-')
  if (!m) return y
  const mon = MONTHS[Number(m) - 1] ?? m
  return d ? `${Number(d)} ${mon} ${y}` : `${mon} ${y}`
}

/** Anchor on the /why page for a source. */
export const sourceAnchor = (id: SourceId) => `source-${sourceNumber(id)}`
export const sourceHref = (id: SourceId) => `/why#${sourceAnchor(id)}`
