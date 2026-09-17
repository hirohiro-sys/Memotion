export function apiFetch(input: string, init?: RequestInit) {
  return fetch(input, { ...init, credentials: "include" });
}
