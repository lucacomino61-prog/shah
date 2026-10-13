import { defineConfig } from 'astro/config';

// Published on Cloudflare Pages (Luca chose it, 2026-10-13) and open to search engines. SITE_URL overrides it when
// a domain comes.
export default defineConfig({
  site: process.env.SITE_URL || 'https://shah-trajneri.pages.dev',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
