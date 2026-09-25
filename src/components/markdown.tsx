"use client";

import dos from "highlight.js/lib/languages/dos";
import powershell from "highlight.js/lib/languages/powershell";
import { common } from "lowlight";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/code-block";
import { cn } from "@/lib/utils";

// highlight.js "common" languages plus the Windows shells PLM consultants use daily.
const languages = { ...common, powershell, dos };

const components: Components = {
  pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
  a: ({ node: _node, href, ...props }) => {
    const external = href?.startsWith("http");
    return (
      <a
        href={href}
        {...(external && { target: "_blank", rel: "noopener noreferrer" })}
        {...props}
      />
    );
  },
};

/**
 * Renders user-written Markdown. Raw HTML in the source is not rendered (react-markdown's
 * default), and unsafe URLs such as `javascript:` are stripped, so content can't inject script.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose max-w-none prose-neutral dark:prose-invert",
        "prose-headings:scroll-mt-20 prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-a:text-primary prose-a:underline-offset-4",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-medium",
        "prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0",
        "prose-table:text-sm prose-th:text-left",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { languages, detect: false }]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
