# Saksi

**Struk anti-ubah untuk setiap akses ke data pribadi warga.** Perusahaan mencatat tiap akses, sidik jarinya disegel di Ethereum Sepolia, dan warga memverifikasi struknya sendiri **di browser** terhadap chain. Server Saksi tidak ikut memutuskan cocok atau tidak.

**Live:** https://saksiku.web.id · **Kontrak:** [Sepolia](#kontrak-di-sepolia) · **Uji:** 27 tes Foundry + 67 tes Vitest lulus · **Biaya:** sekitar Rp275 per catatan di mainnet, sekitar Rp5 di L2 ([hitungan](#biaya-per-catatan))

> Semua data di situs adalah data sintetis. Jaringan yang dipakai testnet Sepolia.

## Masalah dan solusi

[UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022) (UU PDP) mewajibkan pengendali data:

- punya dasar pemrosesan yang sah (Pasal 20 ayat 2 huruf a sampai f: persetujuan, perjanjian, kewajiban hukum, kepentingan vital, tugas publik, kepentingan yang sah),
- merekam **seluruh** kegiatan pemrosesan data pribadi (Pasal 31),
- memberi tahu subjek data dan lembaga secara tertulis **paling lambat 3 x 24 jam** jika terjadi kegagalan pelindungan data, minimal berisi data yang terungkap, kapan dan bagaimana, serta upaya penanganannya (Pasal 46).

Masalahnya, rekaman Pasal 31 disimpan di database milik pengendali sendiri. Baris bisa diubah atau dihapus diam-diam, dan warga tidak bisa membuktikan apa pun. Saksi menambahkan saksi independen: setiap akses menghasilkan struk untuk warga dan komitmen hash di kontrak Sepolia. Kalau database diubah, verifikasi di browser warga dan dasbor Watch milik regulator langsung menunjukkan field mana yang berbeda. Notifikasi insiden juga di-anchor di kontrak yang menegakkan jendela 72 jam terhadap waktu deteksi yang dideklarasikan pengendali.
## Coba sendiri (3 menit)

**A. Tanpa wallet (siapa saja, sekitar 1 menit).** Buka setiap link di **tab baru**.

1. [Struk asli][proof-asli]. Browser Anda mengambil event dari RPC publik Sepolia, menghitung ulang hash, lalu menampilkan **MATCH**. Di panel kanan Anda bisa mengganti node RPC ("Don't trust us").
2. [Struk yang sama dengan aksi diubah][proof-diubah] dari *Shared with third party* menjadi *Read*. Hasilnya **ALTERED**, dengan baris "What they did: DB READ, CHAIN SHARED WITH THIRD PARTY".
3. Jika Anda sudah punya struk dari alur B: klik **Download** di halaman struk, ubah satu field di JSON (misalnya `"eventType": 3` menjadi `0`), lalu tempel atau unggah di [/proof](https://saksiku.web.id/proof).

**B. Alur lengkap (sekitar 2 menit, butuh wallet controller terdaftar).**

1. **Warga:** buka [/citizen](https://saksiku.web.id/citizen), klik **Create synthetic profile**, lalu catat kode 6 karakter.
2. **Controller:** buka [/controller](https://saksiku.web.id/controller), hubungkan MetaMask di Sepolia, isi kode warga, tujuan, dasar hukum, dan jenis akses, lalu klik **Seal on chain**. Hanya wallet yang terdaftar di `ControllerRegistry` yang bisa menyegel. Wallet `demo-one` dan `demo-two` dipegang tim, jadi langkah ini kami peragakan saat demo. Untuk mencobanya dengan wallet sendiri, jalankan versi lokal dengan kontrak Anda sendiri ([Jalankan lokal](#jalankan-lokal)).
3. **Warga:** struk muncul di /citizen. Buka struknya untuk memverifikasi di browser, lalu klik **Explain with AI** untuk penjelasan bahasa awam.
4. **Regulator:** [/regulator/watch](https://saksiku.web.id/regulator/watch) membandingkan setiap baris DB dengan event di chain. Tim memicu perubahan baris lewat `POST /api/demo/tamper` (dilindungi header `x-demo-token`), lalu baris itu berubah dari **MATCH** menjadi **ALTERED** dengan nilai DB dan nilai chain berdampingan. Aksi `restore` mengembalikannya.
5. **Insiden:** [/controller/breach](https://saksiku.web.id/controller/breach) menyusun draf notifikasi Pasal 46 dengan AI lalu meng-anchor-nya. [/regulator](https://saksiku.web.id/regulator) menampilkan status tepat waktu atau terlambat yang dibaca dari event kontrak.

## Arsitektur

```mermaid
flowchart LR
  subgraph B["Browser"]
    CIT["Warga<br/>/citizen, /proof"]
    CTL["Controller<br/>/controller + MetaMask"]
    REGU["Regulator<br/>/regulator/watch"]
    VER["Verifier<br/>lib/shared/verify.ts"]
  end
  subgraph S["Server (Next.js 16, Docker)"]
    API["API tunggal<br/>app/api/[...path]"]
    AIG["Guard AI<br/>explain-guard.ts"]
  end
  DB[("Postgres<br/>AES-256-GCM")]
  LLM["LLM kompatibel OpenAI"]
  subgraph E["Ethereum Sepolia"]
    RG["ControllerRegistry"]
    AJ["AccessJournal"]
    BR["BreachReport"]
  end
  CTL -- "prepare / submit / confirm" --> API
  CTL -- "logAccess, anchor (ditandatangani di MetaMask)" --> AJ
  CTL -- "anchor / anchorLate" --> BR
  API --> DB
  API -- "baca receipt dan log" --> E
  CIT -- "ambil opening struk" --> API
  CIT --> VER
  VER -- "eth_getLogs lewat RPC publik pilihan pengguna" --> AJ
  REGU -- "GET /api/watch" --> API
  API --> AIG --> LLM
  AJ -. "isAuthorized" .-> RG
  BR -. "isAuthorized" .-> RG
```

- **Penandatanganan:** server tidak memegang kunci wallet. Server menyiapkan argumen (`prepare`), controller menandatangani transaksi di MetaMask, lalu server hanya mencocokkan receipt dan event (`submit`, `confirm`).
- **Verifikasi:** `verifyReceipt` berjalan di browser dengan fungsi hash yang sama (`lib/shared/commit.ts`) dan membaca chain langsung lewat RPC publik.
- **Watch:** server memindai event `AccessLogged` sejak blok deployment lalu membandingkannya dengan baris DB. Hasilnya `MATCH`, `ALTERED` (field berbeda), `DELETED` (event ada, baris hilang), atau `NOT_ANCHORED` (baris mengklaim transaksi yang tidak pernah sampai ke journal).

## Apa yang masuk chain

| Data | On-chain (event `AccessLogged`) | Off-chain (Postgres) |
| --- | --- | --- |
| Identitas controller | `controllerId = keccak256("ctrl:<slug>")` | nama, slug, EOA |
| Identitas warga | `subjectPseudonym = HMAC-SHA256(SUBJECT_KEY, controllerId ‖ subjectId ‖ salt per warga)`, berbeda per controller | kode profil; salt pseudonim terenkripsi |
| Tujuan akses | `purposeHash = keccak256(teks ‖ salt acak 32 byte)`, jadi tujuan yang pendek tidak bisa ditebak dari hash | teks dan salt, terenkripsi AES-256-GCM |
| Dasar hukum | `legalBasisKey`, misalnya `"PDP-20-2-b"` sebagai bytes32 | sama |
| Jenis akses | `eventType` 0 sampai 3 (Read, Update, Export, Share with third party) | sama |
| Bukti | `evidenceHash = keccak256(JCS(evidence))`, JSON dikanonikalisasi RFC 8785 dan berisi nonce acak | JSON bukti, terenkripsi |
| Waktu | `timestamp` blok | waktu dibuat |

Tidak ada nama, NIK, atau teks bebas di chain. Struk warga (opening) berisi nilai mentah yang dibutuhkan untuk menghitung ulang hash. Di link bukti, opening ditaruh setelah `#`, jadi browser tidak pernah mengirimnya ke server mana pun.

Insiden: `BreachReport.anchor(controllerId, reportHash, affectedCountHash, detectedAt)` diterima hanya jika `block.timestamp <= detectedAt + 72 jam`. Lewat dari itu kontrak me-revert dengan `ClaimedWindowExpired`, dan satu-satunya jalan adalah `anchorLate`, yang mencatat berapa detik keterlambatannya. Satu `reportHash` hanya bisa di-anchor sekali.

## Kontrak di Sepolia

Sumber: [`contracts/deployments/sepolia.json`](contracts/deployments/sepolia.json). Chain ID 11155111, blok deployment [12181663](https://sepolia.etherscan.io/block/12181663).

| Kontrak | Alamat |
| --- | --- |
| ControllerRegistry | [`0x3d9dE4717a7398d24239b8370b23DCAd7a07f737`](https://sepolia.etherscan.io/address/0x3d9dE4717a7398d24239b8370b23DCAd7a07f737) |
| AccessJournal | [`0xAb9b73586610697deb7Ae59A59e991f5177CB263`](https://sepolia.etherscan.io/address/0xAb9b73586610697deb7Ae59A59e991f5177CB263) |
| BreachReport | [`0x71Ff16F068A845F3D3dfd63584a31A9de86fE462`](https://sepolia.etherscan.io/address/0x71Ff16F068A845F3D3dfd63584a31A9de86fE462) |

| Controller demo | EOA |
| --- | --- |
| `demo-one` | [`0xe4788AcC311c6135A848f82823456F06f2bb74E0`](https://sepolia.etherscan.io/address/0xe4788AcC311c6135A848f82823456F06f2bb74E0) |
| `demo-two` | [`0xc524444F4c376BE75f18810EE7cFCEE67618e8FE`](https://sepolia.etherscan.io/address/0xc524444F4c376BE75f18810EE7cFCEE67618e8FE) |
| `demo-spare` (deployer/admin) | [`0x5678B387056c7571813f8acF934dD145D9f98C9D`](https://sepolia.etherscan.io/address/0x5678B387056c7571813f8acF934dD145D9f98C9D) |

## Model kepercayaan

- **Verdict dihitung di browser.** Server hanya mengirim opening. Browser menghitung ulang `purposeHash` dan `evidenceHash`, membaca event dari RPC yang dipilih pengguna, lalu membandingkan field demi field.
- **AI tidak pernah memutuskan.** Untuk `POST /api/ai/explain`, server menjalankan verifier sendiri dan tidak menerima verdict dari browser. Model hanya menerima nama controller, jenis akses, dasar hukum, status, dan nama field yang berbeda. Teks tujuan tulisan controller tidak dikirim ke model untuk menutup jalur prompt injection. Jawaban selalu diawali kalimat verdict yang tetap. Jawaban yang membantah verdict atau menyatakan akses sah atau tidak sah ditolak, lalu diganti template (`lib/server/explain-guard.ts`). Model, latensi, dan tingkat fallback (primary, fallback, cached, template) dicatat dan ditampilkan.
- **Draf Pasal 46 dibuat AI, keputusannya tidak.** Status tepat waktu atau terlambat berasal dari event kontrak, bukan dari model.
- **Arti MATCH:** isi struk sama dengan yang disegel di chain. MATCH bukan bukti bahwa akses benar-benar terjadi, sah, atau tercatat lengkap. Controller yang tidak mencatat sama sekali tidak terdeteksi oleh hash. Regulator mendeteksinya dari celah lain, misalnya keluhan warga atau audit.
- **Admin registry** adalah satu EOA (deployer). Rotasi dan pencabutan controller selalu memancarkan event yang terlihat publik.

## Keamanan dan pengujian

| Lapisan | Hasil |
| --- | --- |
| Kontrak, `forge test` | **27 lulus, 0 gagal, 0 di-skip** (dijalankan ulang 21 Nov 2026): 22 unit, 4 fuzz (masing-masing 256 run), 1 suite invariant stateful dengan 2 invariant (64 run x 200 call = 12.800 call) |
| Invariant | satu laporan di-anchor paling banyak sekali dengan timestamp yang tidak pernah berubah; tiap laporan berstatus tepat waktu jika dan hanya jika di-anchor dalam 72 jam sejak `detectedAt`. Uji mutasi memastikan kedua invariant benar-benar bisa gagal (tidak vakum). |
| Slither 0.11.6 (102 detektor) | 0 high, 0 medium, 3 low (`timestamp` pada logika jendela 72 jam, ditriase sebagai false positive by design) |
| Review manual | 5 temuan (2 low, termasuk admin registry satu EOA; 3 informational), semuanya didokumentasikan beserta mitigasi dan rencana v2 |
| Web, `pnpm test` (Vitest) | **67 lulus di 9 file**: hash commitment dengan vektor independen, verifier terhadap RPC simulasi (struk asli MATCH; Share with third party yang diubah menjadi Read jadi MISMATCH pada `eventType`), kripto (HMAC, AES-GCM), hardening API (submit token terikat draf, validasi input, rate limit per IP klien, cookie Secure), guard AI (menolak teks yang membantah verdict atau berisi klaim hukum), alur wallet (submit, confirm, pemulihan, persetujuan terlambat), Watch, dan evaluasi drafter AI |
| `pnpm typecheck`, `pnpm build` | lulus tanpa env (konfigurasi dibaca saat runtime) |

Detail lengkap, hash file, dan cara reproduksi ada di [`contracts/SECURITY.md`](contracts/SECURITY.md). Ini review mandiri tim untuk hackathon, bukan audit profesional.

## Biaya per catatan

Diukur dari transaksi `logAccess` asli [`0x4d62e4d2…0fc7`](https://sepolia.etherscan.io/tx/0x4d62e4d2a770718e7ac82cf805283414834eff12503c3b49069c0147927e0fc7) (blok 12181841): **29.163 gas**. Transaksi kedua [`0xc3073600…9a11`](https://sepolia.etherscan.io/tx/0xc3073600aa644b1825b4fc5431911e75bd914b807585d5ad113114e08a259a11) memakai 29.151 gas.

Harga per **21 Nov 2026, 19:51 WIB**: 1 ETH = **Rp30.384.224** ([CoinGecko `simple/price`](https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=idr); pembanding [Indodax](https://indodax.com/market/ETHIDR) pada saat yang sama: Rp30.596.000). Gas mainnet **0,31 gwei** (`eth_gasPrice`, `ethereum-rpc.publicnode.com`). Faktor L2 **0,0194** = gas price Base (0,006 gwei, `base-rpc.publicnode.com`) dibagi gas price mainnet. Faktor ini belum termasuk biaya data L1 rollup, jadi anggap sebagai perkiraan bawah.

| Skenario | Per catatan | Per 1.000 catatan |
| --- | --- | --- |
| Sepolia, terukur (0,00067 gwei; ETH testnet tidak punya nilai pasar) | 0,0000000195 ETH (setara Rp0,59) | Rp593,69 |
| Proyeksi Ethereum mainnet (0,31 gwei) | 0,00000904 ETH = **Rp274,69** | Rp274.689 |
| Proyeksi L2 (0,0194 x L1) | 0,000000175 ETH = **Rp5,33** | Rp5.329 |

Anchor insiden memakan sekitar 56.200 gas (sekitar 1,9 kali satu catatan), tetapi hanya terjadi sekali per insiden. Harga gas bergerak, jadi jalankan ulang sebelum mengutip angka:

```sh
node scripts/gas-cost.mjs --rpc https://ethereum-sepolia-rpc.publicnode.com \
  --tx 0x4d62e4d2a770718e7ac82cf805283414834eff12503c3b49069c0147927e0fc7 \
  --eth-idr 30384224 --mainnet-gwei 0.31 --l2-factor 0.0194
```

## Jalankan lokal

Butuh Node.js 24 (lihat `web/.node-version`), pnpm 10.34.4, Docker (untuk Postgres), dan Foundry jika ingin menguji kontrak.

```sh
# 1. Postgres
docker run -d --name saksi-pg -p 5432:5432 \
  -e POSTGRES_USER=saksi -e POSTGRES_PASSWORD=saksi -e POSTGRES_DB=saksi postgres:17-alpine

# 2. Env: alamat kontrak Sepolia sudah terisi di contoh
cd web
cp .env.example .env.local
# isi DATABASE_URL=postgres://saksi:saksi@localhost:5432/saksi
# isi SUBJECT_KEY, DATA_KEY, SESSION_SECRET masing-masing dengan: openssl rand -hex 32
# isi NEXT_PUBLIC_SITE_URL=http://localhost:3000 ; AI_* opsional (tanpa AI dipakai template)

# 3. Skema dan server dev
pnpm install --frozen-lockfile
pnpm db:push
pnpm dev                       # http://localhost:3000
```

Pemeriksaan:

```sh
(cd contracts && forge test)                                   # 27 tes
(cd web && pnpm typecheck && pnpm test && pnpm build)          # 67 tes
(cd web && pnpm test -t 'recomputes real commitments')         # demo deteksi perubahan tanpa RPC dan dana
```

Simulasi tamper di database lokal, untuk satu UUID catatan *Share with third party* yang sudah di-anchor (jalankan dari root repo):

```sh
psql "$DATABASE_URL" -v event_id="$DEMO_EVENT_ID" -f scripts/tamper.sql    # Watch dan struk menandai eventType
psql "$DATABASE_URL" -v event_id="$DEMO_EVENT_ID" -f scripts/restore.sql
```

Untuk mencoba alur controller dengan wallet sendiri, deploy kontrak Anda sendiri dari `contracts/` dengan alamat publik di `DEPLOY_ADMIN_ADDRESS` dan `DEMO_CONTROLLER_ONE_ADDRESS` / `_TWO_` / `_SPARE_`. Simulasikan dulu dengan `forge script script/Deploy.s.sol:Deploy --rpc-url "$SEPOLIA_RPC_URL" --account <keystore>`, baru tambahkan `--broadcast --verify`. Gunakan keystore Foundry, jangan private key di command line. Setelah itu salin alamat dan blok deployment ke `.env.local`. Jika ABI berubah, jalankan `node web/generate-abi.mjs` dari root repo.

## Deploy

Situs live berjalan di Docker (Next.js standalone + Postgres 17) di belakang Caddy. Panduan langkah demi langkah, env produksi, preflight, dan rollback ada di [`deploy/README.md`](deploy/README.md). Template env: [`deploy/env.production.example`](deploy/env.production.example).

## Tim

| Nama | Peran |
| --- | --- |
| Dwiky | Smart contract (Solidity, Foundry, keamanan) |
| Indri | Backend (API, database, kripto, integrasi AI) |
| Muqorrobin | Front-end dan UX |

## Batasan

- **Testnet.** Semua transaksi ada di Sepolia. Biaya mainnet dan L2 di atas adalah proyeksi.
- **Data sintetis.** Profil warga dan bukti akses dibuat otomatis. Tidak ada data pribadi asli.
- **Controller demo.** Hanya tiga controller terdaftar (`demo-one`, `demo-two`, `demo-spare`), dan admin registry adalah satu EOA. Produksi butuh multisig dan proses onboarding controller.
- **Kelengkapan tidak bisa dibuktikan hash.** Saksi mendeteksi catatan yang diubah atau dihapus setelah disegel, bukan akses yang tidak pernah dicatat.
- **`detectedAt` dideklarasikan controller.** Kontrak menegakkan jendela 72 jam terhadap waktu deteksi yang diklaim, bukan waktu deteksi sebenarnya.
- **Tamper di situs live** hanya bisa dipicu tim (endpoint dilindungi token). Juri bisa menguji deteksi perubahan secara mandiri lewat langkah A di atas.
- **AI** adalah model pihak ketiga yang kompatibel OpenAI. Jika tidak tersedia, aplikasi memakai cache lalu template tetap, dan itu ditandai di UI.

[proof-asli]: https://saksiku.web.id/proof/0xc3073600aa644b1825b4fc5431911e75bd914b807585d5ad113114e08a259a11/130#eyJldmVudElkIjoiMDRiYmJhMTQtMzYxOS00NmYwLWIwZDEtNjFlNDE5NmY2MDEzIiwiY29udHJvbGxlcklkIjoiMHg5ZGE3ZDY3N2I4NmNhZDQwMDZlNGI5YjFlOGRjZDE3ODA4ODlmODJjOTBhNzliNDc3NjhmZDMyM2Y0NjRiYzliIiwiY29udHJvbGxlck5hbWUiOiJEZW1vIFNwYXJlIiwic3ViamVjdFBzZXVkb255bSI6IjB4ODIwZTNmY2QyZGY4NjlhYjQ5OGE3OWFlNzYxNDk5NjBhOTQ0Zjc4MDlmZDUzNzAwYmJlZmRhOGY3NDEzODQwMyIsInB1cnBvc2VUZXh0IjoiU2hhcmUgY29udGFjdCBkZXRhaWxzIHdpdGggYSBkZWJ0IGNvbGxlY3Rpb24gcGFydG5lciAoc3ludGhldGljIGRlbW8gZm9yIGp1ZGdlcykiLCJwdXJwb3NlU2FsdCI6IjB4ZDNmOTg5NTE5YmYyMDc2NDI3N2IxMGYxYmNkODM5NzZjMGY1MDgzNmU5NmRmMWNmMGYxM2Q4NTZkZjNmYjYwOSIsImxlZ2FsQmFzaXNLZXkiOiIweDUwNDQ1MDJkMzIzMDJkMzIyZDYyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJldmVudFR5cGUiOjMsImV2aWRlbmNlIjp7InYiOjEsImV2ZW50SWQiOiIwNGJiYmExNC0zNjE5LTQ2ZjAtYjBkMS02MWU0MTk2ZjYwMTMiLCJub25jZSI6IjB4OWI1YjVlZTJkN2ZmNzM0MWI5MTU4YmZhY2Y1N2NkNjcyMmY0MGU5NTkwNDkyYWZlZGIxOGJhNDA0OGVhYWFmNiIsImNvbnRyb2xsZXJJZCI6IjB4OWRhN2Q2NzdiODZjYWQ0MDA2ZTRiOWIxZThkY2QxNzgwODg5ZjgyYzkwYTc5YjQ3NzY4ZmQzMjNmNDY0YmM5YiIsInN5c3RlbSI6ImNvcmUtYmFua2luZyIsImRhdGFDYXRlZ29yaWVzIjpbImFjY291bnQgcHJvZmlsZSIsImFjY291bnQgYWN0aXZpdHkiXSwib3BlcmF0b3JSZWYiOiJzeW50aGV0aWMtb3BlcmF0b3IiLCJyZXF1ZXN0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ0WiJ9LCJ0eEhhc2giOiIweGMzMDczNjAwYWE2NDRiMTgyNWI0ZmM1NDMxOTExZTc1YmQ5MTRiODA3NTg1ZDVhZDExMzExNGUwOGEyNTlhMTEiLCJsb2dJbmRleCI6MTMwLCJzdGF0dXMiOiJhbmNob3JlZCIsImNyZWF0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ1WiJ9
[proof-diubah]: https://saksiku.web.id/proof/0xc3073600aa644b1825b4fc5431911e75bd914b807585d5ad113114e08a259a11/130#eyJldmVudElkIjoiMDRiYmJhMTQtMzYxOS00NmYwLWIwZDEtNjFlNDE5NmY2MDEzIiwiY29udHJvbGxlcklkIjoiMHg5ZGE3ZDY3N2I4NmNhZDQwMDZlNGI5YjFlOGRjZDE3ODA4ODlmODJjOTBhNzliNDc3NjhmZDMyM2Y0NjRiYzliIiwiY29udHJvbGxlck5hbWUiOiJEZW1vIFNwYXJlIiwic3ViamVjdFBzZXVkb255bSI6IjB4ODIwZTNmY2QyZGY4NjlhYjQ5OGE3OWFlNzYxNDk5NjBhOTQ0Zjc4MDlmZDUzNzAwYmJlZmRhOGY3NDEzODQwMyIsInB1cnBvc2VUZXh0IjoiU2hhcmUgY29udGFjdCBkZXRhaWxzIHdpdGggYSBkZWJ0IGNvbGxlY3Rpb24gcGFydG5lciAoc3ludGhldGljIGRlbW8gZm9yIGp1ZGdlcykiLCJwdXJwb3NlU2FsdCI6IjB4ZDNmOTg5NTE5YmYyMDc2NDI3N2IxMGYxYmNkODM5NzZjMGY1MDgzNmU5NmRmMWNmMGYxM2Q4NTZkZjNmYjYwOSIsImxlZ2FsQmFzaXNLZXkiOiIweDUwNDQ1MDJkMzIzMDJkMzIyZDYyMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJldmVudFR5cGUiOjAsImV2aWRlbmNlIjp7InYiOjEsImV2ZW50SWQiOiIwNGJiYmExNC0zNjE5LTQ2ZjAtYjBkMS02MWU0MTk2ZjYwMTMiLCJub25jZSI6IjB4OWI1YjVlZTJkN2ZmNzM0MWI5MTU4YmZhY2Y1N2NkNjcyMmY0MGU5NTkwNDkyYWZlZGIxOGJhNDA0OGVhYWFmNiIsImNvbnRyb2xsZXJJZCI6IjB4OWRhN2Q2NzdiODZjYWQ0MDA2ZTRiOWIxZThkY2QxNzgwODg5ZjgyYzkwYTc5YjQ3NzY4ZmQzMjNmNDY0YmM5YiIsInN5c3RlbSI6ImNvcmUtYmFua2luZyIsImRhdGFDYXRlZ29yaWVzIjpbImFjY291bnQgcHJvZmlsZSIsImFjY291bnQgYWN0aXZpdHkiXSwib3BlcmF0b3JSZWYiOiJzeW50aGV0aWMtb3BlcmF0b3IiLCJyZXF1ZXN0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ0WiJ9LCJ0eEhhc2giOiIweGMzMDczNjAwYWE2NDRiMTgyNWI0ZmM1NDMxOTExZTc1YmQ5MTRiODA3NTg1ZDVhZDExMzExNGUwOGEyNTlhMTEiLCJsb2dJbmRleCI6MTMwLCJzdGF0dXMiOiJhbmNob3JlZCIsImNyZWF0ZWRBdCI6IjIwMjYtMTEtMjFUMTI6NTQ6MzUuODQ1WiJ9
