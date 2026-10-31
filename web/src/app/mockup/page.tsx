'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { MockupApp } from '@/legacy/MockupApp';
import { config } from '@/lib/config';

// Route de contrôle : la maquette V5 intacte, pilotée par l'URL (?screen=comprendre&cview=hc…).
// Réservée au mode local, elle ne répond pas en production.
export default function MockupPage() {
  const [overrides, setOverrides] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    setOverrides(Object.fromEntries(new URLSearchParams(window.location.search).entries()));
  }, []);
  if (config.dataMode !== 'local') notFound();
  return overrides ? <MockupApp overrides={overrides} /> : null;
}
