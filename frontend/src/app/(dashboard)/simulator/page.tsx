import Link from "next/link";
import { SimulatorPanel } from "@/components/simulator/SimulatorPanel";

export default function SimulatorPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
            Stress test
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
            Simulador de caos
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Parâmetros alinhados ao endpoint{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-cyan-200">
              POST /api/v1/simulation/run
            </code>
            .
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
        >
          ← Painel
        </Link>
      </div>

      <SimulatorPanel />
    </div>
  );
}
