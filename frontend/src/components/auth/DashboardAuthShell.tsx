"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/authSession";
import { useWalletStore } from "@/store/useWalletStore";

const AUTH_KEY = "codechroma.auth.session";

export function DashboardAuthShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!getAccessToken()) {
        if (!cancelled) router.replace("/login");
        return;
      }
      await useWalletStore.getState().fetchWallet();
      if (!cancelled) setChecking(false);
    };

    void boot();

    function onStorage(e: StorageEvent) {
      if (e.key !== AUTH_KEY) return;
      if (e.newValue === null) {
        useWalletStore.getState().resetWallet();
        router.replace("/login");
      }
    }

    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
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
