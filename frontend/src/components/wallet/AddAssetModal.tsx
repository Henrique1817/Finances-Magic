"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import {
  useWalletStore,
  type SetorAtivo,
} from "@/store/useWalletStore";
import { supabase } from "@/lib/supabaseClient";
import { parseLocaleNumber } from "@/lib/parseLocaleNumber";
import { AssetLiveSearch, type CatalogAsset } from "@/components/AssetLiveSearch";

const SETORES: SetorAtivo[] = ["Tech", "Mineração", "Energia"];

function mapCatalogCategoryToSetor(category: string): SetorAtivo {
  const c = category.trim().toLowerCase();
  if (c === "commodities") return "Mineração";
  if (c === "energia") return "Energia";
  if (c === "tech" || c === "index") return "Tech";
  return "Tech";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddAssetModal({ open, onOpenChange }: Props) {
  const saveAssetToDb = useWalletStore((s) => s.saveAssetToDb);
  const formId = useId();
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState<SetorAtivo>("Tech");
  const [valor, setValor] = useState("");
  const [qtd, setQtd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedCatalogAssetId, setSelectedCatalogAssetId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function reset() {
    setNome("");
    setSetor("Tech");
    setValor("");
    setQtd("");
    setError(null);
    setSelectedCatalogAssetId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const v = parseLocaleNumber(valor);
    const q = parseLocaleNumber(qtd);
    if (!nome.trim()) {
      setError("Informe o nome do ativo.");
      return;
    }
    if (!Number.isFinite(v) || v < 0) {
      setError(
        "Valor investido inválido. Use números como 1500 ou 1.500,50 (formato brasileiro).",
      );
      return;
    }
    if (!Number.isFinite(q) || q <= 0) {
      setError("Quantidade deve ser maior que zero (ex.: 1 ou 10,5).");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError(
        "Sem sessão ativa. Aguarde o carregamento ou faça login novamente para guardar posições.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveAssetToDb({
        nome: nome.trim(),
        setor,
        valorInvestido: v,
        quantidade: q,
        assetId: selectedCatalogAssetId ?? undefined,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar no servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Fechar modal"
        onClick={() => onOpenChange(false)}
      />
      <div className="glass-modal relative z-10 w-full max-w-md p-6 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2
              id={`${formId}-title`}
              className="text-lg font-semibold tracking-tight text-white"
            >
              Nova posição
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              A posição é gravada na sua carteira no servidor (autenticado).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Catálogo global
            </span>
            <AssetLiveSearch
              onSelectAsset={(a: CatalogAsset) => {
                setNome(`${a.symbol} — ${a.name}`);
                setSetor(mapCatalogCategoryToSetor(a.category));
                setSelectedCatalogAssetId(a.id);
              }}
              placeholder="Ex.: NVDA, Apple, ouro…"
            />
            <p className="mt-1 text-[11px] text-slate-600">
              Opcional: preenche o nome e o setor; liga a posição ao ativo no simulador.
            </p>
          </div>

          <div>
            <label
              htmlFor={`${formId}-nome`}
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Ativo
            </label>
            <input
              id={`${formId}-nome`}
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setSelectedCatalogAssetId(null);
              }}
              placeholder="Ex.: PETR4, BTC, fundo X"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2"
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-setor`}
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Setor
            </label>
            <select
              id={`${formId}-setor`}
              value={setor}
              onChange={(e) => setSetor(e.target.value as SetorAtivo)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 focus:border-cyan-400/40 focus:ring-2"
            >
              {SETORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${formId}-valor`}
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
              >
                Valor investido (R$)
              </label>
              <input
                id={`${formId}-valor`}
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2"
              />
              <p className="mt-1 text-[11px] text-slate-600">
                Aceita formato brasileiro (ex.: 1.500,00).
              </p>
            </div>
            <div>
              <label
                htmlFor={`${formId}-qtd`}
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
              >
                Quantidade
              </label>
              <input
                id={`${formId}-qtd`}
                inputMode="decimal"
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                placeholder="1"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2"
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500/90 to-violet-500/90 px-4 py-2.5 text-sm font-medium text-slate-950 shadow-neon transition enabled:hover:from-cyan-400 enabled:hover:to-violet-400 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Adicionar à carteira"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
