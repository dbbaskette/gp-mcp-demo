import { jsx as _jsx } from "react/jsx-runtime";
import { usePersonas } from '../state/personaStore';
export default function PersonaPicker({ value, onChange }) {
    const personas = usePersonas(s => s.personas);
    return (_jsx("select", { className: "bg-surface-700 rounded px-2 py-1 text-sm", value: value, onChange: e => onChange(e.target.value), children: personas.map(p => _jsx("option", { value: p.id, children: p.label }, p.id)) }));
}
