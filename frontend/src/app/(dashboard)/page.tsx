import { WalletPanel } from "@/components/wallet/WalletPanel";
import { AiAccuracyRealtimeCard } from "@/components/dashboard/AiAccuracyRealtimeCard";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <section className="glass-panel p-6 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/80">
          Visão geral
        </p>
        <h2 className="mt-2 bg-gradient-to-r from-cyan-200 via-white to-violet-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
          Simulador global de risco
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
          Monitore a carteira local, com persistência no navegador. Na próxima
          fase, o painel de stress test usará estes dados para projetar
          patrimônio sob cenários macro.
        </p>
      </section>

      <AiAccuracyRealtimeCard />
      <WalletPanel />
    </div>
  );
}
