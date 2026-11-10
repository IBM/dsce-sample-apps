import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renders untrusted markdown safely: raw HTML is not enabled and links are neutralised. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => (/^(https?:|mailto:|#)/i.test(url) ? url : '')}
        components={{ a: ({ href, children: c }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{c}</a> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
