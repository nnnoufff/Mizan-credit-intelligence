import type { NextConfig } from "next";

const API = process.env.MIZAN_API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // The browser talks to /api/*; Next forwards it to the FastAPI service (no CORS needed).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/:path*` }];
  },
  async redirects() {
    return [{ source: "/", destination: "/en", permanent: false }];
  },
};

export default nextConfig;
