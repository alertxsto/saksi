# Deploy Saksi ke VM Oracle (ARM64, Ubuntu) dengan Docker

Kit ini menjalankan Saksi di `https://saksiku.web.id` sebagai container Docker, tanpa mengganggu situs atau stack Docker lain di VM yang sama.

```
Browser ──HTTPS──> Caddy :443 (di host, multi-site)
                     └─ sites/saksi.caddy ──> 127.0.0.1:3400 ──> container saksi-web-1 :3000 (node server.js)
Cloudflare: DNS only (awan abu-abu), A record ke IP VM. Sertifikat TLS diurus Caddy.
Database: Neon (eksternal). Tidak ada container database.
```

| File | Fungsi |
|---|---|
| `../web/Dockerfile` | Image multi-stage: `pnpm install --frozen-lockfile` → `next build` (output `standalone`) → runtime `node:22-alpine`, user non-root `node`, `HEALTHCHECK` bawaan. |
| `compose.yaml` | Project `saksi`, service `web`, image `saksi-web:${SAKSI_TAG}`, port `127.0.0.1:3400:3000`, `env_file`, `mem_limit: 1g`, rootfs read-only, `no-new-privileges`, `cap_drop: ALL`, rotasi log. |
| `deploy.sh` | Fetch + checkout ref, `docker build` sementara container lama tetap melayani, `docker compose up -d`, health check, rollback otomatis, `--rollback` manual, prune image lama. |
| `Caddyfile.saksi` | Site block `saksiku.web.id` + `www` (redirect ke apex). Header keamanan, CSP, zstd/gzip, batas body 1 MB. Tanpa global options/snippet, jadi aman di-`import`. |
| `caddy-install.sh` | Pasang `sites/saksi.caddy`, tambah `import sites/*.caddy` kalau belum ada (dengan backup), `caddy validate`, baru `systemctl reload caddy`. |
| `preflight.sh` | Checklist hijau/merah: DNS, sertifikat, redirect, header, `/api/status` (rpc, db, ai, contracts), dan di VM: Docker, env file, port 3400, container, Caddy, disk. Read-only. |
| `status-report.mjs` | Membaca JSON `/api/status`. `deploy.sh` menjalankannya di dalam image (host tidak perlu Node), `preflight.sh` memakai Node di host. |
| `env.production.example` | Template `.env.production` (nilai kosong). |

Semua perintah di bawah dijalankan sebagai user `ubuntu` di VM. User itu harus bisa memakai Docker tanpa sudo (anggota grup `docker`). Host butuh `git`, `curl`, Docker 29 dengan plugin `compose` dan `buildx`. Node di host hanya dipakai oleh bagian `/api/status` di `preflight.sh`.

## Alur deploy pertama

### 1. Ambil kode dan jalankan preflight

```sh
git clone https://github.com/alertxsto/saksi.git ~/saksi
SAKSI_VM_IP=<ip-publik-vm> PREFLIGHT_SKIP="tls status" ~/saksi/deploy/preflight.sh
```

Sebelum deploy pertama, TLS dan `/api/status` pasti merah, jadi lewati dulu. Yang harus hijau: DNS, `docker`, `docker compose`, `docker buildx`, `port 3400` (free), disk. Baris `env file` merah sampai langkah 2 selesai, dan `saksi container` kuning ("not deployed yet").

**DNS di Cloudflare** (proxy dimatikan, awan abu-abu "DNS only"):

| Type | Name | Content |
|---|---|---|
| A | `saksiku.web.id` | IP publik VM |
| CNAME | `www` | `saksiku.web.id` |

Jangan tambahkan AAAA kecuali VM memang melayani IPv6. Port 80 dan 443 sudah terbuka karena Caddy sudah melayani situs lain.

**Repo privat?** Buat deploy key read-only: `ssh-keygen -t ed25519 -f ~/.ssh/saksi_deploy -N ''`, tambahkan public key di GitHub (Settings → Deploy keys), set `Host github.com` + `IdentityFile ~/.ssh/saksi_deploy` di `~/.ssh/config`, lalu pakai `SAKSI_REPO_URL=git@github.com:alertxsto/saksi.git`.

### 2. Isi env produksi

```sh
cp ~/saksi/deploy/env.production.example ~/saksi/web/.env.production
chmod 600 ~/saksi/web/.env.production
nano ~/saksi/web/.env.production      # lihat bagian Env. Jangan pernah commit file ini.
```

### 3. Build dan jalankan

```sh
~/saksi/deploy/deploy.sh main
```

Build pertama di VM ARM 2 vCPU butuh beberapa menit (install dependency + `next build`). Build berikutnya memakai cache layer Docker dan cache store pnpm, jadi lebih cepat kalau `pnpm-lock.yaml` tidak berubah.

### 4. Pasang site Caddy

```sh
~/saksi/deploy/caddy-install.sh --dry-run    # periksa diff yang dicetak
~/saksi/deploy/caddy-install.sh
```

`caddy-install.sh` hanya menambah `/etc/caddy/sites/saksi.caddy` dan, kalau belum ada, satu baris `import sites/*.caddy` di akhir `/etc/caddy/Caddyfile`. Blok situs lain tidak diubah. Config divalidasi di direktori staging dulu, lalu dipasang dengan backup bertanggal di `/etc/caddy/backups/`, divalidasi lagi, baru `systemctl reload caddy`. Kalau validate atau reload gagal, backup dikembalikan dan Caddy tetap memakai config lama.

Kalau CSP ternyata memblokir sesuatu di UI, pasang ulang dengan `--csp-report-only`. Setelah diperbaiki, jalankan lagi tanpa flag itu.

### 5. Cek semuanya

```sh
SAKSI_VM_IP=<ip-publik-vm> ~/saksi/deploy/preflight.sh     # harus READY
```

## Redeploy

```sh
~/saksi/deploy/deploy.sh main              # branch
~/saksi/deploy/deploy.sh v1.0-final        # tag
~/saksi/deploy/deploy.sh 3f2c1ab           # commit
~/saksi/deploy/deploy.sh --force main      # paksa build ulang
```

Yang terjadi:

1. `git fetch` lalu `git checkout --force --detach <ref>` di `~/saksi`. File yang di-ignore (`.env.production`, `deploy/.env`) tidak tersentuh. Edit lokal pada file yang di-track dibuang, dan script memberi peringatan.
2. Tag image = `<12 karakter commit>-<sidik jari nilai NEXT_PUBLIC_*>`, misalnya `saksi-web:4f6ce422a4dd-cb6b376f`. Nilai `NEXT_PUBLIC_*` yang dikirim sebagai build arg adalah setiap `ARG NEXT_PUBLIC_*` di `web/Dockerfile`, diambil dari `.env.production`. Kalau tag itu sudah ada, build dilewati.
3. `docker build` berjalan sementara container lama tetap melayani. Build gagal = source dikembalikan ke commit sebelumnya, container live tidak disentuh.
4. `docker compose up -d` dengan tag baru. Compose mengganti container (stop lama, start baru). Downtime sekitar 1–2 detik, dan Caddy menahan request selama itu (`lb_try_duration 15s`), jadi pengunjung tidak melihat 502.
5. Health check sampai 30 kali dengan jeda 2 detik: `GET /api/status` dengan header `x-demo-token` (token dari `.env.production`) harus HTTP 200 dengan JSON yang benar, dan status container harus `healthy`. Dengan `HEALTH_STRICT=1`, rpc, db, dan contracts juga harus hijau.
6. Tag aktif dan tag sebelumnya dicatat di `~/.local/state/saksi-deploy/{current,previous}`, riwayat di `~/.local/state/saksi-deploy/history`. Image `saksi-web` yang lebih lama dihapus, tiga yang paling baru di-deploy disimpan (ubah dengan `SAKSI_KEEP_IMAGES`). Image yang sedang dipakai dan image sebelumnya tidak pernah dihapus.

Script ini idempoten. Menjalankan ulang ref yang sama dengan nilai `NEXT_PUBLIC_*` yang sama tidak memicu build, hanya memastikan container hidup dan sehat. Kalau nilai `NEXT_PUBLIC_*` berubah, run berikutnya otomatis build ulang. `--force` selalu build, dengan tag baru `<tag>-<waktu UTC>`, supaya image lama tetap ada untuk rollback.

Kalau hanya env server (misalnya `AI_MODEL`) yang berubah, cukup buat ulang container:

```sh
cd ~/saksi/deploy && docker compose up -d --force-recreate web
```

Dua deploy tidak bisa jalan bersamaan (lock di `~/.local/state/saksi-deploy/`).

## Rollback

**Otomatis:**

- **Build gagal:** source dikembalikan ke commit sebelumnya. Situs live tidak pernah berhenti.
- **Health check gagal setelah ganti container:** 40 baris log terakhir container baru dicetak, source dikembalikan, tag sebelumnya dinyalakan lagi, lalu health check diulang. Image yang gagal disimpan untuk diperiksa. Exit code tetap 1.

**Manual** (satu langkah ke belakang, tanpa build, beberapa detik):

```sh
~/saksi/deploy/deploy.sh --rollback     # kembali ke image + commit sebelumnya
~/saksi/deploy/deploy.sh --rollback     # jalankan lagi = maju ke versi semula
```

Kalau image sebelumnya sudah terhapus, deploy ulang commit lama secara eksplisit: `deploy.sh <sha>` (script mencetak SHA-nya).

## Log dan perintah harian

`deploy.sh` menulis `~/saksi/deploy/.env` (tag yang sedang jalan dan path env file), jadi perintah compose biasa langsung jalan dari direktori itu:

```sh
cd ~/saksi/deploy
docker compose ps                       # status + (healthy)
docker compose logs -f --tail 100 web   # log aplikasi (json-file, dirotasi 3 x 10 MB)
docker compose restart web              # restart tanpa membaca ulang env file
docker compose up -d --force-recreate web   # restart dan baca ulang env file
docker stats saksi-web-1                # pemakaian memori (batas 1 GB)
```

## Env (`~/saksi/web/.env.production`)

Formatnya `KEY=value` polos, tanpa `export`. File ini dibaca oleh `docker compose` (`env_file`) saat container dibuat, dan oleh `deploy.sh` untuk build arg `NEXT_PUBLIC_*`. Compose mengekspansi `$VAR` di dalam nilai, jadi bungkus nilai yang mengandung `$` dengan tanda kutip tunggal (`KEY='va$lue'`); preflight memberi peringatan kalau ada. Mode file `600`.

| Variabel | Wajib | Isi |
|---|---|---|
| `NEXT_PUBLIC_RPC_PRIMARY` | ya | URL RPC Sepolia publik (terlihat di browser, tanpa API key rahasia). Origin-nya masuk CSP. |
| `NEXT_PUBLIC_RPC_SECONDARY` | opsional | RPC cadangan. |
| `NEXT_PUBLIC_RPC_TERTIARY` | opsional | RPC cadangan kedua. |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | ya | Alamat kontrak registry (Sepolia). |
| `NEXT_PUBLIC_JOURNAL_ADDRESS` | ya | Alamat kontrak journal. |
| `NEXT_PUBLIC_BREACH_ADDRESS` | ya | Alamat kontrak breach. |
| `NEXT_PUBLIC_DEPLOY_BLOCK` | ya | Nomor blok deployment kontrak (awal pemindaian log). |
| `NEXT_PUBLIC_SITE_URL` | tidak | Belum dibaca kode dan bukan build arg, jadi belum berpengaruh. |
| `DATABASE_URL` | ya | Connection string **Neon**. App memakai driver Neon HTTP, jadi Postgres biasa tidak bisa dipakai. |
| `SUBJECT_KEY` | ya | 64 karakter hex (`openssl rand -hex 32`). Kunci HMAC pseudonim subjek. Jangan diganti setelah ada data. |
| `DATA_KEY` | ya | 64 karakter hex. Kunci AES-256-GCM data terenkripsi. Jangan diganti setelah ada data. |
| `SESSION_SECRET` | ya | Minimal 32 byte (`openssl rand -hex 32`). |
| `DEMO_ADMIN_TOKEN` | ya | Token untuk `/api/status` dan `/api/demo/tamper`. Dibaca juga oleh `deploy.sh` dan `preflight.sh`. |
| `COOKIE_SECURE` | opsional | `true`/`false`. Kosong = ikuti `x-forwarded-proto` dari Caddy (benar untuk setup ini). |
| `AI_PROVIDER` | opsional | Label provider yang tampil di UI. Default: hostname `AI_BASE_URL`. |
| `AI_BASE_URL` | untuk AI | Endpoint yang kompatibel dengan OpenAI. |
| `AI_API_KEY` | untuk AI | API key provider. |
| `AI_MODEL` | untuk AI | Model utama. |
| `AI_FALLBACK_MODEL` | opsional | Model cadangan. |

`compose.yaml` sudah menyetel `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, dan `NODE_OPTIONS=--max-old-space-size=640`, dan nilai itu menang atas env file. Image menyetel `NEXT_TELEMETRY_DISABLED=1`.

## Checklist hari demo

**H-1**

- [ ] Deploy ref final, sebaiknya pakai tag: `git tag v1.0-final && git push origin v1.0-final`, lalu `deploy.sh v1.0-final`.
- [ ] `SAKSI_VM_IP=<ip> ~/saksi/deploy/preflight.sh` menampilkan **READY**, tanpa baris merah (rpc, db, ai, contracts semuanya PASS).
- [ ] Buka `https://saksiku.web.id` di jendela incognito. Console browser bersih dari error CSP.
- [ ] Wallet MetaMask demo sudah di jaringan Sepolia dan punya ETH (UI minta minimal 0.002).
- [ ] Data sintetis di Neon siap. Catat UUID catatan **Share with third party** untuk demo tamper (`scripts/tamper.sql` / `scripts/restore.sql`).
- [ ] Hafalkan perintah darurat: `deploy.sh --rollback`, `cd ~/saksi/deploy && docker compose restart web`, `docker compose logs -f --tail 100 web`.

**Hari H**

- [ ] Freeze: tidak ada deploy dalam 2 jam sebelum tampil.
- [ ] Jalankan preflight 60 menit sebelum tampil dan sekali lagi 10 menit sebelum tampil.
- [ ] Jangan tampilkan `DEMO_ADMIN_TOKEN` di layar, slide, atau URL. Cek status cukup lewat preflight.
- [ ] Siapkan tab Sepolia Etherscan untuk alamat tiga kontrak sebagai bukti on-chain.
- [ ] Setelah demo tamper, jalankan `scripts/restore.sql` dan cek Watch kembali normal.

## Troubleshooting

| Gejala | Cek |
|---|---|
| `deploy.sh` berhenti di "DEMO_ADMIN_TOKEN is empty" | Isi token di `.env.production`. |
| "cannot reach the Docker daemon" | `sudo usermod -aG docker ubuntu`, lalu login ulang. |
| Health check 403 | Token di `.env.production` beda dengan yang dibaca container. Setelah mengganti env: `docker compose up -d --force-recreate web`. |
| Health check 000 / container `starting` terus | `docker compose logs --tail 100 web`. Port 3400 bentrok? `preflight.sh` (baris `port 3400`) atau `sudo ss -ltnp 'sport = :3400'`. |
| Container `unhealthy` | `docker inspect --format '{{json .State.Health}}' saksi-web-1`. Healthcheck image memanggil `/api/status` tanpa token dan mengharapkan 403. |
| Build kehabisan memori atau disk | `docker system df`; hapus cache build lama dengan `docker builder prune --filter until=168h` (ingat: cache build dipakai bersama stack lain). |
| Sertifikat tidak terbit | Cloudflare harus DNS only. Cek `journalctl -u caddy -n 100`. |

## Catatan teknis

- `web/next.config.mjs` memakai `output: 'standalone'` dan `outputFileTracingRoot` = `web/`, jadi `server.js` selalu ada di `.next/standalone/server.js`. `next build` tanpa env tetap berhasil; semua secret dibaca saat runtime.
- `NEXT_PUBLIC_*` di-inline ke bundle browser **dan** server saat build (kode server sengaja membaca `process.env.NEXT_PUBLIC_*` secara literal). Karena itu nilainya menjadi build arg dan bagian dari tag image, bukan env runtime. Kalau kode mulai membaca `NEXT_PUBLIC_*` baru, tambahkan `ARG`-nya di `web/Dockerfile`; `deploy.sh` mengikuti daftar itu otomatis.
- Branch ini belum punya halaman, jadi `/` menjawab 404. `HEALTHCHECK` di image memanggil `/api/status` tanpa token dan menunggu 403: jawaban itu hanya muncul setelah modul route ter-load, tanpa menyentuh database, RPC, atau AI, dan tanpa secret.
- Container berjalan sebagai `node` (uid 1000) dengan rootfs read-only. File aplikasi milik root; yang bisa ditulis hanya tmpfs `/tmp` dan `/app/.next/cache`.
- Image tidak arch-specific di Dockerfile: `node:22-alpine` multi-arch, dan pnpm memasang binary SWC/Turbopack musl yang sesuai platform build. Build di VM menghasilkan image `linux/arm64`.
- Caddy menimpa `X-Forwarded-For` dengan IP klien asli (tidak ada trusted proxy, karena Cloudflare DNS only), dan rate limit di API memakai header itu.

## AI on the same VM

To use an OpenAI-compatible service running on the VM (for example on port 20128), set
`AI_BASE_URL=http://host.docker.internal:20128/v1` and allow only the saksi network to reach it,
before any DROP rule for that port:

```sh
sudo iptables -I INPUT 1 -s 172.31.250.0/24 -p tcp --dport 20128 -j ACCEPT
```

The rule does not survive a reboot unless saved (netfilter-persistent). Remove it with the same
command using `-D` instead of `-I INPUT 1`.
