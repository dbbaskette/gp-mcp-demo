import { jsx as _jsx } from "react/jsx-runtime";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { sanitize } from './sanitize';
import RichCard from '../components/rich/RichCard';
import { StatGrid, StatTile } from '../components/rich/StatGrid';
import StyledTable from '../components/rich/StyledTable';
/* eslint-disable @typescript-eslint/no-explicit-any */
export function RichMarkdown({ source }) {
    const safe = sanitize(source);
    return (_jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeRaw], components: {
            card: (props) => _jsx(RichCard, { title: props.title, children: props.children }),
            statgrid: (props) => _jsx(StatGrid, { children: props.children }),
            stat: (props) => _jsx(StatTile, { label: props.label, value: props.value, sub: props.sub }),
            datatable: (props) => _jsx(StyledTable, { children: props.children }),
            table: (props) => _jsx(StyledTable, { children: props.children }),
        }, children: safe }));
}
