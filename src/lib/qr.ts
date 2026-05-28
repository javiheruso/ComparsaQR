export function extractQrToken(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  try {
    const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(trimmed, baseUrl);
    const token = url.searchParams.get("token");

    if (token) return token.trim() || null;
  } catch {
    // If it is not a URL, treat the scanned text as a raw token.
  }

  return trimmed.length <= 200 ? trimmed : null;
}
