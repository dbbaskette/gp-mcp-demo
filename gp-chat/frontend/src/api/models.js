export async function listProviders() {
    const r = await fetch('/chat/api/models');
    return r.json();
}
