/**
 * Minimal JWT decoder (no verification — that's the backend's job)
 */
export function jwtDecode(token: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}
