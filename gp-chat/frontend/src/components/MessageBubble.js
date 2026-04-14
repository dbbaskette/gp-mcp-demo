import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ToolCallCard from './ToolCallCard';
import { RichMarkdown } from '../rendering/richMarkdown';
export default function MessageBubble({ bubble }) {
    if (bubble.role === 'user') {
        return _jsxs("div", { className: "bg-surface-800 rounded-lg px-4 py-3 my-2", children: [_jsx("strong", { children: "You:" }), " ", bubble.text] });
    }
    return (_jsxs("div", { className: "rounded-lg px-4 py-3 my-2 border border-white/10", children: [bubble.toolCalls.map(tc => _jsx(ToolCallCard, { call: tc }, tc.id)), _jsx(RichMarkdown, { source: bubble.text }), !bubble.done && _jsx("span", { className: "text-xs opacity-60 animate-pulse", children: "thinking..." })] }));
}
