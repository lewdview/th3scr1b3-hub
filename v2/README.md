# th3scr1b3 v2

A modern, warm music hub with a persistent audio player, Audius integration, visualization, and timeline sorting.

How to run locally
- Ensure Node 18+ is installed.
- Install deps: npm install (or pnpm install / yarn install) in v2/
- Dev server: npm run dev
- Build: npm run build
- Start: npm start

Architecture overview
- Next.js 14 App Router + TypeScript for SSR/CSR hybrid and great SEO
- Tailwind for a warm, modern UI
- Zustand store for a global, persistent audio player across routes
- Audius helper library (lib/audius.ts) to locate discovery nodes, fetch user, tracks, and collections; stream URLs are generated client-side
- Player component pinned in app/layout.tsx for persistence; queue and controls managed in lib/store.ts

Feature notes
- Sorting: new → old and old → new by release date
- Playlist/Album/Track switcher: planned in a Library tabbed UI (tracks/collections) and queue management
- Visualization: plan to integrate Wavesurfer.js on the Player (spectrum/waveform)

Next steps
- Add app/(library)/collections page with playlist/album switching
- Create API routes in app/api/audius/* to proxy Audius calls for better caching and CORS control
- Integrate Wavesurfer visualization in the Player (lazy loaded)
- Add favorites and shareable deep-links
- Port branding/assets from v1 index.html/styles
- Write unit tests for Audius helpers and player store
