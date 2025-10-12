"use client";

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/lib/store';

export function Player() {
  const { queue, currentIndex, playing, next, prev, play, pause } = usePlayerStore();
  const current = queue[currentIndex];

  // Keep a single DOM audio element for persistence (easier Wavesurfer integration)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<any>(null);

  // Initialize audio element once
  useEffect(() => {
    if (!audioRef.current) {
      const el = document.createElement('audio');
      el.preload = 'metadata';
      el.crossOrigin = 'anonymous';
      audioRef.current = el;
    }
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // Load current track into audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current?.streamUrl) return;
    audio.src = current.streamUrl;
    if (playing) {
      audio.play().catch(() => undefined);
    }
  }, [current?.streamUrl]);

  // Next on end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => next();
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [next]);

  // Play/pause control from store
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [playing]);

  // Global keyboard shortcuts: Space/k = play/pause, Left/j = prev, Right/l = next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const editable = target?.isContentEditable;
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || editable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault();
        if (playing) pause(); else play();
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play, pause, next, prev, playing]);

  // Wavesurfer visualization
  useEffect(() => {
    let destroyed = false;
    (async () => {
      if (!waveRef.current || !audioRef.current) return;
      const WaveSurfer = (await import('wavesurfer.js')).default;
      // Destroy previous instance if exists
      if (wsRef.current) {
        wsRef.current.destroy();
        wsRef.current = null;
      }
      const ws = WaveSurfer.create({
        container: waveRef.current,
        height: 56,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        cursorWidth: 0,
        normalize: true,
        waveColor: '#00d1ff',
        progressColor: '#ffe600',
        responsive: true,
      });
      ws.load(audioRef.current);
      // Seek on click
      ws.on('interaction', () => {
        if (!audioRef.current || !wsRef.current) return;
        const dur = audioRef.current.duration || 0;
        if (dur > 0) {
          audioRef.current.currentTime = wsRef.current.getCurrentTime();
        }
      });
      wsRef.current = ws;
    })();
    return () => {
      if (wsRef.current) {
        wsRef.current.destroy();
        wsRef.current = null;
      }
    };
  }, [current?.id]);

  if (!current) {
    return (
      <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[480px] card">
        <div className="text-sm text-white/70">Player idle — queue something from the library</div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[520px] card">
      <div className="flex items-center gap-3">
        {current.artwork ? (
          <img src={current.artwork} alt="artwork" className="h-14 w-14 rounded-xl object-cover" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-white/5" />
        )}
        <div className="min-w-0">
          <div className="truncate font-medium">{current.title || 'Untitled'}</div>
          {current.createdAt && (
            <div className="text-xs text-white/60">{new Date(current.createdAt).toLocaleDateString()}</div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="button" onClick={prev} aria-label="Previous">⏮</button>
          {playing ? (
            <button className="button" onClick={pause} aria-label="Pause">⏸</button>
          ) : (
            <button className="button" onClick={play} aria-label="Play">▶️</button>
          )}
          <button className="button" onClick={next} aria-label="Next">⏭</button>
        </div>
      </div>
      <div className="mt-3">
        <div ref={waveRef} className="h-[56px] w-full opacity-90"></div>
      </div>
      {/* Hidden audio element exists in memory; we keep control via ref */}
    </div>
  );
}
