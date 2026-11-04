'use client';

// Filou, le renardeau de Canaille : même dessin et mêmes poses que la maquette validée (maquettes/v7-comprendre/Filou.dc.html).
// Trois couches : la situation (donnée réelle ou estimée) décide de la pose de base, sans saut (poses « passerelles ») ;
// l'ambiance continue (respiration, clignements, oreilles) suit le tempo ; des comportements ponctuels sont tirés sans répétition visible.
import React from 'react';
import { FILOU_DEFS, FILOU_SCENE } from './filou.generated';

export type Situation = 'awake' | 'night' | 'nap' | 'fell' | 'woke' | 'approach' | 'new' | 'none';

export interface FilouProps {
  situation?: Situation | string;
  age?: number | string;
  medal?: boolean;
  /** symbole de la broderie la plus récente, posée sur le médaillon */
  symbol?: string;
  paci?: boolean;
  vol?: number | string;
  still?: boolean;
  defs?: boolean;
  skipTick?: number;
  onPose?: (label: string) => void;
  onTap?: (mode: string) => void;
}

interface State {
  mode: string;
  calmLvl: number;
  fresh: boolean;
  stir: boolean;
  /** pose qui s'efface pendant que la nouvelle apparaît (fondu enchaîné), et numéro de la couche courante */
  out: { mode: string; k: number } | null;
  gen: number;
}

type Step = [mode: string, ms: number, label: string];

const NAMES: Record<string, string> = {
  balade: 'Il se balade', play: 'Il joue avec sa pelote', groom: 'Toilette', sneeze: 'Atchoum, une marguerite', roll: 'Roulade', sit: 'Assis tranquille, suit le papillon',
};
const DUR: Record<string, number> = { play: 4900, groom: 4300, sneeze: 3500, roll: 3100 };
const ORDERS: string[][] = [
  ['balade', 'groom', 'play', 'balade', 'sneeze', 'play', 'balade', 'roll'],
  ['balade', 'groom', 'balade', 'sit'],
  ['balade', 'sit', 'groom', 'sit'],
  ['balade', 'sit', 'balade', 'groom', 'sit'],
];

export class Filou extends React.Component<FilouProps, State> {
  state: State = { mode: 'awake', calmLvl: 0, fresh: false, stir: false, out: null, gen: 0 };
  private outT: ReturnType<typeof setTimeout> | undefined;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private cycle = 0;
  private tapN = 0;
  private busy = false;
  private lvl = 0;
  private waitIter = false;
  private root: HTMLDivElement | null = null;
  private iter = (e: AnimationEvent) => {
    if (!this.waitIter || e.animationName !== 'flWander') return;
    if (!(e.target instanceof HTMLElement) || !e.target.classList.contains('fl-walk')) return;
    this.waitIter = false;
    this.loop();
  };

  componentDidMount(): void {
    this.apply(String(this.props.situation ?? 'awake'), true);
    this.syncMedal();
  }

  componentDidUpdate(prev: FilouProps): void {
    if (prev.situation !== this.props.situation) this.apply(String(this.props.situation ?? 'awake'), false);
    if (prev.skipTick !== this.props.skipTick) this.skip();
    if (prev.symbol !== this.props.symbol) this.syncMedal();
  }

  componentWillUnmount(): void {
    this.clear();
    this.root?.removeEventListener('animationiteration', this.iter);
    clearTimeout(this.outT);
  }

  private syncMedal(): void {
    const use = this.root?.querySelector('.fl-a-medal use');
    if (use) use.setAttribute('href', `#s-${this.props.symbol || 'cloud'}`);
  }

  /**
   * Change de pose sans à-coup : la pose actuelle garde son élément (donc son animation continue) et s'efface,
   * pendant que la suivante apparaît par-dessus. Seul Filou fond ; le décor ne bouge pas.
   */
  private go(mode: string, instant = false): void {
    if (instant) {
      this.setState({ mode });
      return;
    }
    this.setState((s) => (s.mode === mode ? null : { out: { mode: s.mode, k: s.gen }, mode, gen: s.gen + 1 }));
    clearTimeout(this.outT);
    this.outT = setTimeout(() => this.setState({ out: null }), 700);
  }

  private clear(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private say(label: string): void {
    this.props.onPose?.(label);
  }

  private sleeping(): boolean {
    return this.state.mode === 'nap' || this.state.mode === 'night';
  }

  /** Enchaîne des poses [mode, durée ms, libellé], puis appelle done. */
  private seq(steps: Step[], done?: () => void): void {
    let i = 0;
    const next = () => {
      if (i >= steps.length) {
        this.busy = false;
        done?.();
        return;
      }
      const s = steps[i++]!;
      this.go(s[0]);
      this.say(s[2]);
      this.later(s[1], next);
    };
    this.busy = true;
    next();
  }

  private apply(sit: string, initial: boolean): void {
    this.clear();
    if (this.props.still) {
      this.setState({ mode: 'awake', calmLvl: 3 });
      return;
    }
    this.busy = false;
    this.lvl = 0;
    const target = sit === 'night' ? 'night' : sit === 'nap' || sit === 'fell' ? 'nap' : null;
    this.setState({ calmLvl: sit === 'none' ? 3 : 0, fresh: sit === 'new', stir: false });
    if (target) {
      const label = target === 'night' ? 'Dort paisiblement (nuit)' : 'Dort (sieste)';
      if (initial || this.sleeping()) {
        this.go(target, initial);
        this.say(label);
        return;
      }
      /* Déjà posé (assis ou couché) : il s'allonge directement. Sinon il se détend, puis se couche. */
      const m = this.state.mode;
      if (m === 'sit' || m === 'lie') this.seq([['lie', 2200, 'S’allonge, se détend'], [target, 1, label]]);
      else this.seq([['tired', 3200, 'Se détend, ferme les yeux'], ['lie', 2000, 'S’installe pour dormir'], [target, 1, label]]);
      return;
    }
    if (this.sleeping()) {
      this.cycle = 0;
      this.seq([['lie', 1800, 'Rouvre un œil'], ['stretch', 2800, 'S’étire, baille']], () => this.loop());
      return;
    }
    if (sit === 'woke') {
      this.cycle = 0;
      this.seq([['stretch', 2800, 'S’étire, baille']], () => this.loop());
      return;
    }
    if (sit === 'new' && !initial) {
      this.seq([['hug', 3900, 'Câlin au doudou : une broderie vient d’être cousue']], () => this.loop());
      return;
    }
    this.loop();
  }

  /** Boucle d'éveil : balade et jeu en alternance, avec des intermèdes variés. Calme progressif en approche de la fenêtre habituelle. */
  private loop(): void {
    this.clear();
    const sit = String(this.props.situation ?? 'awake');
    const lvl = sit === 'none' ? 3 : sit === 'approach' ? Math.min(3, this.lvl) : 0;
    if (sit === 'approach') this.lvl += 1;
    this.setState({ calmLvl: lvl });
    const order = ORDERS[lvl]!;
    const kind = order[this.cycle % order.length]!;
    this.cycle += 1;
    const sitMs = [8000, 8000, 11000, 15000][lvl]!;
    const walkMs = [26000, 32000, 38000, 44000][lvl]!;
    this.say(NAMES[kind] ?? kind);
    this.waitIter = false;
    if (kind === 'balade') {
      this.go('awake');
      this.waitIter = true;
      this.later(walkMs, () => this.loop());
    } else if (kind === 'sit') {
      this.go('sit');
      this.later(sitMs, () => this.loop());
    } else {
      this.go(kind);
      this.later((DUR[kind] ?? 3000) + 600, () => this.loop());
    }
  }

  private skip(): void {
    if (this.busy || this.sleeping()) return;
    this.loop();
  }

  private tap = (): void => {
    this.props.onTap?.(this.state.mode);
    if (this.busy) return;
    if (this.sleeping()) {
      this.setState({ stir: true });
      this.later(1500, () => this.setState({ stir: false }));
      return;
    }
    this.clear();
    const order = ['sneeze', 'play', 'roll'];
    const m = order[this.tapN % 3]!;
    this.tapN += 1;
    this.seq([[m, (DUR[m] ?? 3000) + 400, NAMES[m] ?? m]], () => this.loop());
  };

  private onClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest('.fl-hit')) this.tap();
  };

  private setRoot = (el: HTMLDivElement | null): void => {
    this.root?.removeEventListener('animationiteration', this.iter);
    this.root = el;
    el?.addEventListener('animationiteration', this.iter);
    if (el) this.syncMedal();
  };

  render(): React.ReactNode {
    const { mode, calmLvl, fresh, stir, out, gen } = this.state;
    const age = this.props.age === undefined || this.props.age === null ? 2 : Number(this.props.age);
    let common = `fl-acc-scarf fl-age${age}`;
    if (age >= 2) common += ' fl-acc-daisy';
    if (age === 0) common += ' fl-acc-bonnet';
    if (this.props.medal) common += ' fl-acc-medal';
    if (calmLvl) common += ` fl-calm fl-calm${calmLvl}`;
    if (calmLvl >= 2 && this.props.paci !== false && this.props.situation === 'approach') common += ' fl-paci';
    if (stir) common += ' fl-stir';
    if (fresh) common += ' fl-new';
    const vol = this.props.vol === undefined || this.props.vol === null ? 1 : Number(this.props.vol);
    if (vol) common += ` fl-vol${vol}`;
    if (this.props.still) common += ' fl-still';
    const label = 'Filou, le renardeau masqué de Canaille, vit au rythme du bébé';
    return (
      <div style={{ position: 'relative', width: '100%', maxWidth: 358, margin: '0 auto' }}>
        {this.props.defs !== false ? <div style={{ position: 'absolute', width: 0, height: 0 }} dangerouslySetInnerHTML={{ __html: FILOU_DEFS }} /> : null}
        {/* le décor : jamais recréé, ses animations ne sautent pas */}
        <div className={`fl-scene fl-lyr-bg fl-s-${mode} ${common}`} role="img" aria-label={label} onClick={this.onClick} dangerouslySetInnerHTML={{ __html: FILOU_SCENE }} />
        {/* Filou : une couche par pose, la précédente s'efface sous la nouvelle */}
        {out ? <div key={`c${out.k}`} className={`fl-scene fl-lyr-ch fl-xout fl-s-${out.mode} ${common}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: FILOU_SCENE }} /> : null}
        <div key={`c${gen}`} ref={this.setRoot} className={`fl-scene fl-lyr-ch ${gen > 0 ? 'fl-xin' : ''} fl-s-${mode} ${common}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: FILOU_SCENE }} />
      </div>
    );
  }
}
