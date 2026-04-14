export function openSocket(onEvent) {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/chat/ws/chat`);
    ws.onmessage = m => onEvent(JSON.parse(m.data));
    return ws;
}
