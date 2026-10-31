// GÉNÉRÉ par scripts/gen-view.mjs depuis la maquette V5 : ne pas modifier à la main.
// eslint-disable
export function createLogicClass(DCLogic) {
class Component extends DCLogic {
  componentDidMount() {
    this._m = Date.now();
    this._tick = setInterval(() => this.forceUpdate(), 20000);
  }
  componentDidUpdate() {
    const s = this.st(), k = (s.tab || '') + '/' + (s.sub || '') + (s.cview || '') + '/' + (s.pday || 0) + '/' + (s.jd || 0) + '/' + (s.ni || 0);
    if (this._noTop) this._noTop = false;
    else if (this._main && this._k !== undefined && this._k !== k) this._main.scrollTop = 0;
    this._k = k;
    this.cwSync();
  }
  clkBind(el) {
    if (!el || el._ck) return;
    el._ck = true;
    let x0 = 0, y0 = 0, dx = 0, id = null, drag = false;
    const day = () => this.st().pday || 0;
    el.addEventListener('pointerdown', (e) => { if (e.button !== 0 || this._anim) return; x0 = e.clientX; y0 = e.clientY; dx = 0; id = e.pointerId; drag = false; });
    el.addEventListener('pointermove', (e) => {
      if (id === null || e.pointerId !== id) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!drag) { if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my)) return; drag = true; el.setPointerCapture(id); el.style.transition = 'none'; }
      dx = mx;
      const blocked = (dx > 0 && day() >= 6) || (dx < 0 && day() <= 0);
      el.style.transform = 'translateX(' + (blocked ? dx * 0.25 : dx) + 'px)';
      el.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / 500));
    });
    const end = () => {
      if (id === null) return;
      id = null;
      if (!drag) return;
      drag = false; this._ckMoved = true; setTimeout(() => { this._ckMoved = false; }, 0);
      const next = dx > 70 ? day() + 1 : dx < -70 ? day() - 1 : day();
      if (next === day() || next < 0 || next > 6) {
        el.style.transition = 'transform .2s ease-out, opacity .2s'; el.style.transform = ''; el.style.opacity = '';
        setTimeout(() => { el.style.transition = ''; }, 220);
        return;
      }
      const w = (dx > 0 ? 1 : -1) * (el.offsetWidth + 40);
      this._anim = true;
      el.style.transition = 'transform .16s ease-in, opacity .16s'; el.style.transform = 'translateX(' + w + 'px)'; el.style.opacity = '0';
      setTimeout(() => {
        this._noTop = true; this.setState({ pday: next, csel: '' });
        el.style.transition = 'none'; el.style.transform = 'translateX(' + (-w) + 'px)'; void el.offsetWidth;
        el.style.transition = 'transform .2s ease-out, opacity .2s'; el.style.transform = ''; el.style.opacity = '';
        setTimeout(() => { el.style.transition = ''; this._anim = false; }, 220);
      }, 160);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', (e) => { if (this._ckMoved) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  cwBind(el) {
    this._cw = el;
    if (!el || el._cb) return;
    el._cb = true;
    el.addEventListener('scroll', () => this.cwSync(), { passive: true });
    requestAnimationFrame(() => this.cwSync());
  }
  cwStep(el) { const f = el.firstElementChild; return f ? f.offsetWidth + 12 : 1; }
  cwSync() {
    const el = this._cw;
    if (!el || !el.parentElement) return;
    const dots = el.parentElement.querySelectorAll('.cw-dots button'), max = el.scrollWidth - el.clientWidth;
    const step = this.cwStep(el), pages = max > 0 ? Math.min(dots.length, Math.ceil(max / step) + 1) : 1;
    const on = el.scrollLeft >= max - 4 ? pages - 1 : Math.min(pages - 1, Math.round(el.scrollLeft / step));
    dots.forEach((d, n) => { d.style.display = n < pages ? '' : 'none'; d.classList.toggle('on', n === on); });
  }
  componentWillUnmount() {
    clearInterval(this._tick);
    clearTimeout(this._tt);
    clearTimeout(this._st);
  }
  st() { const t = this.props.store; return Object.assign({}, this.state || {}, t.shared, t.local, { baby: t.babyTitle }); }
  setState(o, cb) {
    const t = this.props.store, sh = {}, lo = {}, rest = {};
    Object.keys(o).forEach((k) => { (['trk', 'trl', 'notes', 'well', 'tipsX'].indexOf(k) >= 0 ? sh : ['cv', 'dstart'].indexOf(k) >= 0 ? lo : rest)[k] = o[k]; });
    if (Object.keys(sh).length) t.setShared(sh);
    if (Object.keys(lo).length) t.setLocal(lo);
    super.setState(rest, cb);
  }

  base() { return { ev: this.props.store.events, pump: this.props.store.pumps }; }

  toast(msg, undo) {
    clearTimeout(this._tt);
    this.setState({ toast: { msg, undo: undo || null } });
    this._tt = setTimeout(() => this.setState({ toast: null }), 5000);
  }

  renderVals() {
    const P = this.props, s = this.st();
    const pad = (x) => String(x).padStart(2, '0');
    const hm = (t) => { const m = ((Math.round(t) % 1440) + 1440) % 1440; return Math.floor(m / 60) + ':' + pad(m % 60); };
    const hhmm = (t) => { const m = ((Math.round(t) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
    const dur = (m) => { m = Math.round(m); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + pad(r) : ''); };
    const r5 = (x) => Math.round(x / 5) * 5;
    const fr1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
    const med = (a) => { if (!a.length) return null; const v = a.slice().sort((x, y) => x - y), k = Math.floor(v.length / 2); return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2; };
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const lohi = (a) => { const v = a.slice().sort((x, y) => x - y); return v.length >= 5 ? [v[1], v[v.length - 2]] : [v[0], v[v.length - 1]]; };
    const set = (o) => () => this.setState(o);
    const tm = (str) => { const x = String(str || '0:0').split(':'); return Number(x[0]) * 60 + Number(x[1]); };
    const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const MO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const dt = (d) => new Date(P.store.origin.getFullYear(), P.store.origin.getMonth(), P.store.origin.getDate() + d);
    const dShort = (d) => { const x = dt(d); return WD[x.getDay()].slice(0, 3) + '. ' + x.getDate(); };
    const rgW = (a, b, m) => dt(a).getDate() + (dt(a).getMonth() !== dt(b).getMonth() ? ' ' + MO[dt(a).getMonth()] : '') + ' au ' + dt(b).getDate() + (m || dt(a).getMonth() !== dt(b).getMonth() ? ' ' + MO[dt(b).getMonth()] : '');
    const dLong = (d) => { const x = dt(d); return WD[x.getDay()] + ' ' + x.getDate() + ' ' + MO[x.getMonth()]; };
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const win = (a, b) => { const r = []; for (let d = Math.max(0, a); d <= b; d++) r.push(d); return r; };

    // ---------- état ----------
    const etat = 'normal';
    const night = false;
    const theme = P.theme || 'auto';
    const dark = theme === 'sombre' || (theme === 'auto' && P.store.dark);
    const T0 = 27 * 1440;
    const NOW = T0 + P.store.nowMin;
    const nowL = hm(NOW);
    const noData = etat === 'vide' || etat === 'premier';
    const tab = s.tab || P.screen || 'accueil';
    const cview = s.cview || P.cview || 'ret'; // V5 : Comprendre = À retenir | Horaires et chiffres
    const propSheet = P.sheet && P.sheet !== 'aucune' ? P.sheet : null;
    const sheet = s.sheet !== undefined ? s.sheet : propSheet;

    // ---------- événements ----------
    const Bs = this.base();
    const edits = s.edits || {}, del = s.del || {}, added = s.added || [];
    let evs = [];
    if (!noData) {
      evs = Bs.ev.concat(added).filter((e) => !del[e.id]).map((e) => (edits[e.id] ? Object.assign({}, e, edits[e.id]) : e)).filter((e) => e.a <= NOW);
      if (etat === 'peu') evs = evs.filter((e) => e.a >= 24 * 1440);
    } else evs = added.filter((e) => !del[e.id]).map((e) => (edits[e.id] ? Object.assign({}, e, edits[e.id]) : e));
    evs.sort((x, y) => x.a - y.a);
    const runDef = night && !noData ? T0 + 1280 : null;
    const run = P.store.run;
    const SL = evs.filter((e) => e.k === 'sleep');
    const FD = evs.filter((e) => e.k === 'bib' || e.k === 'sein');
    const CH = evs.filter((e) => e.k === 'chg');

    // ---------- nuits et journées ----------
    const NI = {};
    const nightOf = (d) => {
      if (NI[d]) return NI[d];
      const lo = (d - 1) * 1440 + 1140, hi = d * 1440 + 540;
      // un bloc de nuit s'enchaîne au précédent si l'éveil entre les deux dure moins de 50 min ; au-delà, c'est la journée qui commence
      const sl = [];
      for (const x of SL) { if (x.a < lo || x.a >= hi) continue; if (sl.length && x.a - sl[sl.length - 1].b > 50) break; sl.push(x); }
      let r;
      if (!sl.length || sl[0].a > d * 1440 + 120) r = { d, st: 'absent', nf: FD.filter((f) => f.a >= lo && f.a < d * 1440 + 480).length };
      else {
        const bl = sl.map((x) => x.b - x.a), fw = sl[sl.length - 1].b;
        r = { d, st: fw < d * 1440 + 330 ? 'partiel' : 'ok', bed: sl[0].a, wake: fw, sl, bl, total: bl.reduce((a, b) => a + b, 0), longest: Math.max.apply(null, bl), wakings: sl.length - 1, nf: FD.filter((f) => f.a > sl[0].a && f.a < fw).length };
      }
      NI[d] = r;
      return r;
    };
    const DI = {};
    const dayOf = (d) => {
      if (DI[d]) return DI[d];
      const n0 = nightOf(d), n1 = nightOf(d + 1), D = d * 1440;
      const wake = n0.st === 'ok' ? n0.wake : null;
      const bed = n1.st !== 'absent' ? n1.bed : null;
      const evd = evs.filter((e) => e.a >= D && e.a < D + 1440);
      let gap = false;
      for (let i = 1; i < evd.length; i++) if (evd[i].a - evd[i - 1].a > 300 && evd[i - 1].a > D + 360) gap = true;
      const fed = d < 27 && evd.length > 0 && !gap;
      const complete = fed && wake !== null && bed !== null;
      const naps = wake !== null ? SL.filter((x) => x.a > wake + 5 && x.a < (bed !== null ? bed : D + 1140)) : [];
      const feeds = FD.filter((f) => f.a >= D && f.a < D + 1440);
      const r = {
        d, wake, bed, gap, fed, complete, naps,
        napsTotal: naps.reduce((t, x) => t + x.b - x.a, 0),
        sleep24: SL.reduce((t, x) => t + Math.max(0, Math.min(x.b, D + 1440) - Math.max(x.a, D)), 0),
        full24: complete && n1.st !== 'absent',
        feeds, ml: feeds.reduce((t, f) => t + (f.ml || 0), 0), sein: feeds.filter((f) => f.k === 'sein').length,
        dayFeeds: wake !== null && bed !== null ? FD.filter((f) => f.a >= wake && f.a < bed) : [],
      };
      DI[d] = r;
      return r;
    };

    // sur quoi repose une habitude ; la fiabilité de chaque créneau se lit sur la frise (plus il est marqué, plus il revient)
    const fiaOf = (n, w) => ({ basis: 'D’après ' + n + ' ' + w + 's notées en entier sur les 7 dernières.' });
    const FIA = ['', 'encore fragile', 'assez régulier', 'régulier'];
    const lvOf = (p, sp, n) => { const lv = Math.min(n >= 5 ? 3 : 2, Math.max(1, (p >= 0.8 ? 2 : p >= 0.5 ? 1 : 0) + (sp <= 20 ? 1 : 0))); return { hasF: true, fia: 'Fiabilité : ' + FIA[lv], dots: [1, 2, 3].map((k) => ({ cls: k <= lv ? 'on' : '' })) }; };
    // ---------- journée type (7 derniers jours complets) ----------
    const ORD = ['1re', '2e', '3e', '4e', '5e'];
    const cdays = win(20, 26).map(dayOf).filter((x) => x.complete);
    let typ = { ok: false, no: true, n: cdays.length, msg: '' };
    if (cdays.length >= 3) {
      const wk = cdays.map((x) => x.wake - x.d * 1440), bd = cdays.map((x) => x.bed - x.d * 1440);
      const nc = cdays.map((x) => x.naps.length);
      const naps = [];
      for (let k = 0; k < Math.max.apply(null, nc); k++) {
        const ks = cdays.filter((x) => x.naps.length > k).map((x) => x.naps[k]);
        if (ks.length < 2) continue;
        const st = ks.map((z) => z.a % 1440);
        const aws = cdays.filter((x) => x.naps.length > k).map((x) => x.naps[k].a - (k ? x.naps[k - 1].b : x.wake));
        naps.push({ k, a: med(st), du: med(ks.map((z) => z.b - z.a)), n: ks.length, lo: lohi(st)[0], hi: lohi(st)[1], aw: med(aws) });
      }
      const slots = [];
      for (let q = 0; q < 96; q++) {
        let c = 0;
        cdays.forEach((x) => { const t = x.d * 1440 + q * 15 + 7; if (SL.some((z) => z.a <= t && z.b > t)) c++; });
        slots.push(c / cdays.length >= 0.5);
      }
      const band = [];
      for (let q = 0; q < 96; q++) if (slots[q] && (q === 0 || !slots[q - 1] || q === 48)) { let e = q; while (e < 96 && slots[e] && !(e > q && e === 48)) e++; band.push({ a: q * 15, b: e * 15, calc: true }); }
      const wkR = lohi(wk), bdR = lohi(bd);
      // éveils : du réveil (ou de la sieste d'avant) à la sieste suivante ; un repas y tombe-t-il au moins un jour sur deux ?
      const jtAw = (k, last) => {
        const ws = []; let fm = 0;
        cdays.forEach((x) => {
          if (last ? x.naps.length !== k : x.naps.length <= k) return;
          const a = k ? x.naps[k - 1].b : x.wake;
          const b = last ? x.bed : x.naps[k].a;
          ws.push(b - a);
          if (FD.some((f) => f.a >= a - 5 && f.a < b)) fm++;
        });
        return { isSt: false, isAw: true, awCls: 'aw-p day', l: 'éveillé ' + dur(r5(med(ws))), meal: fm * 2 >= ws.length };
      };
      const steps = [{ isSt: true, isAw: false, t: hm(r5(med(wk))), icon: '#i-sun', icCls: 'ic k-calc', l: 'Réveil du matin', d: 'entre ' + hm(r5(wkR[0])) + ' et ' + hm(r5(wkR[1])), ...lvOf(1, wkR[1] - wkR[0], cdays.length) }];
      naps.forEach((z) => { steps.push(jtAw(z.k, false)); steps.push({ isSt: true, isAw: false, t: hm(r5(z.a)), icon: '#i-moon', icCls: 'ic k-sleep', l: ORD[z.k] + ' sieste', hasDu: true, du: dur(r5(z.du)), d: z.n < cdays.length ? 'certains jours (' + z.n + ' sur ' + cdays.length + ')' : 'entre ' + hm(r5(z.lo)) + ' et ' + hm(r5(z.hi)), ...lvOf(z.n / cdays.length, z.hi - z.lo, cdays.length) }); });
      steps.push(jtAw(naps.length ? naps[naps.length - 1].k + 1 : 0, true));
      steps.push({ isSt: true, isAw: false, t: hm(r5(med(bd))), icon: '#i-moon', icCls: 'ic k-calc', l: 'Coucher du soir', d: 'entre ' + hm(r5(bdR[0])) + ' et ' + hm(r5(bdR[1])), ...lvOf(1, bdR[1] - bdR[0], cdays.length) });
      // repas qui reviennent : heures de repas regroupées (moins de 40 min d'écart), gardées si au moins un jour sur deux
      const jtF = [];
      cdays.forEach((x) => FD.forEach((f) => { if (f.a >= x.d * 1440 && f.a < x.d * 1440 + 1440) jtF.push({ t: f.a - x.d * 1440, d: x.d }); }));
      jtF.sort((p1, p2) => p1.t - p2.t);
      const jtMeals = [];
      let jtG = [];
      const jtFlush = () => { if (jtG.length && new Set(jtG.map((g) => g.d)).size * 2 >= cdays.length) jtMeals.push(r5(med(jtG.map((g) => g.t)))); jtG = []; };
      jtF.forEach((f) => { if (jtG.length && f.t - jtG[jtG.length - 1].t > 40) jtFlush(); jtG.push(f); });
      jtFlush();
      const jtNF = Math.round(med(cdays.map((x) => x.feeds.length)));
      const gaps = [];
      cdays.forEach((x) => x.dayFeeds.forEach((f, i) => { if (i) gaps.push(f.a - x.dayFeeds[i - 1].a); }));
      typ = {
        ok: true, no: false, n: cdays.length, from: dShort(cdays[0].d), to: dShort(cdays[cdays.length - 1].d), naps, steps,
        wake: med(wk), bed: med(bd), wkR, bdR,
        bandSegs: band,
        meals: jtMeals,
        fia: fiaOf(cdays.length, 'journée'),
        sumL: [
          { icon: '#i-sun', icCls: 'sm4-i k-calc', l: 'Réveil', v: 'vers ' + hm(r5(med(wk))) },
          { icon: '#i-moon', icCls: 'sm4-i k-sleep', l: 'Siestes', v: Math.min.apply(null, nc) === Math.max.apply(null, nc) ? String(nc[0]) : Math.min.apply(null, nc) + ' à ' + Math.max.apply(null, nc) },
          { icon: '#i-milk', icCls: 'sm4-i k-feed', l: 'Repas sur 24 h', v: String(jtNF) },
          { icon: '#i-moon', icCls: 'sm4-i k-calc', l: 'Coucher', v: 'vers ' + hm(r5(med(bd))) },
        ],
        gapV: gaps.length ? dur(r5(med(gaps))) : 'pas encore',
        gapS: gaps.length ? 'entre le réveil et le coucher' : 'pas assez de repas notés',
        daySleep: '≈ ' + dur(r5(med(cdays.map((x) => x.napsTotal))) ),
        napRange: Math.min.apply(null, nc) === Math.max.apply(null, nc) ? String(nc[0]) : Math.min.apply(null, nc) + ' à ' + Math.max.apply(null, nc),
        feedGap: gaps.length ? 'toutes les ≈ ' + dur(r5(med(gaps))) : 'pas encore assez de données',
        feedSub: 'en médiane, entre le réveil et le coucher · ' + Math.round(med(cdays.map((x) => x.dayFeeds.length))) + ' repas',
      };
    } else typ.msg = 'Sa journée type se dessine à partir de 3 journées notées en entier (réveil, siestes et coucher) ; ' + (cdays.length ? 'il y en a ' + cdays.length + ' pour l’instant.' : 'la première arrive bientôt.') + ' Elle apparaîtra d’elle-même, rien d’autre à faire que noter comme d’habitude.';

    // ---------- nuit habituelle ----------
    const usual = (d) => {
      const ns = win(Math.max(1, d - 7), d - 1).map(nightOf).filter((x) => x.st === 'ok');
      if (ns.length < 4) return { ok: false, n: ns.length };
      const bed = med(ns.map((x) => x.bed - (x.d - 1) * 1440)), wake = med(ns.map((x) => x.wake - x.d * 1440));
      const wk = Math.round(med(ns.map((x) => x.wakings)));
      const b0 = med(ns.map((x) => x.bl[0]));
      const oth = [], gp = [];
      ns.forEach((x) => { x.bl.slice(1).forEach((v) => oth.push(v)); x.sl.forEach((z, i) => { if (i) gp.push(z.a - x.sl[i - 1].b); }); });
      const bo = med(oth) || 120, g = med(gp) || 25;
      const blocks = [];
      let t = bed;
      for (let i = 0; i <= wk; i++) {
        let e = t + (i === 0 ? b0 : bo);
        if (i === wk || e > 1440 + wake - 40) { blocks.push([t, Math.max(1440 + wake, t + 30)]); break; }
        blocks.push([t, e]);
        t = e + g;
      }
      const fb = ns.map((x) => x.bl[0]);
      return { ok: true, n: ns.length, bed, wake, wk, wkMin: Math.min.apply(null, ns.map((x) => x.wakings)), wkMax: Math.max.apply(null, ns.map((x) => x.wakings)), longest: med(ns.map((x) => x.longest)), total: med(ns.map((x) => x.total)), blocks, fbR: lohi(fb), b0,
        bedR: lohi(ns.map((x) => x.bed - (x.d - 1) * 1440)), wakeR: lohi(ns.map((x) => x.wake - x.d * 1440)),
        mealWake: (() => { let wf = 0, wn = 0; ns.forEach((x) => x.sl.forEach((z, i) => { if (!i) return; wn++; if (FD.some((f) => f.a >= x.sl[i - 1].b - 10 && f.a <= z.a + 10)) wf++; })); return wn ? wf / wn : 0; })() };
    };

    // ---------- statistiques par période ----------
    const MET = {
      bloc: { lab: 'Plus long sommeil de nuit', src: 'n', f: (x) => x.longest, fmt: (v) => dur(r5(v)), eq: 15, kind: 'dur' },
      total: { lab: 'Sommeil noté sur 24 h', src: 'd24', f: (x) => x.sleep24, fmt: (v) => dur(r5(v)), eq: 20, kind: 'dur' },
      reveils: { lab: 'Réveils notés par nuit', src: 'n', f: (x) => x.wakings, fmt: fr1, eq: 0.4, kind: 'n', unit: 'réveil' },
      siestes: { lab: 'Siestes par jour', src: 'dc', f: (x) => x.naps.length, fmt: fr1, eq: 0.4, kind: 'n', unit: 'sieste' },
      coucher: { lab: 'Coucher habituel', src: 'n', f: (x) => x.bed - (x.d - 1) * 1440, fmt: (v) => hm(r5(v)), eq: 15, kind: 't', agg: med },
      reveil: { lab: 'Réveil habituel', src: 'n', f: (x) => x.wake - x.d * 1440, fmt: (v) => hm(r5(v)), eq: 15, kind: 't', agg: med },
      repas: { lab: 'Repas par jour', src: 'df', f: (x) => x.feeds.length, fmt: fr1, eq: 0.6, kind: 'n', unit: 'repas' },
      lait: { lab: 'Lait au biberon par jour', src: 'df', f: (x) => x.ml, fmt: (v) => Math.round(v / 10) * 10 + ' mL', eq: 40, kind: 'ml' },
      sein: { lab: 'Part des repas en tétée', src: 'df', f: (x) => (x.feeds.length ? (100 * x.sein) / x.feeds.length : 0), fmt: (v) => Math.round(v) + ' %', eq: 8, kind: 'pct' },
    };
    const pick = (m, a, b) => {
      if (b < a) return [];
      if (m.src === 'n') return win(Math.max(1, a + 1), b + 1).map(nightOf).filter((x) => x.st === 'ok').map(m.f);
      const ds = win(a, b).map(dayOf);
      if (m.src === 'd24') return ds.filter((x) => x.full24).map(m.f);
      if (m.src === 'dc') return ds.filter((x) => x.complete).map(m.f);
      return ds.filter((x) => x.fed).map(m.f);
    };
    const perWord = (p, src) => (src === 'n' ? (p === 7 ? 'les 7 nuits d’avant' : 'les ' + p + ' nuits d’avant') : (p === 7 ? 'les 7 jours d’avant' : 'les ' + p + ' jours d’avant'));
    const stat = (key, p) => {
      const m = MET[key], agg = m.agg || avg;
      const cur = pick(m, 27 - p, 26), prev = pick(m, 27 - 2 * p, 26 - p);
      const okC = cur.length >= 3, okP = prev.length >= 3;
      const vc = okC ? agg(cur) : null, vp = okP ? agg(prev) : null;
      let evo = '', ic = '#i-flat', dir = 0;
      if (!okC) evo = 'Pas encore assez de données';
      else if (!okP) evo = p === 28 ? 'Pas encore de période précédente à comparer' : 'Pas assez de données avant pour comparer';
      else {
        const df = vc - vp;
        if (Math.abs(df) < m.eq) evo = 'Stable, comme ' + perWord(p, m.src);
        else {
          dir = df > 0 ? 1 : -1;
          ic = dir > 0 ? '#i-up' : '#i-down';
          const a = Math.abs(df);
          if (m.kind === 'dur') evo = dur(r5(a)) + (dir > 0 ? ' de plus' : ' de moins') + ' que ' + perWord(p, m.src);
          else if (m.kind === 't') evo = dur(r5(a)) + (dir > 0 ? ' plus tard' : ' plus tôt') + ' que ' + perWord(p, m.src);
          else if (m.kind === 'ml') evo = Math.round(a / 10) * 10 + ' mL' + (dir > 0 ? ' de plus' : ' de moins') + ' que ' + perWord(p, m.src);
          else if (m.kind === 'pct') evo = Math.round(a) + ' points' + (dir > 0 ? ' de plus' : ' de moins') + ' que ' + perWord(p, m.src);
          else evo = fr1(a) + (dir > 0 ? ' de plus' : ' de moins') + ' que ' + perWord(p, m.src);
        }
      }
      return { key, lab: m.lab, val: okC ? m.fmt(vc) : 'Pas encore assez de données', vc, vp, n: cur.length, ok: okC, okP, evo, ic, dir, fmt: m.fmt };
    };

    // ---------- à retenir : deux observations au plus, calculées sur les 7 derniers jours ----------
    // statut : noté (constaté), calculé (une habitude qui se dessine), encore fragile (trop peu de cas)
    const sB = stat('bloc', 7);
    const rIn = (t) => t >= 20 * 1440 && t < 27 * 1440;
    const rQt = (arr, p) => { const v = arr.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(p * v.length))]; };
    const rTag = (k) => (k === 'fait' ? { tag: 'Constaté dans tes notes', tagCls: 'tn' } : k === 'hab' ? { tag: 'Une habitude qui se dessine', tagCls: 'tc' } : { tag: 'Encore fragile', tagCls: 'tq' });
    const rC = [];
    // repas en journée -> sieste suivante (les couchers du soir et les trous de saisie sont laissés de côté)
    const rFw = [], rFd = new Set();
    FD.forEach((f) => {
      const tl = f.a % 1440;
      if (!rIn(f.a) || tl < 420 || tl > 1110 || SL.some((z) => z.a <= f.a && z.b > f.a)) return;
      const nx = SL.find((z) => z.a >= f.a);
      if (!nx || nx.a % 1440 > 1170 || nx.a - f.a > 240) return;
      rFw.push(nx.a - f.a); rFd.add(Math.floor(f.a / 1440));
    });
    if (rFw.length >= 4) {
      const lo = r5(rQt(rFw, 0.25)), hi = r5(rQt(rFw, 0.75)), solid = rFw.length >= 8 && rFd.size >= 5 && hi - lo <= 45;
      rC.push(Object.assign({ key: 'eveil', solid, t: 'Après un repas en journée, il reste éveillé le plus souvent ' + (hi - lo < 10 ? 'environ ' + dur(lo) : dur(lo) + ' à ' + dur(hi)) + ' avant de se rendormir.', x: 'Ils se suivent souvent dans ton journal, sans que l’un entraîne l’autre. Une habitude, pas un horaire à suivre.', basis: 'Sur ' + rFd.size + ' jours · ' + rFw.length + ' repas', go: 'Sa journée type', pick: set({ cview: 'hc' }) }, rTag(solid ? 'hab' : 'fragile')));
    }
    // fin de sieste -> repas dans le quart d'heure
    const rNp = SL.filter((z) => rIn(z.a) && z.b % 1440 >= 480 && z.b % 1440 <= 1140 && Math.floor(z.a / 1440) === Math.floor(z.b / 1440));
    const rNf = rNp.filter((z) => FD.some((f) => f.a >= z.b - 5 && f.a <= z.b + 15)).length;
    const rNd = new Set(rNp.map((z) => Math.floor(z.a / 1440))).size;
    if (rNp.length >= 4 && rNf * 2 >= rNp.length) {
      const solid = rNp.length >= 8 && rNd >= 5 && rNf >= 0.6 * rNp.length;
      rC.push(Object.assign({ key: 'repas', solid, t: 'Au réveil de ses siestes, il prend souvent un repas dans le quart d’heure : ' + rNf + ' fois sur ' + rNp.length + '.', x: 'Un enchaînement fréquent, pas une règle : il peut aussi avoir faim à d’autres moments.', basis: 'Sur ' + rNd + ' jours · ' + rNp.length + ' siestes', go: 'Sa journée type', pick: set({ cview: 'hc' }) }, rTag(solid ? 'hab' : 'fragile')));
    }
    // dernière nuit face à ses nuits habituelles (nuit notée en entier seulement)
    const rN = nightOf(27), rU = usual(27);
    if (rN.st === 'ok' && rU.ok) {
      const bits = [];
      const db = rN.bed - 26 * 1440 - r5(rU.bed), dl = rN.longest - r5(rU.longest);
      if (Math.abs(db) >= 30) bits.push('couché ' + dur(r5(Math.abs(db))) + (db > 0 ? ' plus tard' : ' plus tôt'));
      if (Math.abs(dl) >= 30) bits.push('un plus long sommeil de ' + dur(rN.longest) + ' (≈ ' + dur(r5(rU.longest)) + ' d’habitude)');
      if (rN.wakings > rU.wkMax || rN.wakings < rU.wkMin) bits.push(rN.wakings + ' réveil' + (rN.wakings > 1 ? 's' : '') + ' noté' + (rN.wakings > 1 ? 's' : '') + ' (' + (rU.wkMin === rU.wkMax ? rU.wkMin : rU.wkMin + ' à ' + rU.wkMax) + ' d’habitude)');
      const same = !bits.length;
      rC.push(Object.assign({ key: 'nuit', solid: true, t: same ? 'Sa dernière nuit ressemble à ses nuits habituelles.' : 'Sa dernière nuit a été un peu différente de ses nuits habituelles.', x: same ? 'Couché à ' + hm(rN.bed) + ', un plus long sommeil de ' + dur(rN.longest) + ', réveillé à ' + hm(rN.wake) + '.' : cap(bits.join(', ')) + '. Une nuit à part ne fait pas une tendance.', basis: 'Nuit dernière · comparée à ' + rU.n + ' nuits', go: 'La nuit dans Rythme', pick: set({ tab: 'pilotage', pday: 0, csel: '' }) }, rTag('fait')));
    }
    // tendance de la semaine
    if (sB.ok && sB.okP && sB.dir !== 0) rC.push(Object.assign({ key: 'tend', solid: true, t: sB.dir > 0 ? 'Son plus long sommeil de nuit s’allonge doucement.' : 'Son plus long sommeil de nuit est un peu plus court cette semaine.', x: sB.val + ' en moyenne ces 7 nuits, contre ' + sB.fmt(sB.vp) + ' les 7 d’avant.' + (sB.dir < 0 ? ' Ça se regarde sur plusieurs semaines plutôt que nuit par nuit.' : ''), basis: sB.n + ' nuits notées en entier', go: 'Son sommeil', pick: set({ cview: 'hc', xo: 'sleep' }) }, rTag('hab')));
    // liens possibles sur les 3 dernières semaines : la journée d'avant (dernière sieste, éveils, biberons) et la nuit qui suit
    const lkR = [];
    for (let d = 7; d <= 27; d++) {
      const n = nightOf(d), y = dayOf(d - 1);
      if (n.st !== 'ok' || y.wake === null || !y.naps.length || y.gap) continue;
      const ln = y.naps[y.naps.length - 1], aw = [];
      let t0 = y.wake;
      y.naps.forEach((z) => { aw.push(z.a - t0); t0 = z.b; });
      lkR.push({ end: ln.b % 1440, many: y.naps.length >= 4, bed: n.bed - (d - 1) * 1440, wk: n.wakings, lg: n.longest, ln: ln.b - ln.a, awk: avg(aw), awb: n.bed - ln.b, ml: y.ml, nap: y.naps.length });
    }
    // seuil de la dernière sieste : son heure médiane, arrondie au quart d'heure, pour comparer deux groupes de taille proche
    const lkT = lkR.length ? Math.round(med(lkR.map((x) => x.end)) / 15) * 15 : 0;
    lkR.forEach((x) => { x.late = x.end > lkT; });
    const lkMl = lkR.filter((x) => x.ml > 0);
    const lkV = { ln: lkR.length ? Math.round(med(lkR.map((x) => x.ln)) / 5) * 5 : 0, awk: lkR.length ? Math.round(med(lkR.map((x) => x.awk)) / 5) * 5 : 0, awb: lkR.length ? Math.round(med(lkR.map((x) => x.awb)) / 5) * 5 : 0, ml: lkMl.length ? Math.round(med(lkMl.map((x) => x.ml)) / 10) * 10 : 0 };
    // facteurs (la journée d'avant) et issues (la nuit qui suit) ; `lo` nomme l'autre groupe
    const LFX = {
      late: { l: 'Les soirs où sa dernière sieste finit après ' + hm(lkT), s: 'Dernière sieste après ' + hm(lkT), so: 'Dernière sieste plus tôt', lo: 'Les autres soirs', on: (x) => x.late },
      many: { l: 'Les jours à 4 siestes ou plus', s: '4 siestes ou plus', so: 'Moins de siestes', lo: 'Les autres jours', on: (x) => x.many },
      ln: { l: 'Les jours où sa dernière sieste dure plus de ' + dur(lkV.ln), s: 'Dernière sieste de plus de ' + dur(lkV.ln), so: 'Dernière sieste plus courte', lo: 'Les autres jours', on: (x) => x.ln > lkV.ln },
      awk: { l: 'Les jours où son éveil moyen dépasse ' + dur(lkV.awk), s: 'Éveils de plus de ' + dur(lkV.awk) + ' en moyenne', so: 'Éveils plus courts', lo: 'Les autres jours', on: (x) => x.awk > lkV.awk },
      awb: { l: 'Les soirs où il reste éveillé plus de ' + dur(lkV.awb) + ' avant le coucher', s: 'Éveillé plus de ' + dur(lkV.awb) + ' avant le coucher', so: 'Éveil plus court avant le coucher', lo: 'Les autres soirs', on: (x) => x.awb > lkV.awb },
      ml: { l: 'Les jours à plus de ' + lkV.ml + ' mL de biberons', s: 'Plus de ' + lkV.ml + ' mL de biberons', so: 'Moins de biberons', lo: 'Les autres jours', on: (x) => x.ml > lkV.ml },
    };
    const LO = {
      bed: { k: 'bed', min: 30, t: (v) => 'il s’endort en général ' + dur(r5(Math.abs(v))) + (v > 0 ? ' plus tard' : ' plus tôt'), fmt: (v) => 'couché vers ' + hm(r5(v)), sv: (v) => hm(r5(v)), n: 'coucher', d: (v) => dur(r5(Math.abs(v))) + (v > 0 ? ' plus tard' : ' plus tôt') },
      lg: { k: 'lg', min: 30, t: (v) => 'son plus long sommeil dure en général ' + dur(r5(Math.abs(v))) + (v > 0 ? ' de plus' : ' de moins'), fmt: (v) => 'plus long sommeil ' + dur(r5(v)), sv: (v) => dur(r5(v)), n: 'plus long sommeil', d: (v) => dur(r5(Math.abs(v))) + (v > 0 ? ' de plus' : ' de moins') },
      wk: { k: 'wk', min: 1, t: (v) => 'il se réveille en général ' + (Math.abs(v) >= 2 ? Math.round(Math.abs(v)) + ' fois' : 'une fois') + (v > 0 ? ' de plus' : ' de moins') + ' la nuit', fmt: (v) => fr1(v) + ' réveil' + (v > 1 ? 's' : ''), sv: (v) => fr1(v), n: 'réveils par nuit', d: (v) => fr1(Math.abs(v)) + ' réveil' + (Math.abs(v) > 1 ? 's' : '') + (v > 0 ? ' de plus' : ' de moins') },
    };
    // un facteur compte s'il a au moins 5 nuits de chaque côté, un écart net et le même sens pour 7 nuits sur 10
    const lkEval = (fs, os, rows) => {
      let best = null, enough = false;
      fs.forEach((f) => {
        const A = rows.filter((x) => f.on(x)), B = rows.filter((x) => !f.on(x));
        if (A.length < 5 || B.length < 5) return;
        enough = true;
        os.forEach((o) => {
          const ma = med(A.map((x) => x[o.k])), mb = med(B.map((x) => x[o.k])), df = ma - mb;
          if (Math.abs(df) < o.min) return;
          const k = A.filter((x) => (df > 0 ? x[o.k] > mb : x[o.k] < mb)).length;
          if (k < 0.7 * A.length) return;
          const sc = Math.abs(df) / o.min;
          if (!best || sc > best.sc) best = { sc, t: f.l + ', ' + o.t(df) + '.', basis: k + ' soirs sur ' + A.length + ' · ' + rows.length + ' nuits notées en entier', solid: A.length >= 8, f, o, A, B, ma, mb };
        });
      });
      return { best, enough, n: rows.length };
    };
    const lkBest = lkEval([LFX.late, LFX.many], [LO.bed, LO.lg, LO.wk], lkR).best;
    if (lkBest) rC.push(Object.assign({ key: 'lien', solid: lkBest.solid, t: lkBest.t, x: 'Un lien observé dans ton journal, pas une explication.', basis: lkBest.basis, go: 'Son rythme en détail', pick: set({ cview: 'hc', xo: lkBest.f === LFX.late ? 'naps' : 'links' }) }, lkBest.solid ? { tag: 'Un lien qui se dessine', tagCls: 'tc' } : rTag('fragile')));
    const rK = (k) => rC.find((c) => c.key === k);
    const rHab = [rK('eveil'), rK('repas')].filter(Boolean).sort((x, y) => Number(y.solid) - Number(x.solid))[0];
    const rSec = rK('lien') || rK('nuit') || rK('tend') || [rK('repas'), rK('eveil')].find((c) => c && c !== rHab);
    let rObs = [rHab, rSec].filter(Boolean);
    const rLearn = !rObs.some((c) => c.solid);
    if (rLearn) rObs = rObs.slice(0, 1);
    else {
      // une troisième observation seulement si elle est solide et différente des deux premières
      const rThird = [rK('lien'), rK('nuit'), rK('tend'), rK('repas'), rK('eveil')].find((c) => c && c.solid && !rObs.includes(c));
      if (rThird) rObs.push(rThird);
    }
    const rNok = win(21, 27).map(nightOf).filter((x) => x.st === 'ok').length;
    const ret = {
      learning: rLearn,
      obs: rObs.map((c, i) => Object.assign({}, c, { lead: !rLearn && i === 0, cls: 'rt' + (!rLearn && i === 0 ? ' lead' : '') })),
      lx: 'Ses habitudes apparaîtront d’elles-mêmes au fil de tes notes. Tout ce que tu notes compte, même une journée incomplète.',
      lb: (cdays.length ? cdays.length + ' journée' + (cdays.length > 1 ? 's' : '') + ' complète' + (cdays.length > 1 ? 's' : '') + ' sur 3' : 'Sa première journée complète arrive') + ' · ' + (rNok ? rNok + ' nuit' + (rNok > 1 ? 's' : '') + ' notée' + (rNok > 1 ? 's' : '') + ' en entier sur 4' : 'sa première nuit notée en entier aussi'),
    };
    const partN = win(21, 27).map(nightOf).filter((x) => x.st === 'partiel'), absN = win(21, 27).map(nightOf).filter((x) => x.st === 'absent');
    const dataNote = { on: !noData && partN.length + absN.length > 0, txt: '' };
    if (dataNote.on) {
      const bits = [];
      if (absN.length) bits.push(absN.length === 1 ? '1 nuit n’est pas notée' : absN.length + ' nuits ne sont pas notées');
      if (partN.length) bits.push(partN.length === 1 ? (absN.length ? '1 l’est en partie' : 'la nuit du ' + dShort(partN[0].d - 1) + ' au ' + dShort(partN[0].d) + ' n’est notée qu’en partie') : partN.length + ' le sont en partie');
      dataNote.txt = cap(bits.join(', ')) + ' : ' + (partN.length + absN.length > 1 ? 'elles sont laissées' : 'elle est laissée') + ' de côté. Une absence de note n’est jamais comptée comme une absence de sommeil.';
    }

    // ---------- frise 24 h ----------
    const sleepAria = (z) => (z.run ? 'Dodo en cours depuis ' + hm(z.a) : 'Sommeil de ' + hm(z.a) + ' à ' + hm(z.b) + ', ' + dur(z.b - z.a) + '. Voir le détail');
    // axe d'une frise bornée [a, b] (minutes) : bornes écrites, heures rondes (pas h) gardées si elles ne touchent pas une borne (gap min)
    const axH = (t) => { const m = ((Math.round(t) % 1440) + 1440) % 1440; return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + pad(m % 60) : ''); };
    const axOf = (a, b, step, gap) => {
      const at = (t, c) => ({ l: (((t - a) / (b - a)) * 100).toFixed(2), t: axH(t), c });
      const mid = [];
      for (let t = Math.ceil(a / step) * step; t < b; t += step) if (t - a >= gap && b - t >= gap) mid.push(at(t, ''));
      return [at(a, 'l0')].concat(mid, [at(b, 'l1')]);
    };
    // frise de la journée type : de minuit au coucher du soir (coucher après minuit : la frise s'arrête à 24 h)
    const jtE = typ.ok ? Math.min(1440, r5(typ.bed)) : 1440;
    const jtPc = (t) => ((t / jtE) * 100).toFixed(2);
    const jtRow = {
      nb: [[0, Math.min(420, jtE)], [1200, jtE]].filter((n) => n[1] > n[0]).map((n) => ({ l: jtPc(n[0]), w: jtPc(n[1] - n[0]) })),
      segs: typ.ok ? typ.bandSegs.filter((g) => g.b > 0 && g.a < jtE).map((g) => { const a = Math.max(g.a, 0), b = Math.min(g.b, jtE); return { l: jtPc(a), w: Math.max(1.6, ((b - a) / jtE) * 100).toFixed(2) }; }) : [],
      marks: typ.ok ? typ.meals.filter((t) => t <= jtE).map((t) => ({ l: jtPc(t), aria: 'Un repas revient vers ' + hm(t) })) : [],
      ax: axOf(0, jtE, 360, 240).map((x, i, a) => (i === a.length - 1 && jtE === 1440 ? { ...x, t: '24 h' } : x)),
    };

    // ---------- feuilles : formulaire ----------
    const lastBib = FD.filter((f) => f.k === 'bib').pop();
    const defF = (k, extra) => Object.assign({ k, when: 'now', t: hhmm(NOW), t2: hhmm(NOW), ml: lastBib ? lastBib.ml : 120, side: 'G', dur: null, more: false, lait: '', g: '', dd: '' }, extra || {});
    const findEv = (id) => evs.find((e) => e.id === id);
    const editF = (e) => defF(e.k, { id: e.id, t: hhmm(e.a), t2: e.b ? hhmm(e.b) : '', ml: e.ml || 120, side: e.side || 'G', v: e.v || 'pipi', dur: e.dur || null });
    let f = s.f;
    if (!f && sheet) {
      if (sheet === 'edit') { const e0 = lastBib || evs[evs.length - 1]; f = e0 ? editF(e0) : defF('bib'); }
      else if (sheet === 'dodo') f = defF('dodo', { t: hhmm(NOW - 60), t2: run !== null ? hhmm(NOW) : '' });
      else if (sheet === 'pump') f = defF('pump', { g: '70', dd: '65' });
      else f = defF(sheet);
    }
    f = f || defF('bib');
    const upF = (o) => this.setState({ f: Object.assign({}, f, o) });
    const open = (k, extra) => () => {
      const o = k === 'dodo' ? defF('dodo', Object.assign({ t: hhmm(NOW), t2: run !== null ? hhmm(NOW) : '' }, extra)) : k === 'pump' ? defF('pump') : defF(k, extra);
      this.setState({ sheet: k, f: o, err: null, saving: false });
    };
    const openEdit = (e) => () => { if (e.run) { this.setState({ sheet: 'dodo', f: defF('dodo', { t2: hhmm(NOW) }), err: null }); return; } this.setState({ sheet: 'edit', f: editF(e), err: null, saving: false }); };
    const openDetail = (e) => () => { if (e.run) { this.setState({ sheet: 'dodo', f: defF('dodo', { t2: hhmm(NOW) }), err: null }); return; } this.setState({ sheet: 'detail', selId: e.id, err: null }); };

    const ERR = 'Ce n’est pas enregistré : la connexion n’a pas permis d’écrire la donnée. Tes valeurs sont gardées ici, tu peux réessayer.';
    const errMsg = s.err !== undefined ? s.err : (P.err && sheet ? ERR : null);
    const saving = !!s.saving;
    const fail = () => this.toast('Ce n’est pas enregistré : réessaie dans un instant.');
    const doSave = (apply, msg, popBase) => {
      if (this.st().saving) return;
      this.setState({ saving: true, err: null });
      const undo = apply();
      Promise.resolve(undo && undo.done).then(() => {
        if (popBase) { this.setState({ saving: false, sheet: null, err: null, pop: Object.assign({}, popBase, { undo, id: this._lastId }) }); return; }
        this.setState({ saving: false, sheet: null, err: null });
        this.toast(msg, undo);
      }, () => this.setState({ saving: false, err: ERR }));
    };
    const uid = () => 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    const addEv = (o) => () => {
      const r = P.store.addEvent(o);
      this._lastId = r.id;
      return Object.assign(() => { P.store.removeEvent(r.id).done.catch(fail); this.setState({ toast: null }); }, { done: r.done });
    };
    const baseDay = f.day !== undefined ? f.day : T0;
    const whenT = () => {
      if (f.day === undefined && f.when === 'now') return NOW;
      if (f.day === undefined && f.when === 'm15') return NOW - 15;
      let t = baseDay + tm(f.t);
      if (t > NOW) t -= 1440;
      return t;
    };
    const atL = (t) => (Math.floor(t / 1440) === 27 ? hm(t) : dShort(Math.floor(t / 1440)) + ' à ' + hm(t));

    // ---------- actions de la barre ----------
    const startRun = (a) => {
      P.store.startRun(a).done.then(
        () => this.setState({ sheet: null, f: null, pop: { k: 'start', a, undo: () => P.store.cancelRun().done.catch(fail) } }),
        (e) => { this.setState({ sheet: null, f: null }); this.toast(e && e.name === 'RunningConflictError' ? 'Un dodo est déjà en cours : le voici.' : 'Ce n’est pas enregistré : réessaie dans un instant.'); },
      );
    };
    const sleepNow = () => startRun(NOW);
    const endRun = (b) => {
      const a = run;
      if (b < a) { this.setState({ err: 'L’heure du réveil doit être après ' + hm(a) + '.' }); return; }
      if (b === a) { P.store.cancelRun().done.catch(fail); this.setState({ sheet: null }); this.toast('Dodo de moins d’une minute : rien n’est enregistré', () => { P.store.startRun(a).done.catch(fail); this.setState({ toast: null }); }); return; }
      doSave(() => { const r = P.store.stopRun(b); this._lastId = r.id; return Object.assign(() => { P.store.reopenRun(r.id).done.catch(fail); this.setState({ toast: null }); }, { done: r.done }); }, 'Dodo enregistré : ' + hm(a) + ' – ' + hm(b) + ' (' + dur(b - a) + ')', { k: 'dodo' });
    };

    const save = () => {
      const k = sheet;
      if (k === 'bib') { const t = whenT(); doSave(addEv({ k: 'bib', a: t, ml: f.ml, lait: f.lait }), 'Biberon de ' + f.ml + ' mL enregistré à ' + atL(t), { k: 'bib', t, ml: f.ml }); }
      else if (k === 'sein') { const t = whenT(); doSave(addEv({ k: 'sein', a: t, side: f.side, dur: f.dur }), 'Tétée enregistrée à ' + atL(t)); }
      else if (k === 'dodo' && run === null && !f.t2) {
        let a = baseDay + tm(f.t);
        if (a > NOW) a -= 1440;
        startRun(a);
      } else if (k === 'dodo' && run === null) {
        let a = baseDay + tm(f.t), b = baseDay + tm(f.t2);
        if (b <= a) a -= 1440;
        if (b > NOW) { a -= 1440; b -= 1440; }
        doSave(addEv({ k: 'sleep', a, b }), 'Dodo enregistré : ' + hm(a) + ' – ' + hm(b) + ' (' + dur(b - a) + ')', { k: 'dodo' });
      } else if (k === 'dodo') { let b = T0 + tm(f.t2); if (b > NOW) b -= 1440; endRun(b); }
      else if (k === 'profil') {
        const r = P.store.saveBaby(f.name, f.bdate, f.btime);
        if (r.error) { this.setState({ err: r.error }); return; }
        this.setState({ saving: true, err: null });
        r.done.then(() => { this.setState({ saving: false, sheet: null, f: null, err: null }); this.toast('Profil enregistré'); }, () => this.setState({ saving: false, err: ERR }));
      }
      else if (k === 'trk') {
        const name = (f.name || '').trim();
        if (!name) { this.setState({ err: 'Donne un nom à ton suivi.' }); return; }
        const kind = f.kind === 'compteur' || f.kind === 'qte' ? f.kind : 'fait', tr = { id: uid(), name, kind, unit: kind === 'qte' ? (f.unit || '').trim() : '', icon: f.icon || '#i-heart' };
        const cv1 = putB({ t: 'tile', k: 't:' + tr.id });
        this.setState({ trk: trks.concat([tr]), cv: cv1, sheet: null, f: null, err: null }); this.toast('Suivi « ' + name + ' » créé, ajouté à ton accueil');
      }
      else if (k === 'trkq') {
        const v = Number(String(f.q).replace(',', '.'));
        if (!(v > 0)) { this.setState({ err: 'Indique une valeur.' }); return; }
        this.setState({ trl: trls.concat([{ id: uid(), tid: f.tid, a: NOW, v }]), sheet: null, f: null, err: null });
      }
      else if (k === 'note') {
        const text = (f.text || '').trim();
        if (!text) { this.setState({ err: 'Écris ta note.' }); return; }
        if (f.asCard) { this.setState({ cv: putB({ t: 'note', text }), sheet: null, f: null, err: null }); this.toast('Carte ajoutée'); }
        else { this.setState({ notes: notesL.concat([{ id: uid(), text }]), sheet: null, f: null, err: null }); this.toast('Note ajoutée'); }
      }
      else if (k === 'pump') {
        const g = Number(f.g) || 0, d = Number(f.dd) || 0;
        if (!g && !d) { this.setState({ err: 'Indique au moins un côté, en mL.' }); return; }
        doSave(() => { const r = P.store.addPump({ a: NOW, g, d }); return Object.assign(() => { P.store.removePump(r.id).done.catch(fail); this.setState({ toast: null }); }, { done: r.done }); }, 'Tirage de ' + (g + d) + ' mL enregistré');
      } else if (k === 'edit') {
        const e = findEv(f.id);
        if (!e) return;
        const D0 = Math.floor(e.a / 1440) * 1440;
        const a = D0 + tm(f.t);
        let b = e.b !== undefined ? D0 + tm(f.t2) : undefined;
        if (b !== undefined && b <= a) b += 1440;
        if (a > NOW || (b !== undefined && b > NOW)) { this.setState({ err: 'Cette heure est dans le futur : vérifie l’heure.' }); return; }
        const patch = { a };
        if (b !== undefined) patch.b = b;
        if (e.k === 'bib') patch.ml = f.ml;
        if (e.k === 'sein') patch.side = f.side;
        if (e.k === 'chg') patch.v = f.v;
        doSave(() => { const prev = { a: e.a, b: e.b, ml: e.ml, side: e.side, v: e.v }; const r = P.store.updateEvent(e.id, patch); return Object.assign(() => { P.store.updateEvent(e.id, prev).done.catch(fail); this.setState({ toast: null }); }, { done: r.done }); }, 'Modification enregistrée');
      }
    };
    const chgSave = (v) => () => { const t = whenT(); doSave(addEv({ k: 'chg', a: t, v }), 'Change (' + v + ') enregistré à ' + atL(t)); };
    const doDel = () => {
      const id = f.id, e0 = findEv(id);
      P.store.removeEvent(id).done.catch(fail);
      this.setState({ sheet: null, f: null });
      this.toast('Événement supprimé', () => { if (e0) P.store.restoreEvent(e0).done.catch(fail); this.setState({ toast: null }); });
    };

    // ---------- libellés d'événement ----------
    const SIDE = { G: 'gauche', D: 'droit', '2': 'les deux côtés' };
    const evInfo = (e) => {
      if (e.k === 'bib') return { title: 'Biberon', det: e.ml + ' mL' + (e.lait ? ' · lait ' + e.lait : ''), icon: '#i-milk', icCls: 'ev-ic k-feed' };
      if (e.k === 'sein') return { title: 'Tétée', det: (SIDE[e.side] || 'gauche') + (e.dur ? ' · ' + e.dur + ' min' : ''), icon: '#i-heart', icCls: 'ev-ic k-feed' };
      if (e.k === 'chg') return { title: 'Change', det: e.v, icon: '#i-diaper', icCls: 'ev-ic k-chg' };
      if (e.run) return { title: 'Dodo en cours', det: 'depuis ' + hm(e.a) + ' · ' + dur(NOW - e.a), icon: '#i-moon', icCls: 'ev-ic k-sleep' };
      const m = e.a % 1440;
      return { title: m >= 420 && m < 1170 ? 'Sieste' : 'Sommeil de nuit', det: hm(e.a) + ' → ' + hm(e.b) + ' · ' + dur(e.b - e.a), icon: '#i-moon', icCls: 'ev-ic k-sleep' };
    };
    const ago = (t) => { const m = NOW - t; return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : 'il y a ' + dur(m); };

    // ---------- ACCUEIL ----------
    const lastFeed = FD[FD.length - 1];
    const lastSleep = SL[SL.length - 1];
    let sit;
    if (run !== null) {
      sit = { cls: 'sit asleep', icCls: 'sit-ic k-sleep', icon: '#i-moon', big: NOW - run < 1 ? 'Vient de s’endormir' : 'Endormi depuis ' + dur(NOW - run), sub: (run % 1440 >= 1140 || run % 1440 < 300 ? 'Couché à ' : 'Endormi à ') + hm(run), hasSt: true, asleep: true, stCls: 'stp sl', stTxt: 'Il dort' };
    } else if (!evs.length) {
      sit = { cls: 'sit empty', icCls: 'sit-ic k-main', icon: '#i-flower', big: 'Rien de noté aujourd’hui', sub: 'Touche Tétée, Biberon, Dodo ou Change en bas : l’heure est déjà remplie.', hasSt: false, asleep: false };
    } else {
      sit = { cls: 'sit', icCls: 'sit-ic k-calc', icon: '#i-sun', big: lastSleep ? 'Éveillé depuis ' + dur(NOW - lastSleep.b) : 'Éveillé', sub: !lastSleep ? 'Aucun sommeil noté' : 'depuis ' + hm(lastSleep.b), hasSt: true, asleep: false, stCls: 'stp aw', stTxt: 'Réveillé' };
    }
    // créneaux de dodo à venir : fourchettes habituelles (journée type), jamais un compte à rebours
    let wins = [];
    if (typ.ok) {
      const done = dayOf(27).naps.length;
      const cands = typ.naps.filter((z) => z.k >= done).map((z) => ({ lo: Math.min(z.lo, z.a - 15), hi: Math.max(z.hi, z.a + 15), few: z.n < typ.n }));
      cands.push({ lo: Math.min(typ.bdR[0], typ.bed - 15), hi: Math.max(typ.bdR[1], typ.bed + 15), bed: true });
      wins = cands.filter((z) => T0 + z.hi >= NOW).map((z) => {
        const a = T0 + r5(z.lo), b = T0 + r5(z.hi);
        return { a, b, t: hm(a) + ' – ' + hm(b), bed: !!z.bed, lab: z.bed ? 'Coucher' : z.few ? 'Petite sieste' : 'Sieste', tag: NOW >= a ? 'en ce moment' : z.few ? 'certains jours' : 'estimé' };
      });
    }
    let nx = { on: false };
    if (run === null && lastSleep && wins.length) {
      const w = wins[0], start = Math.min(lastSleep.b, w.a), sp = w.b + 20 - start;
      nx = { on: true, lab: w.bed ? 'Prochain dodo · le coucher' : 'Prochain dodo', win: w.t, tag: NOW >= w.a ? 'en ce moment' : 'estimé', wl: (((w.a - start) / sp) * 100).toFixed(1), ww: (((w.b - w.a) / sp) * 100).toFixed(1), f: Math.min(100, ((NOW - start) / sp) * 100).toFixed(1) };
    }
    const lf = lastFeed
      ? { big: lastFeed.k === 'bib' ? lastFeed.ml + '\u00a0mL' : (lastFeed.dur ? lastFeed.dur + '\u00a0min' : 'Tétée'), sub: ago(lastFeed.a), det: lastFeed.k === 'bib' ? 'Biberon' : 'Tétée ' + (SIDE[lastFeed.side] || ''), icon: lastFeed.k === 'bib' ? '#i-milk' : '#i-heart', pick: set({ tab: 'pilotage', pday: 0, pview: 'jour', csel: '' }) }
      : { big: '—', sub: 'pas encore noté', det: '', icon: '#i-milk', pick: open('bib') };
    const ls = run !== null
      ? { title: 'Dodo en cours', big: dur(NOW - run), sub: 'depuis ' + hm(run), det: 'minuteur en cours', pick: () => this.setState({ sheet: 'dodo', f: defF('dodo', { t2: hhmm(NOW) }), err: null }) }
      : lastSleep
        ? { title: lastSleep.a % 1440 >= 420 && lastSleep.a % 1440 < 1170 ? 'Dernière sieste' : 'Dernier dodo', big: dur(lastSleep.b - lastSleep.a), sub: hm(lastSleep.a) + ' → ' + hm(lastSleep.b), det: '', pick: set({ tab: 'pilotage', pday: 0, pview: 'jour', csel: '' }) }
        : { title: 'Dernière sieste', big: '—', sub: 'pas encore notée', det: '', pick: open('dodo') };

    // ---------- popups après un ajout : un dodo (est-ce dans ses habitudes ?) et un biberon (prochain dodo probable) ----------
    const pop = s.pop || null;
    const popClose = () => this.setState({ pop: null });
    // un dodo comparé à la sieste du même rang de ses journées types (heure de début, durée si connue, éveil avant) ; la nuit : l'heure du coucher
    const habitOf = (a, b, evId) => {
      const m = a % 1440, isNap = m >= 420 && m < 1170, d0 = Math.floor(a / 1440);
      if (!typ.ok) return { lab: isNap ? 'Sieste' : 'Coucher', rows: [], kind: 'nodata' };
      const rg = (lo, hi) => (r5(lo) === r5(hi) ? 'vers ' + hm(r5(lo)) : hm(r5(lo)) + ' – ' + hm(r5(hi)));
      if (isNap) {
        const before = SL.filter((z) => z.id !== evId && Math.floor(z.a / 1440) === d0 && z.a < a && z.a % 1440 >= 420 && z.a % 1440 < 1170);
        const k = before.length, tz = typ.naps.find((z) => z.k === k), lab = ORD[k] + ' sieste';
        if (!tz) return { lab, rows: [], kind: 'extra' };
        const rows = [], inR = m >= tz.lo - 10 && m <= tz.hi + 10;
        rows.push({ lab: 'Heure', val: hm(a), note: inR ? 'dans sa plage habituelle (' + rg(tz.lo, tz.hi) + ')' : (m > tz.hi ? 'plus tard' : 'plus tôt') + ' que sa plage habituelle (' + rg(tz.lo, tz.hi) + ')', ok: inR, s: (m > tz.hi ? 'plus tard' : 'plus tôt') + ' que d’habitude (' + rg(tz.lo, tz.hi) + ')' });
        if (b) { const df = (b - a) - r5(tz.du); rows.push({ lab: 'Durée', val: dur(b - a), note: Math.abs(df) < 15 ? 'comme d’habitude (≈ ' + dur(r5(tz.du)) + ')' : dur(r5(Math.abs(df))) + (df > 0 ? ' de plus' : ' de moins') + ' que d’habitude (≈ ' + dur(r5(tz.du)) + ')', ok: Math.abs(df) < 15, s: 'plus ' + (df > 0 ? 'longue' : 'courte') + ' que d’habitude' }); }
        const w0 = before.length ? before[before.length - 1].b : dayOf(d0).wake;
        if (w0 !== null && w0 !== undefined && tz.aw) { const dw = (a - w0) - r5(tz.aw); rows.push({ lab: 'Éveil avant', val: dur(a - w0), note: Math.abs(dw) < 15 ? 'comme d’habitude (≈ ' + dur(r5(tz.aw)) + ')' : dur(r5(Math.abs(dw))) + (dw > 0 ? ' de plus' : ' de moins') + ' que d’habitude (≈ ' + dur(r5(tz.aw)) + ')', ok: Math.abs(dw) < 15, s: 'éveil plus ' + (dw > 0 ? 'long' : 'court') + ' que d’habitude' }); }
        return { lab, rows, kind: rows.every((x) => x.ok) ? 'ok' : 'diff' };
      }
      const rel = m >= 1170 ? m : 1440 + m, inB = rel >= typ.bdR[0] - 15 && rel <= typ.bdR[1] + 15;
      return { lab: 'Coucher', rows: [{ lab: 'Heure', val: hm(a), note: inB ? 'dans sa plage habituelle (' + rg(typ.bdR[0], typ.bdR[1]) + ')' : (rel > typ.bdR[1] ? 'plus tard' : 'plus tôt') + ' que sa plage habituelle (' + rg(typ.bdR[0], typ.bdR[1]) + ')', ok: inB, s: (rel > typ.bdR[1] ? 'plus tard' : 'plus tôt') + ' que d’habitude (' + rg(typ.bdR[0], typ.bdR[1]) + ')' }], kind: inB ? 'ok' : 'diff' };
    };
    if (run === null && lastSleep) {
      const hl = habitOf(lastSleep.a, lastSleep.b, lastSleep.id), bad = hl.rows.find((x) => !x.ok);
      ls.det = hl.kind === 'ok' ? hl.lab + ' · dans ses habitudes' : hl.kind === 'diff' && bad ? hl.lab + ' · ' + bad.s : hl.kind === 'extra' ? hl.lab + ' · en plus de d’habitude' : '';
    }
    let pv = { on: false, icon: '#i-moon', icCls: 'ic k-sleep', title: '', sub: '', hasV: false, vCls: '', verdict: '', hasBig: false, bigL: '', big: '', tag: '', hasRows: false, rows: [], note: '', hasUndo: false, close: popClose, undo: popClose };
    const popUndo = () => { if (pop && pop.undo) pop.undo(); this.setState({ pop: null }); };
    if (pop && (pop.k === 'dodo' || pop.k === 'start')) {
      const ev = pop.k === 'dodo' ? findEv(pop.id) : null;
      if (pop.k === 'start' || ev) {
        const a = pop.k === 'start' ? pop.a : ev.a, h = habitOf(a, ev ? ev.b : null, ev ? ev.id : null);
        const V = { ok: ['tn', 'Oui, c’est dans ses habitudes'], diff: ['tq', 'Un peu différent de d’habitude'], extra: ['tq', 'Une sieste de plus que d’habitude'], nodata: ['tq', 'Pas encore assez de données pour savoir ce qui est habituel'] }[h.kind];
        pv = Object.assign(pv, { on: true, icon: '#i-moon', icCls: 'ic k-sleep', title: pop.k === 'start' ? 'Chrono lancé' : 'Dodo enregistré', sub: (pop.k === 'start' ? h.lab + ' · endormi à ' + hm(a) : h.lab + ' · ' + hm(ev.a) + ' → ' + hm(ev.b) + ' · ' + dur(ev.b - ev.a)), hasV: true, vCls: 'pp-v ' + V[0], verdict: V[1], hasRows: h.rows.length > 0, rows: h.rows.map((x) => ({ lab: x.lab, val: x.val, note: x.note })), note: h.kind === 'nodata' ? 'Ses habitudes se dessinent à partir de 3 journées notées en entier : ça viendra avec tes notes.' : h.kind === 'extra' ? 'Il fait en général ' + typ.naps.length + ' siestes par jour : celle-ci s’ajoute, sans rien d’inquiétant en soi. Chaque jour est un peu différent.' : (pop.k === 'start' ? 'La durée se comparera à son réveil. ' : '') + 'Chaque jour est un peu différent : ce n’est qu’un repère.', hasUndo: !!pop.undo, undo: popUndo });
      }
    } else if (pop && pop.k === 'bib') {
      let big = null, rows = [], note = '', tagT = '';
      if (run !== null) note = 'Il dort en ce moment : son prochain dodo s’estimera à son réveil.';
      else if (!typ.ok) note = 'Pas encore assez de journées notées pour estimer son prochain dodo : ça se dessinera au fil de tes notes.';
      else if (!wins.length) note = 'Plus de sieste habituelle prévue aujourd’hui : le prochain dodo, c’est la nuit.';
      else {
        const w = wins[0];
        big = w.t; tagT = w.tag;
        if (lastSleep) rows.push({ lab: 'Éveillé depuis', val: dur(NOW - lastSleep.b), note: 'depuis ' + hm(lastSleep.b) });
        note = 'Une estimation à partir de ses habitudes, pas un horaire à suivre : son sommeil passe avant.';
      }
      pv = Object.assign(pv, { on: true, icon: '#i-milk', icCls: 'ic k-feed', title: 'Biberon enregistré', sub: pop.ml + ' mL à ' + hm(pop.t), hasBig: !!big, bigL: wins.length && wins[0].bed ? 'Prochain dodo probable · le coucher' : 'Prochain dodo probable', big: big || '', tag: tagT, hasRows: rows.length > 0, rows, note, hasUndo: !!pop.undo, undo: popUndo });
    }

    // début de journée : à minuit (par défaut) ou au réveil du matin. AX = origine des frises et calendriers.
    const dmode = s.dstart || P.dstart || 'minuit';
    const AX = dmode === 'reveil' ? 420 : 0;
    const dStart = (d) => { if (dmode !== 'reveil') return d * 1440; const n = nightOf(d); return n.st === 'ok' ? n.wake : d * 1440 + 420; };
    const sinceL = dmode === 'reveil' ? 'depuis le réveil (' + hm(dStart(27)) + ')' : 'depuis minuit';
    const dayStats = (D, E, upto, sinceMidnight) => {
      const sl = SL.reduce((t, x) => t + Math.max(0, Math.min(x.b, E, upto) - Math.max(x.a, D)), 0) + (run !== null && upto >= run && run < E ? Math.max(0, upto - Math.max(run, D)) : 0);
      const fd = FD.filter((x) => x.a >= D && x.a < E), ch = CH.filter((x) => x.a >= D && x.a < E);
      const nap = dayOf(Math.floor(D / 1440)).naps.filter((x) => x.a >= D && x.a < E).length;
      const ml = fd.reduce((t, x) => t + (x.ml || 0), 0);
      return {
        sleep: sl ? dur(r5(sl)) : '—', sleepL: sl ? (sinceMidnight ? (nap ? nap + (nap > 1 ? ' siestes' : ' sieste') : 'aucune sieste') : 'de sommeil noté') : (sinceMidnight ? 'pas encore noté' : 'sommeil pas encore noté'),
        feeds: fd.length ? (sinceMidnight && ml ? ml + ' mL' : String(fd.length)) : '—', feedsL: fd.length ? (sinceMidnight ? (ml ? fd.length + ' repas' : 'aujourd’hui') : 'repas' + (ml ? ' · ' + ml + ' mL' : '')) : (sinceMidnight ? 'pas encore noté' : 'repas pas encore noté'),
        chg: ch.length ? String(ch.length) : '—', chgL: ch.length ? (ch.length > 1 ? 'changes' : 'change') : 'change pas encore noté',
      };
    };
    const td = dayStats(dStart(27), dStart(28), NOW, true);
    // Dodo : le sommeil du jour et le dernier dodo ; Repas : biberons et tétées du jour (un picto chacun) et le dernier repas
    const fdTod = FD.filter((x) => x.a >= dStart(27) && x.a < dStart(28)), nBib = fdTod.filter((x) => x.k === 'bib').length, nTet = fdTod.length - nBib;
    if (run === null) {
      ls.title = 'Dodo';
      if (lastSleep) { ls.big = td.sleep; ls.sub = td.sleepL + ' · dernier ' + hm(lastSleep.a) + ' → ' + hm(lastSleep.b); }
    }
    lf.items = [];
    if (nBib) lf.items.push({ icon: '#i-milk', n: nBib, l: nBib > 1 ? 'biberons' : 'biberon' });
    if (nTet) lf.items.push({ icon: '#i-heart', n: nTet, l: nTet > 1 ? 'tétées' : 'tétée' });
    lf.hasItems = lf.items.length > 0; lf.noItems = !lf.hasItems;
    lf.aria = lf.items.map((x) => x.n + ' ' + x.l).join(', ') || 'rien de noté aujourd’hui';
    lf.sub = lastFeed ? 'dernier ' + ago(lastFeed.a) : 'pas encore noté';
    lf.det = lastFeed ? (lastFeed.k === 'bib' ? lastFeed.ml + '\u00a0mL' : (lastFeed.dur ? lastFeed.dur + '\u00a0min' : '')) : '';
    const allSegsAbs = SL.slice();
    if (run !== null) allSegsAbs.push({ a: run, b: NOW, run: true });
    // frise du jour : toucher un sommeil ou un repas affiche ses heures
    const hs = s.hsel || '';
    const FA = T0 + AX;
    const mSl = allSegsAbs.filter((x) => x.b > FA && x.a < FA + 1440);
    const miniSegs = mSl.map((x, i) => { const a = Math.max(x.a, FA), b = Math.min(x.b, FA + 1440); return { l: (((a - FA) / 1440) * 100).toFixed(2), w: Math.max(1.6, ((b - a) / 1440) * 100).toFixed(2), cls: 'mf-s' + (hs === 's' + i ? ' on' : ''), pick: set({ hsel: hs === 's' + i ? '' : 's' + i }), aria: sleepAria(x) }; });
    const mFd = FD.filter((x) => x.a >= FA && x.a < FA + 1440);
    const miniMarks = mFd.map((x, i) => ({ l: (((x.a - FA) / 1440) * 100).toFixed(2), cls: 'mf-d' + (x.k === 'sein' ? ' heart' : '') + (hs === 'f' + i ? ' on' : ''), pick: set({ hsel: hs === 'f' + i ? '' : 'f' + i }), aria: (x.k === 'bib' ? 'Biberon ' + x.ml + ' mL' : 'Tétée') + ' à ' + hm(x.a) }));
    let hsel = { cls: 'hs idle', icon: '#i-info', txt: mSl.length || mFd.length ? 'Touche la frise pour voir les heures' : 'La frise se remplit à chaque saisie' };
    if (hs.charAt(0) === 's' && mSl[+hs.slice(1)]) { const x = mSl[+hs.slice(1)]; hsel = { cls: 'hs sl', icon: '#i-moon', txt: x.run ? 'Dodo en cours depuis ' + hm(x.a) + ' · ' + dur(NOW - x.a) : (x.a % 1440 >= 420 && x.a % 1440 < 1170 ? 'Sieste, ' : 'Nuit, ') + hm(x.a) + ' → ' + hm(x.b) + ' · ' + dur(x.b - x.a) }; }
    if (hs.charAt(0) === 'f' && mFd[+hs.slice(1)]) { const x = mFd[+hs.slice(1)]; hsel = { cls: 'hs fd', icon: x.k === 'bib' ? '#i-milk' : '#i-heart', txt: (x.k === 'bib' ? 'Biberon ' + x.ml + ' mL' : 'Tétée ' + (SIDE[x.side] || '')) + ' à ' + hm(x.a) }; }
    const miniNow = (((NOW - FA) / 1440) * 100).toFixed(2);
    // bandes de nuit (20 h → 7 h) et repères horaires selon l'origine
    const nightRel = AX ? [[780, 1440]] : [[0, 420], [1200, 1440]];
    const miniNb = nightRel.map((n) => ({ l: ((n[0] / 1440) * 100).toFixed(2), w: (((n[1] - n[0]) / 1440) * 100).toFixed(2) }));
    const axL5 = AX ? ['7 h', '13 h', '19 h', '1 h', '7 h'] : ['0 h', '6 h', '12 h', '18 h', '24 h'];
    const axL4 = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ l: (i === 8 && !AX ? 24 : (AX / 60 + i * 3) % 24) + ' h', t: String(i * 12.5), cls: i === 0 ? 'first' : i === 8 ? 'last' : '' }));
    const recent = evs.slice().sort((x, y) => y.a - x.a).slice(0, 4).map((e) => { const inf = evInfo(e); return { time: hm(e.a), icon: inf.icon, icCls: inf.icCls, title: inf.title, det: e.k === 'sleep' ? dur(e.b - e.a) : inf.det, pick: openEdit(e) }; });
    const pumpAll = (etat === 'peu' || !noData ? Bs.pump.filter((p) => p.a <= NOW) : []).concat(s.pumps || []);
    const pumps = pumpAll.filter((p) => p.a >= T0);
    const pumpTotal = pumps.reduce((t, p) => t + p.g + p.d, 0);
    const pumpLine = pumps.length ? pumps.length + (pumps.length > 1 ? ' tirages' : ' tirage') + ' aujourd’hui · ' + pumpTotal + ' mL' : 'Aucun tirage aujourd’hui';
    // journal tire-lait : deux semaines jour par jour, moyenne par jour (aujourd’hui, pas fini, n’entre pas dans la moyenne)
    const pjDay = (k) => {
      const ps = pumpAll.filter((p) => p.a >= (27 - k) * 1440 && p.a < (28 - k) * 1440), g = ps.reduce((n, p) => n + p.g, 0), dd = ps.reduce((n, p) => n + p.d, 0), dl = dLong(27 - k);
      return { k, n: ps.length, tot: g + dd, head: k === 0 ? 'Aujourd’hui' : k === 1 ? 'Hier' : cap(dl.split(' ')[0]), date: k < 2 ? dl : dl.split(' ').slice(1).join(' '),
        totL: ps.length ? g + dd + '\u00a0mL' : '—', sub: ps.length ? ps.length + (ps.length > 1 ? ' tirages' : ' tirage') + ' · gauche ' + g + ' · droite ' + dd : 'aucun tirage noté' };
    };
    const pjAvg = (days) => { const ok = days.filter((x) => x.k > 0 && x.n > 0); return ok.length ? { ml: ok.reduce((n, x) => n + x.tot, 0) / ok.length, n: ok.reduce((n, x) => n + x.n, 0) / ok.length } : null; };
    const pjA = [0, 1, 2, 3, 4, 5, 6].map(pjDay), pjB = [7, 8, 9, 10, 11, 12, 13].map(pjDay), avA = pjAvg(pjA), avB = pjAvg(pjB);
    const pjWeek = (title, w0, days, av, other) => {
      const df = av && other ? Math.round((av.ml - other.ml) / 10) * 10 : 0;
      return { title, per: 'Du ' + rgW(27 - w0 - 6, 27 - w0, true), days, hasAvg: !!av, avg: av ? Math.round(av.ml / 10) * 10 + '\u00a0mL' : '—', avgL: av ? 'par jour en moyenne · ' + fr1(av.n) + ' tirages par jour' : 'pas assez de jours notés pour une moyenne',
        hasChip: !!(av && other) && df !== 0, chip: df > 0 ? 'chp up' : 'chp mv', chipIc: df > 0 ? '#i-up' : '#i-down', chipT: Math.abs(df) + ' mL ' + (df > 0 ? 'de plus' : 'de moins') + ' par jour que la semaine d’avant' };
    };
    const pjo = s.pjo || { 0: true };
    const pjWeeks = [pjWeek('Cette semaine', 0, pjA, avA, avB), pjWeek('La semaine d’avant', 7, pjB, avB, null)].map((w, n) => Object.assign(w, { open: !!pjo[n], chev: 'pj-c' + (pjo[n] ? ' on' : ''), toggle: set({ pjo: Object.assign({}, pjo, { [n]: !pjo[n] }) }) }));

    // ---------- PILOTAGE ----------
    const pDay = s.pday || 0;
    const PS = dStart(27 - pDay), PE = dStart(28 - pDay);
    const segsP = allSegsAbs.filter((x) => x.b > PS && x.a < PE).map((x) => Object.assign({}, x, { pick: openDetail(x) }));
    const marksP = FD.filter((x) => x.a >= PS && x.a < PE);
    const pHas = segsP.length + marksP.length > 0;
    // horloge : un seul cercle. Lavande pleine = il a dormi, lavande pointillée = créneau habituel à venir,
    // pictogrammes cliquables (dodo, repas, créneau) : le détail s'affiche au centre
    const C = 160, R = 116;
    const pt = (t, r) => { const ang = ((((t % 1440) + 1440) % 1440) / 1440) * 2 * Math.PI - Math.PI / 2; return [C + r * Math.cos(ang), C + r * Math.sin(ang)]; };
    const arc = (a, b, r, trim) => {
      if (trim && b - a > 2 * trim + 2) { a += trim; b -= trim; }
      if (b - a >= 1439) b = a + 1439;
      const p0 = pt(a, r), p1 = pt(b, r);
      return 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + (b - a > 720 ? 1 : 0) + ' 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
    };
    const pview = s.pview || P.pview || 'jour';
    const wstyle = s.wstyle || P.wstyle || 'calendrier';
    const wMeal = (s.wsel || P.wsel || 'dodo') === 'repas';
    const pw = s.pweek || 0;
    const winP = pDay === 0 ? wins : [];
    const nowPt = pt(NOW, R);
    const pSleep = r5(segsP.reduce((t, x) => t + Math.min(x.b, PE) - Math.max(x.a, PS), 0));
    const csel = s.csel || '';
    const toggle = (id) => set({ csel: csel === id ? '' : id });
    const cItems = [];
    segsP.forEach((x, i) => { const a = Math.max(x.a, PS), b = Math.min(x.b, PE), q = pt((a + b) / 2, R); cItems.push({ id: 's' + i, kind: 'sl', x: q[0], y: q[1], icon: '#i-moon', src: x, aria: sleepAria(x) }); });
    winP.forEach((w, i) => { const q = pt((w.a + w.b) / 2, R); cItems.push({ id: 'w' + i, kind: 'wn', x: q[0], y: q[1], icon: '#i-clock', src: w, aria: w.lab + ' habituelle : ' + w.t + ', ' + w.tag }); });
    marksP.forEach((m, i) => { const q = pt(m.a, R + 23); cItems.push({ id: 'f' + i, kind: 'fd', x: q[0], y: q[1], icon: m.k === 'bib' ? '#i-milk' : '#i-heart', src: m, aria: (m.k === 'bib' ? 'Biberon ' + m.ml + ' mL' : 'Tétée') + ' à ' + hm(m.a) }); });
    // tout l'anneau est touchable : repas proche, sinon le dodo / créneau qui contient l'heure touchée, sinon le plus proche
    const clkTap = (e) => {
      if (!cItems.length) return;
      const span = (k) => k.kind === 'fd' ? [k.src.a, 0] : [Math.max(k.src.a, PS), Math.min(k.src.b, PE) - Math.max(k.src.a, PS)];
      const gap = (m, k) => { const [a, len] = span(k), d = (((m - a) % 1440) + 1440) % 1440; return d <= len ? 0 : Math.min(d - len, 1440 - d); };
      let pick;
      if (!e.clientX && !e.clientY) { // clavier : élément suivant
        pick = cItems[(cItems.findIndex((k) => k.id === csel) + 1) % cItems.length];
      } else {
        const rc = e.currentTarget.getBoundingClientRect(), sc = rc.width / 320;
        const x = (e.clientX - rc.left) / sc - C, y = (e.clientY - rc.top) / sc - C;
        if (Math.sqrt(x * x + y * y) < 82) return;
        const m = (((Math.atan2(y, x) + Math.PI / 2) / (2 * Math.PI)) * 1440 + 1440) % 1440;
        const fd = cItems.filter((k) => k.kind === 'fd' && gap(m, k) <= 20).sort((p, q) => gap(m, p) - gap(m, q))[0];
        pick = fd || cItems.slice().sort((p, q) => gap(m, p) - gap(m, q))[0];
      }
      this.setState({ csel: pick.id });
    };
    const clk = {
      tap: clkTap,
      sleep: segsP.map((x) => arc(Math.max(x.a, PS), Math.min(x.b, PE), R, 3)).join(' '),
      win: winP.map((w) => arc(w.a, w.b, R, 3)).join(' '),
      feeds: marksP.map((m) => { const q = pt(m.a, R + 23); return 'M' + (q[0] - 4).toFixed(1) + ' ' + q[1].toFixed(1) + ' a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0'; }).join(' '),
      items: cItems.map((k) => ({ cls: 'ca-k ' + k.kind + (csel === k.id ? ' on' : ''), x: k.x.toFixed(1), y: k.y.toFixed(1), icon: k.icon, aria: k.aria, on: csel === k.id, pick: toggle(k.id) })),
      nx: nowPt[0].toFixed(1), ny: nowPt[1].toFixed(1), nr: pDay === 0 ? 7 : 0, hr: pDay === 0 ? 9 : 0,
      c1cls: '', c1: pDay === 0 ? nowL : (pSleep ? dur(pSleep) : '—'),
      c2: pDay === 0 ? (run !== null ? 'endormi depuis ' + dur(NOW - run) : lastSleep ? 'éveillé depuis ' + dur(NOW - lastSleep.b) : '') : (pSleep ? 'de sommeil noté ce jour-là' : 'sommeil pas noté'),
      hasPill: run === null && winP.length > 0, pill: winP[0] ? 'Dodo · ' + winP[0].t : '',
      hasAct: false, act: null, actL: '',
      hint: cItems.length ? 'Touche un dodo, un repas ou un créneau pour le détail' : '',
    };
    const cSel = cItems.find((k) => k.id === csel);
    if (cSel) {
      clk.hasPill = false;
      const x = cSel.src;
      if (cSel.kind === 'sl') {
        const m = x.a % 1440;
        Object.assign(clk, { c1: dur((x.run ? NOW : x.b) - x.a), c2: x.run ? 'Dodo en cours depuis ' + hm(x.a) : (m >= 420 && m < 1170 ? 'Sieste' : 'Nuit') + ' · ' + hm(x.a) + ' → ' + hm(x.b), hasAct: true, act: openDetail(x), actL: x.run ? 'Arrêter ou corriger' : 'Voir le détail' });
      } else if (cSel.kind === 'fd') {
        Object.assign(clk, { c1: x.k === 'bib' ? x.ml + '\u00a0mL' : (x.dur ? x.dur + '\u00a0min' : 'Tétée'), c2: (x.k === 'bib' ? 'Biberon' : 'Tétée ' + (SIDE[x.side] || '')) + ' · ' + hm(x.a), hasAct: true, act: openEdit(x), actL: 'Modifier' });
      } else {
        Object.assign(clk, { c1cls: 'sm', c1: x.t, c2: x.lab + ' habituelle · ' + x.tag });
      }
    }
    const suite = winP.map((w) => ({ t: w.t, lab: w.lab, tag: w.tag }));

    // résumé Dodo / Repas : une carte par jour, du plus ancien à aujourd’hui (carrousel synchronisé avec le jour du cadran)
    const legDots = [6, 5, 4, 3, 2, 1, 0].map((k) => ({ cls: k === pDay ? 'on' : '', on: k === pDay, aria: k === 0 ? 'Aujourd’hui' : k === 1 ? 'Hier' : cap(dLong(27 - k)), pick: () => { this._noTop = true; this.setState({ pday: k, csel: '' }); } }));
    const legSlides = [6, 5, 4, 3, 2, 1, 0].map((k) => {
      const a0 = dStart(27 - k), a1 = dStart(28 - k);
      const sg = allSegsAbs.filter((x) => x.b > a0 && x.a < a1), mk = FD.filter((x) => x.a >= a0 && x.a < a1);
      const sl = r5(sg.reduce((n, x) => n + Math.min(x.b, a1) - Math.max(x.a, a0), 0)), lg = sg.reduce((m, x) => Math.max(m, (x.run ? NOW : x.b) - x.a), 0);
      const nap = dayOf(27 - k).naps.length, ml = mk.reduce((n, x) => n + (x.ml || 0), 0), sein = mk.filter((x) => x.k === 'sein').length, bib = mk.length - sein;
      const seinTxt = sein + (sein > 1 ? ' tétées' : ' tétée'), dl = dLong(27 - k);
      return {
        head: k === 0 ? 'Aujourd’hui' : k === 1 ? 'Hier' : cap(dl.split(' ')[0]), date: k < 2 ? dl : dl.split(' ').slice(1).join(' '),
        t1: { v: sl ? dur(sl) : '—', s: sl ? nap + (nap > 1 ? ' siestes' : ' sieste') + ' · plus long ' + dur(lg) : 'pas encore noté' },
        t2: { v: ml ? ml + '\u00a0mL' : mk.length ? mk.length + ' repas' : '—', s: !mk.length ? 'pas encore noté' : ml ? [bib + (bib > 1 ? ' biberons' : ' biberon'), sein ? seinTxt : ''].filter(Boolean).join(' · ') : seinTxt },
      };
    });

    // semaine : 7 jours finissant le jour choisi par les flèches de semaine
    const wEnd = 27 - pw * 7;
    const wk = win(wEnd - 6, wEnd).map((d) => {
      const x = dayOf(d), A = dStart(d), E = dStart(d + 1), upto = d === 27 ? NOW : E, Dd = d * 1440 + AX;
      const sl = allSegsAbs.filter((z) => z.b > A && z.a < E);
      const vis = allSegsAbs.filter((z) => z.b > Dd && z.a < Dd + 1440);
      const tot = sl.reduce((t, z) => t + Math.max(0, Math.min(z.b, E, upto) - Math.max(z.a, A)), 0);
      const nap = x.naps.reduce((t, z) => t + Math.max(0, Math.min(z.b, upto) - z.a), 0);
      const fdw = FD.filter((f) => f.a >= A && f.a < E);
      const ok = d < 27 && (dmode === 'reveil' ? x.complete && nightOf(d + 1).st === 'ok' : x.full24);
      return { d, Dd, sl, vis, tot, nap: Math.min(nap, tot), ok, today: d === 27, fd: fdw.length, ml: fdw.reduce((t, f) => t + (f.ml || 0), 0), fed: x.fed, napsN: x.naps.length, longest: sl.reduce((m, z) => Math.max(m, Math.min(z.b, upto) - z.a), 0) };
    });
    const okW = wk.filter((w) => w.ok);
    const goDay = (d) => () => this.setState({ pview: 'jour', pday: 27 - d, csel: '' });
    const MXB = 17 * 60;
    const wBars = wk.map((w) => {
      const show = (w.ok || w.today) && w.tot > 0, hN = ((w.tot - w.nap) / MXB) * 100, hS = (w.nap / MXB) * 100;
      return { cls: 'wb-c' + (w.today ? ' today' : ''), isOk: show, isMiss: !show, hN: hN.toFixed(1), hS: hS.toFixed(1), vb: (hN + hS).toFixed(1), v: show ? (w.today ? 'en cours' : dur(r5(w.tot))) : '', pick: goDay(w.d), aria: dShort(w.d) + ' : ' + (show ? dur(r5(w.tot)) + ' de sommeil' + (w.today ? ' jusqu’ici' : '') : 'journée notée en partie') };
    });
    const avgW = okW.length ? avg(okW.map((w) => w.tot)) : null;
    const wAvg = { on: avgW !== null, b: avgW !== null ? ((avgW / MXB) * 100).toFixed(1) : '0', l: avgW !== null ? 'moyenne ' + dur(r5(avgW)) : '' };
    // colonne « D'habitude » : moments où il dormait au moins un jour sur deux (journée type), repères relatifs à l'origine AX
    const habSegs = [];
    if (typ.ok) typ.bandSegs.forEach((g) => { let a = g.a - AX, b = g.b - AX; if (b <= 0) { a += 1440; b += 1440; } if (a < 0) { habSegs.push([a + 1440, 1440]); a = 0; } habSegs.push([a, b]); });
    // fil d'habitude : pointillé qui prolonge chaque heure habituelle (repas, ou début de dodo) à travers les 7 jours
    const habMeals = typ.ok ? typ.meals.map((t) => (((t - AX) % 1440) + 1440) % 1440) : [];
    const wHlines = !typ.ok ? [] : wMeal ? habMeals.map((r) => ({ t: ((r / 1440) * 100).toFixed(2), h: '0px', cls: 'wc-hl' })) : habSegs.map((g) => ({ t: ((g[0] / 1440) * 100).toFixed(2), h: (((g[1] - g[0]) / 1440) * 100).toFixed(2) + '%', cls: 'wc-hb' }));
    // créneaux touchables de chaque colonne : dodos ou repas du jour (minutes depuis le début de la colonne)
    const wItems = (w) => wMeal
      ? FD.filter((f) => f.a >= w.Dd && f.a < w.Dd + 1440).map((f, i) => ({ id: w.d + 'f' + i, d: w.d, kind: 'fd', a: f.a - w.Dd, b: f.a - w.Dd, src: f }))
      : w.vis.map((z, i) => { const a = Math.max(z.a, w.Dd), b = Math.min(z.run ? NOW : z.b, w.Dd + 1440); return { id: w.d + 's' + i, d: w.d, kind: 'sl', a: a - w.Dd, b: b - w.Dd, src: z }; });
    const wbsel = s.wbsel || '';
    const wTap = (w) => (e) => {
      const its = wItems(w);
      if (!its.length) return;
      let pick;
      if (!e.clientX && !e.clientY) { // clavier : créneau suivant
        pick = its[(its.findIndex((k) => k.id === wbsel) + 1) % its.length];
      } else {
        const rc = e.currentTarget.getBoundingClientRect(), m = ((e.clientY - rc.top) / rc.height) * 1440;
        const gap = (k) => (m < k.a ? k.a - m : m > k.b ? m - k.b : 0);
        pick = its.slice().sort((p, q) => gap(p) - gap(q))[0];
        if (gap(pick) > 90) pick = null; // touche loin de tout créneau : on désélectionne
      }
      this.setState({ wbsel: pick && pick.id !== wbsel ? pick.id : '' });
    };
    const wCal = wk.map((w) => ({
      cls: 'wc-c' + (!w.ok && !w.today ? ' part' : ''),
      bl: wItems(w).map((k) => ({ t: ((k.a / 1440) * 100).toFixed(2), h: k.kind === 'fd' ? '10px' : (((k.b - k.a) / 1440) * 100).toFixed(2) + '%', cls: 'wc-b' + (k.kind === 'fd' ? ' meal' + (k.src.k === 'sein' ? ' heart' : '') : '') + (k.id === wbsel ? ' on' : '') })),
      hasFut: w.today, fut: w.today ? Math.max(0, ((NOW - w.Dd) / 1440) * 100).toFixed(2) : '100',
      tap: wTap(w), aria: dShort(w.d) + ' : ' + (wMeal ? FD.filter((f) => f.a >= w.Dd && f.a < w.Dd + 1440).length + ' repas notés' : w.sl.length + ' sommeils notés') + '. Touche pour le détail d’un créneau',
    }));
    // fiche du créneau touché
    const wbSel = wk.flatMap(wItems).find((k) => k.id === wbsel);
    const wDet = { on: false, kCls: '', l: '', v: '', w: '' };
    if (wbSel) {
      const x = wbSel.src, when = dShort(wbSel.d) + ' · ';
      if (wbSel.kind === 'sl') {
        const m = x.a % 1440;
        Object.assign(wDet, { on: true, kCls: 'lg-k sl', l: x.run ? 'Dodo en cours' : m >= 420 && m < 1170 ? 'Sieste' : 'Nuit', v: dur((x.run ? NOW : x.b) - x.a), w: when + hm(x.a) + (x.run ? ' → maintenant' : ' → ' + hm(x.b)) });
      } else {
        Object.assign(wDet, { on: true, kCls: 'lg-k fd' + (x.k === 'bib' ? '' : ' heart'), l: x.k === 'bib' ? 'Biberon' : ('Tétée ' + (SIDE[x.side] || '')).trim(), v: x.k === 'bib' ? x.ml + ' mL' : (x.dur ? x.dur + ' min' : 'Tétée'), w: when + hm(x.a) });
      }
    }
    const wLab = wk.map((w) => ({ t: WD[dt(w.d).getDay()].slice(0, 3) + '. ' + dt(w.d).getDate(), d: WD[dt(w.d).getDay()].slice(0, 3) + '.', n: String(dt(w.d).getDate()), cls: w.today ? 'on' : '' }));
    // moyenne de la semaine, en une phrase sous le graphe (Dodo ou Repas selon la bascule)
    const fedW = wk.filter((w) => w.fed);
    const wkAvg = wMeal
      ? (fedW.length ? { cls: 'wk-avg fd', v: fr1(avg(fedW.map((w) => w.fd))) + ' repas', t: 'par jour en moyenne' + (fedW.some((w) => w.ml) ? ', dont' : '.'), hasV2: fedW.some((w) => w.ml), v2: Math.round(avg(fedW.map((w) => w.ml)) / 10) * 10 + ' mL', t2: 'au biberon.' } : { cls: 'wk-avg', v: '', t: 'Pas encore assez de jours notés pour une moyenne des repas.' })
      : (okW.length ? { cls: 'wk-avg sl', v: dur(r5(avg(okW.map((w) => w.tot)))), t: 'de sommeil par 24 h en moyenne, son plus long : ' + dur(Math.max.apply(null, okW.map((w) => w.longest))) + '.' } : { cls: 'wk-avg', v: '', t: 'Pas encore assez de jours notés en entier pour une moyenne du sommeil.' });
    const wGrid = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ t: (k * 12.5).toFixed(1), cls: 'wc-g' + (k % 2 ? '' : ' six') }));
    // comparatif semaine en cours / semaine d'avant (nuits complètes et jours notés seulement)
    const wStats = (end) => {
      const ns = win(Math.max(1, end - 6), end).map(nightOf).filter((n) => n.st === 'ok');
      const fds = FD.filter((f) => f.a >= Math.max(0, end - 6) * 1440 && f.a < (end + 1) * 1440 && f.a <= NOW);
      const gaps = [];
      fds.forEach((f, i) => { if (i && f.a - fds[i - 1].a < 300) gaps.push(f.a - fds[i - 1].a); });
      const bibs = fds.filter((f) => f.k === 'bib');
      // éveil moyen : temps éveillé entre le réveil, chaque sieste et le coucher (journées notées en entier)
      const days = win(Math.max(0, end - 6), end).map(dayOf).filter((x) => x.complete);
      const awk = [];
      days.forEach((x) => { let t = x.wake; x.naps.forEach((z) => { awk.push(z.a - t); t = z.b; }); awk.push(x.bed - t); });
      return {
        awk: days.length >= 3 ? avg(awk) : null,
        nf: ns.length >= 3 ? avg(ns.map((n) => n.nf)) : null,
        cyc: ns.length >= 3 ? avg(ns.map((n) => n.sl.length)) : null,
        cdur: ns.length >= 3 ? avg(ns.map((n) => n.total / n.sl.length)) : null,
        gap: gaps.length >= 5 ? med(gaps) : null,
        qty: bibs.length >= 5 ? avg(bibs.map((f) => f.ml)) : null,
      };
    };
    const wc = wStats(wEnd), wpv = wStats(wEnd - 7);
    // une carte par indicateur : valeur de la semaine, deux barres avant / maintenant, étiquette d'évolution.
    // Sommeil : moins de cycles ou des cycles plus longs = nuits qui se consolident (vert). Repas : changement signalé en pêche.
    const card = (l, kind, a, b, eq, fmt, prog, upTxt, downTxt, unit) => {
      const r = { l, cls: 'cw-c ' + kind, fam: kind === 'sl' ? '#i-moon' : '#i-milk', a: a !== null ? fmt(a) : '—', b: b !== null ? fmt(b) : '—', chip: 'chp na', w: '' , note: '', ic: '#i-info', wt: '' };
      if (b === null) { r.w = r.wt = 'pas assez de données'; return r; }
      if (a === null) { r.w = r.wt = 'semaine d’avant trop peu notée'; return r; }
      const df = b - a;
      if (Math.abs(df) < eq) { r.chip = 'chp eq'; r.w = 'stable'; r.wt = 'Stable'; r.ic = '#i-minus'; return r; }
      const good = prog !== 0 && Math.sign(df) === prog;
      r.chip = kind === 'sl' && good ? 'chp up' : 'chp mv';
      r.w = (df > 0 ? '↗ ' : '↘ ') + (df > 0 ? upTxt : downTxt);
      r.wt = cap(df > 0 ? upTxt : downTxt);
      r.ic = df > 0 ? '#i-up' : '#i-down';
      r.note = (df > 0 ? upTxt : downTxt) + ' (' + (df > 0 ? '+' : '−') + fmt(Math.abs(df)) + unit + ')';
      r.good = good;
      return r;
    };
    const fmtMl = (v) => Math.round(v / 5) * 5 + '\u00a0mL';
    const cards = [
      card('Cycles par nuit', 'sl', wpv.cyc, wc.cyc, 0.3, fr1, -1, 'nuits plus morcelées', 'nuits plus consolidées', ' cycle'),
      card('Durée d’un cycle', 'sl', wpv.cdur, wc.cdur, 10, (v) => dur(r5(v)), 1, 'cycles plus longs', 'cycles plus courts', ''),
      card('Éveil moyen', 'sl', wpv.awk, wc.awk, 10, (v) => dur(r5(v)), 0, 'éveils plus longs', 'éveils plus courts', ''),
      card('Repas par nuit', 'fd', wpv.nf, wc.nf, 0.3, fr1, 0, 'plus de repas la nuit', 'moins de repas la nuit', ''),
      card('Mange toutes les', 'fd', wpv.gap, wc.gap, 10, (v) => dur(r5(v)), 0, 'repas plus espacés', 'repas plus rapprochés', ''),
      card('Par biberon', 'fd', wpv.qty, wc.qty, 5, fmtMl, 0, 'biberons plus grands', 'biberons plus petits', ''),
    ];
    const cmpW = {
      per: 'Du ' + rgW(wEnd - 6, wEnd, true),
      rows: cards,
    };
    const cwDots = cards.map((r, n) => ({ aria: r.l, pick: () => { const el = this._cw; if (el) el.scrollTo({ left: Math.min(n * this.cwStep(el), el.scrollWidth - el.clientWidth), behavior: 'smooth' }); } }));
    const wHab = { on: typ.ok, bl: wMeal && typ.ok ? typ.meals.map((t) => ({ t: (((((t - AX) % 1440) + 1440) % 1440 / 1440) * 100).toFixed(2), h: '10px', cls: 'wc-b meal calc' })) : habSegs.map((g) => ({ t: ((g[0] / 1440) * 100).toFixed(2), h: (((g[1] - g[0]) / 1440) * 100).toFixed(2) + '%', cls: 'wc-b calc' })), pick: () => this.setState({ tab: 'comprendre', cview: 'hc' }) };
    const wEmpty = wk.every((w) => !w.tot && !w.fd);

    // ---------- COMPRENDRE : nuit choisie ----------
    const ni = pDay; // V5 : la nuit qui précède le jour affiché dans Pilotage
    const ND = 27 - ni;
    const N = nightOf(ND), U = usual(ND);
    const O = (ND - 1) * 1440 + 1200, SPAN = 780;
    const pcN = (t) => Math.max(0, Math.min(100, ((t - O) / SPAN) * 100));
    const segN = (a, b, calc, src) => { const w = pcN(b) - pcN(a); return { moon: w >= 6, l: pcN(a).toFixed(2), w: Math.max(1.2, w).toFixed(2), cls: 'fs' + (calc ? ' calc' : ''), txt: '', pick: src ? openDetail(src) : null, aria: src ? sleepAria(src) : '' }; };
    const nv = { title: ni === 0 ? 'Nuit dernière' : 'Nuit du ' + WD[dt(ND - 1).getDay()] + ' au ' + WD[dt(ND).getDay()], dates: 'du ' + dShort(ND - 1) + ' au ' + dShort(ND), hasWarn: false, warn: '', hasHab: false, sum: '', hasSub: false, sumSub: '', rows: [] };
    const cmpT = (a, b) => { const df = a - b; return Math.abs(df) < 15 ? 'comme d’habitude' : dur(r5(Math.abs(df))) + (df > 0 ? ' plus tard' : ' plus tôt'); };
    const cmpD = (a, b) => { const df = a - b; return Math.abs(df) < 15 ? 'comme d’habitude' : dur(r5(Math.abs(df))) + (df > 0 ? ' de plus' : ' de moins'); };
    const NA = 'non noté';
    if (N.st === 'absent') {
      nv.hasWarn = true;
      nv.warn = 'Le sommeil n’est pas noté cette nuit-là' + (N.nf ? ' (' + N.nf + ' repas notés seulement)' : '') + ' : pas de comparaison. Ça ne veut pas dire qu’il n’a pas dormi.';
    } else if (N.st === 'partiel') {
      nv.hasWarn = true;
      nv.warn = 'Comparaison partielle : son sommeil n’est noté que jusqu’à ' + hm(N.wake) + '. Le sommeil total, les réveils et le réveil du matin ne sont pas comparés.';
    }
    const SAME = 'comme d’habitude';
    // dernière sieste de la journée qui précède la nuit, comparée à celle de ses 7 jours d'avant (médiane)
    const prevDay = dayOf(ND - 1), lastOf = (x) => x.naps[x.naps.length - 1];
    const pDays = win(ND - 8, ND - 2).map(dayOf).filter((x) => x.complete && x.naps.length);
    const lp = prevDay.naps.length ? lastOf(prevDay) : null;
    const usNap = pDays.length >= 3 ? r5(med(pDays.map((x) => lastOf(x).b % 1440))) : null;
    nv.rows = [
      { l: 'Dernière sieste finie', a: lp ? hm(lp.b) : NA, h: usNap !== null ? hm(usNap) : '', w: lp && usNap !== null ? cmpT(lp.b % 1440, usNap) : '' },
      { l: 'Coucher', a: N.st !== 'absent' ? hm(N.bed) : NA, h: U.ok ? hm(r5(U.bed)) : '', w: N.st !== 'absent' && U.ok ? cmpT(N.bed - (ND - 1) * 1440, r5(U.bed)) : '' },
      { l: 'Plus long sommeil', a: N.st !== 'absent' ? dur(N.longest) : NA, h: U.ok ? dur(r5(U.longest)) : '', w: N.st === 'ok' && U.ok ? cmpD(N.longest, r5(U.longest)) : N.st === 'partiel' ? 'au moins' : '' },
      { l: 'Sommeil noté', a: N.st === 'ok' ? dur(N.total) : NA, h: U.ok ? dur(r5(U.total)) : '', w: N.st === 'ok' && U.ok ? cmpD(N.total, r5(U.total)) : '' },
      { l: 'Réveils notés', a: N.st === 'ok' ? String(N.wakings) : NA, h: U.ok ? (U.wkMin === U.wkMax ? String(U.wkMin) : U.wkMin + ' à ' + U.wkMax) : '', w: N.st === 'ok' && U.ok ? (N.wakings < U.wkMin ? 'moins que d’habitude' : N.wakings > U.wkMax ? 'plus que d’habitude' : SAME) : '' },
      { l: 'Réveil du matin', a: N.st === 'ok' ? hm(N.wake) : NA, h: U.ok ? hm(r5(U.wake)) : '', w: N.st === 'ok' && U.ok ? cmpT(N.wake - ND * 1440, r5(U.wake)) : '' },
    ].map((r) => Object.assign(r, { hasW: !!r.w, wCls: r.w === SAME || r.w === 'au moins' ? 'dl-same' : 'dx', hasI: !!r.w && r.w !== SAME && r.w !== 'au moins', wi: /plus tard|de plus|plus que/.test(r.w) ? '#i-up' : '#i-down', h: r.a !== NA && r.w !== SAME ? r.h : '' }));
    nv.hasHab = nv.rows.some((r) => !!r.h);
    if (N.st === 'ok' && U.ok) {
      const diff = Math.abs(N.bed - (ND - 1) * 1440 - r5(U.bed)) >= 20 || Math.abs(N.longest - r5(U.longest)) >= 20 || N.wakings > U.wkMax || N.wakings < U.wkMin;
      nv.sum = diff ? 'Un peu différente de ses nuits habituelles' : 'Une nuit comme ses nuits habituelles';
    }
    if (N.st === 'absent') nv.sum = 'Cette nuit n’est pas notée : rien à comparer.';
    else if (N.st === 'partiel') nv.sum = 'Nuit notée jusqu’à ' + hm(N.wake) + ' : seul le début se compare.';
    else if (!U.ok) nv.sum = 'Couché à ' + hm(N.bed) + ', réveillé à ' + hm(N.wake) + (N.wakings ? ', avec ' + N.wakings + ' réveil' + (N.wakings > 1 ? 's' : '') + ' noté' + (N.wakings > 1 ? 's' : '') : ', sans réveil noté') + '.';
    if (N.st !== 'ok') { nv.hasSub = true; nv.sumSub = N.st === 'absent' ? 'Ça ne veut pas dire qu’il n’a pas dormi : seulement que rien n’a été noté.' : 'Le sommeil total, les réveils et le réveil du matin ne sont pas comparés. Une note manquante n’est jamais comptée comme une nuit sans sommeil.'; }
    // ---------- COMPRENDRE : nuit type (les 7 nuits avant la nuit dernière, indépendante des flèches) ----------
    const UT = usual(27);
    const nty = { ok: UT.ok, no: !UT.ok, sumL: [], fia: { basis: '' }, seg: [], mk: [], ax: ['20 h', '22 h', '0 h', '2 h', '4 h', '6 h', '8 h'], steps: [], msg: 'Sa nuit type se dessine à partir de 4 nuits notées en entier ; ' + (UT.n ? 'il y en a ' + UT.n + ' pour l’instant.' : 'la première arrive bientôt.') + ' Elle apparaîtra d’elle-même.' };
    if (UT.ok) {
      const wkT = UT.wkMin === UT.wkMax ? String(UT.wkMin) : UT.wkMin + ' à ' + UT.wkMax, ntMeal = UT.mealWake >= 0.5;
      const ntN0 = win(20, 26).map(nightOf).filter((x) => x.st === 'ok');
      // frise de la nuit type : du coucher au réveil du matin
      const ntS = r5(UT.bed), ntE = r5(1440 + UT.wake), ntP = (t) => ((t - ntS) / (ntE - ntS)) * 100;
      nty.ax = axOf(ntS, ntE, 120, 120);
      nty.seg = UT.blocks.map((bk) => { const a = Math.max(0, ntP(bk[0])), b = Math.min(100, ntP(bk[1])); return { l: a.toFixed(2), w: Math.max(1.2, b - a).toFixed(2) }; });
      // repas qui reviennent la nuit : heures regroupées (moins de 40 min d'écart), gardées si au moins une nuit sur deux
      const ntN = win(20, 26).map(nightOf).filter((x) => x.st === 'ok'), ntF = [];
      ntN.forEach((x) => FD.forEach((f) => { if (f.a >= x.bed - 60 && f.a <= x.wake + 30) ntF.push({ t: f.a - (x.d - 1) * 1440, d: x.d }); }));
      ntF.sort((p1, p2) => p1.t - p2.t);
      let ntG = [];
      const ntFlush = () => { if (ntG.length && new Set(ntG.map((g) => g.d)).size * 2 >= ntN.length) { const t = r5(med(ntG.map((g) => g.t))); if (t >= ntS && t <= ntE) nty.mk.push({ l: ntP(t).toFixed(2), aria: 'Un repas revient vers ' + hm(t) }); } ntG = []; };
      ntF.forEach((f) => { if (ntG.length && f.t - ntG[ntG.length - 1].t > 40) ntFlush(); ntG.push(f); });
      ntFlush();
      const ntNf = Math.round(med(ntN.map((x) => x.nf)));
      nty.fia = fiaOf(UT.n, 'nuit');
      nty.sumL = [
        { icon: '#i-moon', icCls: 'sm4-i k-calc', l: 'Coucher', v: 'vers ' + hm(r5(UT.bed)) },
        { icon: '#i-moon', icCls: 'sm4-i k-sleep', l: 'Réveils de nuit', v: wkT, hasS: true, s: ntNf ? ntNf + ' repas de nuit' : 'sans repas de nuit' },
        { icon: '#i-clock', icCls: 'sm4-i k-calc', l: 'Plus long sommeil', v: dur(r5(UT.longest)) },
        { icon: '#i-sun', icCls: 'sm4-i k-calc', l: 'Réveil du matin', v: 'vers ' + hm(r5(UT.wake)) },
      ];
      nty.steps.push({ isSt: true, isAw: false, t: hm(r5(UT.bed)), icon: '#i-moon', icCls: 'ic k-calc', l: 'Coucher', d: 'entre ' + hm(r5(UT.bedR[0])) + ' et ' + hm(r5(UT.bedR[1])), ...lvOf(1, UT.bedR[1] - UT.bedR[0], UT.n) });
      UT.blocks.forEach((bk, i) => {
        nty.steps.push({ isSt: false, isAw: true, awCls: 'aw-p night', l: 'dort ' + dur(r5(bk[1] - bk[0])), meal: false });
        const nx = UT.blocks[i + 1];
        const ntSt = ntN0.filter((x) => x.sl.length > i + 1).map((x) => x.sl[i + 1].a - (x.d - 1) * 1440), ntR = ntSt.length ? lohi(ntSt) : [0, 999];
        if (nx) nty.steps.push({ ...lvOf(ntSt.length / ntN0.length, ntR[1] - ntR[0], UT.n), isSt: true, isAw: false, t: hm(r5(bk[1])), icon: ntMeal ? '#i-milk' : '#i-moon', icCls: 'ic ' + (ntMeal ? 'k-feed' : 'k-sleep'), l: (i ? ORD[i] : '1er') + ' réveil', d: 'éveillé ' + dur(r5(nx[0] - bk[1])) });
      });
      nty.steps.push({ isSt: true, isAw: false, t: hm(r5(UT.wake)), icon: '#i-sun', icCls: 'ic k-calc', l: 'Réveil du matin', d: 'entre ' + hm(r5(UT.wakeR[0])) + ' et ' + hm(r5(UT.wakeR[1])), ...lvOf(1, UT.wakeR[1] - UT.wakeR[0], UT.n) });
    }

    // ---------- COMPRENDRE › Explorer son rythme : quatre analyses, une seule ouverte à la fois ----------
    // chacune : une question, la réponse en une phrase, un graphique seulement s'il aide, son statut et ce sur quoi elle repose
    const xo = s.xo !== undefined ? s.xo : '';
    const XTAG = { fait: ['tn', 'Constaté'], tend: ['tc', 'Une tendance se dessine'], hyp: ['tq', 'À confirmer'], nodata: ['tq', 'Pas assez de données'], no: ['tq', 'Non mesurable ici'], unk: ['tq', 'Pas encore noté'], none: ['tq', 'Rien de net'] };
    const xi = (k, o) => Object.assign({ q: '', ans: '', note: '', cap: '', ch: null, fr: null, cmp: null, tab: null, split: null, steps: null, rows: [], basis: '' }, o, { hasSteps: !!o.steps, hasSplit: !!o.split, tag: XTAG[k][1], tagCls: XTAG[k][0], mute: ['none', 'nodata', 'unk', 'no'].indexOf(k) >= 0, cls: 'xp-i' + (['none', 'nodata', 'unk', 'no'].indexOf(k) >= 0 ? ' mute' : ''), hasCmp: !!o.cmp, hasTab: !!o.tab, hasNote: !!o.note, hasCh: !!o.ch, hasFr: !!o.fr, hasRows: !!(o.rows && o.rows.length), hasBasis: !!o.basis });
    const XW = [[1, 6], [7, 13], [14, 20], [21, 27]];
    const xwL = XW.map((w) => dt(w[0]).getDate() + '–' + dt(w[1]).getDate() + ' ' + MO[dt(w[1]).getMonth()].slice(0, 3) + '.');
    const xwNights = (w) => win(w[0], w[1]).map(nightOf).filter((x) => x.st === 'ok');
    const xwDays = (w) => win(w[0], Math.min(w[1], 26)).map(dayOf);
    // barres : une valeur par colonne ; une colonne sans valeur reste hachurée
    const xBars = (vals, labels, fmt, cls) => {
      const known = vals.filter((v) => v !== null), mx = (known.length ? Math.max.apply(null, known) : 1) * 1.18;
      return { cls: 'ch p7 w4', xcls: 'ch-x p7', aria: vals.map((v, i) => labels[i] + ' : ' + (v === null ? 'pas assez de données' : fmt(v))).join(', '), hasMiss: known.length < vals.length, cols: vals.map((v, i) => (v === null ? { x: labels[i], isBar: false, isMiss: true, v: '', h: '0', bcls: '' } : { x: labels[i], isBar: true, isMiss: false, v: fmt(v), h: ((v / mx) * 100).toFixed(1), bcls: 'ch-b' + cls })) };
    };
    // première et dernière semaine renseignées
    const xTr = (vals) => { const ix = []; vals.forEach((v, i) => { if (v !== null) ix.push(i); }); return ix.length < 2 ? null : { a: vals[ix[0]], z: vals[ix[ix.length - 1]], w: ix[ix.length - 1] - ix[0], k: ix.length }; };
    const xWk = (w) => w + ' semaine' + (w > 1 ? 's' : '');
    const xpl = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');
    const lkItem = (q, r, none, nt) => {
      if (!r.enough) return xi('nodata', { q, ans: 'Pas encore assez de nuits notées pour comparer. Ça se dessinera au fil de tes notes.', basis: r.n + ' nuit' + (r.n > 1 ? 's' : '') + ' notée' + (r.n > 1 ? 's' : '') + ' en entier · il en faut au moins 5 de chaque côté' });
      if (!r.best) return xi('none', { q, ans: none, basis: r.n + ' nuits notées en entier' });
      const b = r.best;
      return xi(b.solid ? 'tend' : 'hyp', { q, ans: b.t, cmp: { al: b.f.s, av: b.o.sv(b.ma), an: b.o.n + ' · ' + b.A.length + ' soirs', bl: b.f.so, bv: b.o.sv(b.mb), bn: b.o.n + ' · ' + b.B.length + ' soirs', d: cap(b.o.n) + ' : ' + b.o.d(b.ma - b.mb), ic: b.ma > b.mb ? '#i-up' : '#i-down' }, note: (nt ? nt + ' ' : '') + 'Ces deux choses se suivent dans ton journal : cela ne dit pas que l’une explique l’autre.', basis: b.basis });
    };

    // 1 · son sommeil et ses cycles : un journal montre des périodes observées, pas des cycles biologiques
    const x1v = XW.map((w) => { const ns = xwNights(w); return ns.length >= 3 ? med(ns.map((x) => x.longest)) : null; });
    const x1t = xTr(x1v), x1n = XW.reduce((n, w) => n + xwNights(w).length, 0);
    let x1k = 'nodata', x1a = 'Pas encore assez de nuits notées en entier pour comparer les semaines : il en faut 3 par semaine.', x1s = 'Pas encore assez de nuits notées';
    if (x1t) {
      const a = r5(x1t.a), z = r5(x1t.z), df = z - a;
      if (Math.abs(df) < 20) { x1k = 'fait'; x1a = 'Son plus long sommeil de nuit reste à peu près le même : environ ' + dur(z) + '.'; x1s = 'Ses nuits sont stables, plus long sommeil ≈ ' + dur(z); }
      else {
        x1k = x1t.k >= 3 ? 'tend' : 'hyp';
        x1a = df > 0 ? 'Son plus long sommeil de nuit s’allonge doucement : de ' + dur(a) + ' à ' + dur(z) + ' en ' + xWk(x1t.w) + '.' : 'Son plus long sommeil de nuit est un peu plus court : ' + dur(z) + ', contre ' + dur(a) + ' il y a ' + xWk(x1t.w) + '. Ça se regarde sur plusieurs semaines.';
        x1s = df > 0 ? 'Son plus long sommeil de nuit s’allonge doucement' : 'Son plus long sommeil de nuit varie un peu';
      }
    }
    const x1n7 = win(21, 27).map(nightOf).filter((x) => x.st === 'ok'), x1b = [].concat.apply([], x1n7.map((x) => x.bl)), x1w = x1n7.length ? Math.round(med(x1n7.map((x) => x.wakings))) : 0;
    const x1items = [
      xi(x1k, { q: 'Ses nuits deviennent-elles plus continues ?', ans: x1a, cap: 'Son plus long sommeil de nuit, semaine par semaine', ch: x1t ? xBars(x1v, xwL, (v) => dur(r5(v)), '') : null, note: 'À son âge, une semaine peut ressembler très peu à la suivante : une nuit isolée ne fait pas une tendance.', basis: x1n + ' nuits notées en entier · médiane de chaque semaine' }),
      xi(x1b.length >= 6 ? 'fait' : 'nodata', { q: 'Combien de temps durent ses périodes de sommeil ?', ans: x1b.length >= 6 ? 'Le plus souvent entre ' + dur(r5(rQt(x1b, 0.25))) + ' et ' + dur(r5(rQt(x1b, 0.75))) + ' d’affilée, jusqu’à ' + dur(r5(Math.max.apply(null, x1b))) + ' au plus, avec en général ' + xpl(x1w, 'réveil') + ' noté' + (x1w > 1 ? 's' : '') + ' par nuit.' : 'Il faut au moins 3 nuits notées en entier pour le dire.', basis: x1n7.length + ' dernières nuits notées en entier · ' + x1b.length + ' périodes' }),
      xi('no', { q: 'Voit-on ses cycles de sommeil ?', ans: 'Pas directement. Le journal montre des périodes de sommeil séparées par un réveil que tu as noté ; les cycles de sommeil, eux, se passent à l’intérieur et ne se mesurent pas sans capteur. Margherite suit donc la durée de ces périodes, pas ses cycles.' }),
    ];

    // 2 · ses siestes et ses temps d'éveil
    const x2a = typ.ok ? typ.naps.map((z) => ({ x: ORD[z.k], v: z.aw, du: z.du })) : [];
    const x2ok = x2a.length >= 2;
    const x2lo = x2ok ? Math.min.apply(null, x2a.map((o) => o.v)) : 0, x2hi = x2ok ? Math.max.apply(null, x2a.map((o) => o.v)) : 0;
    const x2rg = x2hi - x2lo < 10 ? 'environ ' + dur(r5(x2lo)) : 'de ' + dur(r5(x2lo)) + ' à ' + dur(r5(x2hi));
    const x2v = XW.map((w) => {
      const ds = xwDays(w).filter((x) => x.complete);
      if (ds.length < 3) return null;
      const aw = [];
      ds.forEach((x) => { let t0 = x.wake; x.naps.forEach((z) => { aw.push(z.a - t0); t0 = z.b; }); });
      return avg(aw);
    });
    const x2t = xTr(x2v);
    let x2k = 'nodata', x2a2 = 'Pas encore assez de journées notées en entier pour comparer les semaines : il en faut 3 par semaine.';
    if (x2t) {
      const a = r5(x2t.a), z = r5(x2t.z), df = z - a;
      if (Math.abs(df) < 10) { x2k = 'fait'; x2a2 = 'Ses temps d’éveil restent à peu près les mêmes : environ ' + dur(z) + ' en moyenne.'; }
      else { x2k = x2t.k >= 3 ? 'tend' : 'hyp'; x2a2 = 'Son éveil moyen ' + (df > 0 ? 's’allonge doucement' : 'se raccourcit un peu') + ' : de ' + dur(a) + ' à ' + dur(z) + ' en ' + xWk(x2t.w) + '.'; }
    }
    const x2lr = lkEval([LFX.late, LFX.ln], [LO.bed, LO.lg, LO.wk], lkR);
    // nombre de siestes par jour : sur les 7 derniers jours, puis semaine par semaine
    const x2nc = cdays.map((x) => x.naps.length), x2nlo = x2nc.length ? Math.min.apply(null, x2nc) : 0, x2nhi = x2nc.length ? Math.max.apply(null, x2nc) : 0;
    const x2nv = XW.map((w) => { const ds = xwDays(w).filter((x) => x.complete); return ds.length >= 3 ? avg(ds.map((x) => x.naps.length)) : null; });
    const x2nt = xTr(x2nv), x2nd = x2nt ? x2nt.z - x2nt.a : 0, x2nch = Math.abs(x2nd) >= 0.35;
    const x2nr = x2nlo === x2nhi ? String(x2nlo) : x2nlo + ' à ' + x2nhi;
    const x2hv = XW.map((w) => { const ds = xwDays(w).filter((x) => x.complete); return ds.length >= 3 ? avg(ds.map((x) => x.napsTotal)) : null; });
    const x2ht = xTr(x2hv), x2hn = cdays.length ? med(cdays.map((x) => x.napsTotal)) : 0, x2hd = x2ht ? r5(x2ht.z) - r5(x2ht.a) : 0, x2hch = Math.abs(x2hd) >= 15;
    const x2items = [
      cdays.length >= 3
        ? xi(x2nch ? (x2nt.k >= 3 ? 'tend' : 'hyp') : 'fait', { q: 'Combien de siestes fait-il par jour ?', ans: 'Le plus souvent ' + x2nr + ' siestes par jour' + (x2nch ? ', et ' + (x2nd > 0 ? 'un peu plus' : 'un peu moins') + ' qu’il y a ' + xWk(x2nt.w) + ' (' + fr1(x2nt.z) + ' en moyenne, contre ' + fr1(x2nt.a) + ').' : '.'), cap: 'Siestes par jour, semaine par semaine', ch: x2nt ? xBars(x2nv, xwL, fr1, '') : null, basis: cdays.length + ' journées notées en entier sur les 7 dernières · moyenne de chaque semaine' })
        : xi('nodata', { q: 'Combien de siestes fait-il par jour ?', ans: 'Pas encore assez de journées notées en entier (réveil, siestes et coucher) : il en faut 3.' }),
      cdays.length >= 3
        ? xi(x2hch ? (x2ht.k >= 3 ? 'tend' : 'hyp') : 'fait', { q: 'Combien d’heures dort-il en siestes ?', ans: 'Environ ' + dur(r5(x2hn)) + ' de sieste par jour' + (x2hch ? ', et ' + (x2hd > 0 ? 'un peu plus' : 'un peu moins') + ' qu’il y a ' + xWk(x2ht.w) + ' (' + dur(r5(x2ht.z)) + ' en moyenne, contre ' + dur(r5(x2ht.a)) + ').' : '.'), cap: 'Temps de sieste par jour, semaine par semaine', ch: x2ht ? xBars(x2hv, xwL, (v) => dur(r5(v)), '') : null, note: 'Les siestes seulement : le sommeil de nuit n’est pas compté.', basis: cdays.length + ' journées notées en entier sur les 7 dernières · moyenne de chaque semaine' })
        : xi('nodata', { q: 'Combien d’heures dort-il en siestes ?', ans: 'Pas encore assez de journées notées en entier : il en faut 3.' }),
      x2ok
        ? xi('fait', { q: 'Combien de temps reste-t-il éveillé entre deux siestes ?', ans: 'Il reste éveillé ' + x2rg + ' avant chacune de ses siestes.', cap: 'Temps éveillé avant chaque sieste', ch: xBars(x2a.map((o) => o.v), x2a.map((o) => o.x), (v) => dur(r5(v)), ' pe'), note: 'Ses siestes durent en général entre ' + dur(r5(Math.min.apply(null, x2a.map((o) => o.du)))) + ' et ' + dur(r5(Math.max.apply(null, x2a.map((o) => o.du)))) + '.', basis: typ.fia.basis })
        : xi('nodata', { q: 'Combien de temps reste-t-il éveillé entre deux siestes ?', ans: 'Pas encore assez de journées notées en entier (réveil, siestes et coucher) : il en faut 3.' }),
      xi(x2k, { q: 'Ses temps d’éveil changent-ils ?', ans: x2a2, basis: XW.reduce((n, w) => n + xwDays(w).filter((x) => x.complete).length, 0) + ' journées notées en entier · moyenne de chaque semaine' }),
      lkItem('Sa dernière sieste a-t-elle un lien avec sa nuit ?', x2lr, 'Pas de lien net entre l’heure ou la durée de sa dernière sieste et sa nuit.'),
    ];

    // 3 · son alimentation : seuls les biberons ont un volume noté, rien n'est estimé pour les tétées
    const x3d = win(20, 26).map(dayOf).filter((x) => x.fed);
    const x3tot = x3d.reduce((n, x) => n + x.feeds.length, 0), x3sein = x3d.reduce((n, x) => n + x.sein, 0), x3bib = x3tot - x3sein;
    const x3nb = x3d.length ? Math.round(med(x3d.map((x) => x.feeds.length))) : 0;
    const x3mode = !x3tot ? '' : !x3sein ? 'au biberon seulement' : !x3bib ? 'en tétée seulement' : 'au biberon et en tétée';
    const x3P = (m) => ((m / 1440) * 100).toFixed(2);
    const x3fr = typ.ok && typ.meals.length >= 2 ? { nb: [[0, r5(typ.wake)], [Math.min(1440, r5(typ.bed)), 1440]].filter((n) => n[1] > n[0]).map((n) => ({ l: x3P(n[0]), w: x3P(n[1] - n[0]) })), segs: [], hasMk: true, marks: typ.meals.map((m) => ({ l: x3P(m), aria: 'Un repas revient vers ' + hm(m) })), ax: axOf(0, 1440, 360, 120).map((x, i, a) => (i === a.length - 1 ? { ...x, t: '24 h' } : x)) } : null;
    const x3w = XW.map((w) => {
      const ds = xwDays(w).filter((x) => x.fed), bs = [].concat.apply([], ds.map((x) => x.feeds.filter((f) => f.k === 'bib')));
      return { nb: ds.length >= 3 ? avg(ds.map((x) => x.feeds.length)) : null, q: ds.length >= 3 && bs.length >= 8 ? avg(bs.map((f) => f.ml)) : null };
    });
    const x3t = xTr(x3w.map((o) => o.q)), x3f = xTr(x3w.map((o) => o.nb));
    let x3k = 'nodata', x3a = 'Pas encore assez de biberons notés pour comparer les semaines.';
    if (x3t) {
      const a = Math.round(x3t.a / 5) * 5, z = Math.round(x3t.z / 5) * 5, df = x3t.z - x3t.a, nf = x3f ? x3f.z - x3f.a : 0;
      const fq = !x3f ? '' : Math.abs(nf) < 0.6 ? ', pour à peu près autant de repas par jour' : ', avec ' + (nf > 0 ? 'plus' : 'moins') + ' de repas par jour';
      if (Math.abs(df) < 10) { x3k = 'fait'; x3a = 'Ses biberons restent à peu près de la même taille : environ ' + z + ' mL' + fq + '.'; }
      else { x3k = x3t.k >= 3 ? 'tend' : 'hyp'; x3a = 'Ses biberons passent de ' + a + ' à ' + z + ' mL en ' + xWk(x3t.w) + fq + '.'; }
    } else if (x3tot > 0 && !x3bib && !x3w.some((o) => o.q !== null)) { x3k = 'no'; x3a = 'Les tétées n’ont pas de volume noté : Margherite n’estime rien. Seul le nombre de repas est suivi.'; }
    const x3fd = x3d.filter((x) => !x.sein && x.ml > 0);
    const x3rows = x3fd.length >= 3
      ? [{ lab: 'Sur 24 h, les jours sans tétée', val: '≈ ' + Math.round(med(x3fd.map((x) => x.ml)) / 10) * 10 + ' mL', note: 'Son total de lait ces jours-là (' + x3fd.length + ' jours).' }]
      : x3bib ? [{ lab: 'Au biberon, par jour', val: '≈ ' + Math.round(med(x3d.map((x) => x.ml)) / 10) * 10 + ' mL', note: x3sein ? 'Les tétées n’ont pas de volume noté : ce n’est pas son total de lait sur 24 h.' : 'Ses ' + x3d.length + ' derniers jours notés.' }] : [];
    const x3lr = lkEval([LFX.ml], [LO.wk], lkMl);
    const x3items = [
      x3d.length >= 3
        ? xi('fait', { q: 'Combien de repas par jour, et à quels moments ?', ans: 'Environ ' + x3nb + ' repas par jour, ' + x3mode + (x3fr ? '. Les points montrent les heures où un repas revient le plus souvent.' : '.'), cap: 'Repas qui reviennent, sur 24 h', fr: x3fr, basis: x3d.length + ' journées notées sur les 7 dernières' })
        : xi('nodata', { q: 'Combien de repas par jour, et à quels moments ?', ans: 'Pas encore assez de journées notées pour le dire.' }),
      xi(x3k, { q: 'Quelle quantité de lait boit-il, et comment ça évolue ?', ans: x3a, cap: 'Quantité moyenne par biberon, semaine par semaine', ch: x3t ? xBars(x3w.map((o) => o.q), xwL, (v) => Math.round(v / 5) * 5 + ' mL', ' pe') : null, rows: x3rows, basis: 'Biberons seulement · moyenne de chaque semaine' }),
      lkItem('Y a-t-il un lien entre ce qu’il boit et ses réveils de nuit ?', x3lr, 'Pas de lien net entre ce qu’il boit au biberon dans la journée et ses réveils la nuit suivante.', 'Biberons seulement : les tétées n’ont pas de volume noté, ce total est donc partiel.'),
    ];

    // 4 · ses habitudes et leurs liens avec son sommeil : jamais de cause, seulement ce qui se suit dans le journal
    const x4lr = lkEval([LFX.awk, LFX.awb, LFX.many], [LO.bed, LO.lg, LO.wk], lkR);
    const x4cut = lkR.length >= 12 ? r5(rQt(lkR.map((x) => x.lg), 0.67)) : 0;
    const x4A = x4cut ? lkR.filter((x) => x.lg >= x4cut) : [], x4B = x4cut ? lkR.filter((x) => x.lg < x4cut) : [];
    const X4F = [
      { l: 'Dernière sieste finie', k: 'end', min: 20, fmt: (v) => hm(r5(v)) },
      { l: 'Siestes dans la journée', k: 'nap', min: 1, fmt: (v) => fr1(v) },
      { l: 'Éveil avant le coucher', k: 'awb', min: 20, fmt: (v) => dur(r5(v)) },
    ];
    const x4rows = x4A.length >= 5 && x4B.length >= 5 ? X4F.map((f) => ({ f, ma: med(x4A.map((x) => x[f.k])), mb: med(x4B.map((x) => x[f.k])) })).filter((o) => Math.abs(o.ma - o.mb) >= o.f.min).map((o) => ({ l: o.f.l, a: o.f.fmt(o.ma), b: o.f.fmt(o.mb) })) : null;
    const x4q = 'Que se passe-t-il avant ses nuits les plus continues ?';
    const x4top = x4rows === null
      ? xi('nodata', { q: x4q, ans: 'Pas encore assez de nuits notées pour comparer ses nuits les plus continues aux autres. Ça se dessinera au fil de tes notes.' })
      : x4rows.length
        ? xi(x4A.length >= 8 ? 'tend' : 'hyp', { q: x4q, ans: 'Avant ses nuits les plus continues (au moins ' + dur(x4cut) + ' d’affilée), la journée ressemblait un peu plus à ceci :', tab: { ha: 'Ses ' + x4A.length + ' nuits les plus continues', hb: 'Les autres nuits', rows: x4rows }, note: 'Des points communs, pas des causes : une journée ne programme pas une nuit.', basis: x4A.length + ' nuits contre ' + x4B.length + ' · ' + lkR.length + ' nuits notées en entier' })
        : xi('none', { q: x4q, ans: 'Pas d’habitude commune repérée avant ses nuits les plus continues : elles ne se ressemblent pas par leur veille.', basis: lkR.length + ' nuits notées en entier' });
    const x4items = [
      lkItem('Ses journées plus ou moins éveillées sont-elles suivies de nuits différentes ?', x4lr, 'Pas de différence nette entre ses nuits selon la durée de ses éveils dans la journée.'),
      x4top,
      xi('unk', { q: 'Le bain ou un rituel aide-t-il à l’endormissement ?', ans: 'On ne peut pas encore le dire. Le bain et les rituels du coucher ne sont pas notés dans Margherite, et un journal de sommeil ne mesure pas le temps d’endormissement.' }),
    ];
    // ---------- popup d'un thème : en bref, sections, repère général à cet âge ----------
    const xBaby = (s.baby || 'Léo, 9 semaines').split(','), xName = xBaby[0].trim(), xAgeW = Number(String(xBaby[1] || '').replace(/\D/g, '')) || 0;
    const xSum = (arr, fb) => { const a = arr.filter(Boolean).slice(0, 3).map((x) => ({ t: x })); return a.length ? a : [{ t: fb }]; };
    const xBest = (b) => b.t.replace(/\.$/, '') + (b.solid ? '.' : ' (à confirmer).');
    const XFB = 'Pas encore assez de données pour une synthèse : elle se dessinera au fil de tes notes.';
    const AGE_REFS = false; // repères d’âge non sourcés : masqués. Passer à true seulement avec des sources validées.
    const XNEAR = ' que ce qui s’observe le plus souvent à cet âge';
    // repère général : situe sans juger ; mêmes exemples que l'Accueil › À retenir, à sourcer et faire valider avant tout usage réel
    const xRef = (l, val, lo, hi, fmt, range, up, down) => (val === null ? null : { l, a: fmt(val), b: range, pos: val < lo ? down + XNEAR : val > hi ? up + XNEAR : 'dans ce qui s’observe le plus souvent à cet âge' });
    const xAge = (rows) => { const r = rows.filter(Boolean); return AGE_REFS && xAgeW && r.length ? { sub: 'Pour situer ' + xName + ', pas pour le juger.', tab: { ha: xName, hb: 'Repère à ' + xAgeW + ' sem.', rows: r.map((x) => ({ l: x.l, a: x.a, b: x.b })) }, pos: r.map((x) => ({ t: x.l + ' : ' + x.pos + '.' })), note: 'Chaque bébé a son rythme : un repère décrit ce qui s’observe le plus souvent, il ne fixe rien à atteindre. Exemple de la maquette, à faire sourcer et valider avant tout usage réel.' } : null; };

    // sommeil : durée, répartition nuit / siestes, évolution
    const x1nap = cdays.length >= 3 ? med(cdays.map((x) => x.napsTotal)) : null, x1nig = x1n7.length >= 3 ? med(x1n7.map((x) => x.total)) : null;
    const x1tot = x1nap !== null && x1nig !== null ? x1nap + x1nig : null, x1pc = x1tot ? Math.round((x1nig / x1tot) * 100) : 0;
    const x1tw = XW.map((w) => { const ns = xwNights(w), ds = xwDays(w).filter((x) => x.complete); return ns.length >= 3 && ds.length >= 3 ? med(ns.map((x) => x.total)) + med(ds.map((x) => x.napsTotal)) : null; });
    const x1tt = xTr(x1tw), x1td = x1tt ? r5(x1tt.z) - r5(x1tt.a) : 0, x1tch = Math.abs(x1td) >= 30;
    const x1q1 = 'Combien dort-il, et quand ?', x1q2 = 'Son sommeil total change-t-il d’une semaine à l’autre ?';
    const x1split = x1tot !== null
      ? xi('fait', { q: x1q1, ans: 'Environ ' + dur(r5(x1tot)) + ' de sommeil noté par 24 h : ' + x1pc + ' % la nuit, ' + (100 - x1pc) + ' % en siestes.', split: { aria: 'Nuit ' + dur(r5(x1nig)) + ', siestes ' + dur(r5(x1nap)), ap: x1pc, bp: 100 - x1pc, an: 'Nuit', av: dur(r5(x1nig)), bn: 'Siestes', bv: dur(r5(x1nap)) }, note: 'Sommeil noté seulement : une note manquante n’est jamais comptée comme du sommeil en moins.', basis: x1n7.length + ' nuits et ' + cdays.length + ' journées notées en entier sur les 7 dernières' })
      : xi('nodata', { q: x1q1, ans: 'Il faut au moins 3 journées et 3 nuits notées en entier pour le dire.' });
    const x1ev = x1tt
      ? xi(x1tch ? (x1tt.k >= 3 ? 'tend' : 'hyp') : 'fait', { q: x1q2, ans: x1tch ? 'Il dort un peu ' + (x1td > 0 ? 'plus' : 'moins') + ' qu’il y a ' + xWk(x1tt.w) + ' : environ ' + dur(r5(x1tt.z)) + ' par 24 h, contre ' + dur(r5(x1tt.a)) + '.' : 'Son sommeil total reste à peu près le même : environ ' + dur(r5(x1tt.z)) + ' par 24 h.', cap: 'Sommeil noté par 24 h (nuit + siestes), semaine par semaine', ch: xBars(x1tw, xwL, (v) => dur(r5(v)), ''), basis: 'Nuits et journées notées en entier · médiane de chaque semaine' })
      : xi('nodata', { q: x1q2, ans: 'Pas encore assez de journées et de nuits notées pour comparer les semaines : il en faut 3 de chaque par semaine.' });

    // siestes : horaires
    const x2sch = typ.ok && typ.naps.length
      ? xi('fait', { q: 'À quelle heure dort-il en journée ?', ans: 'Ses siestes reviennent vers ' + typ.naps.map((z) => hm(r5(z.a))).join(', ') + '.', cap: 'Ses siestes habituelles, de minuit au coucher', fr: { nb: jtRow.nb, segs: jtRow.segs, marks: [], hasMk: false, ax: jtRow.ax }, rows: typ.naps.map((z) => ({ lab: ORD[z.k] + ' sieste', val: 'vers ' + hm(r5(z.a)), note: 'dure en général ' + dur(r5(z.du)) + (z.n < cdays.length ? ' · certains jours (' + z.n + ' sur ' + cdays.length + ')' : '') })), basis: typ.fia.basis })
      : xi('nodata', { q: 'À quelle heure dort-il en journée ?', ans: 'Pas encore assez de journées notées en entier (réveil, siestes et coucher) : il en faut 3.' });

    // alimentation : fréquence, évolution
    const x3g = [];
    cdays.forEach((x) => x.dayFeeds.forEach((f, i) => { if (i) x3g.push(f.a - x.dayFeeds[i - 1].a); }));
    const x3gm = x3g.length >= 5 ? med(x3g) : null;
    const x3fd2 = x3f ? x3f.z - x3f.a : 0;
    const x3q = 'Mange-t-il plus ou moins souvent qu’avant ?';
    const x3fev = x3f
      ? xi(Math.abs(x3fd2) < 0.6 ? 'fait' : (x3f.k >= 3 ? 'tend' : 'hyp'), { q: x3q, ans: Math.abs(x3fd2) < 0.6 ? 'Autant de repas par jour qu’il y a ' + xWk(x3f.w) + ' : environ ' + fr1(x3f.z) + '.' : 'Il passe de ' + fr1(x3f.a) + ' à ' + fr1(x3f.z) + ' repas par jour en ' + xWk(x3f.w) + '.', cap: 'Repas par jour, semaine par semaine', ch: xBars(x3w.map((o) => o.nb), xwL, fr1, ' pe'), note: x3gm ? 'Ces 7 derniers jours : un repas toutes les ' + dur(r5(x3gm)) + ' en journée.' : '', basis: 'Biberons et tétées comptés ensemble · moyenne de chaque semaine' })
      : xi('nodata', { q: x3q, ans: 'Pas encore assez de journées notées pour comparer les semaines : il en faut 3 par semaine.' });

    const XB = [
      { id: 'sleep', title: 'Son sommeil et ses cycles', desc: 'Durée, nuits, évolution et cycles', icon: '#i-moon', icCls: 'hb-ic k-sleep',
        intro: 'Combien ' + xName + ' dort, comment ses nuits évoluent, et ce que le journal peut dire (ou pas) de ses cycles.',
        sum: xSum([x1tot !== null ? 'Environ ' + dur(r5(x1tot)) + ' de sommeil par 24 h, dont ' + x1pc + ' % la nuit.' : '', x1t ? x1s + '.' : '', x1b.length >= 6 ? 'Ses périodes de nuit durent le plus souvent ' + dur(r5(rQt(x1b, 0.25))) + ' à ' + dur(r5(rQt(x1b, 0.75))) + '.' : ''], XFB),
        basis: 'Durées sur les 7 derniers jours · évolution sur 4 semaines',
        sections: [{ title: 'Sa durée de sommeil', sub: 'Sa répartition entre la nuit et le jour, et son évolution.', items: [x1split, x1ev] }, { title: 'Ses nuits', sub: 'Leur continuité et la durée de ses périodes.', items: [x1items[0], x1items[1]] }, { title: 'Ses cycles', sub: 'Ce que le journal peut montrer, et ce qu’il ne peut pas.', items: [x1items[2]] }],
        age: xAge([x1tot !== null ? xRef('Sommeil par 24 h', x1tot, 840, 1020, (v) => dur(r5(v)), '14 à 17 h', 'plus', 'moins') : null]) },
      { id: 'naps', title: 'Ses siestes et ses temps d’éveil', desc: 'Nombre, durée, horaires et temps d’éveil', icon: '#i-sun', icCls: 'hb-ic k-calc',
        intro: 'Les siestes de ' + xName + ' (nombre, durée, heures), le temps qu’il reste éveillé entre deux, et ce qui les relie à sa nuit.',
        sum: xSum([cdays.length >= 3 ? x2nr + ' siestes par jour, ' + dur(r5(x2hn)) + ' en tout.' : '', x2ok ? 'Éveillé ' + x2rg + ' avant chaque sieste.' : '', x2lr.best ? xBest(x2lr.best) : (x2lr.enough ? 'Aucun lien net entre sa dernière sieste et sa nuit.' : '')], XFB),
        basis: 'Habitudes sur les 7 derniers jours · évolution sur 4 semaines · liens sur 3 semaines',
        sections: [{ title: 'Ses siestes', sub: 'Combien, combien de temps et à quelle heure.', items: [x2items[0], x2items[1], x2sch] }, { title: 'Ses temps d’éveil', sub: 'Entre le réveil et la sieste, puis entre deux siestes.', items: [x2items[2], x2items[3]] }, { title: 'Le lien avec sa nuit', sub: 'Deux choses qui se suivent dans son journal, jamais une cause.', items: [x2items[4]] }],
        age: xAge([x2ok ? xRef('Éveil avant une sieste', med(x2a.map((o) => o.v)), 60, 90, (v) => dur(r5(v)), '1 h à 1 h 30', 'plus long', 'plus court') : null]) },
      { id: 'feed', title: 'Son alimentation', desc: 'Fréquence, horaires, quantités et évolution', icon: '#i-milk', icCls: 'hb-ic k-feed',
        intro: 'Les repas de ' + xName + ' : combien, à quelle heure, quelles quantités au biberon, et comment cela évolue.',
        sum: xSum([x3d.length >= 3 ? 'Environ ' + x3nb + ' repas par jour, ' + x3mode + '.' : '', x3t ? 'Son biberon moyen passe de ' + Math.round(x3t.a / 5) * 5 + ' à ' + Math.round(x3t.z / 5) * 5 + ' mL.' : (x3k === 'no' ? 'Les tétées n’ont pas de volume noté : rien n’est estimé.' : ''), x3lr.best ? xBest(x3lr.best) : (x3lr.enough ? 'Aucun lien net entre ce qu’il boit et ses réveils de nuit.' : '')], XFB),
        basis: 'Habitudes sur les 7 derniers jours · évolution sur 4 semaines · liens sur 3 semaines',
        sections: [{ title: 'Ses repas', sub: 'Leur nombre, leurs horaires et leur évolution.', items: [x3items[0], x3fev] }, { title: 'Ses quantités', sub: 'Au biberon seulement : les tétées n’ont pas de volume noté.', items: [x3items[1]] }, { title: 'Le lien avec sa nuit', sub: 'Deux choses qui se suivent dans son journal, jamais une cause.', items: [x3items[2]] }],
        age: xAge([x3gm !== null ? xRef('Un repas toutes les', x3gm, 120, 180, (v) => dur(r5(v)), '2 à 3 h', 'espacés', 'rapprochés') : null]) },
      { id: 'links', title: 'Ses habitudes et leurs liens avec son sommeil', desc: 'Dernière sieste, éveils, repas, bain et rituels', icon: '#i-bulb', icCls: 'hb-ic k-calc',
        intro: 'Ce qui revient dans la journée de ' + xName + ' avant ses nuits. Ce sont des points communs repérés dans le journal, jamais des causes.',
        sum: xSum([x4lr.best ? xBest(x4lr.best) : (x4lr.enough ? 'Aucun lien net repéré entre ses éveils et sa nuit.' : 'Pas assez de nuits notées pour comparer.'), x4rows && x4rows.length ? 'Ses nuits les plus continues suivent des journées un peu différentes (détail plus bas).' : '', 'Bain et rituels : pas encore notés.'], XFB),
        basis: 'Liens calculés sur 3 semaines (21 nuits au plus)',
        sections: [{ title: 'De sa journée à sa nuit', sub: 'Ses éveils, puis ce qui précède ses nuits les plus continues.', items: [x4items[0], x4items[1]] }, { title: 'Bain et rituels', sub: 'Ce que Margherite ne peut pas encore dire.', items: [x4items[2]] }],
        age: null },
    ].map((b) => Object.assign(b, { pick: set({ xo: b.id }) }));
    // popups « Sa journée » et « Sa nuit » : ouvertes depuis les deux grandes cartes, pas depuis la liste « Aller plus loin »
    const XD = [
      { id: 'day', title: 'Sa journée type', icon: '#i-sun', icCls: 'hb-ic k-calc',
        intro: 'Les moments qui reviennent le plus souvent dans la journée de ' + xName + ', calculés sur ses 7 derniers jours.',
        sum: typ.ok ? xSum(['Réveil vers ' + hm(r5(typ.wake)) + ', coucher vers ' + hm(r5(typ.bed)) + '.'].concat([typ.daySleep.replace('≈ ', '') + ' de siestes par jour.'], typ.gapV !== 'pas encore' ? ['Un repas toutes les ' + typ.gapV + '.'] : []), XFB) : xSum([], XFB),
        basis: typ.ok ? typ.fia.basis : '',
        sections: typ.ok ? [
          { title: 'Sa journée en un coup d’œil', sub: 'De minuit au coucher : ses siestes et ses repas.', items: [xi('fait', { q: 'Quand dort-il, quand mange-t-il ?', ans: 'Réveil vers ' + hm(r5(typ.wake)) + ', coucher vers ' + hm(r5(typ.bed)) + '. Entre les deux, ses siestes (capsules) et les repas qui reviennent (points).', cap: 'Sa journée type', fr: { nb: jtRow.nb, segs: jtRow.segs, marks: jtRow.marks, hasMk: true, ax: jtRow.ax } })] },
          { title: 'Étape par étape', sub: 'Les moments dans l’ordre, avec le temps éveillé entre deux.', items: [xi('fait', { q: 'Sa journée, du réveil au coucher', ans: 'Chaque heure est celle qui revient le plus souvent, avec la plage où elle tombe.', steps: typ.steps, note: 'Les points à droite : plus il y en a, plus ce moment revient à la même heure.' })] },
        ] : [],
        age: null },
      { id: 'night', title: 'Sa nuit type', icon: '#i-moon', icCls: 'hb-ic k-sleep',
        intro: 'Comment se passent le plus souvent les nuits de ' + xName + ', calculées sur ses 7 dernières nuits.',
        sum: nty.ok ? xSum(['Coucher vers ' + hm(r5(UT.bed)) + ', réveil vers ' + hm(r5(UT.wake)) + '.', 'Réveils de nuit : ' + nty.sumL[1].v + ' (' + nty.sumL[1].s + ').', 'Son plus long sommeil dure en général ' + nty.sumL[2].v + '.'], XFB) : xSum([], XFB),
        basis: nty.ok ? nty.fia.basis : '',
        sections: nty.ok ? [
          { title: 'Sa nuit en un coup d’œil', sub: 'Du coucher au réveil du matin : ses périodes de sommeil et ses repas.', items: [xi('fait', { q: 'Comment dort-il la nuit ?', ans: 'Coucher vers ' + hm(r5(UT.bed)) + ', réveil du matin vers ' + hm(r5(UT.wake)) + '. Entre les deux, ses périodes de sommeil (capsules) et ses repas (points) : un journal ne montre pas ses cycles.', cap: 'Sa nuit type', fr: { nb: [], segs: nty.seg, marks: nty.mk, hasMk: true, ax: nty.ax } })] },
          { title: 'Étape par étape', sub: 'Du coucher au réveil, avec ses réveils de nuit.', items: [xi('fait', { q: 'Sa nuit, du coucher au réveil', ans: 'Chaque heure est celle qui revient le plus souvent, avec la plage où elle tombe.', steps: nty.steps, note: 'Les points à droite : plus il y en a, plus ce moment revient à la même heure.' })] },
        ] : [],
        age: null },
    ];
    const xSel = XB.concat(XD).find((b) => b.id === xo);
    const xB = XB;
    const xm = xSel
      ? { on: true, title: xSel.title, icon: xSel.icon, icCls: xSel.icCls, intro: xSel.intro, sum: xSel.sum, basis: xSel.basis, sections: xSel.sections, hasAge: !!xSel.age, age: xSel.age, close: set({ xo: '' }) }
      : { on: false, title: '', icon: '#i-moon', icCls: 'hb-ic', intro: '', sum: [], basis: '', sections: [], hasAge: false, age: null, close: set({ xo: '' }) };

    // ---------- JOURNAL : bien-être (humeur, digestion, santé du bébé ; santé de la maman) ----------
    const BB = [
      { k: 'humeur', l: 'Humeur', c: 'w-hum', one: true, o: ['Calme', 'Souriant', 'Joueur', 'Grognon', 'Agité', 'Pleure beaucoup', 'Inconsolable'] },
      { k: 'dig', l: 'Digestion', c: 'w-dig', o: ['Régurgite un peu', 'Régurgite beaucoup', 'Vomit', 'Coliques', 'Gaz', 'Hoquet', 'Ventre dur'] },
      { k: 'selles', l: 'Selles', c: 'w-dig', one: true, pfx: 'Selles ', o: ['Normales', 'Liquides', 'Dures', 'Pas de selles'] },
      { k: 'sante', l: 'Santé', c: 'w-san', o: ['Fièvre', 'Nez bouché', 'Tousse', 'Yeux qui coulent', 'Boutons', 'Érythème fessier', 'Croûtes de lait', 'Muguet', 'Refuse de boire', 'Médicament donné'] },
    ];
    const BM = [
      { k: 'mhum', l: 'Mon humeur', c: 'w-mam', one: true, pfx: 'Humeur : ', o: ['Très bien', 'Bien', 'Moyen', 'Difficile', 'Très difficile'] },
      { k: 'mnuit', l: 'Ma nuit', c: 'w-mam', one: true, pfx: 'Nuit ', o: ['Bonne', 'Correcte', 'Difficile'] },
      { k: 'mall', l: 'Allaitement', c: 'w-mam', o: ['Seins douloureux', 'Crevasses', 'Engorgement', 'Sein rouge et chaud'] },
      { k: 'mcorps', l: 'Mon corps', c: 'w-mam', o: ['Douleur à la cicatrice', 'Douleur au périnée', 'Saignements abondants', 'Fièvre', 'Très fatiguée'] },
      { k: 'mmoral', l: 'Mon moral', c: 'w-mam', o: ['Anxieuse', 'Triste, je pleure', 'Dépassée', 'Seule', 'Idées noires'] },
      { k: 'msoi', l: 'Pour moi', c: 'w-mam', o: ['Un moment pour moi', 'Une sortie', 'De l’aide reçue'] },
    ];
    // données d'exemple (inventées), complétées par ce qui est noté dans la maquette
    const W0 = {};
    const wOf = (d) => Object.assign({}, W0[d] || {}, (s.well || {})[d] || {});
    const wHas = (w, k) => (Array.isArray(w[k]) ? w[k].length > 0 : !!w[k]);
    const wList = (w, cats) => [].concat.apply([], cats.map((c) => (Array.isArray(w[c.k]) ? w[c.k] : w[c.k] ? [w[c.k]] : []).map((t) => ({ t: c.pfx ? c.pfx + t.toLowerCase() : t, cls: 'wpill ' + c.c }))));
    // repères d'orientation, jamais de diagnostic (seuils à faire valider par un professionnel)
    const wAlerts = (w) => {
      const r = [], inc = (k, v) => Array.isArray(w[k]) && w[k].indexOf(v) >= 0;
      if (inc('sante', 'Fièvre')) r.push({ who: 'b', t: 'Fièvre avant 3 mois : appelle ton médecin, ou le 15, sans attendre.' });
      if (inc('sante', 'Refuse de boire') || inc('dig', 'Vomit')) r.push({ who: 'b', t: 'S’il refuse de boire ou vomit de façon répétée, appelle ton médecin.' });
      if (inc('mmoral', 'Idées noires')) r.push({ who: 'm', t: 'Tu n’es pas seule. Appelle le 3114 (gratuit, 24 h/24) ou ton médecin, dès maintenant.' });
      else if (inc('mmoral', 'Triste, je pleure') || inc('mmoral', 'Dépassée')) r.push({ who: 'm', t: 'Si ça dure plus de deux semaines, parles-en à ta sage-femme ou ton médecin : c’est fréquent, et ça se soigne.' });
      if (inc('mall', 'Sein rouge et chaud') || inc('mcorps', 'Fièvre')) r.push({ who: 'm', t: 'Sein rouge et chaud ou fièvre : contacte ta sage-femme ou ton médecin.' });
      if (inc('mcorps', 'Saignements abondants')) r.push({ who: 'm', t: 'Saignements abondants : contacte ton médecin rapidement, ou le 15.' });
      return r;
    };
    const jview = s.jview || P.jview || 'jour';
    const calSel = s.calSel !== undefined ? s.calSel : 27;
    const babyName = (s.baby || 'Léo, 9 semaines').split(',')[0].trim();
    const WDS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const lead = (dt(1).getDay() + 6) % 7;
    const cal = { month: cap(MO[dt(1).getMonth()]) + ' ' + dt(1).getFullYear(), head: WDS.map((t) => ({ t })), cells: [] };
    for (let i = 0; i < lead; i++) cal.cells.push({ blank: true, day: false });
    for (let n = 1; n <= 31; n++) {
      const d = n, w = wOf(d), fut = d > 27;
      const dots = [['humeur', 'w-hum'], ['dig', 'w-dig'], ['sante', 'w-san']].filter((x) => wHas(w, x[0]) || (x[0] === 'dig' && wHas(w, 'selles'))).map((x) => ({ cls: 'wdot ' + x[1] }));
      if (BM.some((c) => wHas(w, c.k))) dots.push({ cls: 'wdot w-mam' });
      cal.cells.push({ blank: false, day: true, n, fut, on: d === calSel, dots, cls: 'cal-d' + (d === calSel ? ' sel' : '') + (d === 27 ? ' tod' : ''), pick: set({ calSel: d }), aria: dLong(d) + (w.humeur ? ', humeur : ' + w.humeur.toLowerCase() : '') + (dots.length ? '' : ', rien de noté') });
    }
    const wSel = wOf(calSel), wB = wList(wSel, BB), wM = wList(wSel, BM);
    const wday = { title: cap(dLong(calSel)), baby: babyName, b: wB, m: wM, hasB: wB.length > 0, noB: !wB.length, hasM: wM.length > 0, noM: !wM.length, alerts: wAlerts(wSel), bBtn: 'Pour ' + babyName };
    const jvOpts = [['jour', 'Jour'], ['cal', 'Calendrier']].map((o) => ({ t: o[1], on: jview === o[0], cls: jview === o[0] ? 'on' : '', pick: set({ jview: o[0] }) }));
    // ---------- JOURNAL ----------
    const jd = s.jd || 0;
    const JS = dStart(27 - jd), JE = dStart(28 - jd);
    const filt = s.filt || 'tout';
    const FL = { tout: 'Tout', repas: 'Repas', sommeil: 'Sommeil', chg: 'Changes' };
    const fOpts = Object.keys(FL).map((k) => ({ t: FL[k], on: k === filt, cls: 'chip' + (k === filt ? ' on' : ''), pick: set({ filt: k }) }));
    let jev = evs.filter((e) => e.a >= JS && e.a < JE);
    if (run !== null && run >= JS && run < JE) jev = jev.concat([{ id: 'run', k: 'sleep', a: run, b: NOW, run: true }]);
    jev.sort((x, y) => x.a - y.a);
    const okK = (e) => filt === 'tout' || (filt === 'repas' && (e.k === 'bib' || e.k === 'sein')) || (filt === 'sommeil' && e.k === 'sleep') || (filt === 'chg' && e.k === 'chg');
    const jl = [];
    let prevSleep = SL.filter((x) => x.b <= JS).pop() || null;
    jev.forEach((e, i) => {
      if (i && e.a - jev[i - 1].a > 300 && jev[i - 1].a % 1440 >= 360 && jev[i - 1].a % 1440 < 1260) jl.push({ isEv: false, isCalc: false, isGap: true, txt: 'Rien de noté entre ' + hm(jev[i - 1].a) + ' et ' + hm(e.a) + '. Ça ne veut pas dire qu’il ne s’est rien passé.' });
      if (e.k === 'sleep' && (filt === 'tout' || filt === 'sommeil') && prevSleep && e.a - prevSleep.b >= 20 && e.a - prevSleep.b < 300) jl.push({ isEv: false, isCalc: true, isGap: false, txt: 'éveillé ' + dur(e.a - prevSleep.b) });
      if (e.k === 'sleep') prevSleep = e;
      // durée ou quantité en pastille à côté du titre, une seule ligne courte dessous
      const pl = e.k === 'bib' ? e.ml + ' mL' : e.k === 'sein' ? (e.dur ? e.dur + ' min' : '') : e.k === 'sleep' ? dur((e.run ? NOW : e.b) - e.a) : '';
      const d = e.k === 'bib' ? (e.lait ? 'lait ' + e.lait : '') : e.k === 'sein' ? SIDE[e.side] || 'gauche' : e.k === 'chg' ? e.v : e.run ? 'en cours depuis ' + hm(e.a) : hm(e.a) + ' → ' + hm(e.b);
      if (okK(e)) jl.push(Object.assign({ isEv: true, isCalc: false, isGap: false, time: hm(e.a), pick: openEdit(e) }, evInfo(e), { hasPl: !!pl, pl, plCls: 'st-du' + (e.k === 'sleep' ? '' : ' fd'), d }));
    });
    jl.reverse();
    const jsd = dayStats(JS, JE, jd === 0 ? NOW : JE);
    const jSum = jev.length ? jsd.sleep + ' de sommeil noté · ' + (jsd.feeds === '—' ? 'aucun repas noté' : jsd.feeds + ' ' + jsd.feedsL) + ' · ' + (jsd.chg === '—' ? 'aucun change noté' : jsd.chg + ' ' + jsd.chgL) : 'Rien de noté ce jour-là';

    // ---------- feuilles : affichage ----------
    const SH = {
      bib: { title: 'Biberon', icon: '#i-milk', icCls: 'ic k-feed' },
      sein: { title: 'Tétée', icon: '#i-heart', icCls: 'ic k-feed' },
      chg: { title: 'Change', icon: '#i-diaper', icCls: 'ic k-chg' },
      dodo: { title: run !== null ? 'Réveil' : 'Dodo', icon: '#i-moon', icCls: 'ic k-sleep' },
      pump: { title: 'Tire-lait', icon: '#i-droplet', icCls: 'ic k-feed' },
      pjour: { title: 'Journal tire-lait', icon: '#i-droplet', icCls: 'ic k-feed' },
      profil: { title: 'Profil', icon: '#i-flower', icCls: 'ic k-main' },
      cvadd: { title: 'Ajouter une carte', icon: '#i-plus', icCls: 'ic k-main' },
      trk: { title: 'Créer mon suivi', icon: '#i-plus', icCls: 'ic k-main' },
      trkq: { title: 'Noter', icon: '#i-plus', icCls: 'ic k-main' },
      note: { title: 'Ma note', icon: '#i-bulb', icCls: 'ic k-calc' },
      add: { title: 'Ajouter un oubli', icon: '#i-plus', icCls: 'ic k-main' },
      detail: { title: 'Détail du dodo', icon: '#i-moon', icCls: 'ic k-sleep' },
      edit: { title: 'Modifier', icon: '#i-pencil', icCls: 'ic k-main' },
    };
    SH.wbb = { title: 'Comment va ' + babyName + ' ?', icon: '#i-heart', icCls: 'ic k-sleep' };
    SH.wbm = { title: 'Et toi, comment vas-tu ?', icon: '#i-flower', icCls: 'ic k-feed' };
    const sh0 = SH[sheet] || SH.bib;
    const isPastDay = f.day !== undefined && f.day !== T0;
    const sh = Object.assign({}, sh0, {
      hasSub: false, sub: '',
      when: ['bib', 'sein', 'chg'].indexOf(sheet) >= 0, whenChips: !isPastDay,
      isBib: sheet === 'bib', isSein: sheet === 'sein', isChg: sheet === 'chg', isPump: sheet === 'pump', isPJ: sheet === 'pjour', isProfil: sheet === 'profil', isCvAdd: sheet === 'cvadd', isTrk: sheet === 'trk', isTrkQ: sheet === 'trkq', isNote: sheet === 'note', isAdd: sheet === 'add',
      isDodoStart: sheet === 'dodo' && run === null, isDodoStop: sheet === 'dodo' && run !== null,
      isDetail: sheet === 'detail', isEdit: sheet === 'edit', isWell: sheet === 'wbb' || sheet === 'wbm',
      hasSave: ['bib', 'sein', 'dodo', 'pump', 'edit', 'trk', 'trkq', 'note', 'profil'].indexOf(sheet) >= 0,
    });
    // feuille bien-être : chaque pastille s'enregistre au toucher
    const wTog = (c, v) => () => {
      const all = Object.assign({}, this.st().well || {}), cur = Object.assign({}, wOf(calSel), all[calSel] || {});
      if (c.one) cur[c.k] = cur[c.k] === v ? '' : v;
      else { const a0 = Array.isArray(cur[c.k]) ? cur[c.k].slice() : []; const i0 = a0.indexOf(v); if (i0 >= 0) a0.splice(i0, 1); else a0.push(v); cur[c.k] = a0; }
      all[calSel] = cur; this.setState({ well: all });
    };
    const wl = { cats: [], alerts: [], priv: sheet === 'wbm' };
    if (sh.isWell) {
      sh.hasSub = true; sh.sub = 'Pour le ' + dLong(calSel);
      wl.cats = (sheet === 'wbb' ? BB : BM).map((c) => ({ l: c.l, dot: 'wd ' + c.c, opts: c.o.map((v) => { const on = c.one ? wSel[c.k] === v : Array.isArray(wSel[c.k]) && wSel[c.k].indexOf(v) >= 0; return { t: v, on, cls: 'wchip ' + c.c + (on ? ' on' : ''), pick: wTog(c, v) }; }) }));
      wl.alerts = wAlerts(wSel).filter((x) => x.who === (sheet === 'wbb' ? 'b' : 'm'));
    }
    if (isPastDay && sh.when) { sh.hasSub = true; sh.sub = 'Pour le ' + dLong(Math.floor(f.day / 1440)); }
    if (sheet === 'dodo' && run === null && f.day !== undefined) { sh.hasSub = true; sh.sub = 'Pour le ' + dLong(Math.floor(f.day / 1440)); sh.isDodoStart = true; }
    const whenAutre = isPastDay || f.when === 'autre';
    const whenOpts = [['now', 'Maintenant · ' + nowL], ['m15', 'Il y a 15 min'], ['autre', 'Autre heure']].map((w) => ({ t: w[1], on: f.when === w[0], cls: 'chip' + (f.when === w[0] ? ' on' : ''), pick: () => upF({ when: w[0], t: w[0] === 'autre' ? hhmm(NOW - 30) : f.t }) }));
    const mlOpts = [90, 120, 150, 180].map((v) => ({ t: v + ' mL', cls: 'chip' + (f.ml === v ? ' on' : ''), pick: () => upF({ ml: v }) }));
    const laitOpts = ['maternel', 'infantile'].map((v) => ({ t: 'Lait ' + v, cls: 'chip' + (f.lait === v ? ' on' : ''), pick: () => upF({ lait: f.lait === v ? '' : v }) }));
    const sideOpts = [['G', 'Gauche'], ['D', 'Droit'], ['2', 'Les deux']].map((o) => ({ t: o[1], on: f.side === o[0], cls: f.side === o[0] ? 'on' : '', pick: () => upF({ side: o[0] }) }));
    const durOpts = [[null, 'Pas noté'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [20, '20 min']].map((o) => ({ t: o[1], cls: 'chip' + (f.dur === o[0] ? ' on' : ''), pick: () => upF({ dur: o[0] }) }));
    const chgOpts = ['pipi', 'caca', 'les deux'].map((v) => ({ t: cap(v), cls: f.v === v ? 'on' : '', pick: () => upF({ v }) }));
    let saveLabel = 'Enregistrer';
    if (sheet === 'bib') saveLabel = 'Enregistrer ' + f.ml + ' mL';
    if (sheet === 'dodo') saveLabel = run !== null ? 'Enregistrer ce réveil' : f.t2 ? 'Enregistrer ces horaires' : 'Lancer le chrono depuis ' + f.t;
    if (sheet === 'pump') saveLabel = 'Enregistrer le tirage';
    if (sheet === 'trk') saveLabel = 'Créer ce suivi';
    if (sheet === 'trkq') saveLabel = 'Enregistrer';
    if (sheet === 'note') saveLabel = 'Ajouter cette note';
    if (sheet === 'edit') saveLabel = 'Enregistrer la modification';
    if (errMsg) saveLabel = 'Réessayer';
    if (saving) saveLabel = 'Enregistrement…';

    // détail d'un sommeil
    // détail d'un dodo : une seule réponse, « il a dormi combien, et c'est habituel pour lui ? »
    let det = { dur: '', range: '', lab: '', date: '', hasCmp: false, cmp: null, learn: false, rows: [], hasRows: false, edit: null, editL: 'Modifier ce sommeil', nap: false };
    const selE = sheet === 'detail' ? (findEv(s.selId) || dayOf(27).naps.slice(-1)[0] || SL[SL.length - 1]) : null;
    if (selE) {
      const m = selE.a % 1440, isNap = m >= 420 && m < 1170, d0 = Math.floor(selE.a / 1440);
      // écart à l’habitude : pastille avec flèche + valeur habituelle ; « comme d’habitude » sans chiffre
      const cmpD = (v, u0, unit, eq) => {
        const u = r5(u0), df = v - u;
        if (Math.abs(df) < eq) return { w: 'comme d’habitude', cls: 'dl-same', hasI: false, wi: '', hasH: false, h: '' };
        const up = df > 0;
        return { w: dur(r5(Math.abs(df))) + (unit === 't' ? (up ? ' plus tard' : ' plus tôt') : (up ? ' de plus' : ' de moins')), cls: 'dx', hasI: true, wi: up ? '#i-up' : '#i-down', hasH: true, h: unit === 't' ? hm(u) : dur(u) };
      };
      let lab = '', cmp = null, rows = [];
      if (isNap) {
        const dn = dayOf(d0).naps, k = dn.findIndex((z) => z.id === selE.id), tz = typ.ok ? typ.naps.find((z) => z.k === k) : null;
        lab = k >= 0 ? ORD[k] + ' sieste' : 'Sieste';
        if (tz) {
          cmp = cmpD(selE.b - selE.a, tz.du, 'd', 15);
          if (m > tz.hi + 10 || m < tz.lo - 10) rows.push(Object.assign({ l: 'Endormi à', a: hm(selE.a) }, { w: m > tz.hi ? 'plus tard' : 'plus tôt', cls: 'dx', hasI: true, wi: m > tz.hi ? '#i-up' : '#i-down', hasH: true, h: hm(r5(tz.lo)) + ' – ' + hm(r5(tz.hi)) }));
          const w0 = k > 0 ? dn[k - 1].b : dayOf(d0).wake;
          if (w0 !== null && w0 !== undefined && tz.aw) rows.push(Object.assign({ l: 'Éveil avant la sieste', a: dur(selE.a - w0) }, cmpD(selE.a - w0, tz.aw, 'd', 15)));
        }
      } else {
        const nd = m >= 1170 ? d0 + 1 : d0, N1 = nightOf(nd), U1 = usual(nd);
        const i = N1.sl ? N1.sl.findIndex((z) => z.id === selE.id) : -1;
        const isLong = i >= 0 && N1.bl[i] === N1.longest;
        lab = isLong ? 'Son plus long sommeil de la nuit' : i >= 0 ? (i === 0 ? '1er' : ORD[i]) + ' sommeil de la nuit' : 'Sommeil de nuit';
        if (U1.ok && i >= 0) {
          if (isLong) cmp = cmpD(selE.b - selE.a, U1.longest, 'd', 15);
          else if (U1.blocks[i]) cmp = cmpD(selE.b - selE.a, U1.blocks[i][1] - U1.blocks[i][0], 'd', 15);
        }
      }
      if (cmp && cmp.hasH) cmp = Object.assign(cmp, { h: 'd’habitude ' + cmp.h });
      det = { dur: dur(selE.b - selE.a), range: hm(selE.a) + ' → ' + hm(selE.b), lab, date: dShort(d0), hasCmp: !!cmp, cmp, learn: !cmp && !rows.length, rows, hasRows: rows.length > 0, edit: openEdit(selE), editL: isNap ? 'Modifier cette sieste' : 'Modifier ce sommeil', nap: isNap };
    }
    const edE = sheet === 'edit' ? findEv(f.id) : null;
    const ed = { l1: edE && edE.k === 'sleep' ? 'Début' : 'Heure', isSleep: !!edE && edE.k === 'sleep', isBib: !!edE && edE.k === 'bib', isSein: !!edE && edE.k === 'sein', isChg: !!edE && edE.k === 'chg', who: edE ? evInfo(edE).title + ' du ' + dLong(Math.floor(edE.a / 1440)) + ' · noté depuis ce téléphone' : '', canAskDel: !f.conf };
    if (sheet === 'cvadd' && f.rep !== undefined) sh.title = 'Remplacer cette carte';
    if (sheet === 'edit') { sh.title = edE ? 'Modifier · ' + evInfo(edE).title : 'Modifier'; sh.icon = edE ? evInfo(edE).icon : sh.icon; sh.icCls = edE ? 'ic ' + evInfo(edE).icCls.split(' ')[1] : sh.icCls; }

    // ---------- barre et onglets ----------
    const dodo = run !== null ? { cls: 'qa run', l1: 'Arrêter', l2: dur(NOW - run), run: true, aria: 'Dodo en cours depuis ' + hm(run) + ', ' + dur(NOW - run) + '. Arrêter le chrono' } : { cls: 'qa', l1: 'Dodo', l2: '', run: false, aria: 'Dodo : lancer le chrono' };
    // ---------- personnalisation de l’accueil, suivis perso, conseils ----------
    const trks = s.trk || [], trls = s.trl || [], notesL = s.notes || [], tipsX = s.tipsX || [];
    const trkToday = (tr) => trls.filter((x) => x.tid === tr.id && x.a >= T0);
    const trkPick = (tr) => () => {
      if (tr.kind === 'qte') { open('trkq', { tid: tr.id, q: '' })(); return; }
      const tod = trkToday(tr);
      if (tr.kind === 'fait' && tod.length) { this.setState({ trl: trls.filter((x) => !(x.tid === tr.id && x.a >= T0)) }); this.toast(tr.name + ' : retiré pour aujourd’hui'); return; }
      this.setState({ trl: trls.concat([{ id: uid(), tid: tr.id, a: NOW, v: 1 }]) });
      this.toast(tr.name + ' noté à ' + hm(NOW));
    };
    const cvEdit = !!s.cvEdit;
    const TILES = { sleep: { l: 'Sommeil', cls: 'bt k-sleep', v: td.sleep, s: td.sleepL, pick: set({ tab: 'pilotage', pday: 0, pview: 'jour', csel: '' }) },
      feeds: { l: 'Repas', cls: 'bt k-feed', v: td.feeds, s: td.feedsL, pick: set({ tab: 'pilotage', pday: 0, pview: 'jour', csel: '' }) },
      chg: { l: 'Changes', cls: 'bt k-chg', v: td.chg, s: td.chgL, pick: set({ tab: 'journal', jd: 0 }) },
      pump: { l: 'Tire-lait', cls: 'bt k-pump', v: pumps.length ? pumpTotal + '\u00a0mL' : '—', s: pumps.length ? pumps.length + (pumps.length > 1 ? ' tirages' : ' tirage') : 'pas encore noté', pick: open('pjour') } };
    trks.forEach((tr) => {
      const tod = trkToday(tr), n = tod.length, sum = tod.reduce((q, x) => q + x.v, 0);
      TILES['t:' + tr.id] = { l: tr.name, cls: 'bt k-trk', pick: trkPick(tr),
        v: tr.kind === 'fait' ? (n ? 'Fait' : 'Pas encore') : tr.kind === 'compteur' ? String(n) : (n ? Math.round(sum * 10) / 10 + (tr.unit ? '\u00a0' + tr.unit : '') : '—'),
        s: tr.kind === 'fait' ? (n ? 'à ' + hm(tod[0].a) + ' · touche pour retirer' : 'touche pour noter') : tr.kind === 'compteur' ? (n ? 'aujourd’hui · touche pour +1' : 'touche pour noter') : (n ? n + (n > 1 ? ' notes' : ' note') + ' · touche pour ajouter' : 'touche pour noter') };
    });
    const KINDL = { fait: 'Fait ou pas fait', compteur: 'Compteur', qte: 'Quantité' };
    const kindNow = f.kind || 'fait';
    const trkKinds = [['fait', 'Fait ou pas fait'], ['compteur', 'Compteur'], ['qte', 'Quantité']].map((o) => ({ t: o[1], on: kindNow === o[0], cls: 'chip' + (kindNow === o[0] ? ' on' : ''), pick: () => upF({ kind: o[0] }) }));
    const trkHint = kindNow === 'fait' ? 'Un toucher par jour, par exemple la vitamine D.' : kindNow === 'compteur' ? 'Un toucher à chaque fois, par exemple les selles.' : 'Tu notes un nombre, par exemple des mL ou des minutes.';
    const trkIcons = [['#i-heart', 'Cœur'], ['#i-droplet', 'Goutte'], ['#i-bulb', 'Idée'], ['#i-clock', 'Horloge'], ['#i-check', 'Coche'], ['#i-diaper', 'Change']].map((o) => ({ icon: o[0], aria: o[1], on: (f.icon || '#i-heart') === o[0], cls: 'chip' + ((f.icon || '#i-heart') === o[0] ? ' on' : ''), pick: () => upF({ icon: o[0] }) }));
    const trkQ = trks.find((x) => x.id === f.tid), trkQL = trkQ ? trkQ.name + (trkQ.unit ? ' (' + trkQ.unit + ')' : '') : 'Valeur';
    // À retenir : ses données (calculé), un repère d’âge, ses propres notes ; chaque ligne dit d’où elle vient
    const AGEW = xAgeW;
    const awN = typ.ok && typ.naps && typ.naps.length ? typ.naps.map((z) => z.aw).filter((x) => x) : [];
    const tipsAll = [];
    if (AGE_REFS && awN.length) tipsAll.push({ id: 'aw', o: 'Calculé · repère d’âge', cls: 'tp-o c', t: 'Éveil avant une sieste : ' + babyName + ' tient en général ' + dur(r5(med(awN))) + '. À ' + AGEW + ' semaines, 1 h à 1 h 30 est courant : un repère, pas une règle.' });
    if (AGE_REFS) tipsAll.push({ id: 'sl', o: 'Repère d’âge', cls: 'tp-o a', t: 'À ' + AGEW + ' semaines, 14 à 17 h de sommeil par 24 h, en plusieurs siestes, est courant.' });
    if (AGE_REFS) tipsAll.push({ id: 'fd', o: 'Repère d’âge', cls: 'tp-o a', t: 'À cet âge, un bébé mange souvent toutes les 2 à 3 h. Sa faim passe avant l’horaire.' });
    notesL.forEach((n) => tipsAll.push({ id: 'n' + n.id, o: 'Ma note', cls: 'tp-o n', t: n.text, mine: n.id }));
    const tipsL = tipsAll.filter((x) => tipsX.indexOf(x.id) < 0).slice(0, 4).map((x) => Object.assign(x, { drop: () => (x.mine ? this.setState({ notes: notesL.filter((n) => n.id !== x.mine) }) : this.setState({ tipsX: tipsX.concat([x.id]) })) }));

    // ---------- canevas de l’accueil : une liste de cartes que le parent compose avec le crayon ----------
    const CV0 = [{ id: 'now', t: 'now' }, { id: 'last', t: 'last' }, { id: 'frise', t: 'frise' }, { id: 'recent', t: 'recent' }, { id: 'pump', t: 'pump' }];
    const cv = s.cv || CV0, setCv = (a) => this.setState({ cv: a });
    const FIXED = ['now', 'last', 'frise', 'tips', 'recent', 'pump'], isTile = (b) => !!b && b.t === 'tile';
    const cvMove = (i, d) => () => { const j = i + d; if (j < 0 || j >= cv.length) return; const a = cv.slice(); const x = a[i]; a[i] = a[j]; a[j] = x; setCv(a); };
    const cvDrop = (i) => () => setCv(cv.filter((_, n) => n !== i));
    // style de chaque carte : place dans la liste, largeur (une tuile = demi-largeur) et espace dessous
    const cvSt = (i) => {
      const b = cv[i];
      if (!isTile(b)) return 'order: ' + i + '; grid-column: span 2; margin-bottom: ' + (i === cv.length - 1 ? 0 : 36) + 'px';
      let pos = 0; for (let n = i - 1; n >= 0 && isTile(cv[n]); n--) pos++;
      const nextTile = isTile(cv[i + 1]), alone = pos % 2 === 0 && !nextTile, endsRow = pos % 2 === 1 || !nextTile;
      return 'order: ' + i + '; grid-column: span ' + (alone ? 2 : 1) + '; margin-bottom: ' + (endsRow && i < cv.length - 1 ? 24 : 0) + 'px';
    };
    const cvCtl = (i) => ({ ed: cvEdit, st: cvSt(i), up: cvMove(i, -1), down: cvMove(i, 1), rm: cvDrop(i), swap: open('cvadd', { rep: i }) });
    const B = {};
    FIXED.forEach((x) => { const i = cv.findIndex((b) => b.t === x); B[x] = Object.assign({ on: i >= 0 && (x !== 'last' || evs.length > 0 || run !== null) }, i >= 0 ? cvCtl(i) : { ed: false, st: '', up: null, down: null, rm: null, swap: null }); });
    // graphes sur 7 jours : un chiffre par jour, aujourd’hui (pas fini) hors moyenne
    const dayNums = (k) => {
      const a0 = dStart(27 - k), a1 = dStart(28 - k), sg = allSegsAbs.filter((x) => x.b > a0 && x.a < a1), mk = FD.filter((x) => x.a >= a0 && x.a < a1);
      return { sleep: r5(sg.reduce((n, x) => n + Math.min(x.b, a1) - Math.max(x.a, a0), 0)), feeds: mk.length, ml: mk.reduce((n, x) => n + (x.ml || 0), 0), pump: pjDay(k).tot };
    };
    const GR = { sleep: { title: 'Sommeil', key: 'sleep', fmt: (v) => dur(v), short: (v) => (v ? Math.round(v / 60) + ' h' : ''), cls: 'sl' },
      feeds: { title: 'Repas', key: 'feeds', fmt: (v) => fr1(v) + ' repas', short: (v) => (v ? String(v) : ''), cls: 'fd' },
      ml: { title: 'Lait au biberon', key: 'ml', fmt: (v) => Math.round(v / 10) * 10 + '\u00a0mL', short: (v) => (v ? String(Math.round(v / 10) * 10) : ''), cls: 'fd' },
      pump: { title: 'Tire-lait', key: 'pump', fmt: (v) => Math.round(v / 10) * 10 + '\u00a0mL', short: (v) => (v ? String(Math.round(v / 10) * 10) : ''), cls: 'pm' } };
    const grOf = (key) => {
      const g = GR[key], ds = [6, 5, 4, 3, 2, 1, 0].map((k) => ({ k, v: dayNums(k)[g.key] })), mx = Math.max.apply(null, ds.map((x) => x.v).concat([1]));
      const past = ds.filter((x) => x.k > 0 && x.v > 0), avg = past.length ? past.reduce((n, x) => n + x.v, 0) / past.length : 0;
      return { title: g.title + ' · 7 jours', sub: avg ? g.fmt(avg) + ' en moyenne' : 'pas encore de moyenne', bars: ds.map((x) => ({ cls: 'gr-c ' + g.cls + (x.k === 0 ? ' now' : ''), h: Math.max(x.v ? 6 : 0, Math.round((x.v / mx) * 100)), v: g.short(x.v), l: WD[dt(27 - x.k).getDay()].slice(0, 1).toUpperCase() })) };
    };
    const tyOf = (night) => { const T = night ? nty : typ; return { title: night ? 'Sa nuit type' : 'Sa journée type', sub: T.ok ? (night ? 'ses nuits habituelles' : 'ses journées habituelles') : '', ok: !!T.ok && T.sumL && T.sumL.length > 0, no: !(T.ok && T.sumL && T.sumL.length > 0), msg: T.msg || 'Elle se dessine à partir de quelques journées notées en entier.', items: T.sumL || [] }; };
    const cvDyn = [];
    cv.forEach((b, i) => {
      if (FIXED.indexOf(b.t) >= 0) return;
      const d = Object.assign({ id: b.id, isTile: false, isTileTrk: false, isGraph: false, isTyp: false, isNote: false }, cvCtl(i));
      if (b.t === 'tile' && TILES[b.k]) { const tl = TILES[b.k]; d.isTile = true; d.tile = Object.assign({}, tl, { pick: cvEdit ? () => {} : tl.pick }); if (b.k.indexOf('t:') === 0) { const tid = b.k.slice(2); d.isTileTrk = cvEdit; d.dropTrk = () => this.setState({ trk: trks.filter((x) => x.id !== tid), trl: trls.filter((x) => x.tid !== tid), cv: cv.filter((x) => x.k !== b.k) }); } }
      else if (b.t === 'graph' && GR[b.k]) { d.isGraph = true; d.g = grOf(b.k); }
      else if (b.t === 'typ' || b.t === 'night') { d.isTyp = true; d.ty = tyOf(b.t === 'night'); }
      else if (b.t === 'note') { d.isNote = true; d.text = b.text; }
      else return;
      cvDyn.push(d);
    });
    const putB = (blk) => { const nb = Object.assign({ id: uid() }, blk); return f.rep !== undefined && cv[f.rep] ? cv.map((b, n) => (n === f.rep ? nb : b)) : cv.concat([nb]); };
    const cvAddB = (blk, msg) => () => { this.setState({ cv: putB(blk), sheet: null, f: null }); this.toast(msg || (f.rep !== undefined ? 'Carte remplacée' : 'Carte ajoutée à la fin de ton accueil')); };
    const has = (t2, k2) => cv.some((b) => b.t === t2 && (k2 === undefined || b.k === k2));
    const libItem = (ic, icon, t2, d2, pick) => ({ ic, icon, t: t2, d: d2, pick });
    const cvLib = [
      { title: 'Cartes', items: [
        !has('now') && libItem('ic k-sleep', '#i-sun', 'Maintenant', 'Éveillé ou endormi depuis combien de temps, et la suite probable', cvAddB({ t: 'now' })),
        !has('last') && libItem('ic k-feed', '#i-milk', 'Dernière sieste et dernier repas', 'Les deux derniers moments, en un coup d’œil', cvAddB({ t: 'last' })),
        !has('frise') && libItem('ic k-sleep', '#i-clock', 'Frise de la journée', 'Ses dodos et repas sur 24 h', cvAddB({ t: 'frise' })),
        !has('tips') && libItem('ic k-calc', '#i-bulb', 'À retenir', 'Ses données, des repères d’âge et tes notes', cvAddB({ t: 'tips' })),
        !has('recent') && libItem('ic k-main', '#i-list', 'Derniers enregistrements', 'Les 4 derniers gestes notés', cvAddB({ t: 'recent' })),
        !has('pump') && libItem('ic k-feed', '#i-droplet', 'Journal tire-lait', 'Les tirages jour par jour et la moyenne', cvAddB({ t: 'pump' })),
        libItem('ic k-sleep', '#i-sun', 'Sa journée type', 'Réveil, siestes, repas et coucher habituels', cvAddB({ t: 'typ' })),
        libItem('ic k-sleep', '#i-moon', 'Sa nuit type', 'Coucher, réveils et repas de nuit habituels', cvAddB({ t: 'night' })),
        libItem('ic k-calc', '#i-pencil', 'Une note à moi', 'Un texte libre, rien que pour toi', open('note', { text: '', asCard: true, rep: f.rep })),
      ].filter(Boolean) },
      { title: 'Graphes sur 7 jours', items: [['sleep', 'Sommeil par jour', '#i-moon', 'ic k-sleep'], ['feeds', 'Nombre de repas par jour', '#i-milk', 'ic k-feed'], ['ml', 'Lait au biberon par jour', '#i-milk', 'ic k-feed'], ['pump', 'Tire-lait par jour', '#i-droplet', 'ic k-feed']].map((g) => libItem(g[3], g[2], g[1], 'Une barre par jour, la moyenne en titre', cvAddB({ t: 'graph', k: g[0] }))) },
      { title: 'Tuiles', items: [['sleep', 'Sommeil', '#i-moon', 'ic k-sleep'], ['feeds', 'Repas', '#i-milk', 'ic k-feed'], ['chg', 'Changes', '#i-diaper', 'ic k-chg'], ['pump', 'Tire-lait', '#i-droplet', 'ic k-feed']].concat(trks.map((tr) => ['t:' + tr.id, tr.name, tr.icon, 'ic k-calc'])).filter((g) => !has('tile', g[0])).map((g) => libItem(g[3], g[2], g[1], 'Le chiffre du jour', cvAddB({ t: 'tile', k: g[0] }))).concat([libItem('ic k-main', '#i-plus', 'Créer mon suivi', 'Vitamine D, bain, temps sur le ventre, médicament…', open('trk', { name: '', kind: 'fait', unit: '', icon: '#i-heart', rep: f.rep }))]) },
    ];
    const cvAccCls = 'acc' + (cvEdit ? ' edit' : '');
    // « + » flottant : cinq gestes en colonne, le plus fréquent (biberon) au plus près du pouce
    const fabOn = !!s.fab, fabClose = () => this.setState({ fab: false });
    const fabGo = (h) => () => { fabClose(); h(); };
    const fabItems = [
      ...trks.map((tr) => ({ cls: 'fab-i', ic: 'fab-ic k-trk', icon: tr.icon, l: tr.name, aria: 'Noter : ' + tr.name, pick: fabGo(trkPick(tr)) })),
      { cls: 'fab-i', ic: 'fab-ic k-pump', icon: '#i-droplet', l: 'Tire-lait', aria: 'Noter un tirage', pick: fabGo(open('pump')) },
      { cls: 'fab-i', ic: 'fab-ic k-chg', icon: '#i-diaper', l: 'Change', aria: 'Noter un change', pick: fabGo(open('chg')) },
      { cls: 'fab-i', ic: 'fab-ic k-feed', icon: '#i-heart', l: 'Tétée', aria: 'Noter une tétée', pick: fabGo(open('sein')) },
      { cls: 'fab-i' + (dodo.run ? ' run' : ''), ic: 'fab-ic k-sleep', icon: '#i-moon', l: dodo.run ? 'Arrêter · ' + dodo.l2 : 'Dodo', aria: dodo.run ? dodo.aria : 'Dodo : maintenant ou à une heure choisie', pick: fabGo(open('dodo')) },
      { cls: 'fab-i', ic: 'fab-ic k-feed', icon: '#i-milk', l: 'Biberon', aria: 'Noter un biberon', pick: fabGo(open('bib')) },
    ];
    const TB = [['accueil', 'Accueil', '#i-house'], ['pilotage', 'Rythme', '#i-clock'], ['comprendre', 'Comprendre', '#i-bulb'], ['journal', 'Journal', '#i-list']];
    const tabsL = TB.map((t) => ({ t: t[1], icon: t[2], cls: 'tab' + (tab === t[0] ? ' on' : ''), cur: tab === t[0] ? 'page' : 'false', pick: () => this.setState({ tab: t[0], sub: t[0] === 'comprendre' ? 'home' : this.st().sub }) }));

    const toastSt = s.toast !== undefined ? s.toast : (P.toast ? { msg: P.toast, undo: () => this.setState({ toast: null }) } : null);
    const wName = s.wName !== undefined ? s.wName : '';
    const babyTitle = s.baby || 'Léo, 9 semaines';
    // carte de présentation : prénom, âge et naissance (dans l'app réelle : le profil saisi au premier lancement)
    const bc = P.store.bc;

    return {
      appCls: 'app' + (dark ? ' dark' : '') + ((P.look || 'jardin') !== 'v4' ? ' look-' + (P.look || 'jardin') : ''),
      mainRef: (el) => { this._main = el; },
      isGate: !!P.store.gate, isPremier: !P.store.gate && !P.store.hasBaby, notPremier: !P.store.gate && P.store.hasBaby,
      wName, wBirth: s.wBirth || '', wTime: s.wTime || '', setWTime: (e) => this.setState({ wTime: e.target.value }), wErr: s.wErr || '', hasWErr: !!s.wErr,
      gcode: s.gcode || '', setGCode: (e) => this.setState({ gcode: e.target.value }), gErr: s.gErr || '', hasGErr: !!s.gErr, gBusy: !!s.gBusy,
      submitGate: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (this.st().gBusy) return;
        this.setState({ gBusy: true, gErr: '' });
        P.store.gate.submit(this.st().gcode || '').then((msg) => this.setState({ gBusy: false, gErr: msg || '' }), () => this.setState({ gBusy: false, gErr: 'Connexion impossible pour le moment.' }));
      },
      setWName: (e) => this.setState({ wName: e.target.value }),
      setWBirth: (e) => this.setState({ wBirth: e.target.value }),
      startApp: () => { const r = P.store.saveBaby(this.st().wName, this.st().wBirth, this.st().wTime); if (r.error) { this.setState({ wErr: r.error }); return; } this.setState({ wErr: '' }); r.done.catch(() => this.setState({ wErr: ERR })); },
      tabA: tab === 'accueil', tabP: tab === 'pilotage', tabJ: tab === 'journal',
      tabC: tab === 'comprendre',
      todayLong: cap(dLong(27)), nowL, babyTitle, bc,
      pv, sit, td, miniSegs, miniMarks, miniNow, miniHasNow: true, hsel, lf, ls, nx, hasCards: evs.length > 0 || run !== null,
      recent, hasRecent: recent.length > 0, noRecent: recent.length === 0, goJournal: set({ tab: 'journal', jd: 0 }), openAddHome: () => this.setState({ sheet: 'add', f: defF('add', { day: T0 }), err: null }),
      miniNb, axL5, axL4,
      dsR: { cls: 'chip' + (dmode === 'reveil' ? ' on' : ''), on: dmode === 'reveil', pick: set({ dstart: 'reveil', csel: '' }) },
      dsM: { cls: 'chip' + (dmode !== 'reveil' ? ' on' : ''), on: dmode !== 'reveil', pick: set({ dstart: 'minuit', csel: '' }) },
      pumpLine,
      goPilot: set({ tab: 'pilotage', pday: 0, pview: 'jour', csel: '' }),
      openPump: open('pump'),
      // pilotage
      pStepL: pview === 'semaine' ? 'Du ' + dShort(wEnd - 6) + ' au ' + dShort(wEnd) : (pDay === 0 ? 'Aujourd’hui, ' + dLong(27 - pDay) : cap(dLong(27 - pDay))),
      pPrevL: pview === 'semaine' ? 'Semaine précédente' : 'Jour précédent', pNextL: pview === 'semaine' ? 'Semaine suivante' : 'Jour suivant',
      pPrev: pview === 'semaine' ? set({ pweek: pw + 1 }) : set({ pday: pDay + 1, csel: '' }),
      pNext: pview === 'semaine' ? set({ pweek: Math.max(0, pw - 1) }) : set({ pday: Math.max(0, pDay - 1), csel: '' }),
      pPrevDis: pview === 'semaine' ? pw >= 3 : pDay >= 6, pNextDis: pview === 'semaine' ? pw === 0 : pDay === 0,
      pvJ: { cls: pview === 'jour' ? 'on' : '', on: pview === 'jour', pick: set({ pview: 'jour' }) },
      pvS: { cls: pview === 'semaine' ? 'on' : '', on: pview === 'semaine', pick: set({ pview: 'semaine', csel: '' }) },
      isJour: pview === 'jour', isSem: pview === 'semaine', isBars: wstyle === 'barres', isCal: wstyle !== 'barres',
      wkAvg: Object.assign({ hasV2: false, v2: '', t2: '' }, wkAvg), wBars, wAvg, wCal, wDet, wLab, wGrid, wHlines, cmpW, wHab, legCur: legSlides[6 - pDay], legDots, cwDots, cwRef: (el) => { this.cwBind(el); }, clkRef: (el) => { this.clkBind(el); },
      wsD: { cls: wMeal ? '' : 'on', on: !wMeal, pick: set({ wsel: 'dodo' }) }, wsR: { cls: wMeal ? 'on' : '', on: wMeal, pick: set({ wsel: 'repas' }) },
      wcCls: wMeal ? 'wc meal' : 'wc', wxCal: wMeal ? 'wx cal meal' : 'wx cal',
      wkQ: wstyle === 'barres' ? 'Combien a-t-il dormi sur 24 h ?' : wMeal ? 'À quelles heures a-t-il mangé ?' : 'À quelles heures a-t-il dormi ?',
      wkSub: wstyle === 'barres' ? 'Foncé : la nuit · clair : les siestes' : '', hasWkSub: wstyle === 'barres',
      wkHint: wEmpty ? 'Rien de noté cette semaine. Les jours se remplissent à chaque saisie.' : '',
      clk, suite, hasSuite: pview === 'jour' && suite.length > 0, pEmpty: pview === 'jour' && !pHas,
      // comprendre
      ret, dataNote,
      cEyebrow: 'Pour mieux connaître ' + (babyTitle.split(',')[0].trim() === 'Ton bébé' ? 'ton bébé' : babyTitle.split(',')[0].trim()),
      cvR: { cls: cview === 'ret' ? 'on' : '', on: cview === 'ret', pick: set({ cview: 'ret' }) },
      cvH: { cls: cview === 'hc' ? 'on' : '', on: cview === 'hc', pick: set({ cview: 'hc' }) },
      openDay: set({ xo: 'day' }), openNight: set({ xo: 'night' }),
      typ: Object.assign({}, typ, {
        row: typ.ok ? jtRow : { nb: [], segs: [], marks: [], ax: [] },
        lines: !typ.ok ? [] : [{ t: typ.daySleep.replace('≈ ', '') + ' de siestes par jour' }].concat(typ.gapV !== 'pas encore' ? [{ t: 'Un repas toutes les ' + typ.gapV }] : []),
      }),
      nty,
      nv,
      stepsOpen: !!s.stepsOpen, toggleSteps: set({ stepsOpen: !s.stepsOpen }),
      xB, xm,
      // journal
      jvOpts, jvList: jview !== 'cal', jvCal: jview === 'cal', cal, wday, wl,
      openWbb: () => this.setState({ sheet: 'wbb' }), openWbm: () => this.setState({ sheet: 'wbm' }),
      jDayLabel: jd === 0 ? 'Aujourd’hui, ' + dLong(27) : cap(dLong(27 - jd)),
      jPrev: set({ jd: jd + 1 }), jNext: set({ jd: Math.max(0, jd - 1) }), jPrevDis: jd >= 27, jNextDis: jd === 0,
      fOpts, jSum, jList: jl, jHas: jl.length > 0, jEmpty: jl.length === 0,
      openAdd: () => this.setState({ sheet: 'add', f: defF('add', { day: (27 - jd) * 1440 }), err: null }),
      // barre
      B, cvDyn, cvEdit, cvLib, accCls: cvAccCls, cvAria: cvEdit ? 'Terminer la modification de l’accueil' : 'Modifier l’accueil', cvIcon: cvEdit ? '#i-check' : '#i-pencil', cvToggle: set({ cvEdit: !cvEdit }), cvAdd: open('cvadd'), cvReset: () => this.setState({ cv: CV0 }), tipsL, noTips: tipsL.length === 0, trkKinds, trkHint, trkQte: kindNow === 'qte', trkIcons, trkQL, openNote: open('note', { text: '' }), setName: (e) => upF({ name: e.target.value }), setUnit: (e) => upF({ unit: e.target.value }), setQ: (e) => upF({ q: e.target.value }), setTxt: (e) => upF({ text: e.target.value }), pjWeeks, openPJ: open('pjour'), fabOn, fabItems, fabToggle: set({ fab: !s.fab }), fabIcon: fabOn ? '#i-x' : '#i-plus', fabAria: fabOn ? 'Fermer' : 'Noter', tabsL,
      // toast
      toastOn: !!toastSt, toastMsg: toastSt ? toastSt.msg : '', toastUndo: !!(toastSt && toastSt.undo), undo: () => { if (toastSt && toastSt.undo) toastSt.undo(); this.setState({ toast: null }); },
      // feuilles
      sheetOn: !!sheet, sh, f, whenOpts, whenAutre, mlOpts, laitOpts, sideOpts, durOpts, chgOpts, saveLabel, saving, det, ed,
      moreLabel: f.more ? 'Masquer les détails' : 'Ajouter un détail (facultatif)',
      hasErr: !!errMsg, errMsg: errMsg || '',
      close: () => this.setState({ sheet: null, f: null, err: null, saving: false }),
      setT: (e) => upF({ t: e.target.value }), setT2: (e) => upF({ t2: e.target.value }),
      setG: (e) => upF({ g: e.target.value }), setD: (e) => upF({ dd: e.target.value }),
      pumpTot: (Number(f.g) || 0) + (Number(f.dd) || 0),
      mlDown: () => upF({ ml: Math.max(10, f.ml - 10) }), mlUp: () => upF({ ml: Math.min(400, f.ml + 10) }),
      toggleMore: () => upF({ more: !f.more }),
      save, sleepNow, wakeNow: () => endRun(NOW),
      cancelRun: () => { const a = run; P.store.cancelRun().done.catch(fail); this.setState({ sheet: null }); this.toast('Dodo annulé', () => { P.store.startRun(a).done.catch(fail); this.setState({ toast: null }); }); },
      runStart: run !== null ? hm(run) : '', runDur: run !== null ? dur(NOW - run) : '',
      chgPipi: chgSave('pipi'), chgCaca: chgSave('caca'), chgDeux: chgSave('les deux'),
      addSein: () => this.setState({ sheet: 'sein', f: defF('sein', { day: f.day, when: 'autre', t: hhmm(NOW - 30) }) }),
      addBib: () => this.setState({ sheet: 'bib', f: defF('bib', { day: f.day, when: 'autre', t: hhmm(NOW - 30) }) }),
      addDodo: () => this.setState({ sheet: 'dodo', f: defF('dodo', { day: f.day, t: hhmm(NOW - 90), t2: hhmm(NOW - 45) }) }),
      addChg: () => this.setState({ sheet: 'chg', f: defF('chg', { day: f.day, when: 'autre', t: hhmm(NOW - 30) }) }),
      askDel: () => upF({ conf: true }), noDel: () => upF({ conf: false }), doDel,
      openProfile: () => {
        const b = P.store.birthAt, p = (n) => String(n).padStart(2, '0');
        this.setState({ sheet: 'profil', f: defF('profil', { name: P.store.babyName, bdate: b.getFullYear() + '-' + p(b.getMonth() + 1) + '-' + p(b.getDate()), btime: p(b.getHours()) + ':' + p(b.getMinutes()) }), err: null, saving: false });
      },
      setBDate: (e) => upF({ bdate: e.target.value }), setBTime: (e) => upF({ btime: e.target.value }),
      exportData: () => { P.store.exportData().then(() => this.toast('Sauvegarde prête'), () => this.toast('La sauvegarde a échoué : réessaie.')); },
      logout: () => P.store.logout(),
      photoLabel: P.store.bc.hasPhoto ? 'Changer la photo' : 'Ajouter une photo',
      pickPhoto: () => {
        const i = document.createElement('input');
        i.type = 'file'; i.accept = 'image/*';
        i.onchange = () => { const fl = i.files && i.files[0]; if (fl) P.store.setPhoto(fl).done.then(() => this.toast('Photo enregistrée'), () => this.toast('La photo n’a pas pu être enregistrée : réessaie.')); };
        i.click();
      },
      removePhoto: () => { P.store.setPhoto(null).done.then(() => this.toast('Photo retirée'), () => this.toast('Ce n’est pas enregistré : réessaie.')); },
      pjImport: () => {
        const i = document.createElement('input');
        i.type = 'file'; i.accept = '.json,.csv,application/json,text/csv';
        i.onchange = () => { const fl = i.files && i.files[0]; if (fl) P.store.importPumpsFile(fl).then((m) => this.toast(m), () => this.toast('L’import a échoué : réessaie.')); };
        i.click();
      },
    };
  }
}
return Component;
}
