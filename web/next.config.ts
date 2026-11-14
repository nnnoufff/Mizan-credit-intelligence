import type { NextConfig } from "next";

/*
  Production: the site is exported as static files (web/out) and served by the FastAPI service itself
  (api/main.py), which also answers /api/*. One service, one address.
  Development (`npm run dev`): Next serves the pages and forwards /api/* to the API running on port 8000.
*/
const API = process.env.MIZAN_API_URL ?? "http://127.0.0.1:8000";
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = isDev
  ? {
      async rewrites() {
        return [{ source: "/api/:path*", destination: `${API}/:path*` }];
      },
      async redirects() {
        return [{ source: "/", destination: "/en", permanent: false }];
      },
    }
  : {
      output: "export",
      // every page becomes a folder with an index.html (/en/assess/index.html), which FastAPI's static server finds
      trailingSlash: true,
    };

export default nextConfig;
