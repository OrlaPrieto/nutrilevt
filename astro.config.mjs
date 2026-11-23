// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  adapter: vercel(),
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover'
  },
  vite: {
    plugins: [tailwindcss()]
  },

  site: 'https://nutrilev.com', // Replace with the actual domain later
  redirects: {
    '/recetario': '/recetario-navideno-2026',
    '/en/recetario': '/recetario-navideno-2026',
    '/en/recetario-navideno-2026': '/recetario-navideno-2026',
  },
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false
    }
  },
  build: {
    inlineStylesheets: 'always'
  },
  integrations: [sitemap()]
});