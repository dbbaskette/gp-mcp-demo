export type Provider = { id: string; models: string[] };
export async function listProviders(): Promise<Provider[]> {
  const r = await fetch('/chat/api/models'); return r.json();
}
