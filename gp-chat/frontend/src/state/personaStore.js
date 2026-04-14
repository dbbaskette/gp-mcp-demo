import { create } from 'zustand';
export const usePersonas = create((set) => ({
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
        const id = ev.personaId;
        if (!id)
            return;
        set(s => {
            const slot = s.slots[id] ?? { messages: [], pendingCalls: [] };
            const msgs = [...slot.messages];
            const last = msgs[msgs.length - 1];
            if (ev.type === 'assistant_delta' && last?.role === 'assistant')
                last.text += ev.text;
            if (ev.type === 'assistant_done' && last?.role === 'assistant')
                last.done = true;
            if (ev.type === 'tool_call_start' && last?.role === 'assistant')
                last.toolCalls.push({ id: ev.id, name: ev.name, args: ev.args, status: 'pending' });
            if (ev.type === 'tool_call_result' && last?.role === 'assistant') {
                const tc = last.toolCalls.find(t => t.id === ev.id);
                if (tc) {
                    tc.status = ev.status;
                    tc.result = ev.result;
                }
            }
            if (ev.type === 'auth_required')
                slot.info = { id, loggedIn: false };
            return { slots: { ...s.slots, [id]: { ...slot, messages: msgs } } };
        });
    }
}));
