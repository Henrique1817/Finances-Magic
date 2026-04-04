"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { getApiBaseUrl } from "@/config/api";

export type CatalogAsset = {
  id: string;
  symbol: string;
  name: string;
  category: string;
  type: string;
};

type SearchSuccess = {
  success: true;
  data: { results: CatalogAsset[] };
};

type Props = {
  onSelectAsset: (asset: CatalogAsset) => void;
  placeholder?: string;
  className?: string;
};

function categoryBadgeClass(category: string): string {
  const c = category.trim().toLowerCase();
  if (c === "tech")
    return "border-violet-400/35 bg-violet-500/15 text-violet-200";
  if (c === "commodities")
    return "border-orange-400/35 bg-orange-500/15 text-orange-200";
  if (c === "index")
    return "border-cyan-400/35 bg-cyan-500/15 text-cyan-200";
  if (c === "energia")
    return "border-amber-400/35 bg-amber-500/15 text-amber-100";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

export function AssetLiveSearch({
  onSelectAsset,
  placeholder = "Buscar por ticker ou nome…",
  className = "",
}: Props) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm] = useDebounce(searchTerm, 300);
  const [results, setResults] = useState<CatalogAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = debouncedTerm.trim();
    if (t.length < 2) {
      setResults([]);
      setFetchError(null);
      setIsLoading(false);
      return;
    }

    const ac = new AbortController();
    void (async () => {
      setIsLoading(true);
      setFetchError(null);
      const url = `${getApiBaseUrl()}/api/v1/assets/search?${new URLSearchParams({ q: t }).toString()}`;
      try {
        const res = await fetch(url, {
          signal: ac.signal,
          headers: { Accept: "application/json" },
        });
        if (ac.signal.aborted) return;
        const json = (await res.json()) as SearchSuccess | { success?: false; error?: string };
        if (ac.signal.aborted) return;
        if (!res.ok) {
          const msg =
            typeof json === "object" && json && "error" in json && typeof json.error === "string"
              ? json.error
              : `HTTP ${res.status}`;
          throw new Error(msg);
        }
        if (!json.success || !json.data?.results) {
          setResults([]);
          return;
        }
        setResults(json.data.results);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        if (ac.signal.aborted) return;
        setResults([]);
        setFetchError(e instanceof Error ? e.message : "Erro na busca.");
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [debouncedTerm]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const showDropdown =
    open && searchTerm.trim().length >= 2 && (isLoading || results.length > 0 || fetchError);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        Buscar ativo no catálogo
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-slate-950/45 px-4 py-2.5 pr-11 text-sm text-white shadow-inner outline-none ring-cyan-400/30 backdrop-blur-md placeholder:text-slate-600 focus:border-cyan-400/35 focus:ring-2"
        />
        <div className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center">
          {isLoading ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400/25 border-t-cyan-400"
              aria-hidden
            />
          ) : (
            <span className="text-slate-600" aria-hidden>
              ⌕
            </span>
          )}
        </div>
      </div>

      {showDropdown ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-white/10 bg-slate-950/90 py-1 shadow-glass backdrop-blur-xl"
          role="listbox"
        >
          {fetchError ? (
            <p className="px-3 py-2 text-xs text-rose-300">{fetchError}</p>
          ) : isLoading ? (
            <p className="px-3 py-2 text-xs text-slate-500">A procurar…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">Sem resultados.</p>
          ) : (
            results.map((asset) => (
              <button
                key={asset.id}
                type="button"
                role="option"
                className="flex w-full flex-col gap-1 border-b border-white/5 px-3 py-2.5 text-left last:border-0 hover:bg-white/5"
                onClick={() => {
                  onSelectAsset(asset);
                  setSearchTerm("");
                  setResults([]);
                  setOpen(false);
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{asset.symbol}</span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${categoryBadgeClass(asset.category)}`}
                  >
                    {asset.category}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{asset.name}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
