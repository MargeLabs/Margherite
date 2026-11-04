'use client';

// Filou en petit dans la carte « Maintenant » de l'Accueil : il suit l'état de la carte (éveillé, sieste, nuit) et un toucher ouvre Comprendre.
import { useEffect, useRef } from 'react';
import { Filou } from './Filou';

export function HomeFilou({ situation, onOpen }: { situation?: string; onOpen?: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const inRef = useRef<HTMLSpanElement | null>(null);
  // Filou remplit toute la hauteur de la zone ; ce qui dépasse sur les côtés est rogné, centré
  useEffect(() => {
    const box = ref.current;
    const inner = inRef.current;
    if (!box || !inner || !('ResizeObserver' in window)) return;
    const fit = () => {
      const W = box.clientWidth;
      const H = box.clientHeight;
      if (!W || !H) return;
      const k = Math.max(H / 270, W / 358);
      inner.style.transform = `translate(${(W - 358 * k) / 2}px, ${H - 270 * k}px) scale(${k})`;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    fit();
    return () => ro.disconnect();
  }, []);
  // hors de l'écran, il se met en pause : un seul Filou animé à la fois, et rien ne tourne pour rien
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => el.classList.toggle('fl-paused', !e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <button ref={ref} type="button" className="sit-fox" aria-label="Voir son portrait dans Comprendre" onClick={onOpen}>
      <span className="sit-fox-in" aria-hidden="true" ref={(el) => { inRef.current = el; el?.setAttribute('inert', ''); }}>
        <Filou situation={situation ?? 'awake'} age={2} session />
      </span>
    </button>
  );
}
