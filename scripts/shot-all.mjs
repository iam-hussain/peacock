// Batch-screenshot every app route at desktop + mobile in one chromium launch.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const port = process.env.PORT ?? "3000";
const outDir = "/private/tmp/claude-501/-Volumes-space-code-peacock/5e02e8b6-fb04-4898-843b-c1357a660797/scratchpad/app-shots";
mkdirSync(outDir, { recursive: true });

const routes = [
  ["landing", "/"],
  ["login", "/login"],
  ["how-it-works", "/how-it-works"],
  ["terms", "/terms"],
  ["dashboard", "/dashboard"],
  ["members", "/members"],
  ["member-detail", "/members/meera-pillai"],
  ["loans", "/loans"],
  ["loan-detail", "/loans/rahul-menon"],
  ["vendors", "/vendors"],
  ["vendor-general", "/vendors/hdfc-bank"],
  ["vendor-chit", "/vendors/sri-chit"],
  ["transactions", "/transactions"],
  ["analytics", "/analytics"],
  ["settings", "/settings"],
  ["notifications", "/notifications"],
  ["audit", "/audit"],
  ["share", "/share"],
  ["more", "/more"],
];

const browser = await chromium.launch();
for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [label, path] of routes) {
    try {
      await page.goto(`http://localhost:${port}${path}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
      await page.waitForTimeout(150);
      const out = `${outDir}/${label}-${name}.png`;
      await page.screenshot({ path: out, fullPage: true });
      console.log(out);
    } catch (e) {
      console.log(`FAIL ${label}-${name}: ${e.message}`);
    }
  }
  await page.close();
}
await browser.close();
