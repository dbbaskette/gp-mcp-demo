import { create } from 'zustand';
import type { Persona, PersonaInfo } from '../api/personas';
import type { Outbound } from '../api/chatSocket';

export type Bubble =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; done: boolean; toolCalls: ToolCall[] };
export type ToolCall = { id: string; name: string; args: unknown; status?: 'pending' | 'success' | 'error' | 'denied'; result?: unknown };

type SlotState = { info?: PersonaInfo; messages: Bubble[]; pendingCalls: ToolCall[] };

interface S {
  personas: Persona[];
  slots: Record<string, SlotState>;
  setPersonas: (p: Persona[]) => void;
  setInfo: (id: string, info: PersonaInfo) => void;
  appendUser: (id: string, text: string) => void;
  onEvent: (ev: Outbound) => void;
}

export const usePersonas = create<S>((set) => ({
  personas: [],
  slots: {},
  setPersonas: (p) => set({ personas: p }),
  setInfo: (id, info) => set(s => ({ slots: { ...s.slots, [id]: { ...(s.slots[id] ?? { messages: [], pendingCalls: [] }), info } } })),
  appendUser: (id, text) => set(s => ({
    slots: { ...s.slots, [id]: {
      ...(s.slots[id] ?? { messages: [], pendingCalls: [] }),
      messages: [...(s.slots[id]?.messages ?? []), { role: 'user', text }, { role: 'assistant', text: '', done: false, toolCalls: [] }]
    } }
  })),
  onEvent: (ev) => {
    const id = ev.personaId; if (!id) return;
    set(s => {
      const slot = s.slots[id] ?? { messages: [], pendingCalls: [] };
      const msgs = [...slot.messages];
      const last = msgs[msgs.length - 1];
      if (ev.type === 'assistant_delta' && last?.role === 'assistant') last.text += ev.text;
      if (ev.type === 'assistant_done'  && last?.role === 'assistant') last.done = true;
      if (ev.type === 'tool_call_start' && last?.role === 'assistant') last.toolCalls.push({ id: ev.id, name: ev.name, args: ev.args, status: 'pending' });
      if (ev.type === 'tool_call_result' && last?.role === 'assistant') {
        const tc = last.toolCalls.find(t => t.id === ev.id); if (tc) { tc.status = ev.status; tc.result = ev.result; }
      }
      if (ev.type === 'auth_required') slot.info = { id, loggedIn: false };
      return { slots: { ...s.slots, [id]: { ...slot, messages: msgs } } };
    });
  }
}));
