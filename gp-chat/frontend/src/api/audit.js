export function openAuditStream(onEvent) {
    const src = new EventSource('/chat/api/audit/stream');
    src.addEventListener('audit', m => onEvent(JSON.parse(m.data)));
    return src;
}
