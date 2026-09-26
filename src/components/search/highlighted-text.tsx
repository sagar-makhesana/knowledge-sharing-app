import type { TextSegment } from "@/lib/knowledge/search";

/** Renders text segments, wrapping matched words in <mark>. */
export function HighlightedText({ segments }: { segments: readonly TextSegment[] }) {
  return segments.map((segment, i) =>
    segment.match ? (
      <mark key={i} className="rounded-sm bg-highlight px-0.5 text-highlight-foreground">
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  );
}
