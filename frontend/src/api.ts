export const API =
  (import.meta as unknown as { env: { VITE_API_URL?: string } }).env
    .VITE_API_URL || "/api";
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(API + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    signal: options?.signal || AbortSignal.timeout(45000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
