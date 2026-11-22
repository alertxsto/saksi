<div align="center">

<img src="web/public/brand/saksi-lockup@2x.png" alt="Saksi" height="48" />

### Bukti akses anti-ubah untuk setiap kali data pribadi warga dibuka

Instansi mencatat setiap akses, sidik jarinya disegel di Ethereum, dan ponsel warga memeriksanya sendiri ke chain.
Kalau catatan di database diubah atau dihapus diam-diam, warga dan regulator langsung tahu.

**[saksiku.web.id](https://saksiku.web.id)** · [Kontrak di Sepolia](#kontrak-di-sepolia) · [Arsitektur](#arsitektur) · [Jalankan lokal](#jalankan-lokal)

![Next.js 16](https://img.shields.io/badge/Next.js-16-111?logo=nextdotjs)
![Solidity](https://img.shields.io/badge/Solidity-Foundry-363636?logo=solidity)
![Ethereum Sepolia](https://img.shields.io/badge/Ethereum-Sepolia-627EEA?logo=ethereum&logoColor=white)
![Postgres 17](https://img.shields.io/badge/Postgres-17-336791?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-27%20forge%20%2B%20214%20vitest-157F3D)

</div>

> HACKSPHERE 2026 (COMPSPHERE 12), tema Web3 Innovation. Semua data di situs adalah data sintetis, nama instansi bertanda "(fiktif)", dan jaringannya testnet Sepolia.

| Warga | Bukti akses | Instansi | Regulator |
| --- | --- | --- | --- |
| <img src=".github/assets/warga.png" alt="Aplikasi warga" width="180" /> | <img src=".github/assets/bukti-akses.png" alt="Bukti akses" width="180" /> | <img src=".github/assets/instansi.png" alt="Ruang kerja instansi" width="320" /> | <img src=".github/assets/regulator.png" alt="Ruang kerja regulator" width="320" /> |

## Masalah

[UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022) (UU PDP) mewajibkan pengendali data untuk:

- punya dasar pemrosesan yang sah (Pasal 20 ayat 2 huruf a sampai f),
- merekam **seluruh** kegiatan pemrosesan data pribadi (Pasal 31),
- memberi tahu subjek data dan lembaga **paling lambat 3 x 24 jam** setelah kegagalan pelindungan data (Pasal 46).

Rekaman Pasal 31 itu disimpan di database milik pengendali sendiri. Barisnya bisa diubah atau dihapus diam-diam, dan warga tidak punya cara membuktikan apa pun.

## Solusi

Saksi menjadi saksi independen di antara instansi, warga, dan regulator.

- **Warga** menerima bukti akses di ponsel setiap kali datanya dibuka: siapa, untuk apa, dasar hukumnya apa. Ponsel memverifikasi sendiri ke chain lewat RPC publik, dan server Saksi tidak ikut memutuskan cocok atau tidak.
- **Instansi** menyegel setiap akses dengan tanda tangan digitalnya (MetaMask). Pemberitahuan kebocoran disusun AI, lalu kontrak yang memutuskan tepat waktu atau terlambat.
- **Regulator** melihat semua instansi terdaftar. Watch membandingkan setiap baris database dengan event di chain, dan laporan warga diperiksa ulang ke ledger sebelum ditinjau.

### Fitur utama

| | |
| --- | --- |
| **Penyegelan on-chain** | Tiga kontrak (`ControllerRegistry`, `AccessJournal`, `BreachReport`). Hanya wallet instansi terdaftar yang bisa menyegel. |
| **Verifikasi di browser** | `lib/shared/verify.ts` menghitung ulang hash dan membaca event langsung dari node publik pilihan pengguna. |
| **Watch** | Rekonsiliasi chain dengan database: `MATCH`, `ALTERED` (field mana yang berubah, termasuk status yang diubah jadi gagal), `DELETED`, `NOT_ANCHORED` (termasuk baris "anchored" tanpa log di jurnal). |
| **Jendela 72 jam ditegakkan kontrak** | `anchor` me-revert setelah 72 jam, dan satu-satunya jalan adalah `anchorLate` yang mencatat lamanya keterlambatan. |
| **AI drafter Pasal 46** | Cerita bebas dari instansi diubah menjadi empat bagian wajib (a) sampai (d). Keputusan tepat waktu tetap dari kontrak. Evaluasi pada 10 kasus sintetis (`web/scripts/ai-eval.ts`, 22 Nov 2026): **100% JSON valid, 100% lolos skema, recall kata kunci 97,5%, waktu deteksi 100% tepat, p50 5,4 detik**. Hasil lengkap: [`web/scripts/ai-eval-results.json`](web/scripts/ai-eval-results.json). |
| **AI "Jelaskan"** | Penjelasan bukti akses dalam bahasa awam (mengikuti bahasa layar), dengan guard yang menolak jawaban yang membantah verdict. |
| **AI prioritas audit (regulator)** | Kode memberi skor setiap instansi dari yang disaksikan Saksi: catatan diubah/dihapus (Watch), pemberitahuan terlambat, laporan warga terbuka, rasio ekspor/berbagi, lonjakan 10 menit, akses malam, segel terlambat, draf yang tak pernah disegel. AI hanya menulis alasan dan satu langkah audit, dicek guard (tanpa kesimpulan hukum, hanya angka dari input). AI tidak pernah melihat data warga. |
| **Laporan warga** | Warga melaporkan akses yang mencurigakan. Server memeriksa ulang bukti itu ke ledger, lalu regulator meninjau dengan tanda tangan wallet. |
| **Privasi** | Tidak ada nama, NIK, atau teks bebas di chain. Identitas warga menjadi pseudonim yang berbeda untuk tiap instansi. |
| **Dwibahasa** | Antarmuka Inggris dan Indonesia, bisa diganti kapan saja tanpa memuat ulang halaman. |

## Coba sendiri

**Tanpa wallet (sekitar 1 menit).** Buka di tab baru.

1. [Bukti akses asli][proof-asli]. Browser mengambil event dari RPC publik Sepolia, menghitung ulang hash, lalu menampilkan **Cocok**. Node RPC bisa diganti dari halaman itu.
2. [Bukti yang sama dengan jenis akses diubah][proof-diubah] dari *Share with third party* menjadi *Read*. Hasilnya **Diubah**, lengkap dengan field yang berbeda.
3. Atau tempel sidik jari atau transaksi apa pun di [/proof](https://saksiku.web.id/proof).

**Alur lengkap.** Mulai dari [/enter](https://saksiku.web.id/enter) dan pilih peran.

1. **Warga:** buka aplikasi warga. Profil sintetis dibuat otomatis lengkap dengan kode 6 karakter dan QR.
2. **Instansi:** [/controller](https://saksiku.web.id/controller). Pilih skenario, masukkan kode warga, lalu tanda tangani dan segel lewat MetaMask di Sepolia. Hanya wallet terdaftar yang bisa menyegel, jadi langkah ini diperagakan tim saat demo.
3. **Warga:** bukti akses muncul dalam hitungan detik dan langsung diperiksa ponsel ke chain.
4. **Regulator:** [/regulator](https://saksiku.web.id/regulator) untuk ringkasan, laporan warga, register instansi, [Watch](https://saksiku.web.id/regulator/watch), dan pemberitahuan kebocoran.
5. **Kebocoran:** [/controller/breach](https://saksiku.web.id/controller/breach). AI menyusun draf Pasal 46, kontrak memeriksa tenggat, lalu pemberitahuan disegel.

Saat demo, tim mengubah satu baris database lewat konsol presenter (`/operator`, dilindungi token). Bukti akses di ponsel warga dan Watch langsung menandainya merah.

## Arsitektur

```mermaid
flowchart LR
  subgraph B["Browser"]
    CIT["Warga<br/>/citizen, /proof"]
    CTL["Instansi<br/>/controller + MetaMask"]
    REGU["Regulator<br/>/regulator"]
    VER["Verifier<br/>lib/shared/verify.ts"]
  end
  subgraph S["Server (Next.js 16, Docker)"]
    API["API tunggal<br/>app/api/[...path]"]
    AIG["Guard AI<br/>explain-guard.ts"]
  end
  DB[("Postgres 17<br/>AES-256-GCM")]
  LLM["LLM kompatibel OpenAI"]
  subgraph E["Ethereum Sepolia"]
    RG["ControllerRegistry"]
    AJ["AccessJournal"]
    BR["BreachReport"]
  end
  CTL -- "prepare / submit / confirm" --> API
  CTL -- "logAccess (ditandatangani di MetaMask)" --> AJ
  CTL -- "anchor / anchorLate" --> BR
  API --> DB
  API -- "baca receipt dan log" --> E
  CIT -- "ambil opening bukti akses" --> API
  CIT --> VER
  VER -- "eth_getLogs lewat RPC publik" --> AJ
  REGU -- "watch, laporan, register" --> API
  API --> AIG --> LLM
  AJ -. "isAuthorized" .-> RG
  BR -. "isAuthorized" .-> RG
```

- **Penandatanganan:** server tidak memegang kunci wallet. Server menyiapkan argumen (`prepare`), instansi menandatangani di MetaMask, lalu server mencocokkan receipt dan event (`submit`, `confirm`).
- **Verifikasi:** `verifyReceipt` berjalan di browser dengan fungsi hash yang sama (`lib/shared/commit.ts`) dan membaca chain langsung.
- **Watch:** server memindai event `AccessLogged` sejak blok deployment lalu membandingkannya dengan baris database.

### Apa yang masuk chain

| Data | On-chain (event `AccessLogged`) | Off-chain (Postgres) |
| --- | --- | --- |
| Identitas instansi | `controllerId = keccak256("ctrl:<slug>")` | nama, slug, EOA |
| Identitas warga | `subjectPseudonym = HMAC-SHA256(SUBJECT_KEY, controllerId ‖ subjectId ‖ salt)`, berbeda per instansi | kode profil, salt terenkripsi |
| Tujuan akses | `purposeHash = keccak256(teks ‖ salt acak 32 byte)` | teks dan salt, terenkripsi AES-256-GCM |
| Dasar hukum | `legalBasisKey`, misalnya `"PDP-20-2-b"` | sama |
| Jenis akses | `eventType` 0 sampai 3 (Read, Update, Export, Share) | sama |
| Bukti | `evidenceHash = keccak256(JCS(evidence))` (RFC 8785, dengan nonce acak) | JSON bukti, terenkripsi |
| Waktu | `timestamp` blok | waktu dibuat |

Opening bukti akses (nilai mentah untuk menghitung ulang hash) ditaruh setelah `#` di link bukti, jadi browser tidak pernah mengirimnya ke server mana pun.

## Kontrak di Sepolia

Sumber: [`contracts/deployments/sepolia.json`](contracts/deployments/sepolia.json). Chain ID 11155111, blok deployment [12181663](https://sepolia.etherscan.io/block/12181663). Source ketiga kontrak terverifikasi di Etherscan dan di Sourcify (status *exact match*): bytecode on-chain sama persis dengan hasil kompilasi `contracts/src` (solc 0.8.24).

| Kontrak | Alamat | Source terverifikasi |
| --- | --- | --- |
| ControllerRegistry | [`0x3d9dE4717a7398d24239b8370b23DCAd7a07f737`](https://sepolia.etherscan.io/address/0x3d9dE4717a7398d24239b8370b23DCAd7a07f737) | [Sourcify · exact match](https://repo.sourcify.dev/11155111/0x3d9dE4717a7398d24239b8370b23DCAd7a07f737) |
| AccessJournal | [`0xAb9b73586610697deb7Ae59A59e991f5177CB263`](https://sepolia.etherscan.io/address/0xAb9b73586610697deb7Ae59A59e991f5177CB263) | [Sourcify · exact match](https://repo.sourcify.dev/11155111/0xAb9b73586610697deb7Ae59A59e991f5177CB263) |
| BreachReport | [`0x71Ff16F068A845F3D3dfd63584a31A9de86fE462`](https://sepolia.etherscan.io/address/0x71Ff16F068A845F3D3dfd63584a31A9de86fE462) | [Sourcify · exact match](https://repo.sourcify.dev/11155111/0x71Ff16F068A845F3D3dfd63584a31A9de86fE462) |

Instansi terdaftar (semuanya fiktif, wallet dipegang tim):

| Instansi | Wallet penanda tangan |
| --- | --- |
| Disdukcapil Kota Contoh, Bank Kredit Contoh | [`0xe4788AcC…74E0`](https://sepolia.etherscan.io/address/0xe4788AcC311c6135A848f82823456F06f2bb74E0) |
| RSUD Contoh, Fintech Contoh | [`0x5678B387…8C9D`](https://sepolia.etherscan.io/address/0x5678B387056c7571813f8acF934dD145D9f98C9D) (juga admin registry) |
| Asuransi Contoh | [`0xc524444F…e8FE`](https://sepolia.etherscan.io/address/0xc524444F4c376BE75f18810EE7cFCEE67618e8FE) |

## Model kepercayaan

- **Verdict dihitung di browser.** Server hanya mengirim opening, browser membandingkan field demi field terhadap event dari RPC yang dipilih pengguna.
- **AI tidak pernah memutuskan.** Untuk `POST /api/ai/explain`, server menjalankan verifier sendiri dan tidak menerima verdict dari browser. Teks tujuan tulisan instansi tidak dikirim ke model untuk menutup jalur prompt injection. Jawaban yang membantah verdict ditolak lalu diganti template (`lib/server/explain-guard.ts`). Model, latensi, dan tingkat fallback dicatat dan ditampilkan.
- **Draf Pasal 46 dibuat AI, keputusannya tidak.** Status tepat waktu atau terlambat berasal dari event kontrak.
- **Arti Cocok:** isi bukti akses sama dengan yang disegel. Itu bukan bukti bahwa aksesnya sah atau tercatat lengkap. Instansi yang tidak mencatat sama sekali tidak terdeteksi oleh hash, dan regulator menangkapnya dari laporan warga atau audit.
- **Admin registry** adalah satu EOA. Pendaftaran dan pencabutan instansi selalu memancarkan event publik.

## Pengujian

| Lapisan | Hasil |
| --- | --- |
| Kontrak, `forge test` | **27 lulus**: 22 unit, 4 fuzz (256 run masing-masing), 1 suite invariant stateful (64 run x 200 call) |
| Invariant | satu laporan di-anchor paling banyak sekali; laporan berstatus tepat waktu jika dan hanya jika di-anchor dalam 72 jam sejak `detectedAt`. Uji mutasi memastikan invariant bisa gagal. |
| Slither 0.11.6 | 0 high, 0 medium, 3 low (`timestamp` pada jendela 72 jam, false positive by design) |
| Web, `pnpm test` (Vitest) | **214 lulus di 28 file**: hash commitment dengan vektor independen, verifier terhadap RPC simulasi, kripto, hardening API, guard AI, alur wallet, Watch, laporan warga, dan tidak ada data mock di jalur produksi |
| `pnpm typecheck`, `pnpm build` | lulus |

Detail dan cara reproduksi ada di [`contracts/SECURITY.md`](contracts/SECURITY.md). Ini review mandiri tim untuk hackathon, bukan audit profesional.

## Biaya per catatan

Diukur dari transaksi `logAccess` asli [`0x4d62e4d2…0fc7`](https://sepolia.etherscan.io/tx/0x4d62e4d2a770718e7ac82cf805283414834eff12503c3b49069c0147927e0fc7): **29.163 gas**. Harga per 21 Nov 2026, 19:51 WIB: 1 ETH = Rp30.384.224, gas mainnet 0,31 gwei, faktor L2 0,0194 (Base).

| Skenario | Per catatan | Per 1.000 catatan |
| --- | --- | --- |
| Proyeksi Ethereum mainnet | **Rp274,69** | Rp274.689 |
| Proyeksi L2 | **Rp5,33** | Rp5.329 |

Pemberitahuan kebocoran memakan sekitar 56.200 gas dan hanya terjadi sekali per insiden. Hitung ulang dengan harga terbaru:

```sh
node scripts/gas-cost.mjs --rpc https://ethereum-sepolia-rpc.publicnode.com \
  --tx 0x4d62e4d2a770718e7ac82cf805283414834eff12503c3b49069c0147927e0fc7 \
  --eth-idr 30384224 --mainnet-gwei 0.31 --l2-factor 0.0194
```

## Struktur repo

```text
.
├── contracts/                 Solidity + Foundry
│   ├── src/                   ControllerRegistry, AccessJournal, BreachReport
│   ├── test/                  unit, fuzz, invariant
│   ├── script/                skrip deploy
│   ├── deployments/           alamat kontrak Sepolia
│   └── SECURITY.md            review keamanan
├── web/                       aplikasi Next.js 16 (UI + API)
│   ├── app/                   halaman: /, /enter, /citizen, /controller, /regulator, /proof, /integrate, /why
│   │   └── api/[...path]/     satu router API untuk semua endpoint
│   ├── components/            UI per peran (citizen, controller, regulator, proof, landing, ui)
│   ├── lib/
│   │   ├── shared/            hash commitment + verifier, dipakai server dan browser
│   │   ├── server/            akses DB, chain, kripto, AI, Watch, laporan
│   │   ├── client/            hook transaksi wallet, bahasa
│   │   └── i18n/              kamus Indonesia
│   ├── db/  drizzle/          skema dan migrasi Postgres
│   └── test/                  tes Vitest
├── deploy/                    Docker Compose, Caddy, skrip deploy dan migrasi produksi
└── scripts/                   hitung biaya gas, SQL simulasi tamper/restore
```

## Jalankan lokal

Butuh Node.js 24 (`web/.node-version`), pnpm 10, Docker untuk Postgres, dan Foundry untuk kontrak.

```sh
# 1. Postgres
docker run -d --name saksi-pg -p 5432:5432 \
  -e POSTGRES_USER=saksi -e POSTGRES_PASSWORD=saksi -e POSTGRES_DB=saksi postgres:17-alpine

# 2. Env (alamat kontrak Sepolia sudah terisi di contoh)
cd web
cp .env.example .env.local
# DATABASE_URL=postgres://saksi:saksi@localhost:5432/saksi
# SUBJECT_KEY, DATA_KEY, SESSION_SECRET: masing-masing `openssl rand -hex 32`
# AI_* opsional; tanpa AI aplikasi memakai template

# 3. Skema dan server dev
pnpm install --frozen-lockfile
pnpm db:push
pnpm dev                       # http://localhost:3000
```

Pemeriksaan:

```sh
(cd contracts && forge test)                          # 27 tes
(cd web && pnpm typecheck && pnpm test && pnpm build)  # 214 tes
```

Simulasi tamper di database lokal untuk satu catatan yang sudah disegel (dari root repo):

```sh
psql "$DATABASE_URL" -v event_id="$DEMO_EVENT_ID" -f scripts/tamper.sql
psql "$DATABASE_URL" -v event_id="$DEMO_EVENT_ID" -f scripts/restore.sql
```

Untuk mencoba alur instansi dengan wallet sendiri, deploy kontrak sendiri dari `contracts/` (`forge script script/Deploy.s.sol:Deploy --rpc-url "$SEPOLIA_RPC_URL" --account <keystore>`, lalu tambahkan `--broadcast --verify`). Pakai keystore Foundry, jangan private key di command line. Salin alamat dan blok deployment ke `.env.local`. Jika ABI berubah, jalankan `node web/generate-abi.mjs`.

## Deploy

Situs live berjalan di Docker (Next.js standalone + Postgres 17) di belakang Caddy. Panduan, env produksi, preflight, dan rollback ada di [`deploy/README.md`](deploy/README.md).

## Batasan

- **Testnet.** Semua transaksi ada di Sepolia. Biaya mainnet dan L2 adalah proyeksi.
- **Data sintetis.** Profil warga, instansi, dan bukti akses tidak memakai data pribadi asli.
- **Kelengkapan tidak bisa dibuktikan hash.** Saksi mendeteksi catatan yang diubah atau dihapus setelah disegel, bukan akses yang tidak pernah dicatat.
- **`detectedAt` dideklarasikan instansi.** Kontrak menegakkan jendela 72 jam terhadap waktu deteksi yang diklaim.
- **Admin registry satu EOA.** Produksi butuh multisig dan proses onboarding instansi.
- **AI pihak ketiga.** Jika model tidak tersedia, aplikasi memakai cache lalu template, dan itu ditandai di UI.

## Tim

| Nama | Peran |
| --- | --- |
| Dwiky | Smart contract (Solidity, Foundry, keamanan) |
| Indri | Backend (API, database, kripto, integrasi AI) |
| Muqorrobin | Front-end, UI/UX, dan pitch |

[proof-asli]: https://saksiku.web.id/proof/0xc3073600aa644b1825b4fc5431911e75bd914b807585d5ad113114e08a259a11/130#eyJldmVudElkIjoiMDRiYmJhMTQtMzYxOS00NmYwLWIwZDEtNjFlNDE5NmY2MDEzIiwiY29udHJvbGxlcklkIjoiMHg5ZGE3ZDY3N2I4NmNhZDQwMDZlNGI5YjFlOGRjZDE3ODA4ODlmODJjOTBhNzliNDc3NjhmZDMyM2Y0NjRiYzliIiwiY29udHJvbGxlck5hbWUiOiJEZW1vIFNwYXJlIiwic3ViamVjdFBzZXVkb255bSI6IjB4ODIwZTNmY2QyZGY4NjlhYjQ5OGE3OWFlNzYxNDk5NjBhOTQ0Zjc4MDlmZDUzNzAwYmJlZmRhOGY3NDEzODQwMyIsInB1cnBvc2VUZXh0IjoiU2hhcmUgY29udGFjdCBkZXRhaWxzIHdpdGggYSBkZWJ0IGNvbGxlY3Rpb24gcGFydG5lciAoc3ludGhldGljIGRlbW8gZm9yIGp1ZGdlcykiLCJwdXJwb3NlU2FsdCI6IjB4ZDNmOTg5NTE5YmYyMDc2NDI3N2IxMGYxYmNkODM5NzZjMGY1MDgzNmU5NmRmMWNmMGYxM2Q4NTZkZjNmYjYwOSIsImxlZ2FsQmFzaXNLZXkiOiIweDUwNDQ1MDJkMzIzMDJkMzIyZDYyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJldmVudFR5cGUiOjMsImV2aWRlbmNlIjp7InYiOjEsImV2ZW50SWQiOiIwNGJiYmExNC0zNjE5LTQ2ZjAtYjBkMS02MWU0MTk2ZjYwMTMiLCJub25jZSI6IjB4OWI1YjVlZTJkN2ZmNzM0MWI5MTU4YmZhY2Y1N2NkNjcyMmY0MGU5NTkwNDkyYWZlZGIxOGJhNDA0OGVhYWFmNiIsImNvbnRyb2xsZXJJZCI6IjB4OWRhN2Q2NzdiODZjYWQ0MDA2ZTRiOWIxZThkY2QxNzgwODg5ZjgyYzkwYTc5YjQ3NzY4ZmQzMjNmNDY0YmM5YiIsInN5c3RlbSI6ImNvcmUtYmFua2luZyIsImRhdGFDYXRlZ29yaWVzIjpbImFjY291bnQgcHJvZmlsZSIsImFjY291bnQgYWN0aXZpdHkiXSwib3BlcmF0b3JSZWYiOiJzeW50aGV0aWMtb3BlcmF0b3IiLCJyZXF1ZXN0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ0WiJ9LCJ0eEhhc2giOiIweGMzMDczNjAwYWE2NDRiMTgyNWI0ZmM1NDMxOTExZTc1YmQ5MTRiODA3NTg1ZDVhZDExMzExNGUwOGEyNTlhMTEiLCJsb2dJbmRleCI6MTMwLCJzdGF0dXMiOiJhbmNob3JlZCIsImNyZWF0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ1WiJ9
[proof-diubah]: https://saksiku.web.id/proof/0xc3073600aa644b1825b4fc5431911e75bd914b807585d5ad113114e08a259a11/130#eyJldmVudElkIjoiMDRiYmJhMTQtMzYxOS00NmYwLWIwZDEtNjFlNDE5NmY2MDEzIiwiY29udHJvbGxlcklkIjoiMHg5ZGE3ZDY3N2I4NmNhZDQwMDZlNGI5YjFlOGRjZDE3ODA4ODlmODJjOTBhNzliNDc3NjhmZDMyM2Y0NjRiYzliIiwiY29udHJvbGxlck5hbWUiOiJEZW1vIFNwYXJlIiwic3ViamVjdFBzZXVkb255bSI6IjB4ODIwZTNmY2QyZGY4NjlhYjQ5OGE3OWFlNzYxNDk5NjBhOTQ0Zjc4MDlmZDUzNzAwYmJlZmRhOGY3NDEzODQwMyIsInB1cnBvc2VUZXh0IjoiU2hhcmUgY29udGFjdCBkZXRhaWxzIHdpdGggYSBkZWJ0IGNvbGxlY3Rpb24gcGFydG5lciAoc3ludGhldGljIGRlbW8gZm9yIGp1ZGdlcykiLCJwdXJwb3NlU2FsdCI6IjB4ZDNmOTg5NTE5YmYyMDc2NDI3N2IxMGYxYmNkODM5NzZjMGY1MDgzNmU5NmRmMWNmMGYxM2Q4NTZkZjNmYjYwOSIsImxlZ2FsQmFzaXNLZXkiOiIweDUwNDQ1MDJkMzIzMDJkMzIyZDYyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJldmVudFR5cGUiOjAsImV2aWRlbmNlIjp7InYiOjEsImV2ZW50SWQiOiIwNGJiYmExNC0zNjE5LTQ2ZjAtYjBkMS02MWU0MTk2ZjYwMTMiLCJub25jZSI6IjB4OWI1YjVlZTJkN2ZmNzM0MWI5MTU4YmZhY2Y1N2NkNjcyMmY0MGU5NTkwNDkyYWZlZGIxOGJhNDA0OGVhYWFmNiIsImNvbnRyb2xsZXJJZCI6IjB4OWRhN2Q2NzdiODZjYWQ0MDA2ZTRiOWIxZThkY2QxNzgwODg5ZjgyYzkwYTc5YjQ3NzY4ZmQzMjNmNDY0YmM5YiIsInN5c3RlbSI6ImNvcmUtYmFua2luZyIsImRhdGFDYXRlZ29yaWVzIjpbImFjY291bnQgcHJvZmlsZSIsImFjY291bnQgYWN0aXZpdHkiXSwib3BlcmF0b3JSZWYiOiJzeW50aGV0aWMtb3BlcmF0b3IiLCJyZXF1ZXN0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ0WiJ9LCJ0eEhhc2giOiIweGMzMDczNjAwYWE2NDRiMTgyNWI0ZmM1NDMxOTExZTc1YmQ5MTRiODA3NTg1ZDVhZDExMzExNGUwOGEyNTlhMTEiLCJsb2dJbmRleCI6MTMwLCJzdGF0dXMiOiJhbmNob3JlZCIsImNyZWF0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ1WiJ9
