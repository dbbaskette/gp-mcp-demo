export function openAuditStream(onEvent: (e: unknown) => void) {
  const src = new EventSource('/chat/api/audit/stream');
  src.addEventListener('audit', m => onEvent(JSON.parse((m as MessageEvent).data)));
  return src;
}
