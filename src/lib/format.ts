const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "25 Sep 2026". Formatted in UTC so server and client output always match. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
