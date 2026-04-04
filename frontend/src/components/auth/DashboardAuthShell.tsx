"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useWalletStore } from "@/store/useWalletStore";

export function DashboardAuthShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      await useWalletStore.getState().fetchWallet();
      if (!cancelled) setChecking(false);
    };

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT" || !session) {
        useWalletStore.getState().resetWallet();
        router.replace("/login");
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await useWalletStore.getState().fetchWallet();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-panel px-8 py-6 text-center">
          <p className="text-sm font-medium text-slate-300">Autenticando…</p>
          <p className="mt-1 text-xs text-slate-500">Sincronizando carteira</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
