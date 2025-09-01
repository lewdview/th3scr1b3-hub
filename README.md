# th3scr1b3 hub

A modular, animated music hub for th3scr1b3.

- Draggable floating player (Audius-powered)
- Brand-centered neon gradient title with energy waveform
- Latest track link
- Carousel of tracks (hover-expand tiles)
- Canvas energy strands that react to audio (bass surges + color cycling)
- Background, drifting stats synced to beats

## Local preview

Any static server works. Example using Python:

```
python3 -m http.server --directory . 8080
# open http://localhost:8080
```

## Deploying

### Vercel (recommended)

1) Add this repo to Vercel
   - Import the repo in Vercel Dashboard (or use `vercel` CLI if you’re authenticated)
   - Framework preset: “Other” (static)
   - Output dir: `.` (root) — we serve index.html directly
   - The included `vercel.json` config ships the site as a static deployment.

2) Set custom domain: `th3scr1b3.runeflow.xyz`
   - In Vercel Project → Settings → Domains → Add `th3scr1b3.runeflow.xyz`

3) DNS record at your DNS host for runeflow.xyz
   - Type: CNAME
   - Name/Host: `th3scr1b3`
   - Value/Target: `cname.vercel-dns.com`
   - TTL: 300 (or default)

4) Wait for Vercel to issue the certificate (a few minutes), then visit:
   - https://th3scr1b3.runeflow.xyz

### Netlify / GH Pages / Cloudflare Pages
The app is a plain static site. Any static host works — set the publish directory to the repo root and configure the domain with a CNAME at your DNS host.
