import { WalletPanel } from "@/components/wallet/WalletPanel";
import { AiAccuracyRealtimeCard } from "@/components/dashboard/AiAccuracyRealtimeCard";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8 md:space-y-10">
      <section className="glass-panel p-4 sm:p-6 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/80">
          Visão geral
        </p>
        <h2 className="mt-2 bg-gradient-to-r from-cyan-200 via-white to-violet-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl md:text-4xl">
          Simulador global de risco
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base md:text-lg">
          A carteira mostra o último preço ingerido por ativo e o valor de mercado (preço ×
          quantidade). O simulador usa o mesmo total para cenários e stress test.
        </p>
      </section>

      <AiAccuracyRealtimeCard />
      <WalletPanel />
    </div>
  );
}
