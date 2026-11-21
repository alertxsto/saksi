# Deploy Saksi ke VM Oracle (ARM64, Ubuntu)

Kit ini menjalankan Saksi di `https://saksiku.web.id` tanpa mengganggu situs lain yang sudah dilayani Caddy di VM yang sama.

```
Browser ──HTTPS──> Caddy :443 (sudah ada, multi-site)
                     └─ sites/saksi.caddy ──> 127.0.0.1:3400  next start  (systemd --user: saksi-web)
Cloudflare: DNS only (awan abu-abu), A record ke IP VM. Sertifikat TLS diurus Caddy.
```

| File | Fungsi |
|---|---|
| `saksi-web.service` | Unit systemd `--user`: `next start -H 127.0.0.1 -p 3400`, `MemoryMax=1G`, `Nice=5`, restart otomatis kalau crash. |
| `Caddyfile.saksi` | Site block `saksiku.web.id` + `www` (redirect ke apex). Header keamanan, CSP, zstd/gzip, batas body 1 MB. Tanpa global options/snippet, jadi aman di-`import`. |
| `deploy.sh` | Fetch + checkout ref, `pnpm install --frozen-lockfile`, build ke `.next-new` sementara situs lama tetap jalan, swap, restart, health check `/api/status`, rollback otomatis. |
| `caddy-install.sh` | Pasang `sites/saksi.caddy`, tambah `import sites/*.caddy` kalau belum ada (dengan backup), `caddy validate`, baru `systemctl reload caddy`. |
| `preflight.sh` | Checklist hijau/merah untuk hari demo: DNS, sertifikat, redirect, header, `/api/status` (rpc, db, ai, contracts), service. |
| `status-report.mjs` | Helper yang dipakai `deploy.sh` dan `preflight.sh` untuk membaca JSON `/api/status`. |
| `env.production.example` | Template `.env.production` (nilai kosong). |

Semua perintah di bawah dijalankan sebagai user `ubuntu` di VM. Node 22 ada di `~/.local/bin/node`.

## 1. Persiapan sekali saja

```sh
# a. Service user tetap hidup setelah logout SSH
sudo loginctl enable-linger ubuntu

# b. pnpm lewat corepack (versi diambil dari packageManager di web/package.json)
corepack enable            # shim ditulis ke ~/.local/bin, tanpa sudo
pnpm --version             # harus jalan; unduhan pertama otomatis

# c. Pastikan controller memory didelegasikan ke user manager, supaya MemoryMax=1G berlaku
cat /sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/cgroup.controllers
#    Harus ada kata "memory". Kalau tidak ada, service tetap jalan tetapi tanpa batas memori.
```

**DNS di Cloudflare** (proxy dimatikan, awan abu-abu "DNS only"):

| Type | Name | Content |
|---|---|---|
| A | `saksiku.web.id` | IP publik VM |
| CNAME | `www` | `saksiku.web.id` |

Jangan tambahkan AAAA kecuali VM memang melayani IPv6. Port 80 dan 443 sudah terbuka karena Caddy sudah melayani situs lain. Caddy butuh port itu untuk menerbitkan sertifikat.

**Repo privat?** Buat deploy key read-only: `ssh-keygen -t ed25519 -f ~/.ssh/saksi_deploy -N ''`, tambahkan public key di GitHub (Settings → Deploy keys), set `Host github.com` + `IdentityFile ~/.ssh/saksi_deploy` di `~/.ssh/config`, lalu pakai `SAKSI_REPO_URL=git@github.com:alertxsto/saksi.git`.

## 2. Deploy pertama

```sh
# 1) Ambil kode
git clone https://github.com/alertxsto/saksi.git ~/saksi

# 2) Isi env produksi (lihat bagian Env). Jangan pernah commit file ini.
cp ~/saksi/deploy/env.production.example ~/saksi/web/.env.production
chmod 600 ~/saksi/web/.env.production
nano ~/saksi/web/.env.production

# 3) Build + jalankan service (memasang unit ke ~/.config/systemd/user/ secara otomatis)
~/saksi/deploy/deploy.sh main

# 4) Pasang site Caddy. Coba dulu tanpa mengubah apa pun:
~/saksi/deploy/caddy-install.sh --dry-run
#    Periksa diff yang dicetak, lalu pasang:
~/saksi/deploy/caddy-install.sh

# 5) Cek semuanya
SAKSI_VM_IP=<ip-publik-vm> ~/saksi/deploy/preflight.sh
```

`caddy-install.sh` hanya menambah file `/etc/caddy/sites/saksi.caddy` dan, kalau belum ada, satu baris `import sites/*.caddy` di akhir `/etc/caddy/Caddyfile`. Blok situs lain tidak diubah. Urutannya:

1. Render template. Origin dari `NEXT_PUBLIC_RPC_*` dimasukkan ke CSP `connect-src`.
2. Salin seluruh `/etc/caddy` ke direktori staging, terapkan perubahan di sana, lalu `caddy validate` (dijalankan sebagai user `caddy`).
3. Cetak diff, simpan backup bertanggal di `/etc/caddy/backups/`, pasang, lalu `caddy validate` lagi pada file asli.
4. Baru setelah itu `systemctl reload caddy`. Kalau validate atau reload gagal, backup dikembalikan dan Caddy tetap memakai config lama.

Kalau CSP ternyata memblokir sesuatu di UI, pasang ulang dengan `--csp-report-only`. Pelanggaran hanya dilaporkan di console browser, tidak diblokir. Setelah diperbaiki, jalankan lagi tanpa flag itu.

## 3. Redeploy

```sh
~/saksi/deploy/deploy.sh main              # branch
~/saksi/deploy/deploy.sh v1.0-final        # tag
~/saksi/deploy/deploy.sh 3f2c1ab           # commit
~/saksi/deploy/deploy.sh --force main      # paksa build ulang
```

Yang terjadi:

1. `git fetch` lalu `git checkout --force --detach <ref>` di `~/saksi`. File yang di-ignore (`.env.production`, `node_modules`, `.next*`) tidak tersentuh. Edit lokal pada file yang di-track akan dibuang, dan script memberi peringatan.
2. `pnpm install --frozen-lockfile`.
3. `next build` ke `web/.next-new` dengan `nice -n 19` (dan `ionice -c 3` kalau ada) serta `NODE_OPTIONS=--max-old-space-size=1536`. Situs lama tetap melayani dari `web/.next` selama build. Ubah batasnya dengan `BUILD_MEMORY_MB=2048`.
4. Stop service, `web/.next` jadi `web/.next-prev`, `web/.next-new` jadi `web/.next`, start. Downtime sekitar 1–2 detik, dan Caddy menahan request selama itu (`lb_try_duration 15s`), jadi pengunjung tidak melihat 502.
5. Health check `GET /api/status` dengan header `x-demo-token` (token dibaca dari `.env.production`), 30 kali dengan jeda 2 detik. Lulus kalau HTTP 200 dan bentuk JSON-nya benar. Dengan `HEALTH_STRICT=1`, rpc, db, dan contracts juga harus hijau.

Script ini idempoten. Menjalankan ulang ref yang sama dengan nilai `NEXT_PUBLIC_*` yang sama tidak memicu build. Script hanya memastikan service hidup dan sehat. Kalau nilai `NEXT_PUBLIC_*` di `.env.production` berubah, run berikutnya otomatis build ulang, karena nilai itu ditanam ke bundle browser saat build. Kalau hanya env server (misalnya `AI_MODEL`) yang berubah, cukup `systemctl --user restart saksi-web`.

Dua deploy tidak bisa jalan bersamaan (ada lock di `~/.local/state/saksi-deploy/`). Riwayat deploy tercatat di `~/.local/state/saksi-deploy/history`.

## 4. Rollback

**Otomatis:**

- **Build gagal:** source dikembalikan ke commit sebelumnya dan `node_modules` disesuaikan lagi. Situs live tidak pernah berhenti.
- **Health check gagal setelah swap:** build baru dipindah ke `web/.next-failed` (untuk diperiksa), `web/.next-prev` dikembalikan, commit sebelumnya di-checkout, service di-restart, lalu health check diulang. Exit code tetap 1.

**Manual** (satu langkah ke belakang, tanpa build, sekitar 10 detik):

```sh
~/saksi/deploy/deploy.sh --rollback     # kembali ke build + commit sebelumnya
~/saksi/deploy/deploy.sh --rollback     # jalankan lagi = maju ke versi semula
```

Rollback manual memakai `web/.next-prev`. Kalau direktori itu tidak ada, deploy ulang commit lama secara eksplisit: `deploy.sh <sha>`. Script mencetak SHA-nya.

## 5. Env (`~/saksi/web/.env.production`)

Formatnya `KEY=value` polos, tanpa `export` dan tanpa tanda kutip, karena file ini dibaca oleh systemd (`EnvironmentFile`) dan juga oleh `next build`. Mode file `600`.

| Variabel | Wajib | Isi |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | disarankan | `https://saksiku.web.id`. URL kanonik untuk UI. Kode di branch ini belum membacanya, jadi aman diisi lebih dulu. |
| `NEXT_PUBLIC_RPC_PRIMARY` | ya | URL RPC Sepolia publik (terlihat di browser, tanpa API key rahasia). Origin-nya masuk CSP. |
| `NEXT_PUBLIC_RPC_SECONDARY` | opsional | RPC cadangan. |
| `NEXT_PUBLIC_RPC_TERTIARY` | opsional | RPC cadangan kedua. |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | ya | Alamat kontrak registry (Sepolia). |
| `NEXT_PUBLIC_JOURNAL_ADDRESS` | ya | Alamat kontrak journal. |
| `NEXT_PUBLIC_BREACH_ADDRESS` | ya | Alamat kontrak breach. |
| `NEXT_PUBLIC_DEPLOY_BLOCK` | ya | Nomor blok deployment kontrak (awal pemindaian log). |
| `DATABASE_URL` | ya | Connection string **Neon**. App memakai driver Neon HTTP, jadi Postgres lokal di VM tidak bisa dipakai. |
| `SUBJECT_KEY` | ya | 64 karakter hex (`openssl rand -hex 32`). Kunci HMAC pseudonim subjek. Jangan diganti setelah ada data. |
| `DATA_KEY` | ya | 64 karakter hex. Kunci AES-256-GCM data terenkripsi. Jangan diganti setelah ada data. |
| `SESSION_SECRET` | ya | Minimal 32 byte (`openssl rand -hex 32`). |
| `DEMO_ADMIN_TOKEN` | ya | Token untuk `/api/status` dan `/api/demo/tamper`. Dibaca juga oleh `deploy.sh` dan `preflight.sh`. |
| `AI_PROVIDER` | opsional | Label provider yang tampil di UI. Default: hostname `AI_BASE_URL`. |
| `AI_BASE_URL` | untuk AI | Endpoint yang kompatibel dengan OpenAI. |
| `AI_API_KEY` | untuk AI | API key provider. |
| `AI_MODEL` | untuk AI | Model utama. |
| `AI_FALLBACK_MODEL` | opsional | Model cadangan. |

Unit systemd sudah menyetel `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, dan `NODE_OPTIONS=--max-old-space-size=768`, jadi ketiganya tidak perlu ditulis di file ini.

## 6. Checklist hari demo

**H-1**

- [ ] Deploy ref final, sebaiknya pakai tag: `git tag v1.0-final && git push origin v1.0-final`, lalu `deploy.sh v1.0-final`.
- [ ] `SAKSI_VM_IP=<ip> ~/saksi/deploy/preflight.sh` menampilkan **READY**, tanpa baris merah (rpc, db, ai, contracts semuanya PASS).
- [ ] Buka `https://saksiku.web.id` di jendela incognito. Console browser bersih dari error CSP.
- [ ] Wallet MetaMask demo sudah di jaringan Sepolia dan punya ETH (UI minta minimal 0.002).
- [ ] Data sintetis di Neon siap. Catat UUID catatan **Share with third party** untuk demo tamper (`scripts/tamper.sql` / `scripts/restore.sql`).
- [ ] Hafalkan perintah darurat: `deploy.sh --rollback`, `systemctl --user restart saksi-web`, `journalctl --user -u saksi-web -n 100 -f`.

**Hari H**

- [ ] Freeze: tidak ada deploy dalam 2 jam sebelum tampil.
- [ ] Jalankan preflight 60 menit sebelum tampil dan sekali lagi 10 menit sebelum tampil.
- [ ] Jangan tampilkan `DEMO_ADMIN_TOKEN` di layar, slide, atau URL. Cek status cukup lewat preflight.
- [ ] Siapkan tab Sepolia Etherscan untuk alamat tiga kontrak sebagai bukti on-chain.
- [ ] Setelah demo tamper, jalankan `scripts/restore.sql` dan cek Watch kembali normal.

## 7. Troubleshooting

| Gejala | Cek |
|---|---|
| `deploy.sh` berhenti di "DEMO_ADMIN_TOKEN is empty" | Isi token di `.env.production`. |
| Health check 403 | Token di `.env.production` beda dengan yang dibaca app. Restart service setelah mengganti env. |
| Health check 000 / connection refused | `journalctl --user -u saksi-web -n 100`. Port 3400 bentrok? `ss -ltnp \| grep 3400`. |
| Service mati setelah logout SSH | Lingering belum aktif (`sudo loginctl enable-linger ubuntu`). |
| `systemctl --user` error "Failed to connect to bus" | Jalankan dari sesi SSH user `ubuntu` langsung, bukan lewat `sudo su`. Script sudah menyetel `XDG_RUNTIME_DIR`. |
| Sertifikat tidak terbit | Cloudflare harus DNS only. Cek `journalctl -u caddy -n 100`. |
| Build kehabisan memori | Naikkan `BUILD_MEMORY_MB`, atau pastikan swap VM aktif. |

## Catatan teknis

- `web/next.config.mjs` membaca `SAKSI_DIST_DIR` (default `.next`). Hanya `deploy.sh` yang menyetelnya ke `.next-new` saat build. Vercel dan `pnpm dev` tetap memakai `.next`. Next.js mengirim `distDir` milik server ke setiap request, sehingga build yang dibuat di `.next-new` lalu di-rename ke `.next` tetap jalan. Ini sudah diuji dengan `next start` setelah rename.
- `next build` menambahkan `.next-new/types` ke `web/tsconfig.json`. `deploy.sh` mengembalikan file itu setelah build supaya checkout tetap bersih.
- Selama `pnpm install`, `node_modules` berubah di bawah server lama yang masih jalan. Module yang sudah di-load tidak terpengaruh. Risikonya hanya pada route yang belum pernah diakses dan baru di-load di detik-detik itu.
- Caddy menimpa `X-Forwarded-For` dengan IP klien asli (tidak ada trusted proxy, karena Cloudflare DNS only), dan rate limit di API memakai header itu.
