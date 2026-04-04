/**
 * Interpreta números no estilo brasileiro (1.234,56) ou simples (1234,56 / 1234.56).
 * Retorna NaN se inválido.
 */
export function parseLocaleNumber(raw: string): number {
  let s = raw.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!s) return NaN;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Último separador define o decimal: 1.234,56 → BR; 1,234.56 → US
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    const last = parts[parts.length - 1] ?? "";
    if (
      parts.length > 1 &&
      last.length === 3 &&
      /^\d{3}$/.test(last) &&
      /^\d+$/.test(parts.join(""))
    ) {
      s = parts.join("");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
