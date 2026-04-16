/**
 * Arredonda instante UTC ao bucket de `intervalMs` (ex.: 30 min).
 */
export function floorUtcToIntervalMs(d: Date, intervalMs: number): Date {
  const t = d.getTime();
  const floored = Math.floor(t / intervalMs) * intervalMs;
  return new Date(floored);
}
