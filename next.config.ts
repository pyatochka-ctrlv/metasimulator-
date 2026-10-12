import type { NextConfig } from "next";

/**
 * STATIC_EXPORT=1 — статична збірка в out/ (GitHub Pages, Cloudflare Pages, Netlify).
 * BASE_PATH — префікс шляху, якщо сайт відкривається не з кореня домену
 * (для GitHub Pages без власного домену: "/<назва-репозиторію>").
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(staticExport ? { output: "export" as const, trailingSlash: true } : {}),
  ...(basePath ? { basePath } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
