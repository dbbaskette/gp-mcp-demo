import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { usePersonas } from '../state/personaStore';
import { loginUrl } from '../api/personas';
import MessageList from './MessageList';
export default function ConversationPane({ personaId }) {
    const slot = usePersonas(s => s.slots[personaId]);
    const info = slot?.info;
    if (!info?.loggedIn) {
        return (_jsx("div", { className: "h-full flex items-center justify-center", children: _jsxs("button", { className: "bg-accent-blue hover:bg-accent-blue/80 rounded px-4 py-2", onClick: () => openLogin(personaId), children: ["Log in as ", personaId] }) }));
    }
    return (_jsx("div", { className: "h-full overflow-auto p-4", children: _jsx(MessageList, { items: slot?.messages ?? [] }) }));
}
function openLogin(id) {
    const w = 480, h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(loginUrl(id), `login-${id}`, `width=${w},height=${h},left=${left},top=${top}`);
}
