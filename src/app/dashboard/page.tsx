"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ResepForm from "@/components/ResepForm";

type User = { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } };

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/");
      else setUser(user);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (!user) return null;

  const nama = user.user_metadata?.full_name?.split(" ")[0] ?? "Bunda";
  const avatar = user.user_metadata?.avatar_url;

  return (
    <main className="min-h-screen px-4 py-8 max-w-xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-gray-500 text-sm">Selamat datang,</p>
          <h1 className="font-display text-2xl text-brand-700">
            {nama} 👋
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={nama} className="w-9 h-9 rounded-full ring-2 ring-brand-200" />
          )}
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-brand-600 transition-colors"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Hero card */}
      <div className="card bg-gradient-to-br from-brand-500 to-brand-600 text-white mb-6 border-0">
        <div className="flex items-start gap-4">
          <span className="text-5xl">🍳</span>
          <div>
            <h2 className="font-display text-xl mb-1">Apa Kabar?</h2>
            <p className="text-brand-100 text-sm leading-relaxed">
              Silakan Chat aja ya!
            </p>
          </div>
        </div>
      </div>

      {/* Main feature */}
      <ResepForm />
    </main>
  );
}
