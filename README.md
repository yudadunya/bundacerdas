# 🍳 BundaCerdas

> Teman pintar untuk ibu rumah tangga Indonesia — fitur "Mau Masak Apa?" berbasis AI.

---

## 🚀 Setup & Deploy (Step by Step)

### 1. Persiapan Project

```bash
git clone <your-repo>
cd bundacerdas
npm install
cp .env.local.example .env.local
```

---

### 2. Setup Supabase

1. Buat akun di [supabase.com](https://supabase.com) → **New Project**
2. Setelah project jadi, pergi ke **Settings → API**
3. Copy:
   - `Project URL` → isi ke `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → isi ke `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Aktifkan Google OAuth di Supabase:
1. Pergi ke **Authentication → Providers → Google**
2. Toggle **Enable Google Provider**
3. Buka [Google Cloud Console](https://console.cloud.google.com)
4. Buat project → **APIs & Services → Credentials → Create OAuth Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
5. Copy **Client ID** dan **Client Secret** ke Supabase Google Provider
6. Di Supabase → **Authentication → URL Configuration**, tambahkan:
   - Site URL: `https://your-vercel-domain.vercel.app`
   - Redirect URLs: `https://your-vercel-domain.vercel.app/auth/callback`

---

### 3. Setup Anthropic API

1. Buat akun di [console.anthropic.com](https://console.anthropic.com)
2. Pergi ke **Settings → API Keys → Create Key**
3. Copy ke `ANTHROPIC_API_KEY` di `.env.local`

> 💡 Model yang dipakai: `claude-sonnet-4-6` — pintar, cepat, dan hemat biaya.

---

### 4. Jalankan Lokal

```bash
npm run dev
# Buka http://localhost:3000
```

---

### 5. Deploy ke Vercel

1. Push code ke GitHub
2. Buka [vercel.com](https://vercel.com) → **New Project** → import repo
3. Di **Environment Variables**, tambahkan:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ANTHROPIC_API_KEY=...
   ```
4. Klik **Deploy** 🎉

---

## 📁 Struktur Project

```
src/
├── app/
│   ├── page.tsx              # Landing page + Google login
│   ├── dashboard/page.tsx    # Halaman utama setelah login
│   ├── auth/callback/        # OAuth callback handler
│   └── api/resep/route.ts    # API endpoint ke OpenAI
├── components/
│   └── ResepForm.tsx         # Komponen input bahan + hasil resep
└── lib/supabase/
    ├── client.ts             # Supabase browser client
    └── server.ts             # Supabase server client
```

---

## 🔧 Tech Stack

| Teknologi | Kegunaan |
|-----------|----------|
| Next.js 14 | Framework (App Router) |
| Supabase | Auth + Database |
| Anthropic Claude Sonnet | AI resep |
| Tailwind CSS | Styling |
| Vercel | Hosting |

---

## 📈 Roadmap

- [ ] Simpan riwayat resep yang sudah dicari
- [ ] Fitur Atur Uang Belanja
- [ ] Fitur Ide Jualan
- [ ] Push notification pengingat masak
- [ ] Premium plan Rp19.000/bulan
