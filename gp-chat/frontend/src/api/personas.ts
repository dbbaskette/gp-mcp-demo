export type Persona = { id: string; label: string; description: string };
export type PersonaInfo = { id: string; loggedIn: boolean; expiresAt?: string; claims?: Record<string, unknown> };

export async function listPersonas(): Promise<Persona[]> {
  const r = await fetch('/chat/api/personas'); return r.json();
}
export async function getPersona(id: string): Promise<PersonaInfo> {
  const r = await fetch(`/chat/api/persona/${id}`); return r.json();
}
export function loginUrl(id: string) { return `/chat/api/persona/${id}/login`; }
export async function logout(id: string) { await fetch(`/chat/api/persona/${id}/logout`, { method: 'POST' }); }
