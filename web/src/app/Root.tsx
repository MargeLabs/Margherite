'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { blankStore, useHousehold } from '@/data/household';
import { LOCAL_KEY, LocalRepo } from '@/data/localRepo';
import { SupabaseRepo } from '@/data/supabaseRepo';
import type { Repo } from '@/data/repo';
import { AppView } from '@/legacy/AppView';
import { config, configProblem } from '@/lib/config';
import { useAutoUpdate } from '@/lib/autoUpdate';
import { originOf } from '@/lib/time';
import { signInWithFamilyCode, supabase } from '@/lib/supabase';

type Overrides = Record<string, string>;

function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <div className="app look-jardin" style={{ display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: 'var(--mut)' }}>
      {children}
    </div>
  );
}

function Household({ repo, fixedNow, overrides, onLogout }: { repo: Repo; fixedNow?: Date; overrides: Overrides; onLogout: () => void }) {
  const opts = useMemo(() => ({ fixedNow, onLogout }), [fixedNow, onLogout]);
  const { store, loadError, notice, retry } = useHousehold(repo, opts);
  if (loadError)
    return (
      <Splash>
        <div style={{ display: 'grid', gap: 12 }}>
          <p>Les données ne se chargent pas. {loadError}</p>
          <button className="btn btn-p" type="button" onClick={() => void retry()}>
            Réessayer
          </button>
        </div>
      </Splash>
    );
  if (!store) return <Splash />;
  return (
    <>
      <AppView store={store} overrides={overrides} />
      {notice ? (
        <div role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 448, margin: '0 auto', padding: '12px 16px', borderRadius: 16, background: '#2E2A44', color: '#fff', font: '600 14px system-ui', zIndex: 50 }}>
          {notice}
        </div>
      ) : null}
    </>
  );
}

/** Développement et tests : dépôt dans le navigateur, avec en option les 28 jours d'exemple (?demo=1) et une heure figée (?now=…). */
function LocalApp({ overrides }: { overrides: Overrides }) {
  const [repo] = useState(() => new LocalRepo());
  const fixedNow = useMemo(() => (overrides.now ? new Date(overrides.now) : undefined), [overrides.now]);
  const [ready, setReady] = useState(!overrides.demo);
  const logout = useCallback(() => undefined, []);
  useEffect(() => {
    if (!overrides.demo || localStorage.getItem(LOCAL_KEY)) {
      setReady(true);
      return;
    }
    void (async () => {
      const { demoSnapshot } = await import('@/data/demo');
      const { snapshot, mine } = await demoSnapshot(originOf(fixedNow ?? new Date()));
      localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot));
      localStorage.setItem('margherite.prefs.v1', JSON.stringify({ mine }));
      setReady(true);
    })();
  }, [overrides.demo, fixedNow]);
  return ready ? <Household repo={repo} fixedNow={fixedNow} overrides={overrides} onLogout={logout} /> : <Splash />;
}

function RemoteApp({ overrides }: { overrides: Overrides }) {
  const [session, setSession] = useState<'loading' | 'in' | 'out'>('loading');
  const repo = useMemo(() => new SupabaseRepo(), []);
  useEffect(() => {
    const sb = supabase();
    void sb.auth.getSession().then(({ data }) => setSession(data.session ? 'in' : 'out'));
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s ? 'in' : 'out'));
    return () => data.subscription.unsubscribe();
  }, []);
  const logout = useCallback(() => void supabase().auth.signOut(), []);
  const gate = useMemo(() => blankStore(new Date(), { gate: { submit: signInWithFamilyCode } }), []);
  if (session === 'loading') return <Splash />;
  if (session === 'out') return <AppView store={gate} overrides={overrides} />;
  return <Household repo={repo} overrides={overrides} onLogout={logout} />;
}

export function Root() {
  useAutoUpdate();
  const [overrides, setOverrides] = useState<Overrides | null>(null);
  useEffect(() => {
    // les réglages d'URL (?demo, ?now, ?screen…) ne servent qu'en mode local
    setOverrides(config.dataMode === 'local' ? Object.fromEntries(new URLSearchParams(window.location.search).entries()) : {});
  }, []);
  const problem = configProblem();
  if (problem) return <Splash>{problem}</Splash>;
  if (!overrides) return <Splash />;
  return config.dataMode === 'local' ? <LocalApp overrides={overrides} /> : <RemoteApp overrides={overrides} />;
}

