"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** A `<pre>` with a copy-to-clipboard button. */
export function CodeBlock(props: React.ComponentProps<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (e.g. plain http on another host); the text is still selectable.
    }
  }

  return (
    <div className="group/code not-prose relative my-5">
      <pre
        ref={preRef}
        {...props}
        className="overflow-x-auto rounded-lg border bg-[var(--code-bg)] p-4 pr-12 font-mono text-[0.8125rem] leading-relaxed"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        title={copied ? "Copied" : "Copy code"}
        className="absolute top-2 right-2 bg-background/80 opacity-70 group-hover/code:opacity-100 focus-visible:opacity-100"
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Code copied to clipboard" : ""}
      </span>
    </div>
  );
}
