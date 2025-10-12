import { NextResponse } from 'next/server';

// Serve an SVG icon at /favicon.ico to avoid 404s
export async function GET() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#00d1ff"/>
      <stop offset="1" stop-color="#ffe600"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="12" fill="#0f0f12"/>
  <circle cx="32" cy="32" r="20" fill="url(#g)"/>
  <text x="32" y="38" font-size="20" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" text-anchor="middle" fill="#0f0f12" font-weight="900">S</text>
</svg>`;
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    }
  });
}
