import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  security: {
    // Astro's default CSRF check compares the request's Origin header against
    // its own derived request origin, which is unreliable on this Vercel
    // deployment (see src/lib/oauth.ts's originFromRequest — the same
    // underlying issue). It would also incorrectly block the OAuth token
    // endpoint (src/pages/api/oauth/token.ts), which is *supposed* to receive
    // genuine cross-origin, server-to-server requests from claude.ai per the
    // OAuth spec. No other route in this app relies on this protection —
    // /api/unlock and /api/mcp both use JSON bodies, which this check exempts
    // anyway. Real request authorization is handled explicitly per-route
    // (Bearer token, PKCE, or the Fireside access code).
    checkOrigin: false,
  },
});
