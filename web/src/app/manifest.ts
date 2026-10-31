import type { MetadataRoute } from 'next';

// Installable sur l'écran d'accueil de l'iPhone (Safari › Partager › Sur l'écran d'accueil) : s'ouvre en plein écran, sans barre Safari.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Margherite',
    short_name: 'Margherite',
    description: 'Le suivi de bébé : repas, sommeil, changes et tire-lait.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFDF8',
    theme_color: '#FFFDF8',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
