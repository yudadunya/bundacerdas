"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/dashboard");
      else setChecking(false);
    });
  }, []);

  async function loginWithGoogle() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  }

  if (checking) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-200 rounded-full opacity-30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sage-200 rounded-full opacity-30 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm text-center animate-fade-up">
        {/* Logo / Emoji */}
        <div className="text-7xl mb-4 select-none">🍳</div>

        <h1 className="font-display text-4xl text-brand-700 mb-2 leading-tight">
          BundaCerdas
        </h1>
        <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-2">
          BundaCerdas
        </p>
        <p className="text-gray-500 text-sm mb-6">
          Teman ngobrol masak sehari-hari 🥘
        </p>

        <p className="text-gray-600 mb-10 leading-relaxed">
          Bingung masak apa hari ini? Cukup ceritakan bahan yang ada di dapur,
          Bunda langsung dapat ide resep hemat & praktis! ✨
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {["🥦 Resep dari bahan ada", "⏱️ Estimasi waktu masak", "💰 Perkiraan biaya"].map((f) => (
            <span key={f} className="tag">{f}</span>
          ))}
        </div>

        {/* Google Login Button */}
        <button
          onClick={loginWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-brand-200
                     hover:border-brand-400 hover:bg-brand-50 text-gray-700 font-semibold
                     px-6 py-3.5 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {loading ? "Sedang masuk..." : "Masuk dengan Google"}
        </button>

        <p className="text-xs text-gray-400 mt-4">
          Gratis · Tidak perlu password · Aman
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
