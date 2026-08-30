# Better Auth + Express + Supabase (Postgres)

Backend Express.js siap-produksi dengan autentikasi [Better Auth](https://www.better-auth.com)
(email/password + Google & GitHub OAuth), database PostgreSQL di Supabase, dan
Docker multi-stage build.

## Stack

- **Runtime**: Node.js 24 LTS, TypeScript (ESM)
- **Framework**: Express 5
- **Auth**: Better Auth — adapter Kysely bawaan (tanpa ORM tambahan)
- **Database**: PostgreSQL (Supabase)
- **Container**: Docker multi-stage, non-root user, healthcheck

## Struktur Proyek

```
src/
  lib/
    db.ts        # Pool koneksi pg bersama (dipakai Better Auth & query lain)
    auth.ts      # Instance Better Auth (email/password + Google/GitHub)
  middleware/
    error-handler.ts
  routes/
    health.ts    # GET /health -> ping DB
    me.ts        # GET /api/me -> contoh route terproteksi (session)
  app.ts         # Setup Express app (CORS, mount Better Auth, routes)
  server.ts      # Entrypoint + graceful shutdown
Dockerfile
docker-compose.yml
.env.example
```

## 1. Setup Database di Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **Project Settings > Database > Connection string**, pilih tab
   **Session pooler** (bukan Direct connection, bukan Transaction pooler).
   Untuk container long-lived seperti ini, Session pooler (port `5432`)
   paling aman: IPv4-friendly dan mendukung prepared statement.
   - Pakai **Transaction pooler** (port `6543`) hanya kalau nanti kamu
     scale service ini ke banyak replica sekaligus.
3. Salin connection string-nya ke `DATABASE_URL` di file `.env` (lihat
   langkah 2).

## 2. Konfigurasi Environment

```bash
cp .env.example .env
```

Isi minimal yang wajib diisi:

- `DATABASE_URL` — connection string Supabase dari langkah 1.
- `BETTER_AUTH_SECRET` — generate dengan:
  ```bash
  npm install
  npm run auth:secret
  ```
- `BETTER_AUTH_URL` — URL publik API ini (mis. `https://api.domainkamu.com`,
  atau `http://localhost:3000` saat development).
- `TRUSTED_ORIGINS` — origin frontend yang boleh memanggil API ini
  (comma-separated), mis. `https://app.domainkamu.com`.

`GOOGLE_CLIENT_ID/SECRET` dan `GITHUB_CLIENT_ID/SECRET` boleh dikosongkan
dulu — provider terkait otomatis nonaktif sampai kredensialnya diisi
(lihat `src/lib/auth.ts`). Saat siap:

- **Google**: buat OAuth Client ID di Google Cloud Console, set Authorized
  redirect URI ke `{BETTER_AUTH_URL}/api/auth/callback/google`.
- **GitHub**: buat OAuth App di GitHub Developer Settings, set Authorization
  callback URL ke `{BETTER_AUTH_URL}/api/auth/callback/github`.

## 3. Migrasi Schema Better Auth

Better Auth generate & apply schema-nya sendiri (tabel `user`, `session`,
`account`, `verification`) lewat CLI resmi `auth` (paket pengganti
`@better-auth/cli` yang sudah deprecated):

```bash
npm install

# Lihat rencana perubahan schema dulu (read-only)
npm run auth:migrate
```

Jalankan ulang `auth:migrate` setiap kali menambah plugin
Better Auth baru.

## 4. Development Lokal

```bash
npm install
npm run dev
```

Server jalan di `http://localhost:3000`. Cek cepat:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/auth/ok   # { "status": "ok" } dari Better Auth
```

Endpoint auth utama (dipakai lewat Better Auth client di frontend, bukan
manual): `/api/auth/sign-up/email`, `/api/auth/sign-in/email`,
`/api/auth/sign-in/social`, `/api/auth/sign-out`, `/api/auth/get-session`,
dll — daftar lengkap di [dokumentasi Better Auth](https://www.better-auth.com/docs/concepts/api).

## 5. Build & Jalankan dengan Docker

```bash
# pastikan .env sudah terisi (langkah 2)
docker compose up --build -d

docker compose logs -f api
docker compose ps        # cek status healthcheck
```

Dockerfile menggunakan multi-stage build (`deps` → `build` → `prod-deps` →
`runtime`) supaya image final hanya berisi `node_modules` production dan
hasil kompilasi `dist/`, jalan sebagai non-root user, dan punya
`HEALTHCHECK` bawaan yang mem-ping `/health`.

Untuk deploy ke server (VPS, dsb.) tanpa registry:

```bash
docker compose build
docker save better-auth-express-app:latest | gzip > app.tar.gz
# di server:
docker load < app.tar.gz
docker compose up -d
```

## Catatan Produksi

- **Secret**: jangan commit `.env`. Di server, isi env var lewat secret
  manager platform kamu (mis. Docker secrets, Vault, atau env var provider
  hosting) — `docker-compose.yml` di sini membacanya dari `.env` untuk
  kesederhanaan.
- **HTTPS**: taruh reverse proxy (Nginx/Caddy/Traefik) di depan container
  ini untuk TLS. `app.set("trust proxy", 1)` di `app.ts` sudah disiapkan
  supaya Express membaca IP & protokol asli dari header
  `X-Forwarded-*`.
- **Cookie aman**: `advanced.useSecureCookies` otomatis `true` saat
  `NODE_ENV=production`, jadi cookie session hanya dikirim lewat HTTPS.
- **Rate limiting**: sudah aktif (`rateLimit.enabled: true`, default 100
  request/60 detik per IP) untuk endpoint Better Auth. Sesuaikan di
  `src/lib/auth.ts` kalau perlu limit lebih ketat untuk
  `/sign-in`/`/sign-up`.
- **Connection pool**: satu `pg.Pool` dipakai bersama oleh Better Auth dan
  query lain (`src/lib/db.ts`) supaya tidak boros koneksi ke Supabase.
  Sesuaikan `DATABASE_POOL_MAX` dengan quota koneksi paket Supabase kamu.
- **Graceful shutdown**: `server.ts` menangkap `SIGTERM`/`SIGINT`, berhenti
  menerima request baru, lalu menutup pool koneksi sebelum exit — penting
  supaya `docker stop` / rolling deploy tidak memutus request yang sedang
  berjalan.
- **Email verification**: `requireEmailVerification` masih `false` di
  `src/lib/auth.ts` karena belum ada provider pengirim email yang
  dikonfigurasi. Aktifkan setelah menambahkan konfigurasi `email` sesuai
  [dokumentasi Better Auth](https://www.better-auth.com/docs/concepts/email).

## Menambah Route Terproteksi

Pola di `src/routes/me.ts` bisa dipakai ulang di route lain:

```ts
const session = await auth.api.getSession({
  headers: fromNodeHeaders(req.headers),
});
if (!session) return res.status(401).json({ error: "Unauthorized" });
```
