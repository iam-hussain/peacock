// Screenshot a route at desktop + mobile widths for pixel review.
// Usage: node scripts/shot.mjs <path> [outPrefix]  (dev server must be running on PORT env or 3001)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const path = process.argv[2] ?? "/";
const prefix = (process.argv[3] || path.replace(/\W+/g, "_") || "home").replace(/^_|_$/g, "");
const port = process.env.PORT ?? "3001";
const outDir = "/private/tmp/claude-501/-Volumes-space-code-peacock/d41273f3-c57a-4d1f-9985-15cc49bd2717/scratchpad/shots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`http://localhost:${port}${path}`, { waitUntil: "networkidle" });
  // freeze entrance animations so review shots are deterministic (full end state)
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none !important;transition:none !important}",
  });
  await page.waitForTimeout(200);
  const out = `${outDir}/${prefix}-${name}.png`;
  await page.screenshot({ path: out, fullPage: true });
  console.log(out);
  await page.close();
}
await browser.close();
