export async function listPersonas() {
    const r = await fetch('/chat/api/personas');
    return r.json();
}
export async function getPersona(id) {
    const r = await fetch(`/chat/api/persona/${id}`);
    return r.json();
}
export function loginUrl(id) { return `/chat/api/persona/${id}/login`; }
export async function logout(id) { await fetch(`/chat/api/persona/${id}/logout`, { method: 'POST' }); }
