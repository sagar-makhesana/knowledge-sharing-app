// Builds the Codefest submission PDF from submission.html (real text, not a scan).
//   pnpm submission:pdf -- "https://your-app.vercel.app" "Your team name"
// Without arguments, the app URL and team name are left as red placeholders.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
const dir = path.dirname(new URL(import.meta.url).pathname);
const [appUrl, team] = process.argv.slice(2);
const ph = (s) => `<span class="placeholder">${s}</span>`;
const html = readFileSync(path.join(dir, "submission.html"), "utf8")
  .replaceAll("{{APP_URL}}", appUrl ? `<code>${appUrl}</code>` : ph("[your Vercel production URL]"))
  .replaceAll("{{TEAM}}", team ?? ph("[your team name]"));
const rendered = path.join(dir, ".rendered.html");
writeFileSync(rendered, html);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.goto(`file://${rendered}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const out = path.join(dir, "Altegra-Knowledge-Sharing-Codefest-2026.pdf");
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font-size:7px;color:#8a9098;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>Altegra Knowledge Sharing · Codefest 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log(out);
