import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { usePersonas } from '../state/personaStore';
import { openAuditStream } from '../api/audit';
export default function DevPanel({ onClose }) {
    const slots = usePersonas(s => s.slots);
    const [tab, setTab] = useState('claims');
    const [audit, setAudit] = useState([]);
    useEffect(() => {
        const src = openAuditStream(ev => setAudit(a => [ev, ...a].slice(0, 200)));
        return () => src.close();
    }, []);
    return (_jsxs("aside", { className: "fixed top-0 right-0 h-full w-[420px] bg-surface-800 border-l border-white/10 overflow-hidden flex flex-col z-50", children: [_jsxs("div", { className: "h-12 px-4 flex items-center justify-between border-b border-white/10", children: [_jsx("div", { className: "font-semibold", children: "DevPanel" }), _jsx("button", { className: "text-sm opacity-70", onClick: onClose, children: "close" })] }), _jsx("div", { className: "flex border-b border-white/10 text-sm", children: ['claims', 'audit', 'tools'].map(t => (_jsx("button", { className: `flex-1 py-2 ${tab === t ? 'bg-surface-700' : ''}`, onClick: () => setTab(t), children: t }, t))) }), _jsxs("div", { className: "flex-1 overflow-auto p-3 text-xs font-mono", children: [tab === 'claims' && Object.entries(slots).filter(([, s]) => s.info?.loggedIn).map(([id, s]) => (_jsxs("div", { className: "mb-3", children: [_jsx("div", { className: "text-accent-blue", children: id }), _jsx("pre", { className: "bg-black/30 p-2 rounded overflow-auto", children: JSON.stringify(s.info?.claims, null, 2) })] }, id))), tab === 'audit' && audit.map((a, i) => (_jsxs("div", { className: "mb-2 border-b border-white/5 pb-1", children: [_jsx("span", { className: "text-accent-green", children: a.personaId }), " ", a.tool, " ", _jsx("span", { className: "opacity-60", children: a.status }), " ", a.durationMs, "ms"] }, i))), tab === 'tools' && _jsx("div", { className: "opacity-70", children: "(shows MCP tool inventory per persona after login)" })] })] }));
}
