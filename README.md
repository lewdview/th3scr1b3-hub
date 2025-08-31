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

Choose a static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages). Create a CNAME for `th3scr1b3.runeflow.xyz` to the host’s provided domain. See instructions in the commit message or ask me to set it up.
