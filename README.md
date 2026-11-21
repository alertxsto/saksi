# Saksi

Kontrak Solidity, verifikasi receipt di browser, penandatanganan MetaMask, dan API backend untuk profil, catatan akses, insiden, Watch, dan AI. Gunakan data sintetis saja.

## Jalankan pemeriksaan

Butuh Foundry, Node.js 24, dan pnpm 10.34.4.

```sh
(cd contracts && forge test)
(cd web && pnpm install --frozen-lockfile && pnpm typecheck && pnpm test)
```

Untuk mendemokan deteksi perubahan receipt tanpa dana atau RPC publik:

```sh
(cd web && pnpm test -t 'recomputes real commitments')
```

Tes memakai RPC lokal simulasi dengan event yang hash-nya ditetapkan dari vektor independen. Receipt asli harus `MATCH`; mengganti aksi off-chain menjadi `READ` harus menghasilkan `MISMATCH` pada `eventType`.

Jika ABI kontrak berubah, jalankan `node web/generate-abi.mjs` dari root repo dengan `forge` di `PATH`. Generator membaca ABI dari Solidity, termasuk custom error.

## Integrasi web

- Salin pengaturan publik dari `web/.env.example` ke `web/.env.local`. Gunakan RPC Sepolia yang boleh terlihat di browser. Jangan simpan kunci wallet atau URL RPC privat di env publik.
- `web/lib/shared/chain.ts` menyediakan ABI, klien Sepolia, pembacaan laporan, riwayat otorisasi, dan verifikasi receipt.
- Gunakan `verifyReceipt(opening)` dari `web/lib/shared/verify.ts`. Verifier memakai fungsi hash bersama dan memeriksa receipt lewat RPC, bukan memakai status verifikasi dari server.
- `web/lib/client/wagmi.ts` menyediakan `wagmiConfig`, `useWalletState(controllerIds)`, `useRecordAccess()`, dan `useAnchorBreach()`. Pasang `WagmiProvider` dan `QueryClientProvider` di aplikasi Next.js. Hubungkan tombol kirim ke `record()` atau `anchor()`, dan tombol persetujuan terlambat ke `recordLate()`.
- API backend `prepare`, `submit`, dan `confirm` harus tersedia. Jika sudah ada hash, gunakan `reconfirm()` tanpa mengirim transaksi baru. Hook menyimpan ID dan hash sementara, jadi pertahankan komponen saat melakukan pemulihan.

`MATCH` berarti isi receipt sesuai dengan event di kontrak tujuan. Itu bukan bukti bahwa kejadian benar, pencatatan lengkap, akses sah, atau notifikasi terkirim.

## Backend dan gladi

Pakai Node.js 24 dan pnpm 10.34.4. Salin `web/.env.example` ke `web/.env.local`, isi Neon latihan, secret server, konfigurasi Sepolia, dan model sponsor. Jangan taruh private key wallet atau secret di Git. Di Vercel gunakan root `web/`, Node.js 24, dan Neon region Singapore.

```sh
cd web
pnpm install --frozen-lockfile
pnpm db:push
pnpm dev
```

`/api/status` dan `/api/demo/tamper` memerlukan header `x-demo-token`. Watch membandingkan log Sepolia dengan isi DB saat ini. Jalankan SQL ini hanya untuk satu UUID catatan **Share with third party** yang sudah di-anchor di database sintetis:

```sh
psql "$DATABASE_URL" -v event_id="$DEMO_EVENT_ID" -f scripts/tamper.sql
# Periksa ulang receipt dan /api/watch; keduanya harus menandai perbedaan eventType.
psql "$DATABASE_URL" -v event_id="$DEMO_EVENT_ID" -f scripts/restore.sql
```

Jalankan perintah `psql` dari root repo. Watch/receipt menyatakan kecocokan data, bukan kebenaran kejadian atau kepatuhan hukum. AI hanya menjelaskan hasil atau menyusun draf; mode tepat waktu/terlambat diambil dari event kontrak.

## Deployment

Kontrak belum diterbitkan lewat checkout ini. Dari `contracts/`, isi
`DEPLOY_ADMIN_ADDRESS`, `DEMO_CONTROLLER_ONE_ADDRESS`, dan
`DEMO_CONTROLLER_TWO_ADDRESS` dengan alamat publik. Opsional:
`DEMO_CONTROLLER_SPARE_ADDRESS`. ID controller diturunkan dari slug
`demo-one`, `demo-two`, dan `demo-spare` dengan awalan `ctrl:`.

```sh
forge script script/Deploy.s.sol:Deploy --rpc-url "$SEPOLIA_RPC_URL" --account admin
```

Perintah di atas hanya simulasi. Gunakan keystore Foundry, bukan private key
di command line. Setelah simulasi lolos, tambahkan `--broadcast --verify`
dengan `ETHERSCAN_API_KEY` di environment, atau pilih verifier Sourcify.
Catat alamat tiga kontrak dan blok deployment untuk konfigurasi web.
