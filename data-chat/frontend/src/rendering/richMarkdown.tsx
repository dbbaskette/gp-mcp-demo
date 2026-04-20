import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { sanitize } from './sanitize';
import RichCard from '../components/rich/RichCard';
import { StatGrid, StatTile } from '../components/rich/StatGrid';
import StyledTable from '../components/rich/StyledTable';

/**
 * Editorial prose for assistant responses.
 *
 *   - Fraunces italic blockquotes, Instrument Sans body
 *   - Cobalt-underlined links
 *   - Deep paper-2 inline code chip; paper-3 fenced block with ink-toned rule
 *   - Lozenge bullet (a small horizontal rule) instead of disc — feels printed
 *   - Headings flip between serif (h1/h2) and small-caps mono (h3/h4) so section
 *     breaks are obvious even in a long answer
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function RichMarkdown({ source }: { source: string }) {
  const safe = sanitize(source);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        // ── Paragraphs ──
        p: (props: any) => (
          <p className="my-3 first:mt-0 last:mb-0 leading-[1.65] text-ink">{props.children}</p>
        ),

        // ── Headings ──
        h1: (props: any) => (
          <h1 className="mt-8 mb-3 font-display text-display-sm italic text-ink leading-tight">
            {props.children}
          </h1>
        ),
        h2: (props: any) => (
          <h2 className="mt-6 mb-2.5 font-display text-display-sm text-ink leading-tight">
            {props.children}
          </h2>
        ),
        h3: (props: any) => (
          <h3 className="mt-5 mb-2 font-mono text-label-sm uppercase text-cobalt">
            {props.children}
          </h3>
        ),
        h4: (props: any) => (
          <h4 className="mt-4 mb-1.5 font-mono text-label-xs uppercase text-ink-2">
            {props.children}
          </h4>
        ),

        // ── Emphasis ──
        strong: (props: any) => <strong className="font-semibold text-ink">{props.children}</strong>,
        em: (props: any) => <em className="italic text-ink">{props.children}</em>,

        // ── Lists: lozenge bullets feel like printed bullets ──
        ul: (props: any) => (
          <ul className="my-3 pl-5 space-y-1.5 list-none [&>li]:relative [&>li]:pl-4 [&>li::before]:content-[''] [&>li::before]:absolute [&>li::before]:left-0 [&>li::before]:top-[0.75em] [&>li::before]:w-2 [&>li::before]:h-px [&>li::before]:bg-cobalt">
            {props.children}
          </ul>
        ),
        ol: (props: any) => (
          <ol className="my-3 pl-7 space-y-1.5 list-decimal marker:font-mono marker:text-cobalt marker:text-[11px]">
            {props.children}
          </ol>
        ),
        li: (props: any) => <li className="leading-[1.55] text-ink">{props.children}</li>,

        // ── Pullquote ──
        blockquote: (props: any) => (
          <blockquote className="my-5 pl-5 border-l-2 border-cobalt font-display italic text-body-lg text-ink-2">
            {props.children}
          </blockquote>
        ),

        // ── Links: cobalt with scaled underline on hover ──
        a: (props: any) => (
          <a
            href={props.href}
            className="text-cobalt underline decoration-cobalt/40 decoration-2 underline-offset-[3px] hover:decoration-cobalt transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            {props.children}
          </a>
        ),

        // ── Code ──
        code: (props: any) => {
          const { inline, className, children } = props;
          if (inline) {
            return (
              <code className="font-mono text-[0.9em] px-1.5 py-[1px] border border-ink/20 bg-paper-2 text-ink">
                {children}
              </code>
            );
          }
          return <code className={`font-mono text-[13px] text-ink ${className ?? ''}`}>{children}</code>;
        },
        pre: (props: any) => (
          <pre className="my-4 p-4 bg-paper-3 border-l-2 border-ink overflow-x-auto text-[13px] leading-[1.55] text-ink">
            {props.children}
          </pre>
        ),

        // ── Horizontal rule: a set of three small dots, classical printed device ──
        hr: () => (
          <div className="my-6 flex items-center justify-center gap-2 text-ink-3">
            <span className="w-1 h-1 rounded-full bg-current" />
            <span className="w-1 h-1 rounded-full bg-current" />
            <span className="w-1 h-1 rounded-full bg-current" />
          </div>
        ),

        // ── Custom widgets (recolored in their own files) ──
        card: (props: any) => <RichCard title={props.title} color={props.color}>{props.children}</RichCard>,
        statgrid: (props: any) => <StatGrid>{props.children}</StatGrid>,
        stat: (props: any) => <StatTile label={props.label} value={props.value} sub={props.sub} />,
        datatable: (props: any) => <StyledTable>{props.children}</StyledTable>,
        table: (props: any) => <StyledTable>{props.children}</StyledTable>,
      } as any}
    >{safe}</ReactMarkdown>
  );
}
