'use client';

// La page Comprendre : le gabarit validé (maquettes/v7-comprendre/), rendu par le moteur de gabarits de l'app,
// avec le modèle réel du journal et les broderies de l'appareil.
import { Component as ReactComponent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ViewStore } from '@/data/household';
import { DcHost } from '@/legacy/dc-engine';
import { MIN_PER_DAY, TODAY_INDEX } from '@/lib/time';
import { cmpTemplate } from './cmp.template.generated';
import { CmpLogic, type CmpProps } from './CmpLogic';
import { mergeEmb, unionEmb, type EmbEntry } from './embroidery';
import { Filou } from './Filou';
import { buildModel } from './model';

/** Les feuilles se posent sur l'écran de l'app (au-dessus de la barre d'onglets), pas dans la page qui défile. */
function Portal({ children }: { children?: ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(document.querySelector('.app')), []);
  return host ? createPortal(<div className="cmp cmp-portal">{children}</div>, host) : null;
}

const COMPONENTS = { Filou, Portal };

const SEEN_KEY = 'canaille.emb.seen';
function readSeen(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function monthsOld(birth: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (30.44 * 86_400_000)));
}

function ComprendrePage({ store }: { store: ViewStore }) {
  const stored = unionEmb(store.shared.emb, store.local.emb);
  const storedRef = useRef(stored);
  storedRef.current = stored;
  // les badges que ce parent n'a pas encore vus (par appareil, chacun fête la nouveauté de son côté)
  const [seen, setSeen] = useState<string[]>(readSeen);
  const fresh = stored.filter((e) => !e.hand && !e.hidden && !seen.includes(e.key)).map((e) => e.key);
  const markSeen = () => {
    const all = [...new Set([...seen, ...stored.map((e) => e.key)])];
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(all)); } catch { /* sans stockage, la fête revient au prochain passage */ }
    setSeen(all);
  };
  /** dans la base (les deux téléphones) et sur l'appareil, qui reste le filet si la base refuse */
  const saveBoth = (list: EmbEntry[]) => {
    store.setShared({ emb: list });
    store.setLocal({ emb: list });
  };

  // le modèle se recalcule quand le journal change, sinon toutes les 5 minutes : l'ajustement du moteur est trop coûteux pour chaque rendu
  // store.nowMin est l'heure du jour ; le moteur compte en minutes depuis l'origine (aujourd'hui = jour TODAY_INDEX)
  const nowAbs = TODAY_INDEX * MIN_PER_DAY + store.nowMin;
  const tick = Math.floor(nowAbs / 5);
  const model = useMemo(
    () => buildModel({ events: store.events, origin: store.origin, nowMin: nowAbs, run: store.run, birthAt: store.hasBaby ? store.birthAt : null, babyName: store.babyName }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.events, store.run, store.hasBaby, store.birthAt, store.babyName, tick],
  );

  // une habitude qui se valide est cousue une fois, puis gardée
  useEffect(() => {
    if (!model.ok) return;
    const { list, fresh: added } = mergeEmb(storedRef.current, model, Date.now());
    if (!added.length) return;
    saveBoth(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const props = useMemo<CmpProps>(
    () => ({
      model, emb: stored, fresh, markSeen,
      saveEmb: saveBoth,
      babyName: store.babyName,
      ageLine: `${store.babyName} · ${store.bc.age}`,
      ageMonths: store.hasBaby ? monthsOld(store.birthAt, new Date()) : 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, store.shared.emb, store.local.emb, fresh, store.babyName, store.bc.age, store.birthAt, store.hasBaby],
  );

  return <DcHost template={cmpTemplate} Logic={CmpLogic} logicProps={props as unknown as Record<string, unknown>} components={COMPONENTS} />;
}

/** Si un calcul échoue, seule cette page le dit : le reste de l'app continue de fonctionner. */
class Boundary extends ReactComponent<{ children?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <p className="cp-empty" role="alert">
          La page Comprendre n’a pas pu se calculer pour l’instant. Le reste de l’app fonctionne ; recharge la page pour réessayer.
        </p>
      );
    return this.props.children;
  }
}

export function Comprendre({ store }: { store: ViewStore }) {
  return (
    <Boundary>
      <ComprendrePage store={store} />
    </Boundary>
  );
}
