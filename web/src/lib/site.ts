/**
 * Which site this build is (set at build time with NEXT_PUBLIC_SITE):
 *  - "client":  the customers' site (home, apply, my applications)
 *  - "officer": the bank staff's site (landing, inbox, manual assessment, portfolio, models)
 *  - "all":     everything in one site (the default, used by `npm run dev`)
 * scripts/build-site.mjs removes the other site's pages from each export.
 */
export type Site = "all" | "client" | "officer";
export const SITE: Site = ((): Site => {
  const v = process.env.NEXT_PUBLIC_SITE;
  return v === "client" || v === "officer" ? v : "all";
})();
export const HAS_CLIENT = SITE !== "officer";
export const HAS_OFFICER = SITE !== "client";

/** Pages that belong to one site only (the locale home page is shared: each site renders its own). */
export const CLIENT_PAGES = ["apply", "my-applications"];
export const OFFICER_PAGES = ["inbox", "assess", "portfolio"];
