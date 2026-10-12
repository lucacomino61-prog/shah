import { defineConfig } from 'astro/config';

// A local learning app: no canonical site yet, nothing indexed until Luca chooses a domain and says "deploy".
export default defineConfig({
  site: process.env.SITE_URL || 'http://127.0.0.1:3770',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
