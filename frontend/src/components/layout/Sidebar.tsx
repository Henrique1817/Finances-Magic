"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutLocal } from "@/lib/authApi";
import { useWalletStore } from "@/store/useWalletStore";

const nav = [
  { href: "/", label: "Início" },
  { href: "/#carteira", label: "Carteira" },
  { href: "/simulator", label: "Simulador" },
];

type Props = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: Props) {
  const pathname = usePathname();

  function signOut() {
    onNavigate?.();
    useWalletStore.getState().resetWallet();
    logoutLocal();
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-slate-950/40 px-4 py-6 backdrop-blur-xl">
      <div className="mb-10 px-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400/70">
          Code Chroma
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-white">
          Risk OS
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href.startsWith("/#")
                ? false
                : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-gradient-to-r from-cyan-500/20 to-violet-500/15 text-white shadow-neon"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3 px-2">
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-slate-400 transition hover:border-rose-400/25 hover:bg-rose-500/10 hover:text-rose-200"
        >
          Sair
        </button>
        <p className="text-[11px] leading-relaxed text-slate-600">
          Proteção de patrimônio · cenários macro
        </p>
      </div>
    </aside>
  );
}
