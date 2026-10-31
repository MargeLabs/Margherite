import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../legacy/mockup.generated.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Margherite',
  description: 'Le suivi de bébé de Victor et Luana',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const FONTS =
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Figtree:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Nunito+Sans:opsz,wght@6..12,400..800&family=Varela+Round&family=Source+Sans+3:wght@400;600;700;800&display=swap';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONTS} rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
