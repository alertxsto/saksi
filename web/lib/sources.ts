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
  {
    id: 'uu-pdp-32',
    claim:
      'UU PDP Article 32 gives every data subject the right to see their data together with its processing record, within 3 × 24 hours of asking. A Saksi receipt delivers that record without the citizen having to ask.',
    figure: 'Access to data "beserta rekam jejak pemrosesan"; within 3 × 24 hours of the request',
    title: 'UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 32',
    url: 'https://pasal.id/peraturan/uu/uu-no-27-tahun-2022/pasal-32',
    publisher: 'Pasal.id (text of UU 27/2022)',
    date: '2022-10-17',
    quote:
      'Pengendali Data Pribadi wajib memberikan akses kepada Subjek Data Pribadi terhadap Data Pribadi yang diproses beserta rekam jejak pemrosesan Data Pribadi ... paling lambat 3 x 24 (tiga kali dua puluh empat) jam terhitung sejak Pengendali Data Pribadi menerima permintaan akses.',
  },
  {
    id: 'pp-33-2026',
    claim:
      'UU PDP’s implementing regulation, PP 33/2026, was signed on 16 July 2026 and takes effect on 16 January 2027.',
    figure: 'Signed 16 Jul 2026; in force 16 Jan 2027',
    title: 'PP Pelindungan Data Pribadi Berlaku Januari 2027, Ini Aturan Baru Data Anak',
    url: 'https://katadata.co.id/finansial/makro/6a9979b7c5745/pp-pelindungan-data-pribadi-berlaku-januari-2027-ini-aturan-baru-data-anak',
    publisher: 'Katadata',
    date: '2026-09-03',
    quote: 'Aturan ini berlaku enam bulan sejak diundangkan atau pada 16 Januari 2027.',
    note: 'Press report; the official PP text was not opened.',
  },
  {
    id: 'pdp-perpres-submitted-2026',
    claim:
      'As of 4 November 2026, the Presidential Regulation creating the PDP agency had only been submitted to the President; Komdigi carries out the agency’s functions until it exists.',
    figure: 'Draft Perpres submitted via the State Secretariat; agency not yet formed (4 Nov 2026)',
    title: 'Komdigi: Perpres Lembaga Pengawas PDP Masuk Tahap Final',
    url: 'https://katadata.co.id/digital/teknologi/6aec368e80c97/komdigi-perpres-lembaga-pengawas-pdp-masuk-tahap-final',
    publisher: 'Katadata, quoting Muchtarul Huda, Komdigi',
    date: '2026-11-05',
    quote: 'Sudah diajukan kepada Presiden melalui Kementerian Sekretariat Negara',
  },
  {
    id: 'dukcapil-7833-2026',
    claim:
      '7,833 institutions had agreements with Dukcapil to use population data as of November 2026, verifying citizens’ identity against the national NIK database.',
    figure: '7,833 institutions (as of 3 Nov 2026)',
    title: 'Kemendagri Perluas Jangkauan IKD, 7.833 Lembaga Sudah Kerja Sama',
    url: 'https://www.jawapos.com/nasional/2611090427/kemendagri-perluas-jangkauan-ikd-7833-lembaga-sudah-kerja-sama',
    publisher: 'JawaPos, citing Kemendagri data',
    date: '2026-11-10',
    quote: 'Sampai November tahun ini, sudah 7.833 lembaga bekerja sama.',
    note: 'The figure is the outlet’s narration of Kemendagri data, not a direct quote from an official.',
  },
  {
    id: 'dukcapil-hits-2025',
    claim:
      'By the end of 2025, institutions had queried Dukcapil’s population data 18.94 billion times; 2,283 active users made 2.57 billion queries in 2025 alone.',
    figure: '7,419 institutions and 18.94 billion hits cumulative; 2,283 active users and 2.57 billion hits in 2025',
    title: 'Kinerja Ditjen Dukcapil Tahun 2025 Lampaui Target',
    url: 'https://rmol.id/politik/read/2026/08/03/716970/kinerja-ditjen-dukcapil-tahun-2025-lampaui-target',
    publisher: 'RMOL, reporting Dirjen Dukcapil Teguh Setyabudi at Rakornas Dukcapil 2026',
    date: '2026-08-03',
    quote:
      'Hingga 31 Desember 2025, tercatat ada 2.283 lembaga pengguna aktif, melampaui target nasional yang dipatok 1.300 lembaga ... Jumlah tersebut terdiri atas 1.218 lembaga pusat dan 1.065 lembaga daerah dengan total akses mencapai 2,57 miliar hits. ... sebanyak 7.419 lembaga telah memanfaatkan layanan data kependudukan dengan total akses menyentuh 18,94 miliar hits.',
    note: 'Secondary outlet; the official Dukcapil release was not found.',
  },
  {
    id: 'dukcapil-knows-who',
    claim:
      'Dukcapil can see which institution looked up which citizen, but citizens have no matching view. The record exists; only the controller can read it.',
    figure: 'Access is password-based and visible to Dukcapil (2019)',
    title: 'Hanya Akses Verifikasi, Ombudsman Anggap Sistem Pemanfaatan Data Kependudukan Aman',
    url: 'https://ombudsman.go.id/pers/r/hanya-akses-verifikasi-ombudsman-anggap-sistem-pemanfaatan-data-kependudukan-aman',
    publisher: 'Ombudsman RI, quoting Dirjen Dukcapil Zudan Arif Fakrulloh',
    date: '2019-07-25',
    quote: 'Yang mengakses itu ada passwordnya kan, kita tahu siapa sedang mengambil data siapa',
    note: 'Dates from 2019. "No citizen view" means we found no public channel, not that one is officially ruled out.',
  },
  {
    id: 'kpu-2023-unanswered',
    claim:
      'When 204 million voter records were alleged to have leaked in 2023, Kominfo had to send the election commission a second letter citing UU PDP’s three-day rule, and still had no answer.',
    figure: 'Second letter sent; no clarification after about a week (5 Dec 2023)',
    title: '204 Juta Data Pemilih Diduga Bocor, Kominfo: KPU Belum Klarifikasi',
    url: 'https://inet.detik.com/security/d-7073750/204-juta-data-pemilih-diduga-bocor-kominfo-kpu-belum-klarifikasi',
    publisher: 'detikInet, quoting Semuel A. Pangerapan, Kominfo',
    date: '2023-12-05',
    quote:
      'Ini yang kami tunggu, kami lagi mengirim surat kedua, KPU wajib membalas ... sesuai aturan dari Undang-Undang PDP harusnya KPU memberi kabar tiga hari.',
    note: 'The leak itself was never confirmed. UU PDP’s transition period ran until October 2024.',
  },
  {
    id: 'dukcapil-337m-denial-2023',
    claim:
      'When 337 million population records were alleged to have leaked in 2023, Dukcapil disputed it by saying the data’s format did not match its database. Outsiders had no way to check.',
    figure: 'Denial based on a data-format mismatch; audit with BSSN still in progress',
    title: 'Dirjen Dukcapil: Format data diduga bocor berbeda dengan database',
    url: 'https://www.antaranews.com/berita/3638547/dirjen-dukcapil-format-data-diduga-bocor-berbeda-dengan-database',
    publisher: 'ANTARA, quoting Dirjen Dukcapil Teguh Setyabudi',
    date: '2023-07-17',
    quote:
      'data yang ada di Breachforums dilihat dari format elemen datanya tidak sama dengan yang terdapat di database kependudukan',
  },
  {
    id: 'pdns-backup-2024',
    claim:
      'After the 2024 PDNS ransomware attack, the head of BSSN told Parliament that only about 2% of the data had been backed up and that the root problem was governance.',
    figure: 'About 2% of PDNS 2 data backed up',
    title: 'Akui Data tak Selamat Usai Diserang Hacker, BSSN Ungkap PDNS tak Punya Back Up',
    url: 'https://news.republika.co.id/berita/sfqm5d409/akui-data-tak-selamat-usai-diserang-hacker-bssn-ungkap-pdns-tak-punya-back-up',
    publisher: 'Republika, quoting BSSN head Hinsa Siburian at DPR Komisi I',
    date: '2024-06-27',
    quote: 'hanya sekitar 2 persen data dari PDNS 2 yang sudah tercadangkan',
  },
  {
    id: 'pp-71-2019-22',
    claim:
      'Every electronic system operator in Indonesia, government agencies included, must already keep an audit trail of all system activity for supervision, dispute resolution and verification (PP 71/2019 Article 22).',
    figure: 'Art. 22(1)–(2); Art. 2(3) puts government "Instansi" in scope',
    title: 'PP No. 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik, Pasal 22',
    url: 'https://peraturan.go.id/files/LN185-PP71.pdf',
    publisher: 'Pemerintah RI (via peraturan.go.id)',
    date: '2019-10-04',
    quote:
      'Penyelenggara Sistem Elektronik wajib menyediakan rekam jejak audit terhadap seluruh kegiatan penyelenggaraan Sistem Elektronik. ... digunakan untuk keperluan pengawasan, penegakan hukum, penyelesaian sengketa, verifikasi, pengujian, dan pemeriksaan lainnya.',
  },
  {
    id: 'pojk-11-2022',
    claim:
      'Banks must already keep an IT audit trail for supervision, dispute resolution and verification, and notify OJK within 24 hours of a significant IT incident (POJK 11/2022 Articles 54 and 60).',
    figure: 'Art. 54(2) audit trail; Art. 60(1) initial notice within 24 hours, full report within 5 working days',
    title: 'POJK Nomor 11/POJK.03/2022 tentang Penyelenggaraan Teknologi Informasi oleh Bank Umum',
    url: 'https://peraturan.go.id/files/pojk11-2022.pdf',
    publisher: 'Otoritas Jasa Keuangan (via peraturan.go.id)',
    date: '2022-07-06',
    quote:
      'Bank wajib memastikan ketersediaan jejak audit atas seluruh kegiatan penyelenggaraan TI untuk keperluan pengawasan, penegakan hukum, penyelesaian sengketa, verifikasi, pengujian, dan pemeriksaan lain.',
  },
  {
    id: 'bssn-4-2021-logs',
    claim:
      'Government (SPBE) web applications must already protect their logs from unauthorised access and modification (Peraturan BSSN 4/2021 Article 27(6)(e)). Saksi makes that protection checkable.',
    figure: 'Art. 27(6)(d) log scope for investigations; (e) protection against unauthorised modification; (g) time sync',
    title: 'Peraturan BSSN Nomor 4 Tahun 2021 tentang Pedoman Manajemen Keamanan Informasi SPBE dan Standar Teknis dan Prosedur Keamanan SPBE',
    url: 'https://peraturan.go.id/files/bn541-2021.pdf',
    publisher: 'Badan Siber dan Sandi Negara (via peraturan.go.id)',
    date: '2021-05-19',
    quote: 'mengatur pelindungan log aplikasi dari akses dan modifikasi yang tidak sah',
  },
  {
    id: 'estonia-tracker-16',
    claim:
      'Even Estonia’s Data Tracker showed citizens queries from only 16 of the country’s hundreds of databases in 2025, and the state holds the logs.',
    figure: '16 databases (Aug 2025); "hundreds" in total',
    title: 'Andmejälgija infot näeb vaid 16 andmekogu kohta',
    url: 'https://www.err.ee/1609768860/andmejalgija-infot-naeb-vaid-16-andmekogu-kohta0',
    publisher: 'ERR (Estonian Public Broadcasting)',
    date: '2025-08-12',
    quote:
      'Praegu näeb enda kohta päritud andmete kohta infot andmejälgijas vaid 16 andmekogust. ... Kokku on neid sadu.',
    note: 'The publication date was decoded from the page timestamp.',
  },
  {
    id: 'georgia-bitcoin-registry',
    claim:
      'Georgia’s public land registry anchors a hash of each land transaction on the Bitcoin public chain while the records stay with the registry: a government precedent for Saksi’s design.',
    figure: 'Transaction hash ("digital receipt") anchored to Bitcoin',
    title: 'Project Capsule: Georgia Land Titling System',
    url: 'https://www.newamerica.org/insights/project-capsule-georgia-land-titling-system/',
    publisher: 'New America',
    date: '2020-12-15',
    quote:
      'uploads an immutable hash, or digital receipt, of a land transaction to the Bitcoin blockchain',
    note: 'Whether the system is still operating in 2026 was not confirmed.',
  },
  {
    id: 'apjii-2026-protection',
    claim:
      'In APJII’s 2026 national survey, 21.4% of Indonesians said they had never done anything to protect their personal data, and only 25.9% applied basic protection.',
    figure: 'n = 8,700, 38 provinces, 1 Feb – 15 Mar 2026, ±1.1%; 21.4% none; 25.9% basic protection',
    title: 'Survei APJII: Kasus Kejahatan Siber di Indonesia Menurun',
    url: 'https://www.metrotvnews.com/read/KRXCQlwa-survei-apjii-kasus-kejahatan-siber-di-indonesia-menurun',
    publisher: 'Metro TV News (data: APJII, Survei Internet Indonesia 2026)',
    date: '2026-05-22',
    quote:
      '21,4 persen responden mengaku sama sekali tidak tahu atau bahkan tidak pernah melakukan upaya apa pun',
    note: 'Press report of the APJII survey; the report itself was not opened.',
  },
  {
    id: 'cfds-ugm-2021',
    claim:
      'In a 2021 CfDS UGM survey of 2,401 people, 78.7% were very worried that companies, the government or third parties would misuse their personal data.',
    figure: 'n = 2,401, 34 provinces, 21 Oct – 1 Nov 2021; 78.7% very worried',
    title: 'Survei CfDS UGM: Masih Sedikit Masyarakat yang Mafhum Data Pribadi',
    url: 'https://ugm.ac.id/id/berita/22036-survei-cfds-ugm-masih-sedikit-masyarakat-yang-mafhum-data-pribadi/',
    publisher: 'Universitas Gadjah Mada (CfDS FISIPOL)',
    date: '2021-12-02',
    quote:
      '78,7% responden sangat khawatir data pribadi mereka disalahgunakan oleh perusahaan, pemerintah, maupun pihak ketiga',
    note: 'The quote is the page’s figure as summarised by the fetch tool, not a single copied sentence. Predates UU PDP; online sample.',
  },
  {
    id: 'uu-pdp-12',
    claim:
      'UU PDP Article 12 gives every data subject the right to sue and receive compensation when their personal data is processed in violation of the law. A sealed record is evidence for that claim.',
    figure: 'Art. 12(1): right to sue and receive compensation; Art. 12(2): details by Government Regulation',
    title: 'UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Pasal 12',
    url: 'https://pasal.id/peraturan/uu/uu-no-27-tahun-2022/pasal-12',
    publisher: 'Pasal.id (text of UU 27/2022)',
    date: '2022-10-17',
    quote:
      'Subjek Data Pribadi berhak menggugat dan menerima ganti rugi atas pelanggaran pemrosesan Data Pribadi tentang dirinya sesuai dengan ketentuan peraturan perundang-undangan.',
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
