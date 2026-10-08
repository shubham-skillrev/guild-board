import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/* Links in posts and replies are almost always sources elsewhere. Opening them
   in a new tab keeps the thread where it was, same as every other outbound
   link in the product. Relative links stay in the tab: they are the app. */
const components: Components = {
  a: ({ href, children, node: _node, ...props }) => {
    const external = !!href && /^https?:\/\//i.test(href)
    return (
      <a
        href={href}
        {...props}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  },
}

/** User-written markdown: topic descriptions and comments. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
