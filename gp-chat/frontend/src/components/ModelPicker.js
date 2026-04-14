import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { listProviders } from '../api/models';
export default function ModelPicker({ value, onChange }) {
    const [providers, setProviders] = useState([]);
    useEffect(() => { listProviders().then(setProviders); }, []);
    return (_jsx("select", { className: "bg-surface-700 rounded px-2 py-1 text-sm", value: `${value.providerId}::${value.modelId}`, onChange: e => { const [p, m] = e.target.value.split('::'); onChange({ providerId: p, modelId: m }); }, children: providers.flatMap(p => p.models.map(m => (_jsxs("option", { value: `${p.id}::${m}`, children: [p.id, " / ", m] }, `${p.id}::${m}`)))) }));
}
