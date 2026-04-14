import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import Shell from './components/Shell';
import PersonaPicker from './components/PersonaPicker';
import ChatSurface from './components/ChatSurface';
import DevPanel from './components/DevPanel';
import { listPersonas, getPersona } from './api/personas';
import { openSocket } from './api/chatSocket';
import { usePersonas } from './state/personaStore';
export default function App() {
    const { setPersonas, setInfo, onEvent, appendUser, personas } = usePersonas();
    const [active, setActive] = useState('');
    const [demoMode, setDemoMode] = useState(false);
    const [demoSelection, setDemoSelection] = useState([]);
    const [devOpen, setDevOpen] = useState(false);
    useEffect(() => {
        listPersonas().then(ps => { setPersonas(ps); if (!active && ps[0])
            setActive(ps[0].id); });
    }, []);
    useEffect(() => {
        personas.forEach(p => getPersona(p.id).then(i => setInfo(p.id, i)));
    }, [personas.length]);
    useEffect(() => {
        const handler = (e) => {
            if (e.data?.type === 'persona-login' && e.data.personaId)
                getPersona(e.data.personaId).then(i => setInfo(e.data.personaId, i));
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);
    useEffect(() => {
        const ws = openSocket(onEvent);
        window.__gpchat_send = (ev) => {
            const msg = ev;
            if (msg.type === 'user_message')
                appendUser(msg.personaId, msg.content);
            if (msg.type === 'demo_message')
                msg.personaIds.forEach(pid => appendUser(pid, msg.content));
            ws.send(JSON.stringify(ev));
        };
        return () => ws.close();
    }, [onEvent, appendUser]);
    useEffect(() => {
        const h = (e) => { if (e.metaKey && e.key === '\\')
            setDevOpen(o => !o); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);
    return (_jsxs(_Fragment, { children: [_jsx(Shell, { right: _jsxs(_Fragment, { children: [_jsxs("label", { className: "text-sm flex items-center gap-1", children: [_jsx("input", { type: "checkbox", checked: demoMode, onChange: e => setDemoMode(e.target.checked) }), " Demo"] }), !demoMode && _jsx(PersonaPicker, { value: active, onChange: setActive }), demoMode && (_jsx("div", { className: "flex gap-2 text-sm", children: personas.map(p => (_jsxs("label", { className: "flex items-center gap-1", children: [_jsx("input", { type: "checkbox", checked: demoSelection.includes(p.id), onChange: e => setDemoSelection(s => e.target.checked ? [...s, p.id] : s.filter(x => x !== p.id)) }), p.label] }, p.id))) })), _jsx("button", { className: "text-sm opacity-70 hover:opacity-100", onClick: () => setDevOpen(o => !o), children: "DevPanel" })] }), children: demoMode
                    ? (demoSelection.length > 0 ? _jsx(ChatSurface, { personaIds: demoSelection }) : _jsx("div", { className: "p-6 opacity-70", children: "Select at least one persona to compare." }))
                    : (active ? _jsx(ChatSurface, { personaIds: [active] }) : null) }), devOpen && _jsx(DevPanel, { onClose: () => setDevOpen(false) })] }));
}
