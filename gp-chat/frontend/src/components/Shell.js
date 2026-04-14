import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Shell({ right, children }) {
    return (_jsxs("div", { className: "h-full flex flex-col", children: [_jsxs("header", { className: "h-12 px-4 flex items-center justify-between border-b border-white/10 bg-surface-800", children: [_jsx("div", { className: "font-semibold", children: "gp-chat" }), _jsx("div", { className: "flex items-center gap-2", children: right })] }), _jsx("main", { className: "flex-1 overflow-hidden", children: children })] }));
}
