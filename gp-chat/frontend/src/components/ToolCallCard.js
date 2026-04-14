import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const statusStyle = {
    pending: 'border-white/20 bg-surface-700',
    success: 'border-accent-green/50 bg-accent-green/10',
    error: 'border-accent-red/50 bg-accent-red/10',
    denied: 'border-accent-amber/50 bg-accent-amber/10',
};
export default function ToolCallCard({ call }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: `rounded border p-3 my-2 font-mono text-xs ${statusStyle[call.status ?? 'pending']}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: call.name }), " ", _jsxs("span", { className: "opacity-70", children: ["(", call.status ?? 'pending', ")"] })] }), _jsx("button", { onClick: () => setOpen(!open), className: "text-xs underline", children: open ? 'hide' : 'details' })] }), _jsx("div", { className: "mt-2 flex flex-wrap gap-1", children: Object.entries((call.args ?? {})).map(([k, v]) => (_jsxs("span", { className: "bg-surface-900/60 rounded px-2 py-0.5", children: [k, ": ", JSON.stringify(v)] }, k))) }), open && (_jsx("pre", { className: "mt-2 p-2 bg-black/30 rounded overflow-auto max-h-64", children: JSON.stringify(call.result, null, 2) }))] }));
}
