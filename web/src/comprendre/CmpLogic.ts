// La logique de la page Comprendre : les mêmes états et gestes que la maquette validée (maquettes/v7-comprendre/Main.dc.html),
// mais alimentés par le modèle réel (model.ts) et par les broderies enregistrées (embroidery.ts).
import { DCLogic, type Scope } from '@/legacy/dc-engine';
import { type EmbEntry, resolveEmb, type EmbView } from './embroidery';
import type { Bar, CmpModel, Disc, MoreId, Sec, StKey } from './model';

const ST: Record<StKey, [string, string]> = {
  constate: ['Constaté', 'st-ok'], dessine: ['Se dessine', 'st-bu'], tendance: ['Une tendance se dessine', 'st-bu'],
  fragile: ['Encore fragile', 'st-ne'], main: ['Cousu à la main', 'st-ro'], passe: ['Habitude passée', 'st-ne'], pas: ['Pas encore noté', 'st-ne'],
};
const SEW: Array<[string, string]> = [['smile', 'Sourire'], ['heart', 'Câlin'], ['drop', 'Bain'], ['sun', 'Sortie'], ['roll', 'Retournement'], ['flower', 'Autre']];

interface SitText { a: string; b: string; est: boolean }
const SIT: Record<string, SitText> = {
  awake: { a: 'Éveillé', b: 'Il est éveillé.', est: false },
  night: { a: 'Nuit', b: 'Un dodo de nuit est en cours.', est: false },
  nap: { a: 'Sieste', b: 'Un dodo de jour est en cours.', est: false },
  fell: { a: 'Vient de s’endormir', b: 'Dodo commencé il y a quelques minutes.', est: false },
  woke: { a: 'Vient de se réveiller', b: 'Dodo terminé il y a quelques minutes.', est: false },
  approach: { a: 'Éveillé', b: 'Sa fenêtre de sieste habituelle approche (estimé).', est: true },
  new: { a: 'Éveillé', b: 'Une broderie vient d’être cousue.', est: false },
  none: { a: 'Aucun enregistrement récent', b: 'Rien n’est supposé.', est: true },
};

export interface CmpProps {
  model: CmpModel;
  emb: EmbEntry[];
  /** clés des broderies cousues à l'instant : Filou serre son doudou, une seule fois */
  fresh: string[];
  saveEmb(list: EmbEntry[]): void;
  babyName: string;
  ageLine: string;
  ageMonths: number;
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

export class CmpLogic extends DCLogic {
  private _bt: ReturnType<typeof setTimeout> | undefined;
  private _car: HTMLElement | null = null;
  private _drag = false;

  private get p(): CmpProps {
    return this.props as unknown as CmpProps;
  }
  private g<T>(k: string, d: T): T {
    const v = this.state[k];
    return v === undefined ? d : (v as T);
  }
  componentWillUnmount(): void {
    clearTimeout(this._bt);
  }

  private openDisc(id: string, from: string | null): void {
    this.setState({ sheet: 'disc', discId: id, from });
  }
  private closeSheet(): void {
    const from = this.g<string | null>('from', null);
    if (this.g('sheet', null) === 'disc' && from) this.setState({ sheet: from, from: null });
    else this.setState({ sheet: null, from: null });
  }
  private hideBubble(): void {
    clearTimeout(this._bt);
    this.setState({ bub: -1 });
  }

  /** Carrousel des repères : au doigt c'est natif ; à la souris on ajoute le glisser et l'accroche sur la page la plus proche. */
  private bindCar(el: HTMLElement | null): void {
    this._car = el;
    if (!el || (el as unknown as { _bd?: boolean })._bd) return;
    (el as unknown as { _bd?: boolean })._bd = true;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const x0 = e.clientX, s0 = el.scrollLeft;
      let moved = 0;
      this._drag = false;
      el.style.scrollSnapType = 'none';
      const mv = (ev: PointerEvent) => {
        const dx = ev.clientX - x0;
        moved = Math.max(moved, Math.abs(dx));
        if (moved > 6) this._drag = true;
        el.scrollLeft = s0 - dx;
      };
      const up = () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        const w = el.clientWidth + 10;
        const i = Math.max(0, Math.min(2, Math.round(el.scrollLeft / w)));
        el.style.scrollSnapType = '';
        el.scrollTo({ left: i * w, behavior: 'smooth' });
        setTimeout(() => {
          this._drag = false;
        }, 60);
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  renderVals(): Scope {
    const { model, emb, fresh, babyName, ageLine, ageMonths } = this.p;
    const sheet = this.g<string | null>('sheet', null);
    const dn = this.g('dn', 'day');
    const jOpen = this.g('jOpen', false);
    const cOpen = this.g('cOpen', false);
    const cg = this.g('cg', 0);
    const day = dn === 'day';
    const ok = model.ok;
    const st = (k: StKey) => ST[k] ?? ST.fragile;
    const views: EmbView[] = resolveEmb(emb, model);
    const viewOf = (key: string) => views.find((v) => v.key === key);

    // ---- portrait : situation, puce, bulle, écharpe
    const sit = fresh.length && (model.situation === 'awake' || model.situation === 'none') ? 'new' : model.situation;
    const cur = SIT[sit] ?? SIT.awake!;
    const bubI = this.g('bub', -1);
    let bub = { t: '', has: false, open: () => undefined as void };
    if (bubI >= 0) {
      const ids = model.bubbles;
      if (!ids.length) bub = { t: 'Nous apprenons encore à connaître son rythme.', has: false, open: () => undefined };
      else {
        const id = ids[bubI % ids.length]!;
        bub = { t: model.disc[id]!.phrase, has: true, open: () => { this.hideBubble(); this.openDisc(id, null); } };
      }
    }
    const ribList = views.filter((v) => !v.hidden && v.active);
    const ribItems = ribList.slice(0, 6).map((v) => ({ href: `#s-${v.sym}`, dash: v.st === 'dessine' || v.st === 'tendance' ? 'dash' : '', cls: v.hand ? 'hand' : '' }));

    // ---- à retenir
    const keeps = model.keeps.map((k) => {
      const d = model.disc[k.key]!, t = st(d.st);
      return { title: k.title, tint: d.tint, href: `#s-${d.sym}`, stLab: t[0], stCls: t[1], base: d.base.split(' · À rapprocher')[0]!, fresh: fresh.includes(k.key), open: () => this.openDisc(k.key, null) };
    });

    // ---- repères en carrousel
    const tiles = model.tiles.map((t) => ({
      k: t.k, ti: t.ti, href: `#s-${t.sym}`, v: t.v, s: t.s, dots: [0, 1, 2].map((i) => (i < t.d ? 'on' : '')),
      go: () => {
        if (!ok || this._drag) return;
        if (t.to[0] === 'd') {
          if (model.disc[t.to[1]]) this.openDisc(t.to[1], null);
          else this.setState({ sheet: 'more', moreId: 'sleep', from: null });
        } else this.setState({ sheet: 'more', moreId: t.to[1], from: null });
      },
    }));
    const cpage = this.g('cpage', 0);
    const tilePages = [0, 1, 2].map((i) => ({ items: tiles.slice(i * 2, i * 2 + 2) }));
    const pdots = [0, 1, 2].map((i) => ({
      l: `Page ${i + 1} sur 3`, cls: i === cpage ? 'on' : '',
      go: () => { if (this._car) this._car.scrollTo({ left: i * (this._car.clientWidth + 10), behavior: 'smooth' }); },
    }));

    // ---- journée / nuit
    const fr = day ? model.day : model.night;
    const caps = (fr?.caps ?? []).map((c) => ({ l: pct(c.l), w: pct(c.w) }));
    const dots = (fr?.dots ?? []).map((l) => ({ l: pct(l) }));
    const axis = (fr?.axis ?? []).map((a) => ({ t: a.t, l: pct(a.l), cls: a.cls }));
    const steps = (fr?.steps ?? []).map((s) => ({ ...s, dots: s.dots ?? [] }));

    // ---- ce qui change
    const barsOf = (arr: Bar[]) => arr.map((b, i) => ({ l: b.l, v: b.v, h: `${b.pct}%`, cls: b.inc && i === arr.length - 1 ? 'inc' : '' }));
    const C = model.ch[Math.min(cg, Math.max(0, model.ch.length - 1))];
    const chChips = model.ch.map((c, i) => {
      const on = cOpen && i === cg;
      return { l: c.l, cls: on ? 'on' : '', exp: on, pick: () => this.setState(on ? { cOpen: false } : { cOpen: true, cg: i }) };
    });
    const cst = st(C?.st ?? 'pas');

    // ---- aller plus loin
    const moreCards = (['sleep', 'naps', 'food', 'links'] as MoreId[]).map((id) => {
      const m = model.more[id];
      return { t: m.t, tint: m.tint, href: `#s-${m.sym}`, line: m.line, key: m.key, open: () => this.setState({ sheet: 'more', moreId: id }) };
    });
    const M = model.more[this.g<MoreId>('moreId', 'sleep')];
    const secOf = (x: Sec) => {
      const t = st(x.st);
      return { q: x.q, ph: x.ph, stLab: t[0], stCls: t[1], base: x.base, hasBars: !!x.bars, bars: x.bars ? barsOf(x.bars) : [], hasRows: !!x.rows && x.rows.length > 0, rows: (x.rows ?? []).map((r) => ({ k: r.k, v: r.v, p: r.p ?? '', hasP: !!r.p })) };
    };
    const more = { t: M.t, tint: M.tint, href: `#s-${M.sym}`, bul: M.bul, sec: M.sec.map(secOf) };

    // ---- fiche d'une découverte (ou d'une broderie)
    const did = this.g('discId', 'wake');
    const dv = viewOf(did);
    const dd: Disc | undefined = model.disc[did];
    const hid = !!dv?.hidden;
    const dT = st(dv ? dv.st : (dd?.st ?? 'fragile'));
    const dSym = dv?.sym ?? dd?.sym ?? 'sun';
    const dFlags = dd && !dv?.hand ? dd.flags : [];
    const dMore = dd?.more ?? dv?.more;
    const disc = {
      tint: dv?.tint ?? dd?.tint ?? 'ti-but', href: `#s-${dSym}`, dash: (dv ? dv.st : dd?.st) === 'dessine' || (dv ? dv.st : dd?.st) === 'tendance' ? 'dash' : '',
      stLab: dT[0], stCls: dT[1], phrase: dv?.phrase ?? dd?.phrase ?? '', base: dv?.base ?? dd?.base ?? '',
      hasDots: dFlags.length > 0, dots: dFlags.map((f) => (f ? 'on' : '')), lab: dd?.lab ?? '',
      hasNote: !!dv?.note, note: dv?.note ?? '', isPast: !!dv && !dv.active && !dv.hand,
      hasMore: !!dMore, goMore: () => this.setState({ sheet: 'more', moreId: dMore, from: null }),
      canHide: !!dv, hideLab: hid ? 'Réafficher cette broderie' : 'Masquer cette broderie',
    };

    // ---- album
    const row = (v: EmbView) => ({ phrase: v.phrase, tint: v.tint, href: `#s-${v.sym}`, dash: v.st === 'dessine' || v.st === 'tendance' ? 'dash' : '', sub: v.sub, off: v.hidden ? 'off' : '', open: () => this.openDisc(v.key, 'album') });
    const appRows = views.filter((v) => !v.hand && v.active).map(row);
    const handRows = views.filter((v) => v.hand).map(row);
    const pastRows = views.filter((v) => !v.hand && !v.active).map(row);
    const ageSel = Math.min(this.g('ageSel', Math.min(2, ageMonths)), Math.min(2, ageMonths));
    const maxAge = Math.min(2, ageMonths);
    const ageLabels = ['Naissance', '1 mois', ageMonths > 2 ? '2 mois et plus' : '2 mois'];
    const ageChips = [0, 1, 2].filter((a) => a <= maxAge).map((a) => ({ l: `${ageLabels[a]}${a === maxAge ? ' · aujourd’hui' : ''}`, cls: ageSel === a ? 'on' : '', pick: () => this.setState({ ageSel: a }) }));

    // ---- souvenir à coudre
    const sewSym = this.g('sewSym', 'smile');
    const sewSyms = SEW.map((x) => ({ l: x[1], href: `#s-${x[0]}`, cls: sewSym === x[0] ? 'on' : '', pick: () => this.setState({ sewSym: x[0] }) }));
    const today = new Date();
    const todayText = `${today.getDate()} ${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][today.getMonth()]}`;

    return {
      yes: true, no: false,
      sit, sparse: !ok, babyName, ageLine, heroAge: Math.min(2, ageMonths),
      medalOn: ribList.length > 0, medalSym: ribList[0]?.sym ?? 'cloud', skip: 0, paciOn: true,
      onPose: () => undefined,
      onFoxTap: () => {
        const n = this.g('bn', -1) + 1;
        clearTimeout(this._bt);
        this.setState({ bub: n, bn: n });
        this._bt = setTimeout(() => this.setState({ bub: -1 }), 8000);
      },
      bubOn: bubI >= 0, bub, hideBub: () => this.hideBubble(),
      chipA: cur.a, chipB: cur.b, chipDot: cur.est ? 'est' : '',
      ribItems, ribEmpty: ribItems.length === 0,
      openAlbum: () => this.setState({ sheet: 'album', from: null }),
      keeps, keepsEmpty: keeps.length === 0, keepsFull: keeps.length > 0,
      keepsMsg: ok ? 'Nous apprenons encore à connaître son rythme : rien d’assez solide à raconter pour l’instant. Aucune saisie en plus n’est nécessaire.' : 'Nous apprenons encore à connaître son rythme : il faut au moins 3 journées notées en entier. Aucune saisie en plus n’est nécessaire.',
      tilePages, pdots, basis: model.basis,
      setCar: (el: HTMLElement | null) => this.bindCar(el),
      onCar: (e: { currentTarget: HTMLElement }) => {
        const el = e.currentTarget;
        const i = Math.round(el.scrollLeft / (el.clientWidth + 10));
        if (i !== this.g('cpage', 0)) this.setState({ cpage: i });
      },
      setJ: () => undefined,
      jOpen, segFold: jOpen ? '' : 'nm',
      segDay: jOpen && day ? 'on' : '', segNight: jOpen && !day ? 'on' : '',
      dayExp: jOpen && day, nightExp: jOpen && !day,
      showDay: () => this.setState(jOpen && day ? { jOpen: false } : { jOpen: true, dn: 'day' }),
      showNight: () => this.setState(jOpen && !day ? { jOpen: false } : { jOpen: true, dn: 'night' }),
      dayView: day, nightView: !day,
      frEmpty: !fr, frFull: !!fr,
      frMsg: day ? 'La journée type apparaît dès 3 journées notées en entier.' : 'La nuit type apparaît dès 3 nuits notées en entier.',
      brief: fr?.brief ?? '', frCls: day ? '' : 'n', caps, dots, axis, mealLab: fr?.mealLab ?? '', mealPills: fr?.mealPills ?? [], frBase: fr?.base ?? '',
      lastDayLine: model.lastDayLine,
      lastNightLine: model.more.night.bul[0] ? `La nuit dernière : ${model.more.night.bul[0]!.charAt(0).toLowerCase()}${model.more.night.bul[0]!.slice(1)}` : '',
      openLastNight: () => this.setState({ sheet: 'more', moreId: 'night' }),
      openLastDay: () => this.setState({ sheet: 'more', moreId: 'day' }),
      openSteps: () => this.setState({ sheet: 'steps' }), showSteps: sheet === 'steps', steps,
      stepsTitle: day ? 'Sa journée, étape par étape' : 'Sa nuit, étape par étape',
      stepsBase: fr?.base ?? '',
      cOpen, chFold: cOpen ? '' : 'nm', chChips, chEmpty: model.ch.length === 0, chFull: model.ch.length > 0,
      chQ: C?.q ?? '', chBars: barsOf(C?.bars ?? []), chPh: C?.ph ?? '', chStLab: cst[0], chStCls: cst[1], chBase: C?.base ?? '',
      moreCards,
      showDisc: sheet === 'disc', disc, toggleHide: () => this.p.saveEmb(emb.map((e) => (e.key === did ? { ...e, hidden: !e.hidden } : e))),
      closeSheet: () => this.closeSheet(),
      showAlbum: sheet === 'album', appRows, handRows, pastRows, embEmpty: appRows.length + handRows.length + pastRows.length === 0, ageSel, ageChips, ageMedal: ageSel >= 1,
      openSew: () => this.setState({ sheet: 'sew', sewTitle: '', sewDate: todayText }),
      showSew: sheet === 'sew', closeSew: () => this.setState({ sheet: 'album' }),
      sewSyms, sewTitle: this.g('sewTitle', ''), sewDate: this.g('sewDate', todayText),
      setSewTitle: (e: { target: { value: string } }) => this.setState({ sewTitle: e.target.value }),
      setSewDate: (e: { target: { value: string } }) => this.setState({ sewDate: e.target.value }),
      saveSew: () => {
        const t = this.g('sewTitle', '').trim() || 'Un souvenir';
        const date = this.g('sewDate', todayText) || todayText;
        this.p.saveEmb([{ key: `m${Date.now()}`, at: Date.now(), phrase: t, sym: sewSym, tint: 'ti-rose', st: 'main', hand: true, date }, ...emb]);
        this.setState({ sheet: 'album' });
      },
      showMore: sheet === 'more', more,
    };
  }
}
