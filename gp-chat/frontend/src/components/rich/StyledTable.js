import { jsx as _jsx } from "react/jsx-runtime";
export default function StyledTable({ children }) {
    return (_jsx("div", { className: "rounded-lg overflow-hidden border border-white/10 my-3", children: _jsx("table", { className: "w-full text-sm", children: children }) }));
}
