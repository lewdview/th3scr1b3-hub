import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Track = {
  id: string;
  title: string;
  streamUrl: string;
  artwork?: string;
  createdAt?: string; // ISO
};

type State = {
  queue: Track[];
  currentIndex: number;
  playing: boolean;
  favorites: string[]; // track IDs
  setQueue: (q: Track[], startIndex?: number) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  setIndex: (i: number) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
};

export const usePlayerStore = create<State>()(persist((set, get) => ({
  queue: [],
  currentIndex: 0,
  playing: false,
  favorites: [],
  setQueue: (q, startIndex = 0) => set({ queue: q, currentIndex: Math.max(0, Math.min(startIndex, q.length - 1)), playing: true }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  next: () => {
    const { currentIndex, queue } = get();
    if (queue.length === 0) return;
    const i = (currentIndex + 1) % queue.length;
    set({ currentIndex: i, playing: true });
  },
  prev: () => {
    const { currentIndex, queue } = get();
    if (queue.length === 0) return;
    const i = (currentIndex - 1 + queue.length) % queue.length;
    set({ currentIndex: i, playing: true });
  },
  setIndex: (i) => set({ currentIndex: i, playing: true }),
  isFavorite: (id) => get().favorites.includes(id),
  toggleFavorite: (id) => {
    const favs = new Set(get().favorites);
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    set({ favorites: Array.from(favs) });
  }
}), {
  name: 'th3scr1b3-player',
  partialize: (state) => ({ favorites: state.favorites }),
}));
