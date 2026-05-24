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

  if (!user) return null;

  const nama = user.user_metadata?.full_name?.split(" ")[0] ?? "Bunda";
  const avatar = user.user_metadata?.avatar_url;

  return (
    <main style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "#e5ddd5",
    }}>
      <ResepForm
        userName={nama}
        userAvatar={avatar}
        onLogout={async () => {
          await supabase.auth.signOut();
          router.replace("/");
        }}
      />
    </main>
  );
}
