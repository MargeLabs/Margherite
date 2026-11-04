/* Filou en direct : le décor reste en place, chaque pose est une couche qui fond dans la suivante. */
(() => {
  const SCENE = window.__SCENE;
  const DUR = { play: 4900, groom: 4300, sneeze: 3500, roll: 3100 };
  const ORDER = ['balade', 'groom', 'play', 'balade', 'sneeze', 'play', 'balade', 'roll'];
  const ORDER_CALM = ['sit', 'groom', 'sit', 'sneeze', 'sit'];

  class Filou {
    constructor(host, o = {}) {
      this.walk = o.walk !== false;
      this.fade = o.fade !== false;
      this.host = host;
      this.mode = 'awake';
      this.sit = 'awake';
      this.timers = [];
      this.cycle = 0;
      this.busy = false;
      this.waitIter = false;
      this.tapN = 0;
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
      this.stage.addEventListener('animationiteration', (e) => {
        if (this.waitIter && e.animationName === 'flWander' && this.cur.contains(e.target)) {
          this.waitIter = false;
          this.loop();
        }
      });
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
    paint() {
      this.bg.className = `fl-scene fl-lyr-bg fl-s-${this.mode} ${this.common}`;
      this.cur.className = `fl-scene fl-lyr-ch ${this.cur.dataset.in ? 'fl-xin' : ''} fl-s-${this.mode} ${this.common}`;
    }
    go(mode, instant) {
      if (mode === this.mode) return;
      if (!this.fade || instant) {
        this.mode = mode;
        this.paint();
        return;
      }
      const old = this.cur;
      old.className = `fl-scene fl-lyr-ch fl-xout fl-s-${this.mode} ${this.common}`;
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
    setSit(sit, instant) {
      this.clear();
      this.busy = false;
      this.waitIter = false;
      this.sit = sit;
      const target = sit === 'night' ? 'night' : sit === 'nap' ? 'nap' : null;
      if (target) {
        if (instant || this.sleeping()) return this.go(target, instant);
        if (this.mode === 'sit' || this.mode === 'lie') return this.seq([['lie', 2200], [target, 1]]);
        return this.seq([['tired', 3200], ['lie', 2000], [target, 1]]);
      }
      if (this.sleeping()) {
        this.cycle = 0;
        return this.seq([['lie', 1800], ['stretch', 2800]], () => this.loop());
      }
      this.loop();
    }
    loop() {
      this.clear();
      if (this.sleeping()) return;
      const order = this.walk ? ORDER : ORDER_CALM;
      const kind = order[this.cycle++ % order.length];
      this.waitIter = false;
      if (kind === 'balade') {
        this.go('awake');
        this.waitIter = true;
        this.later(40000, () => this.loop());
      } else if (kind === 'sit') {
        this.go('sit');
        this.later(8000, () => this.loop());
      } else {
        this.go(kind);
        this.later((DUR[kind] || 3000) + 600, () => this.loop());
      }
    }
    react(kind) {
      if (this.busy || this.sleeping()) {
        if (this.sleeping()) {
          this.cur.classList.add('fl-stir');
          setTimeout(() => this.cur.classList.remove('fl-stir'), 1500);
        }
        return;
      }
      this.clear();
      this.waitIter = false;
      this.seq([[kind, (DUR[kind] || 3000) + 400]], () => this.loop());
    }
    tap() {
      const m = ['sneeze', 'play', 'roll'][this.tapN++ % 3];
      this.react(m);
    }
  }
  window.Filou = Filou;
})();
