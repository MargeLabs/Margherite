// Correctifs appliqués à la maquette V5 pour produire la variante « app » (vraies données).
// Chaque correctif doit trouver exactement `count` occurrences (1 par défaut), sinon la génération échoue :
// si la maquette change, on le voit tout de suite au lieu de livrer une app qui diverge en silence.
//   { name, in: 'template' | 'logic' | 'css', find: string | RegExp, replace: string, count? }
//
// Contrat avec l'app : `this.props.store` (voir src/data/household.tsx, type ViewStore).
// Écarts assumés avec la maquette, tous listés ici :
//   - horloge, âge, données, chrono : réels (plus d'exemple) ; la pastille « Exemple » disparaît
//   - feuille « Profil » (modifier le bébé, sauvegarde, déconnexion) ouverte par la fleur en haut de l'Accueil
//   - import du carnet tire-lait (JSON ou CSV) dans le Journal tire-lait
//   - repères d'âge masqués tant qu'ils ne sont pas sourcés (AGE_REFS)
//   - 3 phrases de la maquette qui parlaient de la maquette elle-même

export const mockupPatches = [];

const s = (name, find, replace, count = 1) => ({ name, in: 'logic', find, replace, count });
const t = (name, find, replace, count = 1) => ({ name, in: 'template', find, replace, count });

export const appPatches = [
  // ---------------------------------------------------------------- état : une partie vit dans la base, une partie sur l'appareil
  s('état et écriture partagés', '  st() { return this.state || {}; }', `  st() { const t = this.props.store; return Object.assign({}, this.state || {}, t.shared, t.local, { baby: t.babyTitle }); }
  setState(o, cb) {
    const t = this.props.store, sh = {}, lo = {}, rest = {};
    Object.keys(o).forEach((k) => { (['trk', 'trl', 'notes', 'well', 'tipsX'].indexOf(k) >= 0 ? sh : ['cv', 'dstart'].indexOf(k) >= 0 ? lo : rest)[k] = o[k]; });
    if (Object.keys(sh).length) t.setShared(sh);
    if (Object.keys(lo).length) t.setLocal(lo);
    super.setState(rest, cb);
  }`),
  s('données : plus de jeu d\'exemple', /  \/\/ Données d'exemple : 28 jours[\s\S]*?\n    return this\._base;\n  \}\n/, '  base() { return { ev: this.props.store.events, pump: this.props.store.pumps }; }\n'),

  // ---------------------------------------------------------------- horloge réelle
  s('nuit', "const night = (P.moment || 'jour') === 'nuit';", 'const night = false;'),
  s('thème système', "const dark = theme === 'sombre' || (theme === 'auto' && night);", "const dark = theme === 'sombre' || (theme === 'auto' && P.store.dark);"),
  s('maintenant', 'const NOW = T0 + (night ? 1420 : 860) + Math.floor((Date.now() - (this._m || Date.now())) / 60000);', 'const NOW = T0 + P.store.nowMin;'),
  s('calendrier', 'const dt = (d) => new Date(2026, 8, 30 + d);', 'const dt = (d) => new Date(P.store.origin.getFullYear(), P.store.origin.getMonth(), P.store.origin.getDate() + d);'),
  s('état normal', "const etat = s.etat || P.etat || 'normal';", "const etat = 'normal';"),
  s('chrono partagé', 'const run = s.run !== undefined ? s.run : runDef;', 'const run = P.store.run;'),

  // ---------------------------------------------------------------- écritures : la base d'abord, l'écran confirme ou affiche l'erreur
  s('texte d\'erreur', 'le téléphone n’a pas pu écrire la donnée.', 'la connexion n’a pas permis d’écrire la donnée.'),
  s('enregistrement', /    const doSave = \(apply, msg, popBase\) => \{[\s\S]*?\n    \};\n    const uid/, `    const fail = () => this.toast('Ce n’est pas enregistré : réessaie dans un instant.');
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
    const uid`),
  s('ajout', /    const addEv = \(o\) => \(\) => \{[\s\S]*?\n    \};\n/, `    const addEv = (o) => () => {
      const r = P.store.addEvent(o);
      this._lastId = r.id;
      return Object.assign(() => { P.store.removeEvent(r.id).done.catch(fail); this.setState({ toast: null }); }, { done: r.done });
    };
`),
  s('lancer le chrono', /    const sleepNow = \(\) => \{[^\n]*\n/, `    const startRun = (a) => {
      P.store.startRun(a).done.then(
        () => this.setState({ sheet: null, f: null, pop: { k: 'start', a, undo: () => P.store.cancelRun().done.catch(fail) } }),
        (e) => { this.setState({ sheet: null, f: null }); this.toast(e && e.name === 'RunningConflictError' ? 'Un dodo est déjà en cours : le voici.' : 'Ce n’est pas enregistré : réessaie dans un instant.'); },
      );
    };
    const sleepNow = () => startRun(NOW);
`),
  s('dodo trop court', "{ this.setState({ run: null, sheet: null }); this.toast('Dodo de moins d’une minute : rien n’est enregistré', () => this.setState({ run: a, toast: null })); return; }",
    "{ P.store.cancelRun().done.catch(fail); this.setState({ sheet: null }); this.toast('Dodo de moins d’une minute : rien n’est enregistré', () => { P.store.startRun(a).done.catch(fail); this.setState({ toast: null }); }); return; }"),
  s('arrêter le chrono', "doSave(() => { const u = addEv({ k: 'sleep', a, b })(); this.setState({ run: null }); return () => { u(); this.setState({ run: a }); }; },",
    'doSave(() => { const r = P.store.stopRun(b); this._lastId = r.id; return Object.assign(() => { P.store.reopenRun(r.id).done.catch(fail); this.setState({ toast: null }); }, { done: r.done }); },'),
  s('chrono depuis une heure', `        const prev = this.st().run;
        this.setState({ run: a, sheet: null, f: null, pop: { k: 'start', a, undo: () => this.setState({ run: prev === undefined ? runDef : prev }) } });`, '        startRun(a);'),
  s('annuler le dodo', "cancelRun: () => { const a = run; this.setState({ run: null, sheet: null }); this.toast('Dodo annulé', () => this.setState({ run: a, toast: null })); },",
    "cancelRun: () => { const a = run; P.store.cancelRun().done.catch(fail); this.setState({ sheet: null }); this.toast('Dodo annulé', () => { P.store.startRun(a).done.catch(fail); this.setState({ toast: null }); }); },"),
  s('tirage', "doSave(() => { const p = { id: uid(), a: NOW, g, d }; this.setState({ pumps: (this.st().pumps || []).concat([p]) }); return () => this.setState({ pumps: (this.st().pumps || []).filter((x) => x.id !== p.id), toast: null }); }, 'Tirage de '",
    "doSave(() => { const r = P.store.addPump({ a: NOW, g, d }); return Object.assign(() => { P.store.removePump(r.id).done.catch(fail); this.setState({ toast: null }); }, { done: r.done }); }, 'Tirage de '"),
  s('modification', "doSave(() => { const old = (this.st().edits || {})[e.id]; this.setState({ edits: Object.assign({}, this.st().edits || {}, { [e.id]: Object.assign({}, old || {}, patch) }) }); return () => this.setState({ edits: Object.assign({}, this.st().edits || {}, { [e.id]: old }), toast: null }); }, 'Modification enregistrée');",
    "doSave(() => { const prev = { a: e.a, b: e.b, ml: e.ml, side: e.side, v: e.v }; const r = P.store.updateEvent(e.id, patch); return Object.assign(() => { P.store.updateEvent(e.id, prev).done.catch(fail); this.setState({ toast: null }); }, { done: r.done }); }, 'Modification enregistrée');"),
  s('suppression', `      const id = f.id;
      this.setState({ del: Object.assign({}, this.st().del || {}, { [id]: true }), sheet: null, f: null });
      this.toast('Événement supprimé', () => { const d2 = Object.assign({}, this.st().del || {}); delete d2[id]; this.setState({ del: d2, toast: null }); });`,
  `      const id = f.id, e0 = findEv(id);
      P.store.removeEvent(id).done.catch(fail);
      this.setState({ sheet: null, f: null });
      this.toast('Événement supprimé', () => { if (e0) P.store.restoreEvent(e0).done.catch(fail); this.setState({ toast: null }); });`),

  // ---------------------------------------------------------------- bébé réel
  s('humeur : pas d\'exemple', /    const W0 = \{[\s\S]*?\n    \};\n/, '    const W0 = {};\n'),
  s('carte bébé', /    const bcBirth = [\s\S]*?\n    \};\n/, '    const bc = P.store.bc;\n'),
  s('âge en semaines', 'const AGEW = 9;', 'const AGEW = xAgeW;'),

  // ---------------------------------------------------------------- repères d'âge : exemples de la maquette, à sourcer avant tout affichage (INTELLIGENCE.md §10)
  s('interrupteur des repères', "    const XNEAR = ' que ce qui s’observe le plus souvent à cet âge';", "    const AGE_REFS = false; // repères d’âge non sourcés : masqués. Passer à true seulement avec des sources validées.\n    const XNEAR = ' que ce qui s’observe le plus souvent à cet âge';"),
  s('repères : popups', 'return xAgeW && r.length ?', 'return AGE_REFS && xAgeW && r.length ?'),
  s('repères : calculé', 'if (awN.length) tipsAll.push', 'if (AGE_REFS && awN.length) tipsAll.push'),
  s('repères : sommeil', "tipsAll.push({ id: 'sl'", "if (AGE_REFS) tipsAll.push({ id: 'sl'"),
  s('repères : repas', "tipsAll.push({ id: 'fd'", "if (AGE_REFS) tipsAll.push({ id: 'fd'"),

  // ---------------------------------------------------------------- feuille Profil, import tire-lait
  s('feuille profil : titre', "      pjour: { title: 'Journal tire-lait', icon: '#i-droplet', icCls: 'ic k-feed' },", "      pjour: { title: 'Journal tire-lait', icon: '#i-droplet', icCls: 'ic k-feed' },\n      profil: { title: 'Profil', icon: '#i-flower', icCls: 'ic k-main' },"),
  s('feuille profil : drapeau', "isPJ: sheet === 'pjour',", "isPJ: sheet === 'pjour', isProfil: sheet === 'profil',"),
  s('feuille profil : bouton', "hasSave: ['bib', 'sein', 'dodo', 'pump', 'edit', 'trk', 'trkq', 'note']", "hasSave: ['bib', 'sein', 'dodo', 'pump', 'edit', 'trk', 'trkq', 'note', 'profil']"),
  s('feuille profil : enregistrer', "      else if (k === 'trk') {", `      else if (k === 'profil') {
        const r = P.store.saveBaby(f.name, f.bdate, f.btime);
        if (r.error) { this.setState({ err: r.error }); return; }
        this.setState({ saving: true, err: null });
        r.done.then(() => { this.setState({ saving: false, sheet: null, f: null, err: null }); this.toast('Profil enregistré'); }, () => this.setState({ saving: false, err: ERR }));
      }
      else if (k === 'trk') {`),
  s('profil, import, sauvegarde : actions', 'askDel: () => upF({ conf: true }), noDel: () => upF({ conf: false }), doDel,', `askDel: () => upF({ conf: true }), noDel: () => upF({ conf: false }), doDel,
      openProfile: () => {
        const b = P.store.birthAt, p = (n) => String(n).padStart(2, '0');
        this.setState({ sheet: 'profil', f: defF('profil', { name: P.store.babyName, bdate: b.getFullYear() + '-' + p(b.getMonth() + 1) + '-' + p(b.getDate()), btime: p(b.getHours()) + ':' + p(b.getMinutes()) }), err: null, saving: false });
      },
      setBDate: (e) => upF({ bdate: e.target.value }), setBTime: (e) => upF({ btime: e.target.value }),
      exportData: () => { P.store.exportData().then(() => this.toast('Sauvegarde prête'), () => this.toast('La sauvegarde a échoué : réessaie.')); },
      logout: () => P.store.logout(),
      pjImport: () => {
        const i = document.createElement('input');
        i.type = 'file'; i.accept = '.json,.csv,application/json,text/csv';
        i.onchange = () => { const fl = i.files && i.files[0]; if (fl) P.store.importPumpsFile(fl).then((m) => this.toast(m), () => this.toast('L’import a échoué : réessaie.')); };
        i.click();
      },`),

  // ---------------------------------------------------------------- gabarit
  t('fleur : profil', '<div class="top-r"><span class="ex">Exemple</span><button class="pe-b"', '<div class="top-r"><button class="pe-b" type="button" onClick="{{ openProfile }}" aria-label="Profil et sauvegarde"><svg class="i sm"><use href="#i-flower"></use></svg></button><button class="pe-b"'),
  t('plus de pastille Exemple', '<span class="ex">Exemple</span>', '', 2),
  t('tire-lait : phrase de la maquette', /<p class="note" style="font-size: 13px"><svg class="i sm" style="margin-top: 1px"><use href="#i-info"><\/use><\/svg><span>Module tire-lait actuel[^<]*<\/span><\/p>\n?/, ''),
  t('note partagée', 'Toi seule la vois.', 'Elle est partagée entre vos deux téléphones.'),
  t('profil et import', `          </sc-for>
        </div>
      </sc-if>

      <sc-if value="{{ sh.isCvAdd }}" hint-placeholder-val="{{ false }}">`, `          </sc-for>
          <button class="btn btn-s" type="button" onClick="{{ pjImport }}">Importer l’ancien carnet (JSON ou CSV)</button>
        </div>
      </sc-if>

      <sc-if value="{{ sh.isProfil }}" hint-placeholder-val="{{ false }}">
        <label class="fld"><span class="lbl">Prénom</span><input class="tin" type="text" value="{{f.name}}" onChange="{{ setName }}"></label>
        <div class="two">
          <label class="fld"><span class="lbl">Date de naissance</span><input class="tin" type="date" value="{{f.bdate}}" onChange="{{ setBDate }}"></label>
          <label class="fld"><span class="lbl">Heure</span><input class="tin" type="time" value="{{f.btime}}" onChange="{{ setBTime }}"></label>
        </div>
        <div class="fld"><span class="lbl">Sauvegarde</span><button class="btn btn-s" type="button" onClick="{{ exportData }}">Télécharger toutes les données (JSON)</button><span class="sub" style="font-size: 13px">Une copie de tout ce qui est noté, à garder de côté.</span></div>
        <button class="btn-g" type="button" onClick="{{ logout }}">Se déconnecter de ce téléphone</button>
      </sc-if>

      <sc-if value="{{ sh.isCvAdd }}" hint-placeholder-val="{{ false }}">`),

  // ---------------------------------------------------------------- code famille (avant connexion) et premier lancement (pas encore de bébé)
  s('écrans : code famille, premier lancement', 'isPremier: etat === \'premier\', notPremier: etat !== \'premier\',', 'isGate: !!P.store.gate, isPremier: !P.store.gate && !P.store.hasBaby, notPremier: !P.store.gate && P.store.hasBaby,'),
  s('premier lancement : enregistrer', "startApp: () => this.setState({ etat: 'vide', baby: (this.st().wName || '').trim() ? this.st().wName.trim() : 'Ton bébé' }),",
    "startApp: () => { const r = P.store.saveBaby(this.st().wName, this.st().wBirth, this.st().wTime); if (r.error) { this.setState({ wErr: r.error }); return; } this.setState({ wErr: '' }); r.done.catch(() => this.setState({ wErr: ERR })); },"),
  s('premier lancement : champs', "wName, wBirth: s.wBirth || '',", `wName, wBirth: s.wBirth || '', wTime: s.wTime || '', setWTime: (e) => this.setState({ wTime: e.target.value }), wErr: s.wErr || '', hasWErr: !!s.wErr,
      gcode: s.gcode || '', setGCode: (e) => this.setState({ gcode: e.target.value }), gErr: s.gErr || '', hasGErr: !!s.gErr, gBusy: !!s.gBusy,
      submitGate: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (this.st().gBusy) return;
        this.setState({ gBusy: true, gErr: '' });
        P.store.gate.submit(this.st().gcode || '').then((msg) => this.setState({ gBusy: false, gErr: msg || '' }), () => this.setState({ gBusy: false, gErr: 'Connexion impossible pour le moment.' }));
      },`),
  t('premier lancement : prénom', '<span class="lbl">Prénom du bébé · facultatif</span>', '<span class="lbl">Prénom du bébé</span>'),
  t('premier lancement : naissance', '<label class="fld"><span class="lbl">Date de naissance · facultative, pour situer son âge</span><input class="tin" type="date" value="{{wBirth}}" onChange="{{ setWBirth }}"></label>',
    '<div class="two"><label class="fld"><span class="lbl">Date de naissance</span><input class="tin" type="date" value="{{wBirth}}" onChange="{{ setWBirth }}"></label><label class="fld"><span class="lbl">Heure</span><input class="tin" type="time" value="{{wTime}}" onChange="{{ setWTime }}"></label></div>'),
  t('premier lancement : note', 'Tes notes restent sur ce téléphone. Rien n’est obligatoire, et tout se modifie plus tard.', 'Vos notes sont partagées entre vos deux téléphones. Tout se modifie plus tard, dans le profil.'),
  t('premier lancement : erreur', `    <div style="flex: 1"></div>
    <button class="btn btn-p" type="button" onClick="{{ startApp }}">Commencer</button>`, `    <sc-if value="{{ hasWErr }}" hint-placeholder-val="{{ false }}"><p class="err" role="alert"><svg class="i sm" style="margin-top: 2px"><use href="#i-alert"></use></svg><span>{{wErr}}</span></p></sc-if>
    <div style="flex: 1"></div>
    <button class="btn btn-p" type="button" onClick="{{ startApp }}">Commencer</button>`),
  t('écran du code famille', '<sc-if value="{{ notPremier }}" hint-placeholder-val="{{ true }}">', `<sc-if value="{{ isGate }}" hint-placeholder-val="{{ false }}">
  <form class="welcome" onsubmit="{{ submitGate }}">
    <div class="deco j-garden" aria-hidden="true"><svg class="g-sun"><use href="#d-sun"></use></svg><svg class="g-cloud"><use href="#d-cloud"></use></svg><svg class="g-d1"><use href="#d-daisy"></use></svg><svg class="g-d2"><use href="#d-daisy"></use></svg><svg class="g-sprig"><use href="#d-sprig"></use></svg><svg class="g-flower"><use href="#d-flower"></use></svg></div>
    <span class="logo"><svg class="i lg" style="color: var(--sage-x); width: 40px; height: 40px"><use href="#i-flower"></use></svg></span>
    <div class="col" style="gap: 10px">
      <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1">Margherite</h1>
      <p style="font-size: 17px; line-height: 1.5; color: var(--mut)">Entre le code famille pour retrouver vos notes sur ce téléphone.</p>
    </div>
    <label class="fld"><span class="lbl">Code famille</span><input class="tin" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" value="{{gcode}}" onChange="{{ setGCode }}"></label>
    <sc-if value="{{ hasGErr }}" hint-placeholder-val="{{ false }}"><p class="err" role="alert"><svg class="i sm" style="margin-top: 2px"><use href="#i-alert"></use></svg><span>{{gErr}}</span></p></sc-if>
    <div style="flex: 1"></div>
    <button class="btn btn-p" type="submit" disabled="{{gBusy}}">Entrer</button>
  </form>
</sc-if>

<sc-if value="{{ notPremier }}" hint-placeholder-val="{{ true }}">`),

  // ---------------------------------------------------------------- retours de Victor après la mise en ligne (2026-10-31)
  // un dodo lancé « à une heure choisie » partait une heure plus tôt : l'heure par défaut est maintenant, pas maintenant − 1 h
  s('dodo : heure par défaut', "defF('dodo', Object.assign({ t: hhmm(NOW - 60), t2:", "defF('dodo', Object.assign({ t: hhmm(NOW), t2:"),

  // Accueil : les cartes « Dernière sieste » et « Dernier repas » absorbent les tuiles Sommeil et Repas
  s('accueil : plus de tuiles Sommeil et Repas par défaut', "{ id: 'ts', t: 'tile', k: 'sleep' }, { id: 'tf', t: 'tile', k: 'feeds' }, ", ''),
  s('accueil : cartes Dodo et Repas', '    const td = dayStats(dStart(27), dStart(28), NOW, true);\n', `    const td = dayStats(dStart(27), dStart(28), NOW, true);
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
    // Repas : la quantité du jour en grand, le nombre de biberons et de tétées dessous, le dernier repas en une ligne
    const mlTod = fdTod.reduce((n, x) => n + (x.ml || 0), 0);
    lf.ml = mlTod ? mlTod + '\\u00a0mL' : ''; lf.hasMl = mlTod > 0;
    lf.sub = lastFeed ? 'dernier ' + ago(lastFeed.a) : 'pas encore noté';
    // toucher une carte ouvre Rythme › Jour ; le « + » sert à lancer un dodo ou noter un repas
    ls.pick = lf.pick = set({ tab: 'pilotage', pday: 0, pview: 'jour', csel: '' });
    // Dodo : l'écart à l'habitude n'est plus sur la carte (il est dans « Derniers enregistrements »)
    ls.hasDet = run !== null && !!ls.det; if (!ls.hasDet) ls.det = '';
`),
  s('derniers enregistrements : habitude du dodo', '    const recent = evs.slice()', `    const habTxt = (e) => {
      const hl = habitOf(e.a, e.b, e.id), bad = hl.rows.find((x) => !x.ok);
      return hl.kind === 'ok' ? hl.lab + ' · dans ses habitudes' : hl.kind === 'diff' && bad ? hl.lab + ' · ' + bad.s : hl.kind === 'extra' ? hl.lab + ' · en plus de d’habitude' : '';
    };
    const recent = evs.slice()`),
  s('derniers enregistrements : texte', "det: e.k === 'sleep' ? dur(e.b - e.a) : inf.det, pick: openEdit(e) };", "det: e.k === 'sleep' ? [dur(e.b - e.a), habTxt(e)].filter(Boolean).join(' · ') : inf.det, pick: openEdit(e) };"),
  t('carte Dodo : plus de ligne d\'habitude', '<span class="fc-d">{{ls.det}}</span>', '<sc-if value="{{ ls.hasDet }}" hint-placeholder-val="{{ false }}"><span class="fc-d">{{ls.det}}</span></sc-if>'),
  t('carte Repas : plus de ligne de quantité', '<span class="fc-d">{{lf.det}}</span>', ''),
  t('accueil : carte Dodo avec picto', '<b class="fc-v">{{ls.big}}</b>', '<span class="fc-its"><span class="fc-it big"><svg class="i" aria-hidden="true"><use href="#i-moon"></use></svg><b>{{ls.big}}</b></span></span>'),
  t('accueil : carte Repas', '<span class="fc-h"><span class="ic"><svg class="i sm"><use href="{{lf.icon}}"></use></svg></span>Dernier repas</span>\n              <b class="fc-v">{{lf.big}}</b>',
    '<span class="fc-h"><span class="ic"><svg class="i sm"><use href="#i-milk"></use></svg></span>Repas</span>\n              <sc-if value="{{ lf.hasItems }}" hint-placeholder-val="{{ true }}"><span class="fc-its"><sc-if value="{{ lf.hasMl }}" hint-placeholder-val="{{ true }}"><b class="fc-v">{{lf.ml}}</b></sc-if><sc-for list="{{ lf.items }}" as="it" hint-placeholder-count="2"><span class="fc-it"><svg class="i" aria-hidden="true"><use href="{{it.icon}}"></use></svg><b>{{it.n}}</b><span>{{it.l}}</span></span></sc-for></span></sc-if><sc-if value="{{ lf.noItems }}" hint-placeholder-val="{{ false }}"><b class="fc-v">{{lf.big}}</b></sc-if>'),
  t('accueil : carte Repas, étiquette', 'aria-label="Dernier repas : {{lf.big}}, {{lf.sub}}"', 'aria-label="Repas : {{lf.aria}}, {{lf.sub}}"'),

  // frises : un picto (biberon ou cœur) à la place du point, une lune dans les dodos (le dessin est dans globals.css)
  s('frise : cœur pour la tétée', "cls: 'mf-d' + (hs === 'f' + i ? ' on' : ''),", "cls: 'mf-d' + (x.k === 'sein' ? ' heart' : '') + (hs === 'f' + i ? ' on' : ''),"),
  s('semaine : cœur pour la tétée', "cls: 'wc-b' + (k.kind === 'fd' ? ' meal' : '') + (k.id === wbsel ? ' on' : '')", "cls: 'wc-b' + (k.kind === 'fd' ? ' meal' + (k.src.k === 'sein' ? ' heart' : '') : '') + (k.id === wbsel ? ' on' : '')"),
  s('semaine : cœur dans la légende', "kCls: 'lg-k fd', l:", "kCls: 'lg-k fd' + (x.k === 'bib' ? '' : ' heart'), l:"),

  // vocabulaire : « Sein » devient « Tétée » (les cases de l'humeur de la maman, « Seins douloureux », restent telles quelles) ; « Pilotage » devient « Rythme »
  s('mot : Sein', /'Sein'/g, "'Tétée'", 8),
  s('mot : Sein + côté', /'Sein '/g, "'Tétée '", 4),
  s('mot : au sein', "'Part des repas au sein'", "'Part des repas en tétée'"),
  s('mot : au sein seulement', "!x3bib ? 'au sein seulement' : 'au biberon et au sein'", "!x3bib ? 'en tétée seulement' : 'au biberon et en tétée'"),
  s('mot : Touche Sein', 'Touche Sein, Biberon', 'Touche Tétée, Biberon'),
  s('mot : onglet Rythme', "['pilotage', 'Pilotage', '#i-clock']", "['pilotage', 'Rythme', '#i-clock']"),
  s('mot : la nuit dans Rythme', "go: 'La nuit dans Pilotage'", "go: 'La nuit dans Rythme'"),
  t('mot : Tétée (ajout d\'un oubli)', '</svg>Sein</button>', '</svg>Tétée</button>'),
  t('mot : en-tête Rythme', '<span class="eyebrow">Pilotage</span>', '<span class="eyebrow">Rythme</span>'),

  // photo du bébé : sur la carte de l'Accueil (à la place du dessin) et dans le Profil
  t('carte bébé : photo', '<svg class="deco bc-baby" aria-hidden="true"><use href="#d-baby"></use></svg>',
    '<sc-if value="{{ bc.hasPhoto }}" hint-placeholder-val="{{ false }}"><img class="bc-photo" src="{{bc.photo}}" alt=""></sc-if><sc-if value="{{ bc.noPhoto }}" hint-placeholder-val="{{ true }}"><svg class="deco bc-baby" aria-hidden="true"><use href="#d-baby"></use></svg></sc-if>'),
  t('profil : photo', '<label class="fld"><span class="lbl">Prénom</span><input class="tin" type="text" value="{{f.name}}" onChange="{{ setName }}"></label>\n        <div class="two">',
    `<div class="fld"><span class="lbl">Photo</span><div class="row" style="gap: 12px"><sc-if value="{{ bc.hasPhoto }}" hint-placeholder-val="{{ false }}"><img class="pf-photo" src="{{bc.photo}}" alt=""></sc-if><button class="btn btn-s" type="button" onClick="{{ pickPhoto }}" style="flex: 1">{{photoLabel}}</button><sc-if value="{{ bc.hasPhoto }}" hint-placeholder-val="{{ false }}"><button class="btn-g" type="button" onClick="{{ removePhoto }}">Retirer</button></sc-if></div></div>
        <label class="fld"><span class="lbl">Prénom</span><input class="tin" type="text" value="{{f.name}}" onChange="{{ setName }}"></label>
        <div class="two">`),
  s('profil : actions photo', '      logout: () => P.store.logout(),', `      logout: () => P.store.logout(),
      photoLabel: P.store.bc.hasPhoto ? 'Changer la photo' : 'Ajouter une photo',
      pickPhoto: () => {
        const i = document.createElement('input');
        i.type = 'file'; i.accept = 'image/*';
        i.onchange = () => { const fl = i.files && i.files[0]; if (fl) P.store.setPhoto(fl).done.then(() => this.toast('Photo enregistrée'), (e) => this.toast(e && e.message ? e.message : 'La photo n’a pas pu être enregistrée : réessaie.')); };
        i.click();
      },
      removePhoto: () => { P.store.setPhoto(null).done.then(() => this.toast('Photo retirée'), (e) => this.toast(e && e.message ? e.message : 'Ce n’est pas enregistré : réessaie.')); },`),

  // Journal tire-lait : on peut y ajouter un tirage
  s('journal tire-lait : ajouter', '      logout: () => P.store.logout(),\n', '      logout: () => P.store.logout(),\n      pjAdd: open(\'pump\'),\n'),
  t('journal tire-lait : bouton ajouter', '<div class="col" style="gap: 20px">\n          <sc-for list="{{ pjWeeks }}"', '<div class="col" style="gap: 20px">\n          <button class="btn btn-p" type="button" onClick="{{ pjAdd }}">Ajouter un tirage</button>\n          <sc-for list="{{ pjWeeks }}"'),

  // Accueil : un « + » en haut à droite des cartes Dodo et Repas
  s('cartes : actions +', '    lf.hasItems = lf.items.length > 0;', "    ls.plus = open('dodo'); ls.plusAria = run !== null ? 'Arrêter le dodo' : 'Lancer un dodo';\n    lf.plus = open('meal');\n    lf.hasItems = lf.items.length > 0;"),
  t('cartes : enveloppe Dodo', '<div class="duo">\n            <button class="fc c-sleep"', '<div class="duo">\n            <div class="fcw"><button class="fc c-sleep"'),
  t('cartes : + Dodo', '<svg class="deco j-cloud" aria-hidden="true"><use href="#d-cloud"></use></svg>\n            </button>', '<svg class="deco j-cloud" aria-hidden="true"><use href="#d-cloud"></use></svg>\n            </button><button class="fc-plus" type="button" onClick="{{ ls.plus }}" aria-label="{{ls.plusAria}}"><svg class="i sm" aria-hidden="true"><use href="#i-plus"></use></svg></button></div>'),
  t('cartes : enveloppe Repas', '            <button class="fc c-feed"', '            <div class="fcw"><button class="fc c-feed"'),
  t('cartes : + Repas', '<svg class="deco j-flower" aria-hidden="true"><use href="#d-flower"></use></svg>\n            </button>', '<svg class="deco j-flower" aria-hidden="true"><use href="#d-flower"></use></svg>\n            </button><button class="fc-plus" type="button" onClick="{{ lf.plus }}" aria-label="Noter un repas"><svg class="i sm" aria-hidden="true"><use href="#i-plus"></use></svg></button></div>'),
  // feuille « Repas » : biberon ou tétée
  s('feuille Repas : titre', "      pjour: { title: 'Journal tire-lait', icon: '#i-droplet', icCls: 'ic k-feed' },", "      pjour: { title: 'Journal tire-lait', icon: '#i-droplet', icCls: 'ic k-feed' },\n      meal: { title: 'Repas', icon: '#i-milk', icCls: 'ic k-feed' },"),
  s('feuille Repas : drapeau', "isPJ: sheet === 'pjour',", "isPJ: sheet === 'pjour', isMeal: sheet === 'meal',"),
  s('feuille Repas : actions', '      logout: () => P.store.logout(),\n', "      logout: () => P.store.logout(),\n      mealBib: open('bib'), mealTet: open('sein'),\n"),
  t('feuille Repas : boutons', '      <sc-if value="{{ sh.isCvAdd }}" hint-placeholder-val="{{ false }}">', `      <sc-if value="{{ sh.isMeal }}" hint-placeholder-val="{{ false }}">
        <div class="big4">
          <button class="k-feed" type="button" onClick="{{ mealBib }}"><svg class="i lg"><use href="#i-milk"></use></svg>Biberon</button>
          <button class="k-feed" type="button" onClick="{{ mealTet }}"><svg class="i lg"><use href="#i-heart"></use></svg>Tétée</button>
        </div>
      </sc-if>

      <sc-if value="{{ sh.isCvAdd }}" hint-placeholder-val="{{ false }}">`),

  // feuille Dodo : un seul bouton, « Lancer le chrono » (l'heure proposée est maintenant ; on peut la changer)
  t('dodo : un seul bouton', '        <button class="btn btn-l" type="button" onClick="{{ sleepNow }}">Il s’endort maintenant<small>minuteur lancé à {{nowL}}</small></button>\n        <div class="or">ou, à une heure choisie</div>\n', ''),

  // « Ajouter un oubli » › Dodo pendant qu'un chrono tourne : avant, la feuille devenait celle du réveil et arrêtait le chrono ;
  // maintenant un oubli (jour choisi) ajoute un dodo passé, avec ses deux heures, sans toucher au chrono en cours
  s('oubli : feuille', "isDodoStart: sheet === 'dodo' && run === null, isDodoStop: sheet === 'dodo' && run !== null,", "isDodoStart: sheet === 'dodo' && (run === null || f.day !== undefined), isDodoStop: sheet === 'dodo' && run !== null && f.day === undefined,"),
  s('oubli : titre', "dodo: { title: run !== null ? 'Réveil' : 'Dodo',", "dodo: { title: run !== null && f.day === undefined ? 'Réveil' : 'Dodo',"),
  s('oubli : bouton', "saveLabel = run !== null ? 'Enregistrer ce réveil' : f.t2 ? 'Enregistrer ces horaires' :", "saveLabel = run !== null && f.day === undefined ? 'Enregistrer ce réveil' : (f.t2 || run !== null) ? 'Enregistrer ces horaires' :"),
  s('oubli : enregistrement', "      } else if (k === 'dodo' && run === null) {\n        let a = baseDay + tm(f.t), b = baseDay + tm(f.t2);", "      } else if (k === 'dodo' && f.day !== undefined && !f.t2) {\n        this.setState({ err: 'Indique aussi l’heure du réveil : un dodo est déjà en cours.' }); return;\n      } else if (k === 'dodo' && (run === null || f.day !== undefined)) {\n        let a = baseDay + tm(f.t), b = baseDay + tm(f.t2);"),

  // Fiche Tire-lait : quand était le dernier tirage
  s('tire-lait : dernier tirage', '    const pumpTotal = ', "    const pumpPrev = pumpAll.filter((p) => p.a <= NOW).sort((x, y) => y.a - x.a)[0];\n    const pumpLastL = pumpPrev ? ago(pumpPrev.a) + ' · ' + atL(pumpPrev.a) + ' · ' + (pumpPrev.g + pumpPrev.d) + '\\u00a0mL' : 'aucun tirage noté';\n    const pumpTotal = "),
  s('tire-lait : dernier tirage, valeur', '      pjAdd: open(\'pump\'),\n', "      pjAdd: open('pump'), pumpLastL,\n"),
  t('tire-lait : dernier tirage, ligne', '<div class="two">\n          <label class="fld"><span class="lbl">Gauche (mL)</span>', '<div class="row sb" style="font-size: 15px"><span class="lbl">Dernier tirage</span><b style="text-align: right">{{pumpLastL}}</b></div>\n        <div class="two">\n          <label class="fld"><span class="lbl">Gauche (mL)</span>'),

  // Apparence : automatique (comme le téléphone), clair ou sombre, au choix dans le Profil (mémorisé sur l'appareil)
  s('apparence : mémorisée', "['cv', 'dstart'].indexOf(k)", "['cv', 'dstart', 'theme'].indexOf(k)"),
  s('apparence : lecture', "const theme = P.theme || 'auto';", "const theme = s.theme || P.theme || 'auto';"),
  s('apparence : choix', '      logout: () => P.store.logout(),\n', "      logout: () => P.store.logout(),\n      themeOpts: [['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']].map((o) => ({ t: o[1], cls: theme === o[0] ? 'on' : '', pick: () => this.setState({ theme: o[0] }) })),\n"),
  t('apparence : feuille Profil', '<div class="fld"><span class="lbl">Sauvegarde</span>', '<div class="fld"><span class="lbl">Apparence</span><div class="seg"><sc-for list="{{ themeOpts }}" as="o" hint-placeholder-count="3"><button class="{{o.cls}}" type="button" onClick="{{ o.pick }}">{{o.t}}</button></sc-for></div></div>\n        <div class="fld"><span class="lbl">Sauvegarde</span>'),

  // Rythme › horloge : les repas sont posés directement sur l'anneau (biberon ou cœur), et tout est touchable
  s('horloge : repas sur l\'anneau', "const q = pt(m.a, R + 23); cItems.push({ id: 'f' + i", "const q = pt(m.a, R); cItems.push({ id: 'f' + i"),
  s('horloge : plus de points dehors', /      feeds: marksP\.map\([^\n]*\n/, "      feeds: '',\n"),

  // une seule police (celle de « Endormi depuis ») dans Accueil et Rythme : la classe de l'onglet permet de la poser (globals.css)
  s('police : classe de l\'onglet', "appCls: 'app' + (dark", "appCls: 'app tab-' + tab + (dark"),

  // Journal tire-lait : le détail des heures de chaque tirage sous le total du jour
  s('journal tire-lait : tirages du jour', 'return { k, n: ps.length, tot: g + dd,', "return { k, n: ps.length, list: ps.slice().sort((x, y) => x.a - y.a).map((p) => ({ t: hm(p.a), v: (p.g + p.d) + '\\u00a0mL', s: 'gauche ' + p.g + ' · droite ' + p.d })), tot: g + dd,"),
  t('journal tire-lait : lignes des tirages', '<span class="pj-m"><b>{{d.totL}}</b><small>{{d.sub}}</small></span></div>', '<span class="pj-m"><b>{{d.totL}}</b><small>{{d.sub}}</small></span></div><sc-for list="{{ d.list }}" as="p" hint-placeholder-count="3"><div class="pj-t"><span class="pj-th">{{p.t}}</span><span class="pj-ts">{{p.s}}</span><b>{{p.v}}</b></div></sc-for>'),

  // Rythme : « La suite probable » devient « Prochains dodos » (elle n'apparaît qu'aujourd'hui, avec 3 journées complètes notées)
  t('rythme : prochains dodos', '<h2 class="h2">La suite probable</h2>', '<h2 class="h2">Prochains dodos</h2>'),
  t('rythme : prochains dodos, sous-titre', 'Des fenêtres estimées d’après ses 7 derniers jours, pas un horaire à tenir.', 'Estimés d’après ses 7 derniers jours : un repère, pas un horaire à tenir.'),
  s('galerie : Maintenant', 'et la suite probable', 'et son prochain dodo'),
];



