// Builds one of the two sites as a static export:
//   node scripts/build-site.mjs client   -> web/out-client   (customers: home, apply, my applications)
//   node scripts/build-site.mjs officer  -> web/out-officer  (bank staff: landing, inbox, assessment, portfolio, models)
// Each export drops the other site's pages, so they are not reachable even by typing the address.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const site = process.argv[2];
if (site !== "client" && site !== "officer") {
  console.error("usage: node scripts/build-site.mjs client|officer");
  process.exit(1);
}
const web = new URL("..", import.meta.url).pathname;
// the page lists live in src/lib/site.ts; read them from there so the two never drift
const src = readFileSync(join(web, "src/lib/site.ts"), "utf8");
const list = (name) => JSON.parse(src.match(new RegExp(`${name} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'));
const drop = site === "client" ? list("OFFICER_PAGES") : list("CLIENT_PAGES");

// next export always writes to web/out: park the combined export (if any) and put it back afterwards
const out = join(web, "out"), parked = join(web, ".out-combined");
if (existsSync(parked)) rmSync(parked, { recursive: true, force: true });
if (existsSync(out)) renameSync(out, parked);
try {
  execSync("npx next build", { cwd: web, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_SITE: site } });
} catch (e) {
  if (existsSync(parked)) { rmSync(out, { recursive: true, force: true }); renameSync(parked, out); }
  throw e;
}

for (const locale of ["en", "ar"]) for (const page of drop) rmSync(join(out, locale, page), { recursive: true, force: true });
const dest = join(web, `out-${site}`);
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
renameSync(out, dest);
if (existsSync(parked)) renameSync(parked, out);
console.log(`\n${site} site exported to ${dest} (removed: ${drop.join(", ")})`);
