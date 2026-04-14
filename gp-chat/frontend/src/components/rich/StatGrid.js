import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function StatGrid({ children }) {
    return _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-3 my-2", children: children });
}
export function StatTile({ label, value, sub }) {
    return (_jsxs("div", { className: "rounded-lg bg-gradient-to-br from-surface-700 to-surface-800 p-4", children: [_jsx("div", { className: "text-[10px] uppercase tracking-wider text-white/60", children: label }), _jsx("div", { className: "text-2xl font-semibold", children: value }), sub && _jsx("div", { className: "text-xs text-white/50 mt-1", children: sub })] }));
}
