import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function RichCard({ title, children }) {
    return (_jsxs("div", { className: "rounded-lg border border-white/10 bg-gradient-to-br from-surface-800 to-surface-900 p-4 my-3", children: [title && _jsx("div", { className: "text-xs uppercase tracking-wider text-accent-blue font-semibold mb-3", children: title }), _jsx("div", { children: children })] }));
}
