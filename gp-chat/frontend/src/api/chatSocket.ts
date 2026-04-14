export type Inbound =
  | { type: 'user_message'; personaId: string; content: string; providerId: string; modelId: string }
  | { type: 'demo_message'; personaIds: string[]; content: string; providerId: string; modelId: string }
  | { type: 'reset'; personaId: string };

export type Outbound =
  | { type: 'assistant_delta'; personaId: string; text: string }
  | { type: 'assistant_done'; personaId: string }
  | { type: 'tool_call_start'; personaId: string; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_call_result'; personaId: string; id: string; status: 'success' | 'error' | 'denied'; result: unknown }
  | { type: 'auth_required'; personaId: string }
  | { type: 'error'; personaId: string; code: string; message: string };

export function openSocket(onEvent: (e: Outbound) => void) {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/chat/ws/chat`);
  ws.onmessage = m => onEvent(JSON.parse(m.data));
  return ws;
}
