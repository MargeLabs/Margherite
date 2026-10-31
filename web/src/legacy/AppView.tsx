'use client';

import { useEffect, useMemo } from 'react';
import type { ViewStore } from '@/data/household';
import { DCLogic, DcHost, type LogicClass, type Scope } from './dc-engine';
import { template } from './app.template.generated';
import { createLogicClass } from './app.logic.generated';
import defaults from './props.generated.json';

/**
 * La maquette V5, branchée sur de vraies données : même gabarit, même logique, plus les correctifs de scripts/patches.mjs.
 * `overrides` (réglages d'URL du mode local, pour les tests : ?screen=comprendre…) prolonge les valeurs par défaut de la maquette.
 */
export function AppView({ store, overrides = {} }: { store: ViewStore; overrides?: Record<string, string> }) {
  const Logic = useMemo(() => (createLogicClass as unknown as (base: typeof DCLogic) => LogicClass)(DCLogic), []);
  const logicProps = useMemo<Scope>(() => ({ ...defaults, ...overrides, store }), [store, overrides]);
  // le fond autour de l'app (zones de sécurité de l'iPhone) suit le thème choisi, clair ou sombre
  useEffect(() => {
    const app = document.querySelector('.app');
    if (!app) return;
    const bg = getComputedStyle(app).backgroundColor;
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
  });
  return <DcHost template={template} Logic={Logic} logicProps={logicProps} />;
}
