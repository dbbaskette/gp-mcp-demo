import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { sanitize } from './sanitize';
import RichCard from '../components/rich/RichCard';
import { StatGrid, StatTile } from '../components/rich/StatGrid';
import StyledTable from '../components/rich/StyledTable';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function RichMarkdown({ source }: { source: string }) {
  const safe = sanitize(source);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        card: (props: any) => <RichCard title={props.title} color={props.color}>{props.children}</RichCard>,
        statgrid: (props: any) => <StatGrid>{props.children}</StatGrid>,
        stat: (props: any) => <StatTile label={props.label} value={props.value} sub={props.sub} />,
        datatable: (props: any) => <StyledTable>{props.children}</StyledTable>,
        table: (props: any) => <StyledTable>{props.children}</StyledTable>,
      } as any}
    >{safe}</ReactMarkdown>
  );
}
