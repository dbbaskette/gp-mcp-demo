import { jsx as _jsx } from "react/jsx-runtime";
import MessageBubble from './MessageBubble';
export default function MessageList({ items }) {
    return _jsx("div", { className: "flex flex-col", children: items.map((b, i) => _jsx(MessageBubble, { bubble: b }, i)) });
}
