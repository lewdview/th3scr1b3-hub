"use client";

import { usePlayerStore } from '@/lib/store';

export function Heart({ trackId, className = '' }: { trackId: string; className?: string }) {
  const isFavorite = usePlayerStore(s => s.isFavorite(trackId));
  const toggleFavorite = usePlayerStore(s => s.toggleFavorite);
  return (
    <button
      type="button"
      className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-md border border-white/15 ${isFavorite ? 'bg-[rgba(255,0,110,0.15)] text-[var(--accent)]' : 'bg-black/40 text-white/90'} ${className}`}
      aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
      onClick={(e) => { e.stopPropagation(); toggleFavorite(trackId); }}
      title={isFavorite ? 'Unfavorite' : 'Favorite'}
    >
      {isFavorite ? '♥' : '♡'}
    </button>
  );
}
