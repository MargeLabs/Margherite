/* Filou sur l'Accueil : le décor reste en place, chaque pose est une couche qui fond dans la suivante. */
(() => {
  const SCENE = window.__SCENE;
  // Éveillé : une seule animation par ouverture de l'app, puis il reste assis.
  // walk = balade vers les marguerites, bfly = il suit le papillon, play = la pelote (coupée avant la fin)
  // L'ouverture suivante prend la suivante de la liste (compteur gardé sur l'appareil).
  const ORDER = [['walk', 8200], ['bfly', 6800], ['play', 3300]];
  const KEY = 'filou.opens';
  let mem = Math.floor(Math.random() * ORDER.length); // si le stockage est refusé : compteur en mémoire
  const nextOpen = () => {
    let n = ++mem;
    try { n = (parseInt(localStorage.getItem(KEY), 10) || 0) + 1; localStorage.setItem(KEY, String(n)); } catch (e) { /* mem */ }
    return n % ORDER.length;
  };
  const DUR = { sneeze: 3500, roll: 3100, play: 4900, groom: 4300 };

  class Filou {
    constructor(host) {
      this.host = host;
      this.mode = 'awake';
      this.sit = 'awake';
      this.timers = [];
      this.pick = nextOpen();
      this.played = false;
      this.busy = false;
      this.tapN = 0;
      this.onstep = null;
      this.common = 'fl-acc-scarf fl-age2 fl-acc-daisy fl-acc-medal fl-vol1';
      host.classList.add('fl-host');
      this.stage = document.createElement('div');
      this.stage.className = 'fl-stage';
      host.append(this.stage);
      this.bg = this.layer();
      this.stage.append(this.bg);
      this.cur = this.layer();
      this.stage.append(this.cur);
      this.out = null;
      this.paint();
      this.bg.addEventListener('click', () => this.tap());
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((es) => host.classList.toggle('fl-paused', !es[0].isIntersecting)).observe(host);
      }
    }
    layer() {
      const s = document.createElement('div');
      s.setAttribute('aria-hidden', 'true');
      s.innerHTML = SCENE;
      return s;
    }
    cls() {
      // « paci » = assis avec la sucette
      return (this.mode === 'paci' ? 'fl-s-sit fl-paci' : 'fl-s-' + this.mode) + ' ' + this.common;
    }
    paint() {
      this.bg.className = `fl-scene fl-lyr-bg ${this.cls()}`;
      this.cur.className = `fl-scene fl-lyr-ch ${this.cur.dataset.in ? 'fl-xin' : ''} ${this.cls()}`;
    }
    go(mode, instant) {
      if (mode === this.mode) return;
      if (instant) {
        this.mode = mode;
        this.paint();
        return;
      }
      const old = this.cur;
      old.className = `fl-scene fl-lyr-ch fl-xout ${this.cls()}`;
      if (this.out) this.out.remove();
      this.out = old;
      this.mode = mode;
      this.cur = this.layer();
      this.cur.dataset.in = '1';
      this.stage.append(this.cur);
      this.paint();
      setTimeout(() => {
        if (this.out === old) {
          old.remove();
          this.out = null;
        }
      }, 700);
    }
    clear() {
      this.timers.forEach(clearTimeout);
      this.timers = [];
    }
    later(ms, fn) {
      this.timers.push(setTimeout(fn, ms));
    }
    sleeping() {
      return this.mode === 'nap' || this.mode === 'night';
    }
    says(step) {
      if (this.onstep) this.onstep(step);
    }
    // sit : awake | soon (à 5 min de la fenêtre de dodo) | nap | night
    setSit(sit, instant) {
      this.clear();
      this.busy = false;
      const wasSleeping = this.sleeping();
      this.sit = sit;
      if (sit === 'nap' || sit === 'night') {
        this.says(sit === 'nap' ? 'Sieste' : 'Nuit');
        return this.go(sit, instant); // directement dans la pose, sans transition de fatigue
      }
      if (sit === 'soon') {
        this.says('Assis, sucette');
        return this.go('paci', instant);
      }
      this.played = false;
      if (wasSleeping && !instant) {
        this.says('Réveil');
        return this.seq([['lie', 1800], ['stretch', 2800]], () => this.loop());
      }
      this.loop();
    }
    seq(steps, done) {
      let i = 0;
      const next = () => {
        if (i >= steps.length) {
          this.busy = false;
          if (done) done();
          return;
        }
        const s = steps[i++];
        this.go(s[0]);
        this.later(s[1], next);
      };
      this.busy = true;
      next();
    }
    // à chaque ouverture de l'app : une nouvelle position éveillée
    restart() {
      this.pick = nextOpen();
      if (this.sit !== 'awake') return;
      this.clear();
      this.busy = false;
      this.played = false;
      this.go('sit', true);
      this.loop();
    }
    // joue l'animation de la session, puis reste assis
    loop() {
      this.clear();
      if (this.sit !== 'awake') return;
      if (this.played) return this.rest();
      this.played = true;
      const [kind, ms] = ORDER[this.pick];
      this.says({ walk: 'Balade', bfly: 'Papillon', play: 'Balle' }[kind]);
      if (kind === 'play') this.go('play');
      else {
        this.host.dataset.ph = kind === 'bfly' ? 'b' : 'a';
        this.go('awake');
      }
      this.later(ms, () => this.rest());
    }
    rest() {
      this.says('Repos');
      this.go('sit');
    }
    react(kind) {
      if (this.busy || this.sit !== 'awake') return;
      this.clear();
      this.seq([[kind, (DUR[kind] || 3000) + 400]], () => this.loop());
    }
    tap() {
      if (this.sit === 'nap' || this.sit === 'night') {
        this.cur.classList.add('fl-stir');
        setTimeout(() => this.cur.classList.remove('fl-stir'), 1500);
        return;
      }
      this.react(['sneeze', 'play', 'roll'][this.tapN++ % 3]);
    }
  }
  window.Filou = Filou;
})();
