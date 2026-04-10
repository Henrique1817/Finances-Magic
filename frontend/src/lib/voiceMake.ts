export function normalizaSpeech(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasWakePhrase(input: string): boolean {
  const t = normalizaSpeech(input);
  return (
    t.includes("hey magic") ||
    t.includes("ei magic") ||
    t.includes("e magic") ||
    t.includes("hey magik")
  );
}
