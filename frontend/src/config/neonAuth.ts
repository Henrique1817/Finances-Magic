export function getNeonAuthUrl(): string {
  const raw = process.env.NEXT_PUBLIC_NEON_AUTH_URL?.trim() ?? "";
  return raw.replace(/\/$/, "");
}
