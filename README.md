# Saksi · Chain

Bagian Dwiky: kontrak Solidity, verifikasi receipt dari browser, dan alur penandatanganan MetaMask. Backend dan halaman aplikasi tidak ada di repo ini. Gunakan data sintetis saja.

## Jalankan pemeriksaan

Butuh Foundry, Node.js 22+, dan pnpm 10.34.4.

```sh
(cd contracts && forge test)
(cd web && pnpm install --frozen-lockfile && pnpm typecheck && pnpm test)
```

Jika ABI kontrak berubah, jalankan `node web/generate-abi.mjs` dari root repo dengan `forge` di `PATH`. Generator membaca ABI dari Solidity, termasuk custom error.

## Integrasi web

- Salin pengaturan publik dari `web/.env.example` ke `web/.env.local`. Gunakan RPC Sepolia yang boleh terlihat di browser. Jangan simpan kunci wallet atau URL RPC privat di env publik.
- `web/lib/shared/chain.ts` menyediakan ABI, klien Sepolia, pembacaan laporan, riwayat otorisasi, dan verifikasi receipt.
- Buat `verifyReceipt(opening)` di lapisan integrasi dengan `createReceiptVerifier({ purposeHash, evidenceHash })`, memakai fungsi hash bersama milik backend. Verifier tidak memakai respons server untuk menentukan `MATCH` atau `MISMATCH`.
- `web/lib/client/wagmi.ts` menyediakan `wagmiConfig`, `useWalletState(controllerIds)`, `useRecordAccess()`, dan `useAnchorBreach()`. Pasang `WagmiProvider` dan `QueryClientProvider` di aplikasi Next.js. Hubungkan tombol kirim ke `record()` atau `anchor()`, dan tombol persetujuan terlambat ke `recordLate()`.
- API backend `prepare`, `submit`, dan `confirm` harus tersedia. Jika sudah ada hash, gunakan `reconfirm()` tanpa mengirim transaksi baru. Hook menyimpan ID dan hash sementara, jadi pertahankan komponen saat melakukan pemulihan.

`MATCH` berarti isi receipt sesuai dengan event di kontrak tujuan. Itu bukan bukti bahwa kejadian benar, pencatatan lengkap, akses sah, atau notifikasi terkirim.

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
