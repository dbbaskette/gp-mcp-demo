import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import ConversationPane from './ConversationPane';
import ModelPicker from './ModelPicker';
export default function ChatSurface({ personaIds }) {
    const [draft, setDraft] = useState('');
    const [model, setModel] = useState({ providerId: 'openai', modelId: 'gpt-4o-mini' });
    function send() {
        if (!draft.trim())
            return;
        const ev = personaIds.length === 1
            ? { type: 'user_message', personaId: personaIds[0], content: draft, ...model }
            : { type: 'demo_message', personaIds, content: draft, ...model };
        const fn = window.__gpchat_send;
        if (fn)
            fn(ev);
        setDraft('');
    }
    return (_jsxs("div", { className: "h-full flex flex-col", children: [_jsx("div", { className: "px-4 py-2 border-b border-white/10 flex items-center gap-3", children: _jsx(ModelPicker, { value: model, onChange: setModel }) }), _jsx("div", { className: "flex-1 grid", style: { gridTemplateColumns: `repeat(${personaIds.length}, minmax(0,1fr))` }, children: personaIds.map(id => _jsx("div", { className: "h-full min-w-0 border-r border-white/10 last:border-r-0", children: _jsx(ConversationPane, { personaId: id }) }, id)) }), _jsx("div", { className: "border-t border-white/10 p-3", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "flex-1 bg-surface-700 rounded px-3 py-2", value: draft, onChange: e => setDraft(e.target.value), onKeyDown: e => e.key === 'Enter' && send(), placeholder: "Ask something..." }), _jsx("button", { className: "bg-accent-blue rounded px-4 py-2", onClick: send, children: "Send" })] }) })] }));
}
