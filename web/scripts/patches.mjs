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
    // une sieste fusionnée (voir « siestes rapprochées ») est réécrite en un seul événement : ses autres parties disparaissent
    "doSave(() => { const o0 = evs.find((x) => x.id === e.id) || e, prev = { a: o0.a, b: o0.b, ml: o0.ml, side: o0.side, v: o0.v }, extra = (e.parts || []).slice(1).map((p) => evs.find((x) => x.id === p)).filter(Boolean); const r = P.store.updateEvent(e.id, patch); extra.forEach((x) => P.store.removeEvent(x.id).done.catch(fail)); return Object.assign(() => { P.store.updateEvent(e.id, prev).done.catch(fail); extra.forEach((x) => P.store.restoreEvent(x).done.catch(fail)); this.setState({ toast: null }); }, { done: r.done }); }, 'Modification enregistrée');"),
  s('suppression', `      const id = f.id;
      this.setState({ del: Object.assign({}, this.st().del || {}, { [id]: true }), sheet: null, f: null });
      this.toast('Événement supprimé', () => { const d2 = Object.assign({}, this.st().del || {}); delete d2[id]; this.setState({ del: d2, toast: null }); });`,
  `      const id = f.id, e0 = findEv(id), ids = (e0 && e0.parts) || [id], raws = ids.map((p) => evs.find((x) => x.id === p)).filter(Boolean);
      ids.forEach((p) => P.store.removeEvent(p).done.catch(fail));
      this.setState({ sheet: null, f: null });
      this.toast('Événement supprimé', () => { raws.forEach((x) => P.store.restoreEvent(x).done.catch(fail)); this.setState({ toast: null }); });`),

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
      <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1">Canaille</h1>
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
  t('journal tire-lait : bouton ajouter', '<div class="col" style="gap: 20px">\n          <sc-for list="{{ pjWeeks }}"', `<div class="col" style="gap: 20px">
          <button class="btn btn-p" type="button" onClick="{{ pjAdd }}">Ajouter un tirage</button>
          <sc-for list="{{ pjWeeks }}"`),

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

  // Accueil › Aujourd'hui : la mini-horloge de Rythme (toujours sur aujourd'hui) à la place de la frise ; dodos, repas et créneaux se touchent
  s('mini-horloge : calcul', '    const suite = winP.map((w) => ({ t: w.t, lab: w.lab, tag: w.tag }));\n', `    const suite = winP.map((w) => ({ t: w.t, lab: w.lab, tag: w.tag }));
    const hcS = dStart(27), hcE = dStart(28), hcSel = s.hcsel || '';
    const hcSegs = allSegsAbs.filter((x) => x.b > hcS && x.a < hcE), hcFd = FD.filter((x) => x.a >= hcS && x.a < hcE);
    const hcItems = [];
    hcSegs.forEach((x, i) => { const a = Math.max(x.a, hcS), b = Math.min(x.b, hcE), q = pt((a + b) / 2, R); hcItems.push({ id: 's' + i, kind: 'sl', x: q[0], y: q[1], icon: '#i-moon', src: x, aria: sleepAria(x) }); });
    wins.forEach((w, i) => { const q = pt((w.a + w.b) / 2, R); hcItems.push({ id: 'w' + i, kind: 'wn', x: q[0], y: q[1], icon: '#i-clock', src: w, aria: w.t + ', ' + w.tag }); });
    hcFd.forEach((m, i) => { const q = pt(m.a, R); hcItems.push({ id: 'f' + i, kind: 'fd', x: q[0], y: q[1], icon: m.k === 'bib' ? '#i-milk' : '#i-heart', src: m, aria: (m.k === 'bib' ? 'Biberon ' + m.ml + ' mL' : 'Tétée') + ' à ' + hm(m.a) }); });
    const hcTap = (e) => {
      if (!hcItems.length) return;
      const span = (k) => k.kind === 'fd' ? [k.src.a, 0] : [Math.max(k.src.a, hcS), Math.min(k.src.b, hcE) - Math.max(k.src.a, hcS)];
      const gap = (m, k) => { const [a, len] = span(k), d = (((m - a) % 1440) + 1440) % 1440; return d <= len ? 0 : Math.min(d - len, 1440 - d); };
      let pick;
      if (!e.clientX && !e.clientY) pick = hcItems[(hcItems.findIndex((k) => k.id === hcSel) + 1) % hcItems.length];
      else {
        const rc = e.currentTarget.getBoundingClientRect(), sc = rc.width / 320;
        const x = (e.clientX - rc.left) / sc - C, y = (e.clientY - rc.top) / sc - C;
        if (Math.sqrt(x * x + y * y) < 82) return;
        const m = (((Math.atan2(y, x) + Math.PI / 2) / (2 * Math.PI)) * 1440 + 1440) % 1440;
        const fd = hcItems.filter((k) => k.kind === 'fd' && gap(m, k) <= 20).sort((p, q) => gap(m, p) - gap(m, q))[0];
        pick = fd || hcItems.slice().sort((p, q) => gap(m, p) - gap(m, q))[0];
      }
      this.setState({ hcsel: pick.id });
    };
    const hclk = {
      tap: hcTap, sleep: hcSegs.map((x) => arc(Math.max(x.a, hcS), Math.min(x.b, hcE), R, 3)).join(' '), win: wins.map((w) => arc(w.a, w.b, R, 3)).join(' '),
      items: hcItems.map((k) => ({ cls: 'ca-k ' + k.kind + (hcSel === k.id ? ' on' : ''), x: k.x.toFixed(1), y: k.y.toFixed(1), icon: k.icon, aria: k.aria, on: hcSel === k.id, pick: () => this.setState({ hcsel: hcSel === k.id ? '' : k.id }) })),
      nx: nowPt[0].toFixed(1), ny: nowPt[1].toFixed(1), nr: 7, hr: 9,
      c1cls: '', c1: nowL, c2: run !== null ? 'endormi depuis ' + dur(NOW - run) : lastSleep ? 'éveillé depuis ' + dur(NOW - lastSleep.b) : '',
      hasPill: !!lastFeed, pill: lastFeed ? 'a mangé ' + ago(lastFeed.a) : '', hasAct: false, act: null, actL: '',
    };
    const hcItem = hcItems.find((k) => k.id === hcSel);
    if (hcItem) {
      hclk.hasPill = false;
      const x = hcItem.src;
      if (hcItem.kind === 'sl') { const m = x.a % 1440; Object.assign(hclk, { c1: dur((x.run ? NOW : x.b) - x.a), c2: x.run ? 'Dodo en cours depuis ' + hm(x.a) : (m >= 420 && m < 1170 ? 'Sieste' : 'Nuit') + ' · ' + hm(x.a) + ' → ' + hm(x.b), hasAct: true, act: openDetail(x), actL: x.run ? 'Arrêter ou corriger' : 'Voir le détail' }); }
      else if (hcItem.kind === 'fd') { Object.assign(hclk, { c1: x.k === 'bib' ? x.ml + '\\u00a0mL' : (x.dur ? x.dur + '\\u00a0min' : 'Tétée'), c2: (x.k === 'bib' ? 'Biberon' : 'Tétée ' + (SIDE[x.side] || '')) + ' · ' + hm(x.a), hasAct: true, act: openEdit(x), actL: 'Modifier' }); }
      else Object.assign(hclk, { c1cls: 'sm win', c1: x.ts, c2: x.lab + '\\nS’endort généralement vers' });
    }
`),
  s('mini-horloge : valeur', 'pv, sit, td, miniSegs, miniMarks, miniNow,', 'pv, sit, td, hclk, miniSegs, miniMarks, miniNow,'),
  t('mini-horloge : le réglage de journée passe sous l\'horloge', /          <div class="dset">[\s\S]*?<\/div><\/div>\n/, ''),
  t('mini-horloge : gabarit', /<div class="col" style="gap: 6px">\s*<div class="mf-tr">\s*<sc-for list="\{\{ miniNb \}\}"[\s\S]*?<p class="\{\{hsel\.cls\}\}">[\s\S]*?<\/p>/, `<div class="hc">
            <div class="ca">
              <svg viewBox="0 0 320 320" aria-hidden="true">
                <defs><linearGradient id="caG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color: var(--s1)"></stop><stop offset="1" style="stop-color: var(--s2)"></stop></linearGradient></defs>
                <circle class="ca-track" cx="160" cy="160" r="116"></circle>
                <path class="ca-win" d="{{hclk.win}}"></path>
                <path class="ca-sleep" d="{{hclk.sleep}}" pathLength="1"></path>
                <path class="ca-tick" d="M160 60 V68 M260 160 H252 M160 260 V252 M60 160 H68"></path>
                <text class="ca-lab" x="160" y="14" text-anchor="middle" dominant-baseline="central">0 h</text>
                <text class="ca-lab" x="306" y="160" text-anchor="middle" dominant-baseline="central">6 h</text>
                <text class="ca-lab" x="160" y="306" text-anchor="middle" dominant-baseline="central">12 h</text>
                <text class="ca-lab" x="14" y="160" text-anchor="middle" dominant-baseline="central">18 h</text>
                <circle class="ca-halo" cx="{{hclk.nx}}" cy="{{hclk.ny}}" r="{{hclk.hr}}"></circle>
                <circle class="ca-now" cx="{{hclk.nx}}" cy="{{hclk.ny}}" r="{{hclk.nr}}"></circle>
              </svg>
              <button class="ca-hit" type="button" aria-label="Lire un moment sur l’horloge : dodo, repas ou créneau" onClick="{{ hclk.tap }}"></button>
              <sc-for list="{{ hclk.items }}" as="k" hint-placeholder-count="8"><button class="{{k.cls}}" type="button" style="left: {{k.x}}px; top: {{k.y}}px" onClick="{{ k.pick }}" aria-label="{{k.aria}}" aria-pressed="{{k.on}}"><svg class="i xs"><use href="{{k.icon}}"></use></svg></button></sc-for>
              <div class="ca-ctr" aria-live="polite">
                <b class="{{hclk.c1cls}}">{{hclk.c1}}</b>
                <span>{{hclk.c2}}</span>
                <sc-if value="{{ hclk.hasPill }}" hint-placeholder-val="{{ true }}"><span class="ca-pill">{{hclk.pill}}</span></sc-if>
                <sc-if value="{{ hclk.hasAct }}" hint-placeholder-val="{{ false }}"><button class="ca-act" type="button" onClick="{{ hclk.act }}">{{hclk.actL}}</button></sc-if>
              </div>
            </div>
          </div>
          <div class="dset"><span>La journée commence</span><div class="row" style="gap: 6px"><button class="{{dsM.cls}}" type="button" onClick="{{ dsM.pick }}" aria-pressed="{{dsM.on}}">À minuit</button><button class="{{dsR.cls}}" type="button" onClick="{{ dsR.pick }}" aria-pressed="{{dsR.on}}">Au réveil</button></div></div>`),

  // Accueil › carte Journal tire-lait : le dernier tirage
  t('journal tire-lait : carte, dernier tirage', '<small>{{pumpLine}}</small>', '<small>{{pumpLine}}</small><small>Dernier : {{pumpLastL}}</small>'),

  // logo de l'app (la canaille) à la place de la marguerite : écrans d'entrée (code famille, premier lancement) et bouton de profil
  t('logo : écrans d\'entrée', '<span class="logo"><svg class="i lg" style="color: var(--sage-x); width: 40px; height: 40px"><use href="#i-flower"></use></svg></span>', '<span class="logo"><img class="logo-img" src="/logo.svg" alt="Canaille"></span>', 2),
  t('logo : bouton de profil', 'aria-label="Profil et sauvegarde"><svg class="i sm"><use href="#i-flower"></use></svg></button>', 'aria-label="Profil et sauvegarde"><img class="pe-logo" src="/logo.svg" alt=""></button>'),

  // Journal tire-lait : le détail des heures de chaque tirage sous le total du jour
  // chaque ligne de jour : le total du jour en grand, le nombre de tirages et la moyenne par tirage en petit
  s('journal tire-lait : total et moyenne', "totL: ps.length ? g + dd + '\\u00a0mL' : '—', sub: ps.length ? ps.length + (ps.length > 1 ? ' tirages' : ' tirage') + ' · gauche ' + g + ' · droite ' + dd : 'aucun tirage noté'", "totL: ps.length ? g + dd + '\\u00a0mL' : '—', sub: ps.length ? ps.length + (ps.length > 1 ? ' tirages' : ' tirage') + ' · moy. ' + Math.round((g + dd) / ps.length) + '\\u00a0mL par tirage' : 'aucun tirage noté'"),
  s('journal tire-lait : tirages du jour', 'return { k, n: ps.length, tot: g + dd,', "return { k, n: ps.length, list: ps.slice().sort((x, y) => y.a - x.a).map((p) => ({ t: hm(p.a), v: (p.g + p.d) + '\\u00a0mL', s: 'gauche ' + p.g + ' · droite ' + p.d })), tot: g + dd,"),
  t('journal tire-lait : lignes des tirages', '<span class="pj-m"><b>{{d.totL}}</b><small>{{d.sub}}</small></span></div>', '<span class="pj-m"><b>{{d.totL}}</b><small>{{d.sub}}</small></span></div><sc-for list="{{ d.list }}" as="p" hint-placeholder-count="3"><div class="pj-t"><span class="pj-th">{{p.t}}</span><span class="pj-ts">{{p.s}}</span><b>{{p.v}}</b></div></sc-for>'),

  // Rythme : « La suite probable » devient « Prochains dodos » (elle n'apparaît qu'aujourd'hui, avec 3 journées complètes notées)
  t('rythme : prochains dodos', '<h2 class="h2">La suite probable</h2>', '<h2 class="h2">Prochains dodos</h2>'),
  // Prochains dodos : le prochain seul, les suivants dans un dépliant fermé par défaut
  t('rythme : prochains dodos, le prochain seul', '<sc-for list="{{ suite }}" as="w" hint-placeholder-count="3"><div class="sr"><span class="mk2"><svg class="i xs"><use href="#i-clock"></use></svg></span><span class="t">{{w.t}}</span><span class="l">{{w.lab}}</span><span class="tg">{{w.tag}}</span></div></sc-for>', '<sc-for list="{{ suite1 }}" as="w" hint-placeholder-count="1"><div class="sr"><span class="mk2"><svg class="i xs"><use href="#i-clock"></use></svg></span><span class="t">{{w.t}}</span><span class="l">{{w.lab}}</span><span class="tg">{{w.tag}}</span></div></sc-for><sc-if value="{{ suiteRest.length }}" hint-placeholder-val="{{ false }}"><details class="suite-more"><summary>Voir les suivants</summary><sc-for list="{{ suiteRest }}" as="w" hint-placeholder-count="2"><div class="sr"><span class="mk2"><svg class="i xs"><use href="#i-clock"></use></svg></span><span class="t">{{w.t}}</span><span class="l">{{w.lab}}</span><span class="tg">{{w.tag}}</span></div></sc-for></details></sc-if>'),
  s('rythme : prochains dodos, données', 'clk, suite, hasSuite:', 'clk, suite, suite1: suite.slice(0, 1), suiteRest: suite.slice(1), hasSuite:'),
  t('rythme : prochains dodos, sous-titre', 'Des fenêtres estimées d’après ses 7 derniers jours, pas un horaire à tenir.', 'Estimés d’après ses 7 derniers jours : un repère, pas un horaire à tenir.'),
  s('galerie : Maintenant', 'et la suite probable', 'et son prochain dodo'),

  // ---------------------------------------------------------------- retours de Victor (2026-11-01)
  // siestes rapprochées : deux siestes de jour séparées de 30 min au plus comptent pour une seule (20 min, puis 10 min après = 1 sieste).
  // La nuit n'est pas touchée : ses réveils comptent. Une sieste fusionnée garde l'id de sa première partie et la liste de ses parties (`parts`).
  s('siestes rapprochées : une seule sieste', "    const SL = evs.filter((e) => e.k === 'sleep');\n", `    // siestes de jour séparées d'au plus NAP_GAP min = une seule sieste (la nuit : seulement si l'éveil dure NIGHT_GAP min au plus, au-delà c'est un vrai réveil)
    const NAP_GAP = 30, NIGHT_GAP = 15, isNapAt = (x) => x.a % 1440 >= 420 && x.a % 1440 < 1170;
    const SL = evs.filter((e) => e.k === 'sleep').reduce((o, e) => {
      const p = o[o.length - 1];
      if (p && (isNapAt(p) && isNapAt(e) && Math.floor(p.a / 1440) === Math.floor(e.a / 1440) ? e.a - p.b <= NAP_GAP : !isNapAt(p) && e.a - p.b <= NIGHT_GAP && p.b - p.a >= 60)) o[o.length - 1] = Object.assign({}, p, { b: Math.max(p.b, e.b), parts: p.parts.concat([e.id]), gaps: e.a > p.b ? p.gaps.concat([[p.b, e.a]]) : p.gaps });
      else o.push(Object.assign({}, e, { parts: [e.id], gaps: [] }));
      return o;
    }, []);
    // minutes réellement dormies dans [lo, hi] : l'étendue d'un bloc fusionné moins les éveils comblés par la fusion
    const slIn = (z, lo = -Infinity, hi = Infinity) => { const ov = (a, b) => Math.max(0, Math.min(b, hi) - Math.max(a, lo)); return ov(z.a, z.b) - (z.gaps || []).reduce((t, g) => t + ov(g[0], g[1]), 0); };
`),
  // Journal : les dodos rapprochés fusionnés (SL) remplacent les dodos bruts, comme dans Rythme et l'Accueil (avant : 1 h 09 et 3 h 00 restaient deux lignes)
  s('journal : dodos fusionnés', "    let jev = evs.filter((e) => e.a >= JS && e.a < JE);\n", "    let jev = evs.filter((e) => e.k !== 'sleep' && e.a >= JS && e.a < JE).concat(SL.filter((e) => e.a >= JS && e.a < JE));\n"),
  // horloges (Accueil et Rythme) : la sieste a son propre arc, d'une autre couleur que le dodo de nuit (couleurs dans globals.css)
  s('horloge Rythme : arcs sieste / nuit', "      tap: clkTap,\n      sleep: segsP.map((x) => arc(Math.max(x.a, PS), Math.min(x.b, PE), R, 3)).join(' '),\n", "      tap: clkTap,\n      sleep: segsP.filter((x) => !isNapAt(x)).map((x) => arc(Math.max(x.a, PS), Math.min(x.b, PE), R, 3)).join(' '),\n      nap: segsP.filter(isNapAt).map((x) => arc(Math.max(x.a, PS), Math.min(x.b, PE), R, 3)).join(' '),\n"),
  s('horloge Accueil : arcs sieste / nuit', "tap: hcTap, sleep: hcSegs.map((x) => arc(Math.max(x.a, hcS), Math.min(x.b, hcE), R, 3)).join(' '),", "tap: hcTap, sleep: hcSegs.filter((x) => !isNapAt(x)).map((x) => arc(Math.max(x.a, hcS), Math.min(x.b, hcE), R, 3)).join(' '), nap: hcSegs.filter(isNapAt).map((x) => arc(Math.max(x.a, hcS), Math.min(x.b, hcE), R, 3)).join(' '),"),
  s('horloge Rythme : pastille sieste', "cls: 'ca-k ' + k.kind + (csel === k.id ? ' on' : '')", "cls: 'ca-k ' + k.kind + (k.kind === 'sl' && isNapAt(k.src) ? ' nap' : '') + (csel === k.id ? ' on' : '')"),
  s('horloge Accueil : pastille sieste', "cls: 'ca-k ' + k.kind + (hcSel === k.id ? ' on' : '')", "cls: 'ca-k ' + k.kind + (k.kind === 'sl' && isNapAt(k.src) ? ' nap' : '') + (hcSel === k.id ? ' on' : '')"),
  t('horloge Rythme : arc des siestes', '<path class="ca-sleep" d="{{clk.sleep}}" pathLength="1"></path>', '<path class="ca-sleep" d="{{clk.sleep}}" pathLength="1"></path><path class="ca-nap" d="{{clk.nap}}" pathLength="1"></path>'),
  t('horloge Accueil : arc des siestes', '<path class="ca-sleep" d="{{hclk.sleep}}" pathLength="1"></path>', '<path class="ca-sleep" d="{{hclk.sleep}}" pathLength="1"></path><path class="ca-nap" d="{{hclk.nap}}" pathLength="1"></path>'),

  // fenêtre de nuit propre au bébé : de son coucher habituel − 2 h (entre 17 h et 21 h) à son réveil habituel + 30 min (entre 6 h 30 et 9 h),
  // d'après ses 7 nuits précédentes (médiane, 3 nuits « ok » minimum), sinon 19 h → 9 h. Elle se met à jour à chaque nuit ajoutée.
  // Les nuits de référence sont calculées avec la fenêtre par défaut (cache NI0) : pas de récursion.
  s('fenêtre de nuit : calcul avec fenêtre en paramètre', "    const nightOf = (d) => {\n      if (NI[d]) return NI[d];\n      const lo = (d - 1) * 1440 + 1140, hi = d * 1440 + 540;\n", "    const nightIn = (d, lo, hi, C) => {\n      if (C[d]) return C[d];\n"),
  s('fenêtre de nuit : fenêtre habituelle', "      NI[d] = r;\n      return r;\n    };\n    const DI = {};\n", `      C[d] = r;
      return r;
    };
    const NI0 = {};
    const nightWin = (d) => {
      const ref = [];
      for (let k = Math.max(1, d - 7); k < d; k++) { const n = nightIn(k, (k - 1) * 1440 + 1140, k * 1440 + 540, NI0); if (n.st === 'ok') ref.push(n); }
      if (ref.length < 3) return [(d - 1) * 1440 + 1140, d * 1440 + 540];
      const B = med(ref.map((n) => n.bed - (n.d - 1) * 1440)), W = med(ref.map((n) => n.wake - n.d * 1440));
      return [(d - 1) * 1440 + Math.min(1260, Math.max(1020, B - 120)), d * 1440 + Math.min(540, Math.max(390, W + 30))];
    };
    const nightOf = (d) => { if (NI[d]) return NI[d]; const w = nightWin(d); return nightIn(d, w[0], w[1], NI); };
    const DI = {};
`),
  // coucher : le sommeil de nuit commence au premier bloc dès 19 h qui, avec ceux qui s'y enchaînent (éveil ≤ 50 min), totalise au moins NIGHT_MIN min.
  // Une sieste du soir plus courte (45 min à 19 h 10, puis éveil) n'est pas le coucher. Sans aucun bloc assez long, on garde le premier comme avant.
  s('coucher : sieste du soir ≠ début de nuit', "      const sl = [];\n      for (const x of SL) { if (x.a < lo || x.a >= hi) continue; if (sl.length && x.a - sl[sl.length - 1].b > 50) break; sl.push(x); }\n", `      // un premier bloc de moins de NIGHT_FIRST min n'est pas le coucher, même rattaché au suivant par un éveil court (19 h 40 → 20 h 30, puis 23 min d'éveil)
      const NIGHT_MIN = 90, NIGHT_FIRST = 60, ch = [];
      for (const x of SL) { if (x.a < lo || x.a >= hi) continue; const c = ch[ch.length - 1]; if (c && x.a - c[c.length - 1].b <= 50) c.push(x); else ch.push([x]); }
      const lead = (c) => { let i = 0; while (i < c.length - 1 && c[i].b - c[i].a < NIGHT_FIRST) i++; return c.slice(i); };
      const sl = ch.map(lead).find((c) => c[0].a <= d * 1440 + 120 && c.reduce((t, x) => t + x.b - x.a, 0) >= NIGHT_MIN) || ch[0] || [];
`),
  // sommeil réel : un dodo fusionné garde son étendue (continuité, cycles, plus long sommeil) mais ne compte que les minutes dormies ; l'éveil comblé reste de l'éveil
  s('sommeil réel : tuile du jour', "const sl = SL.reduce((t, x) => t + Math.max(0, Math.min(x.b, E, upto) - Math.max(x.a, D)), 0)", "const sl = SL.reduce((t, x) => t + slIn(x, D, Math.min(E, upto)), 0)"),
  s('sommeil réel : horloge', "segsP.reduce((t, x) => t + Math.min(x.b, PE) - Math.max(x.a, PS), 0)", "segsP.reduce((t, x) => t + slIn(x, PS, PE), 0)"),
  s('sommeil réel : semaine', "const tot = sl.reduce((t, z) => t + Math.max(0, Math.min(z.b, E, upto) - Math.max(z.a, A)), 0);", "const tot = sl.reduce((t, z) => t + slIn(z, A, Math.min(E, upto)), 0);"),
  s('sommeil réel : semaine, siestes', "const nap = x.naps.reduce((t, z) => t + Math.max(0, Math.min(z.b, upto) - z.a), 0);", "const nap = x.naps.reduce((t, z) => t + slIn(z, -Infinity, upto), 0);"),
  s('sommeil réel : graphes', "sleep: r5(sg.reduce((n, x) => n + Math.min(x.b, a1) - Math.max(x.a, a0), 0))", "sleep: r5(sg.reduce((n, x) => n + slIn(x, a0, a1), 0))"),
  // « Coucher » seulement pour le premier dodo de la nuit : un dodo de nuit qui reprend après un réveil est du sommeil de nuit
  s('coucher : seulement le premier dodo de la nuit', "      if (!typ.ok) return { lab: isNap ? 'Sieste' : 'Coucher', rows: [], kind: 'nodata' };", `      const nN = nightOf(m >= 1170 ? d0 + 1 : d0), firstN = nN.sl ? nN.sl[0] : null;
      if (!isNap && firstN && firstN.id !== evId && firstN.a < a) return { lab: 'Sommeil de nuit', rows: [], kind: 'night' };
      if (!typ.ok) return { lab: isNap ? 'Sieste' : 'Coucher', rows: [], kind: 'nodata' };`),
  s('coucher : popup, nuit', "nodata: ['tq', 'Pas encore assez de données pour savoir ce qui est habituel'] }", "nodata: ['tq', 'Pas encore assez de données pour savoir ce qui est habituel'], night: ['tn', 'Noté dans sa nuit'] }"),
  s('nuit : début du journal', "nv.warn = 'Comparaison partielle : son sommeil n’est noté que jusqu’à ' + hm(N.wake) + '. Le sommeil total, les réveils et le réveil du matin ne sont pas comparés.';", "nv.warn = N.startUnobserved ? 'Comparaison partielle : le journal commence juste avant son coucher, on ne sait pas quand il s’est couché. Cette nuit n’entre pas dans ses habitudes.' : 'Comparaison partielle : son sommeil n’est noté que jusqu’à ' + hm(N.wake) + '. Le sommeil total, les réveils et le réveil du matin ne sont pas comparés.';"),
  // comparatif : « Cycles par nuit » devient « Réveils par nuit » (blocs − 1), « Durée d’un cycle » devient « Durée d’un bloc de sommeil » (un journal montre des blocs, pas des cycles)
  s('comparatif : réveils par nuit', "cyc: ns.length >= 3 ? avg(ns.map((n) => n.sl.length)) : null,", "cyc: ns.length >= 3 ? avg(ns.map((n) => n.wakings)) : null,"),
  s('comparatif : carte réveils', "card('Cycles par nuit', 'sl', wpv.cyc, wc.cyc, 0.3, fr1, -1, 'nuits plus morcelées', 'nuits plus consolidées', ' cycle'),", "card('Réveils par nuit', 'sl', wpv.cyc, wc.cyc, 0.3, fr1, -1, 'nuits plus morcelées', 'nuits plus consolidées', ' réveil'),"),
  s('comparatif : carte bloc', "card('Durée d’un cycle', 'sl',", "card('Durée d’un bloc de sommeil', 'sl',"),
  s('siestes rapprochées : retrouver une sieste', '    const findEv = (id) => evs.find((e) => e.id === id);', '    const findEv = (id) => SL.find((e) => e.id === id) || evs.find((e) => e.id === id);'),

  // Résumé : dire sur quelle période portent les totaux (24 h, de minuit à minuit ou du réveil au réveil selon le réglage)
  t('résumé : période des totaux', '<span class="lgc-m">{{legCur.date}}</span></p>', '<span class="lgc-m">{{legCur.date}}</span></p>\n        <p class="lgc-sp">{{legCur.span}}</p>'),
  // Rythme › Jour › Résumé : Dodo = nuit et siestes « nombre / total », Repas = intervalle moyen entre biberons, nouvelle ligne Éveil
  s('résumé : éveil et détail du jour', /    const legSlides = \[6, 5, 4, 3, 2, 1, 0\]\.map\(\(k\) => \{[\s\S]*?\n    \}\);\n/, `    // éveil d’un jour (k jours en arrière) : temps éveillé, éveils entre deux dodos (réveils de nuit exclus), délai biberon → dodo suivant
    // (biberons de 7 h à 21 h, hors sommeil, dodo dans les 4 h), écarts entre biberons
    const isNapSeg = (x) => x.a % 1440 >= 420 && x.a % 1440 < 1170;
    const awDay = (k) => {
      const a0 = dStart(27 - k), a1 = dStart(28 - k), end = k === 0 ? NOW : a1;
      const sg = allSegsAbs.filter((x) => x.b > a0 && x.a < end).sort((x, y) => x.a - y.a);
      const slp = sg.reduce((n, x) => n + slIn(x, a0, end), 0);
      const gaps = [], aft = [], bg = [];
      for (let i = 1; i < sg.length; i++) if (sg[i].a > sg[i - 1].b && (isNapSeg(sg[i - 1]) || isNapSeg(sg[i]))) gaps.push(sg[i].a - sg[i - 1].b);
      const bib = FD.filter((f) => f.a >= a0 && f.a < end); // biberons et tétées
      bib.forEach((f, i) => {
        if (i && f.a - bib[i - 1].a < 360) bg.push(f.a - bib[i - 1].a);
        const m = f.a % 1440;
        if (m < 420 || m >= 1260 || allSegsAbs.some((x) => x.a <= f.a && x.b > f.a)) return;
        const nx = allSegsAbs.reduce((r, x) => (x.a > f.a && (r === null || x.a < r) ? x.a : r), null);
        if (nx !== null && nx - f.a <= 240) aft.push(nx - f.a);
      });
      return { awake: slp > 0 ? Math.max(0, end - a0 - slp) : null, gaps, aft, bg };
    };
    const avgD = (a) => (a.length ? dur(r5(avg(a))) : null);
    const legSlides = [6, 5, 4, 3, 2, 1, 0].map((k) => {
      const a0 = dStart(27 - k), a1 = dStart(28 - k);
      const sg = allSegsAbs.filter((x) => x.b > a0 && x.a < a1), mk = FD.filter((x) => x.a >= a0 && x.a < a1);
      const part = (arr) => r5(arr.reduce((n, x) => n + slIn(x, a0, a1), 0));
      const sl = part(sg), nSg = sg.filter((x) => !isNapSeg(x)), pSg = sg.filter(isNapSeg);
      const ml = mk.reduce((n, x) => n + (x.ml || 0), 0), sein = mk.filter((x) => x.k === 'sein').length, bib = mk.length - sein;
      const seinTxt = sein + (sein > 1 ? ' tétées' : ' tétée'), dl = dLong(27 - k);
      const aw = awDay(k), bgA = avgD(aw.bg), gA = avgD(aw.gaps), aA = avgD(aw.aft);
      const row = (l, v, s) => ({ l, v, s: s || '', hasS: !!s });
      return {
        span: dmode === 'reveil' ? (k === 0 ? 'Totaux depuis son réveil (' + hm(a0) + '), la journée est en cours.' : 'Totaux sur 24 h, de son réveil de ce jour à celui du lendemain.') : (k === 0 ? 'Totaux depuis minuit, la journée est en cours.' : 'Totaux sur 24 h, de minuit à minuit.'),
        head: k === 0 ? 'Aujourd’hui' : k === 1 ? 'Hier' : cap(dl.split(' ')[0]), date: k < 2 ? dl : dl.split(' ').slice(1).join(' '),
        t1: { v: sl ? dur(sl) : '—', hasS: !sl, s: 'pas encore noté', hasRows: !!sl, rows: !sl ? [] : [].concat(nSg.length ? [row('Nuit', nSg.length + ' / ' + dur(part(nSg)))] : [], [row('Siestes', pSg.length ? pSg.length + ' / ' + dur(part(pSg)) : 'aucune')]) },
        t2: { v: ml ? ml + '\\u00a0mL' : mk.length ? mk.length + ' repas' : '—', hasS: true, s: !mk.length ? 'pas encore noté' : ml ? [bib + (bib > 1 ? ' biberons' : ' biberon'), sein ? seinTxt : ''].filter(Boolean).join(' · ') : seinTxt, hasRows: !!bgA, rows: bgA ? [row('Mange toutes les', bgA)] : [] },
        t3: { v: aw.awake !== null ? dur(r5(aw.awake)) : '—', hasS: aw.awake === null, s: 'sommeil non noté', hasRows: !!(gA || aA), rows: [].concat(gA ? [row('Entre deux dodos', gA)] : [], aA ? [row('Après un repas', aA)] : []) },
      };
    });
`),
  t('résumé : détail Dodo', '<span class="lg-s">{{legCur.t1.s}}</span>', legRows('t1')),
  t('résumé : détail Repas', '<span class="lg-s">{{legCur.t2.s}}</span>', legRows('t2')),
  t('résumé : ligne Éveil', '<b class="lg-v fd">{{legCur.t2.v}}</b></div>', `<b class="lg-v fd">{{legCur.t2.v}}</b></div>
        <div class="lg-r"><i class="lg-k aw" aria-hidden="true"></i><span class="lg-m"><span class="lg-l">Éveil</span>${legRows('t3')}</span><b class="lg-v aw">{{legCur.t3.v}}</b></div>`),

  // Rythme › Semaine : sous la phrase du sommeil, l'éveil (mêmes mesures, moyennées sur les jours notés en entier)
  s('semaine : éveil', '    const wGrid = [1, 2, 3, 4, 5, 6, 7, 8].map(', `    const awW = okW.map((w) => awDay(27 - w.d));
    const awA = (f) => avgD(awW.flatMap(f).filter((v) => v !== null));
    const wkAw = { cls: 'wk-aw ' + (wMeal ? 'fd' : 'sl'), title: wMeal ? 'Fréquence des repas' : 'Éveil', rows: (wMeal ? [['Mange toutes les', awA((x) => x.bg)]] : [['Éveil par 24 h', awA((x) => [x.awake])], ['Entre deux dodos', awA((x) => x.gaps)], ['Après un repas', awA((x) => x.aft)]]).filter((r) => r[1] !== null).map((r) => ({ l: r[0], v: r[1] })) };
    wkAw.on = wkAw.rows.length > 0;
    const wGrid = [1, 2, 3, 4, 5, 6, 7, 8].map(`),
  // Rythme › Semaine (Dodo et Repas) : ligne de l'heure qui descend dans la journée, sur toute la largeur du graphe (NOW est rafraîchi toutes les 20 s)
  s('semaine : ligne de l’heure', "cls: 'wc-g' + (k % 2 ? '' : ' six') }));", "cls: 'wc-g' + (k % 2 ? '' : ' six') })).concat(wk.some((w) => w.today) ? [{ t: (Math.min(100, Math.max(0, (NOW - wk.find((w) => w.today).Dd) / 14.4))).toFixed(2), cls: 'wc-g wc-now' }] : []);"),
  s('semaine : éveil, valeur', "wkAvg: Object.assign({ hasV2: false, v2: '', t2: '' }, wkAvg),", "wkAw, wkAvg: Object.assign({ hasV2: false, v2: '', t2: '' }, wkAvg),"),
  t('semaine : éveil, gabarit', '<sc-if value="{{ wkHint }}" hint-placeholder-val="{{ false }}">', '<sc-if value="{{ wkAw.on }}" hint-placeholder-val="{{ false }}"><div class="{{wkAw.cls}}"><span class="wk-awt">{{wkAw.title}}</span><sc-for list="{{ wkAw.rows }}" as="q" hint-placeholder-count="3"><div class="wk-awr"><span>{{q.l}}</span><b>{{q.v}}</b></div></sc-for></div></sc-if>\n        <sc-if value="{{ wkHint }}" hint-placeholder-val="{{ false }}">'),

  // Rythme › Semaine › « Par rapport à la semaine d'avant » : les cartes avec des données d'abord (tri stable : sinon l'ordre d'origine)
  s('comparaison : cartes avec données d’abord', '    const cmpW = {\n      per:', "    // seules les cartes du choix Dodo / Repas de l'en-tête\n    cards.splice(0, cards.length, ...cards.filter((r) => r.cls.endsWith(wMeal ? ' fd' : ' sl')));\n    cards.forEach((r) => { if (r.b === '—') r.cls += ' none'; });\n    cards.sort((p, q) => (p.b === '—') - (q.b === '—'));\n    const cmpW = {\n      per:"),

  // Rythme › Semaine : toucher un créneau ouvre une feuille par le bas (au lieu d'une carte au-dessus du graphe)
  s('créneau de la semaine : feuille', "      this.setState({ wbsel: pick && pick.id !== wbsel ? pick.id : '' });", "      const nsel = pick && pick.id !== wbsel ? pick.id : '';\n      this.setState({ wbsel: nsel, sheet: nsel ? 'wdet' : null, err: null });"),
  s('créneau de la semaine : contenu', "const wDet = { on: false, kCls: '', l: '', v: '', w: '' };", "const wDet = { on: false, kCls: '', l: '', v: '', w: '', tone: 'sl', icon: '#i-moon', icCls: 'ic k-sleep', hasAct: false, act: null, actL: '' };"),
  s('créneau de la semaine : dodo', /w: when \+ hm\(x\.a\) \+ \(x\.run \? ' → maintenant' : ' → ' \+ hm\(x\.b\)\) \}\);/, "w: when + hm(x.a) + (x.run ? ' → maintenant' : ' → ' + hm(x.b)), hasAct: true, act: openDetail(x), actL: x.run ? 'Arrêter ou corriger' : 'Voir le détail' });"),
  s('créneau de la semaine : repas', 'w: when + hm(x.a) });', "w: when + hm(x.a), tone: 'fd', icon: '#i-milk', icCls: 'ic k-feed', hasAct: true, act: openEdit(x), actL: 'Modifier' });"),
  s('créneau de la semaine : titre', '    SH.wbb = {', "    SH.wdet = { title: wDet.l || 'Détail', icon: wDet.icon, icCls: wDet.icCls };\n    SH.wbb = {"),
  s('créneau de la semaine : drapeau', "isPJ: sheet === 'pjour',", "isPJ: sheet === 'pjour', isWdet: sheet === 'wdet',"),
  s('feuilles : fermer désélectionne le créneau', "close: () => this.setState({ sheet: null, f: null, err: null, saving: false }),", "close: () => this.setState({ sheet: null, f: null, err: null, saving: false, wbsel: '' }),"),
  t('créneau de la semaine : plus de carte au-dessus du graphe', /          <sc-if value="\{\{ wDet\.on \}\}"[\s\S]*?<\/sc-if>\n/, ''),
  t('détail du dodo : navigation, gabarit', '        <div class="dd">\n          <div class="dd-k"><span class="dd-chip">', `        <div class="dd" ref="{{ det.ref }}">
          <sc-if value="{{ det.hasNav }}" hint-placeholder-val="{{ false }}"><div class="dd-nav"><button class="dd-nb" type="button" disabled="{{det.noPrev}}" onClick="{{ det.prev }}" aria-label="Dodo précédent"><svg class="i sm" aria-hidden="true"><use href="#i-chevl"></use></svg>Précédent</button><span class="dd-pos">{{det.pos}}</span><button class="dd-nb" type="button" disabled="{{det.noNext}}" onClick="{{ det.next }}" aria-label="Dodo suivant">Suivant<svg class="i sm" aria-hidden="true"><use href="#i-chevr"></use></svg></button></div></sc-if>
          <div class="dd-k"><span class="dd-chip">`),
  t('créneau de la semaine : gabarit', '      <sc-if value="{{ sh.isDetail }}" hint-placeholder-val="{{ false }}">\n        <div class="dd"', `      <sc-if value="{{ sh.isWdet }}" hint-placeholder-val="{{ false }}">
        <div class="dd">
          <div class="dd-hero"><span class="dd-m"><b class="{{wDet.tone}} dd-v wd-v">{{wDet.v}}</b><span class="dd-r">{{wDet.w}}</span></span></div>
        </div>
      </sc-if>

      <sc-if value="{{ sh.isDetail }}" hint-placeholder-val="{{ false }}">
        <div class="dd"`),
  t('créneau de la semaine : bouton', '      <sc-if value="{{ sh.isDetail }}" hint-placeholder-val="{{ false }}"><button class="btn btn-s"', '      <sc-if value="{{ sh.isWdet }}" hint-placeholder-val="{{ false }}"><sc-if value="{{ wDet.hasAct }}" hint-placeholder-val="{{ false }}"><button class="btn btn-s" type="button" onClick="{{ wDet.act }}">{{wDet.actL}}</button></sc-if></sc-if>\n      <sc-if value="{{ sh.isDetail }}" hint-placeholder-val="{{ false }}"><button class="btn btn-s"'),

  // Fiche « Détail du dodo » : précédent / suivant entre les dodos (boutons, ou glisser à droite / à gauche)
  s('détail du dodo : navigation, valeurs', "edit: null, editL: 'Modifier ce sommeil', nap: false };", "edit: null, editL: 'Modifier ce sommeil', nap: false, hasNav: false, noPrev: true, noNext: true, prev: null, next: null, pos: '', ref: (el) => { this.ddBind(el); } };"),
  s('détail du dodo : navigation, calcul', "editL: isNap ? 'Modifier cette sieste' : 'Modifier ce sommeil', nap: isNap };", `editL: isNap ? 'Modifier cette sieste' : 'Modifier ce sommeil', nap: isNap };
      const dnI = SL.findIndex((z) => z.id === selE.id), dnP = dnI > 0 ? SL[dnI - 1] : null, dnN = dnI >= 0 && dnI < SL.length - 1 ? SL[dnI + 1] : null, dnDay = SL.filter((z) => Math.floor(z.a / 1440) === d0);
      Object.assign(det, { hasNav: dnI >= 0 && SL.length > 1, noPrev: !dnP, noNext: !dnN, prev: () => { if (dnP) this.setState({ selId: dnP.id }); }, next: () => { if (dnN) this.setState({ selId: dnN.id }); }, pos: dnDay.length > 1 ? dnDay.findIndex((z) => z.id === selE.id) + 1 + ' sur ' + dnDay.length + ' ce jour' : '' });
      this._ddNav = (dir) => { const t = dir < 0 ? dnP : dnN; if (t) this.setState({ selId: t.id }); };`),

  // « Cette nuit en détail » : une icône par ligne sur un fil, et les lignes qui s'écartent de l'habitude sont en couleur
  s('nuit en détail : repères', '    nv.hasHab = nv.rows.some((r) => !!r.h);', `    nv.hasHab = nv.rows.some((r) => !!r.h);
    const NVI = { 'Dernière sieste finie': ['#i-sun', 'k-calc'], 'Coucher': ['#i-moon', 'k-sleep'], 'Plus long sommeil': ['#i-clock', 'k-sleep'], 'Sommeil noté': ['#i-chart', 'k-sleep'], 'Réveils notés': ['#i-milk', 'k-feed'], 'Réveil du matin': ['#i-sun', 'k-calc'] };
    nv.rows.forEach((r) => { const q = NVI[r.l] || ['#i-moon', 'k-sleep']; r.icon = q[0]; r.icCls = 'sm4-i ' + q[1]; r.cls = 'nt-r' + (r.hasW && r.wCls === 'dx' ? ' diff' : ''); });`),
  t('nuit en détail : gabarit', /          <div class="dl">\n            <sc-if value="\{\{ nv\.hasHab \}\}"[\s\S]*?<\/sc-for>\n          <\/div>\n/, `${ntBlock()}`),

  // Rythme : le titre et la bascule Jour / Semaine restent en haut quand on défile (.rh, voir globals.css)
  t('rythme : le stepper rejoint l’en-tête', /    <div class="stepper">\n      <sc-if value="\{\{ isSem \}\}"[\s\S]*?<\/div>\n/, ''),
  t('rythme : en-tête fixe, début', '    <div class="top">\n      <div class="top-t"><span class="eyebrow">Rythme</span>', '    <div class="rh">\n    <div class="rh-f">\n    <div class="top">\n      <div class="top-t"><span class="eyebrow">Rythme</span>'),
  t('rythme : en-tête fixe, fin', 'onClick="{{ pvS.pick }}" aria-pressed="{{pvS.on}}">Semaine</button>\n    </div>\n', 'onClick="{{ pvS.pick }}" aria-pressed="{{pvS.on}}">Semaine</button>\n    </div>\n    <div class="stepper"><sc-if value="{{ isSem }}" hint-placeholder-val="{{ false }}"><button type="button" aria-label="{{pPrevL}}" onClick="{{ pPrev }}" disabled="{{pPrevDis}}"><svg class="i"><use href="#i-chevl"></use></svg></button></sc-if><b>{{pStepL}}</b><sc-if value="{{ isSem }}" hint-placeholder-val="{{ false }}"><button type="button" aria-label="{{pNextL}}" onClick="{{ pNext }}" disabled="{{pNextDis}}"><svg class="i"><use href="#i-chevr"></use></svg></button></sc-if></div>\n    </div>\n    <sc-if value="{{ isSem }}" hint-placeholder-val="{{ false }}"><div class="rh-x"><div class="col rh-q" style="gap: 2px"><b class="wk-q">{{wkQ}}</b><sc-if value="{{ hasWkSub }}" hint-placeholder-val="{{ false }}"><span class="sub">{{wkSub}}</span></sc-if></div><sc-if value="{{ isCal }}" hint-placeholder-val="{{ false }}"><div class="seg wk-sw" role="group" aria-label="Graphique"><button class="{{wsD.cls}}" type="button" onClick="{{ wsD.pick }}" aria-pressed="{{wsD.on}}"><svg class="i xs" aria-hidden="true"><use href="#i-moon"></use></svg>Dodo</button><button class="{{wsR.cls}}" type="button" onClick="{{ wsR.pick }}" aria-pressed="{{wsR.on}}"><svg class="i xs" aria-hidden="true"><use href="#i-milk"></use></svg>Repas</button></div></sc-if></div></sc-if>\n    </div>\n'),

  // Rythme › Jour : toute la vue se glisse pour changer de jour (voir jBind)
  s('jour : glisser partout', 'mainRef: (el) => { this._main = el; },', "mainRef: (el) => { this._main = el; this._jourOn = tab === 'pilotage' && pview === 'jour'; if (el) { this.jBind(el); el.style.touchAction = this._jourOn ? 'pan-y' : ''; } },"),

  // changer de page ramène toujours en haut : en plus de l'onglet, du jour et de Comprendre, la bascule Jour / Semaine de Rythme et Jour / Calendrier du Journal
  s('page : retour en haut', "+ '/' + (s.ni || 0);", "+ '/' + (s.ni || 0) + '/' + (s.pview || '') + (s.jview || '');"),

  // Rythme › Jour › « Nuit dernière » : le détail s'ouvre en popup sous l'en-tête (Jour / Semaine et date restent visibles) ;
  // on peut changer de jour (boutons ou glisser) sans fermer, la nuit affichée suit
  s('nuit popup : calcul', "    nv.rows.forEach((r) => { const q = NVI[r.l]", `    const nsh = {
      on: !!s.nopen && tab === 'pilotage' && pview === 'jour', style: 'top: ' + (s.ntop || 190) + 'px',
      close: set({ nopen: false }), noPrev: pDay >= 6, noNext: pDay === 0, prev: () => this._nNav && this._nNav(1), next: () => this._nNav && this._nNav(-1),
      ref: (el) => { this.nBind(el); },
    };
    this._nNav = (dir) => {
      const n = pDay + dir;
      if (n < 0 || n > 6) return;
      this._noTop = true;
      this.setState({ pday: n, csel: '' }, () => { const b = document.querySelector('.nsh-b, .fr-day'); if (b) b.scrollTop = 0; if (b && b.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) b.animate([{ transform: 'translateX(' + -dir * 36 + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)' }); });
    };
    nv.rows.forEach((r) => { const q = NVI[r.l]`),
  s('nuit popup : valeurs', 'legCur: legSlides[6 - pDay], legDots,', 'nsh, legCur: legSlides[6 - pDay], legDots,'),
  s('nuit popup : ouvrir', '      logout: () => P.store.logout(),\n', "      logout: () => P.store.logout(),\n      openNuit: () => { const h = document.querySelector('.rh'), ap = document.querySelector('.app'); this.setState({ nopen: true, ntop: h && ap ? Math.round(h.getBoundingClientRect().bottom - ap.getBoundingClientRect().top) : 190 }); },\n"),
  s('nuit popup : se ferme avec la bascule', "pvJ: { cls: pview === 'jour' ? 'on' : '', on: pview === 'jour', pick: set({ pview: 'jour' }) },", "pvJ: { cls: pview === 'jour' ? 'on' : '', on: pview === 'jour', pick: set({ pview: 'jour', nopen: false }) },"),
  s('nuit popup : glisser', '  componentWillUnmount() {', `  // glisser dans la popup de la nuit : jour précédent (vers la droite) ou suivant (vers la gauche)
  nBind(el) {
    if (!el || el._nb) return;
    el._nb = true;
    let x0 = 0, y0 = 0, id = null;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; id = e.pointerId; });
    el.addEventListener('pointerup', (e) => {
      if (id === null) return;
      id = null;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && this._nNav) this._nNav(dx > 0 ? 1 : -1);
    });
    el.addEventListener('pointercancel', () => { id = null; });
  }
  componentWillUnmount() {`),
  t('nuit popup : le bouton ouvre la popup', 'onClick="{{ toggleSteps }}" aria-expanded="{{stepsOpen}}"><span>Cette nuit en détail</span><svg class="i sm"><use href="#i-chevd"></use></svg></button>', 'onClick="{{ openNuit }}" aria-haspopup="dialog"><span>Cette nuit en détail</span><svg class="i sm"><use href="#i-chevr"></use></svg></button>'),
  t('nuit popup : plus de détail dans la carte', /      <sc-if value="\{\{ stepsOpen \}\}"[^\n]*\n        <div class="col" style="gap: 10px">\n          <div class="nt">[\s\S]*?<\/sc-for>\n          <\/div>\n        <\/div>\n      <\/sc-if>\n/, ''),
  t('nuit popup : gabarit', '<sc-if value="{{ toastOn }}" hint-placeholder-val="{{ false }}">', `<sc-if value="{{ nsh.on }}" hint-placeholder-val="{{ false }}">
  <section class="nsh" style="{{nsh.style}}" role="dialog" aria-label="{{nv.title}}">
    <span class="grab"></span>
    <div class="nsh-h"><span class="nc-ic"><svg class="i sm"><use href="#i-moon"></use></svg></span><span class="nc-t"><b class="h2">{{nv.title}}</b><span class="sub">{{nv.dates}}</span></span>
      <button class="x" type="button" aria-label="Fermer" onClick="{{ nsh.close }}"><svg class="i"><use href="#i-x"></use></svg></button></div>
    <div class="nsh-nav" role="group" aria-label="Changer de nuit">
      <button class="nsh-p" type="button" disabled="{{nsh.noPrev}}" onClick="{{ nsh.prev }}" aria-label="Nuit précédente"><svg class="i sm"><use href="#i-chevl"></use></svg><span>Nuit d’avant</span></button>
      <div class="lgc-dots ca-dots nsh-dots" role="group" aria-label="Choisir la nuit"><sc-for list="{{ legDots }}" as="x" hint-placeholder-count="7"><button class="{{x.cls}}" type="button" onClick="{{ x.pick }}" aria-label="{{x.aria}}" aria-pressed="{{x.on}}"></button></sc-for></div>
      <button class="nsh-p" type="button" disabled="{{nsh.noNext}}" onClick="{{ nsh.next }}" aria-label="Nuit suivante"><span>Nuit suivante</span><svg class="i sm"><use href="#i-chevr"></use></svg></button>
    </div>
    <div class="nsh-b" ref="{{ nsh.ref }}">
      <p class="ans">{{nv.sum}}</p>
      <sc-if value="{{ nv.hasSub }}" hint-placeholder-val="{{ false }}"><p class="sub" style="font-size: 13px">{{nv.sumSub}}</p></sc-if>
      <sc-if value="{{ nv.hasWarn }}" hint-placeholder-val="{{ false }}"><p class="sub" style="font-size: 13px">{{nv.warn}}</p></sc-if>
${ntBlock()}
    </div>
  </section>
</sc-if>

<sc-if value="{{ toastOn }}" hint-placeholder-val="{{ false }}">`),

  // ... et ils quittent le corps de la page
  t('semaine : la question rejoint l’en-tête', '        <div class="col" style="gap: 2px"><b class="wk-q">{{wkQ}}</b><sc-if value="{{ hasWkSub }}" hint-placeholder-val="{{ false }}"><span class="sub">{{wkSub}}</span></sc-if></div>\n        <sc-if value="{{ isBars }}"', '        <sc-if value="{{ isBars }}"'),
  t('semaine : Dodo / Repas rejoint l’en-tête', /          <div class="seg wk-sw" role="group" aria-label="Graphique">[\s\S]*?<\/div>\n/, ''),

  // toucher l'onglet déjà actif ramène en haut de la page
  s('onglets : retour en haut', "pick: () => this.setState({ tab: t[0], sub: t[0] === 'comprendre' ? 'home' : this.st().sub }) }));", "pick: () => { this.setState({ nopen: false }); if (tab === t[0]) { if (this._main) this._main.scrollTo({ top: 0, behavior: 'smooth' }); return; } this.setState({ tab: t[0], sub: t[0] === 'comprendre' ? 'home' : this.st().sub }); } }));"),

  // horloge de Rythme : le glisser pour changer de jour suit le doigt sans à-coup (transform seul, touch-action: pan-y, geste bref accepté),
  // et la nouvelle journée n'entre qu'une fois dessinée ; ddBind : glisser dans la fiche d'un dodo pour passer au suivant
  s('horloge : glisser fluide', /  clkBind\(el\) \{[\s\S]*?\n  cwBind\(el\) \{/, `  clkBind() {}
  // Rythme › Jour : glisser n'importe où change de jour, comme un carrousel sans indicateur. L'en-tête (titre, Jour / Semaine) reste en place :
  // seuls le jour, l'horloge et les cartes glissent. Au lâcher, une copie de l'ancien jour sort pendant que le nouveau entre (le rendu
  // se fait pendant que la copie glisse ; les transitions sont sur transform, donc fluides même si le rendu bloque le thread principal).
  jBind(el) {
    if (!el || el._jb) return;
    el._jb = true;
    let x0 = 0, y0 = 0, dx = 0, id = null, drag = false, raf = 0;
    const day = () => this.st().pday || 0;
    const mv = () => Array.from(el.children).filter((c) => !c.matches('.rh, .jv-old'));
    el.addEventListener('scroll', () => { el.classList.toggle('sc', el.scrollTop > 4); if (el.scrollTop > 4) { el.classList.add('scr'); clearTimeout(this._scrT); this._scrT = setTimeout(() => el.classList.remove('scr'), 200); } }, { passive: true });
    const jx = (px) => el.style.setProperty('--jx', px + 'px');
    let ov = null, dir = 0, back = 0, rubber = false, lx = 0, lt = 0, vel = 0;
    const clear = () => { el.classList.remove('jd', 'jt', 'jh'); el.style.removeProperty('--jx'); el.style.removeProperty('--jd'); if (ov) ov.remove(); ov = null; dir = 0; rubber = false; };
    // la copie du jour affiché, exactement là où il est : elle sort pendant que le vrai jour, déjà rendu, entre
    const copy = (offset) => {
      const kids = mv();
      if (!kids.length) return null;
      const o = document.createElement('div'), cs = getComputedStyle(el);
      o.className = 'jv-old';
      o.style.cssText = 'top:' + kids[0].offsetTop + 'px;width:' + el.clientWidth + 'px;padding:0 ' + cs.paddingLeft + ';gap:' + cs.rowGap;
      o.style.setProperty('--jo', offset + 'px');
      kids.forEach((k) => { const c = k.cloneNode(true); c.removeAttribute('id'); o.appendChild(c); });
      el.appendChild(o);
      return o;
    };
    const open = (d, target, offset, then) => {
      ov = copy(offset);
      if (!ov) return false;
      dir = d; back = day();
      el.classList.add('jd', 'jh');
      jx(offset - d * el.clientWidth);
      this._noTop = true;
      this.setState({ pday: target, csel: '' }, () => { el.classList.remove('jh'); if (then) then(); });
      return true;
    };
    const glide = (toNew, toOld, ms, done) => {
      el.style.setProperty('--jd', ms + 'ms');
      void el.offsetWidth;
      el.classList.add('jt'); ov.classList.add('jt');
      jx(toNew); ov.style.setProperty('--jo', toOld + 'px');
      setTimeout(done, ms + 40);
    };
    const finish = () => { clear(); this._anim = false; };
    // pastilles sous l'horloge : même glissement, le sens dit si on recule ou si on avance
    this._jGo = (k) => {
      if (this._anim || !this._jourOn || k === day()) return false;
      const d = k > day() ? 1 : -1, W = el.clientWidth;
      this._anim = true;
      if (!open(d, k, 0, () => glide(0, d * W, 320, finish))) { this._anim = false; return false; }
      return true;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this._jourOn || e.button !== 0 || this._anim || (e.target.closest && e.target.closest('input, select, textarea'))) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; id = e.pointerId; drag = false; lx = e.clientX; lt = e.timeStamp; vel = 0;
    });
    el.addEventListener('pointermove', (e) => {
      if (id === null || e.pointerId !== id) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!drag) { if (Math.abs(mx) < 10 || Math.abs(mx) < Math.abs(my) * 1.2) return; drag = true; try { el.setPointerCapture(id); } catch (_) { /* déjà relâché */ } el.classList.remove('jt'); }
      const dt = e.timeStamp - lt;
      if (dt > 0) { vel = 0.6 * ((e.clientX - lx) / dt) + 0.4 * vel; lx = e.clientX; lt = e.timeStamp; }
      // dès le premier geste, le jour voisin est là, collé au jour affiché, et suit le doigt
      if (!dir && !rubber) {
        const d = mx > 0 ? 1 : -1, next = day() + d;
        if (next < 0 || next > 6 || !open(d, next, mx)) { rubber = true; el.classList.add('jd'); }
      }
      dx = dir ? (dir > 0 ? Math.max(mx, 0) : Math.min(mx, 0)) : mx * 0.25;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (dir && ov) { jx(dx - dir * el.clientWidth); ov.style.setProperty('--jo', dx + 'px'); } else jx(dx);
      });
    });
    const end = () => {
      if (id === null) return;
      id = null;
      cancelAnimationFrame(raf);
      if (!drag) return;
      drag = false; this._ckMoved = true; setTimeout(() => { this._ckMoved = false; }, 0);
      if (!dir) { el.style.setProperty('--jd', '320ms'); void el.offsetWidth; el.classList.add('jt'); jx(0); setTimeout(clear, 340); return; }
      const W = el.clientWidth, d = dir, moved = Math.abs(dx), flick = vel * d > 0.35;
      this._anim = true;
      if (moved > W * 0.22 || flick) {
        // la durée suit la vitesse du doigt : le mouvement continue, il ne repart pas de zéro
        const ms = Math.round(Math.min(340, Math.max(200, (W - moved) / Math.max(Math.abs(vel), 1.1))));
        glide(0, d * W, ms, finish);
      } else {
        const ms = Math.round(Math.min(260, Math.max(160, moved / 1.1)));
        glide(-d * W, 0, ms, () => { this._noTop = true; this.setState({ pday: back, csel: '' }, finish); });
      }
      setTimeout(() => { if (this._anim) finish(); }, 1500);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', (e) => { if (this._ckMoved) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  ddBind(el) {
    if (!el || el._db) return;
    el._db = true;
    let x0 = 0, y0 = 0, id = null;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; id = e.pointerId; });
    el.addEventListener('pointerup', (e) => {
      if (id === null) return;
      id = null;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && this._ddNav) this._ddNav(dx < 0 ? 1 : -1);
    });
    el.addEventListener('pointercancel', () => { id = null; });
  }
  cwBind(el) {`),
  // Rythme › Semaine : la carte Éveil s'ouvre en feuille et dit les choses simplement
  // (« il se réveille, puis reste éveillé X avant son dodo suivant » / « il mange, puis reste éveillé X avant de s'endormir »), avec chaque jour
  s('semaine éveil : feuille, données', "    wkAw.on = wkAw.rows.length > 0;\n", `    wkAw.on = wkAw.rows.length > 0;
    wkAw.more = !wMeal;
    wkAw.open = wMeal ? () => {} : set({ sheet: 'weveil', err: null });
    const gA = awA((x) => x.gaps), aA = awA((x) => x.aft), tA = awA((x) => [x.awake]);
    const wAw = {};
    // son habitude de la semaine, la nuit ne comptant pas : sur tous les éveils de la journée (du réveil au dodo suivant) des jours notés en entier,
    // on regarde où tombe le repas : tout de suite (≤ 10 min après le réveil), juste avant le dodo (≤ 30 min), ou entre les deux, et combien de temps il reste éveillé
    const awDays = wk.filter((w) => w.d < 27).map((w) => dayOf(w.d)).filter((x) => x.complete);
    const awAll = [].concat.apply([], awDays.map((x) => {
      const bd = [x.wake].concat(x.naps.flatMap((z) => [z.a, z.b]), [x.bed]), out = [];
      for (let i = 0; i + 1 < bd.length; i += 2) out.push({ W: bd[i], S: bd[i + 1] });
      return out;
    }));
    const awInfo = awAll.map((q) => {
      const ms = FD.filter((f) => f.a >= q.W && f.a < q.S), a = ms.length ? ms[0].a - q.W : null, tail = ms.length ? q.S - ms[ms.length - 1].a : null;
      return { D: q.S - q.W, a, tail, kind: a === null ? 'none' : a <= 10 ? 'direct' : tail <= 30 ? 'fin' : 'milieu' };
    });
    const awOrd = ['direct', 'milieu', 'fin', 'none'], awCnt = {};
    awOrd.forEach((k) => { awCnt[k] = awInfo.filter((i) => i.kind === k).length; });
    wAw.has = awInfo.length >= 2;
    wAw.no = !wAw.has;
    const awKind = awOrd.slice().sort((p, q) => awCnt[q] - awCnt[p])[0], awOf = awInfo.filter((i) => i.kind === awKind);
    const aM = wAw.has && awKind !== 'none' ? r5(med(awOf.map((i) => i.a))) : 0, tM = wAw.has && awKind !== 'none' ? r5(med(awOf.map((i) => i.tail))) : 0, dM = wAw.has ? r5(med(awInfo.map((i) => i.D))) : 0;
    wAw.hero = !wAw.has ? { t1: '', v1: '', t2: '', h2: false, v2: '', t3: '' }
      : awKind === 'direct' ? { t1: 'Il se réveille, mange tout de suite, puis reste éveillé ', v1: dur(tM), t2: ' jusqu’au dodo.', h2: false, v2: '', t3: '' }
      : awKind === 'milieu' ? { t1: 'Il se réveille, reste éveillé ', v1: dur(aM), t2: ', mange, puis reste éveillé ', h2: true, v2: dur(tM), t3: ' jusqu’au dodo.' }
      : awKind === 'fin' ? { t1: 'Il se réveille, reste éveillé ', v1: dur(aM), t2: ', puis mange et s’endort juste après.', h2: false, v2: '', t3: '' }
      : { t1: 'Il se réveille, puis reste éveillé ', v1: dur(dM), t2: ' jusqu’au dodo (aucun repas noté).', h2: false, v2: '', t3: '' };
    wAw.lane = { hasS1: awKind === 'milieu' || awKind === 'fin', s1: Math.max(8, aM), l1: dur(aM), hasDot: awKind !== 'none', hasS2: awKind !== 'fin', s2: Math.max(8, awKind === 'none' ? dM : tM), l2: dur(awKind === 'none' ? dM : tM) };
    const awLab = { direct: 'Mange tout de suite', milieu: 'Reste éveillé un moment, puis mange', fin: 'Mange puis s’endort juste après', none: 'Aucun repas noté' };
    wAw.rows = awOrd.filter((k) => awCnt[k] > 0).map((k) => ({ cls: 'aw-r' + (k === awKind ? ' top' : ''), l: awLab[k], n: awCnt[k] + ' sur ' + awInfo.length, w: ((awCnt[k] / awInfo.length) * 100).toFixed(0) }));
    // l'habitude dominante reste visible ; les autres schémas et la base de calcul sont repliés
    wAw.top = wAw.rows.find((r) => r.cls.indexOf('top') >= 0) || { cls: 'aw-r', l: '', n: '', w: '0' };
    wAw.rest = wAw.rows.filter((r) => r !== wAw.top);
    wAw.hasRest = wAw.rest.length > 0;
    wAw.fragile = awDays.length < 3;
    wAw.basis = awDays.length ? 'Sur ' + awInfo.length + ' éveils de la journée, ' + awDays.length + (awDays.length > 1 ? ' jours notés en entier' : ' jour noté en entier') + (awDays.length < 3 ? ' : encore fragile' : '') + '.' : '';
`),
  s('semaine éveil : valeurs', 'wkAw, wkAvg:', 'wkAw, wAw, wkAvg:'),
  s('semaine éveil : feuille, titre', "    SH.wdet = {", "    SH.weveil = { title: 'Son temps d’éveil', icon: '#i-sun', icCls: 'ic k-calc' };\n    SH.wdet = {"),
  s('semaine éveil : feuille, drapeau', "isWdet: sheet === 'wdet',", "isWdet: sheet === 'wdet', isWeveil: sheet === 'weveil',"),
  t('semaine éveil : carte cliquable', '<div class="{{wkAw.cls}}"><span class="wk-awt">{{wkAw.title}}</span><sc-for list="{{ wkAw.rows }}" as="q" hint-placeholder-count="3"><div class="wk-awr"><span>{{q.l}}</span><b>{{q.v}}</b></div></sc-for></div>', '<button class="{{wkAw.cls}}" type="button" onClick="{{ wkAw.open }}"><span class="wk-awt"><span>{{wkAw.title}}</span><sc-if value="{{ wkAw.more }}" hint-placeholder-val="{{ true }}"><span class="wk-awm">Voir le détail<svg class="i xs" aria-hidden="true"><use href="#i-chevr"></use></svg></span></sc-if></span><sc-for list="{{ wkAw.rows }}" as="q" hint-placeholder-count="3"><div class="wk-awr"><span>{{q.l}}</span><b>{{q.v}}</b></div></sc-for></button>'),
  t('semaine éveil : feuille, gabarit', '      <sc-if value="{{ sh.isWdet }}" hint-placeholder-val="{{ false }}">\n        <div class="dd">\n          <div class="dd-hero"><span class="dd-m"><b class="{{wDet.tone}}', `      <sc-if value="{{ sh.isWeveil }}" hint-placeholder-val="{{ false }}">
        <div class="aw-sh">
          <sc-if value="{{ wAw.has }}" hint-placeholder-val="{{ true }}">
            <p class="aw-l">{{wAw.hero.t1}}<b>{{wAw.hero.v1}}</b>{{wAw.hero.t2}}<sc-if value="{{ wAw.hero.h2 }}" hint-placeholder-val="{{ false }}"><b>{{wAw.hero.v2}}</b>{{wAw.hero.t3}}</sc-if></p>
            <div class="aw-lane2">
              <span class="aw-z sun"><svg class="i xs" aria-hidden="true"><use href="#i-sun"></use></svg></span>
              <sc-if value="{{ wAw.lane.hasS1 }}" hint-placeholder-val="{{ false }}"><div class="aw-seg" style="flex: {{wAw.lane.s1}} 1 0"><span>{{wAw.lane.l1}}</span></div></sc-if>
              <sc-if value="{{ wAw.lane.hasDot }}" hint-placeholder-val="{{ true }}"><i class="aw-dot2"><svg class="i xs" aria-hidden="true"><use href="#i-milk"></use></svg></i></sc-if>
              <sc-if value="{{ wAw.lane.hasS2 }}" hint-placeholder-val="{{ true }}"><div class="aw-seg" style="flex: {{wAw.lane.s2}} 1 0"><span>{{wAw.lane.l2}}</span></div></sc-if>
              <span class="aw-z"><svg class="i xs" aria-hidden="true"><use href="#i-moon"></use></svg></span>
            </div>
            <div class="aw-top"><b>{{wAw.top.l}}</b><sc-if value="{{ wAw.fragile }}" hint-placeholder-val="{{ false }}"><em>encore fragile</em></sc-if><span>{{wAw.top.n}}</span></div>
            <details class="aw-more">
              <summary>Voir toutes ses habitudes</summary>
              <sc-for list="{{ wAw.rest }}" as="r" hint-placeholder-count="3"><div class="{{r.cls}}"><span class="aw-r1"><span>{{r.l}}</span><b>{{r.n}}</b></span><span class="aw-r2"><i style="width: {{r.w}}%"></i></span></div></sc-for>
              <p class="sub" style="font-size: 13px">{{wAw.basis}} « Tout de suite » : un repas dans les 10 min qui suivent le réveil. « Juste après » : le dodo vient dans les 30 min qui suivent le dernier repas. Les réveils de nuit ne comptent pas.</p>
            </details>
          </sc-if>
          <sc-if value="{{ wAw.no }}" hint-placeholder-val="{{ false }}"><p class="sub">Pas encore assez de journées notées en entier pour montrer ses habitudes.</p></sc-if>
        </div>
      </sc-if>

      <sc-if value="{{ sh.isWdet }}" hint-placeholder-val="{{ false }}">
        <div class="dd">
          <div class="dd-hero"><span class="dd-m"><b class="{{wDet.tone}}`),

  // Rythme › Jour : toucher un créneau de l'horloge l'affiche AU CENTRE de l'horloge (durée, heures, bouton) et on change de créneau depuis le centre :
  // deux flèches de chaque côté de la valeur, « 3 sur 6 » dessous, ou glisser au centre. Les créneaux défilent dans l'ordre du temps, et seulement ceux du jour affiché
  s('créneau : calcul', "    const suite = winP.map((w) => ({ t: w.t, lab: w.lab, tag: w.tag }));\n", `    const kTime = (k) => (k.kind === 'sl' ? Math.max(k.src.a, PS) : k.src.a);
    // le premier créneau est celui de minuit (le dodo qui traverse minuit, affiché à 0 h) ; seuls les créneaux du jour affiché défilent
    const kOrd = cItems.slice().sort((p, q) => kTime(p) - kTime(q)), kIx = kOrd.findIndex((k) => k.id === csel), kk = kIx >= 0 ? kOrd[kIx] : null;
    // sans créneau choisi, « plus tard » ouvre le premier (minuit) et « plus tôt » le dernier déjà commencé
    const kPast = pDay === 0 ? kOrd.filter((k) => kTime(k) <= NOW) : kOrd, kLast = kPast.length ? kOrd.indexOf(kPast[kPast.length - 1]) : kOrd.length - 1;
    this._kNav = (dir) => { const n = kk ? kIx + dir : dir > 0 ? 0 : kLast; if (kOrd.length && n >= 0 && n < kOrd.length) this.setState({ csel: kOrd[n].id }); };
    const kv = {
      on: kOrd.length > 0 && tab === 'pilotage' && pview === 'jour', pos: kk ? (kIx + 1) + ' sur ' + kOrd.length : '', ctr: 'ca-ctr' + (kOrd.length ? ' kn' : ''),
      noPrev: kk ? kIx <= 0 : false, noNext: kk ? kIx >= kOrd.length - 1 : false, prev: () => this._kNav && this._kNav(-1), next: () => this._kNav && this._kNav(1),
    };
    this._kOn = kv.on;
    const suite = winP.map((w) => ({ t: w.t, lab: w.lab, tag: w.tag }));
`),
  s('créneau : valeurs', 'wkAw, wAw, wkAvg:', 'wkAw, wAw, kv, wkAvg:'),
  s('créneau : glisser au centre', '  clkBind() {}\n', `  // Rythme › Jour : glisser au centre de l'horloge change de créneau (vers la droite : plus tôt, vers la gauche : plus tard)
  clkBind(el) {
    if (!el || el._kb) return;
    el._kb = true;
    let x0 = 0, y0 = 0, id = null;
    const inCtr = (e) => { const r = el.getBoundingClientRect(), k = r.width / 320, x = (e.clientX - r.left) / k - 160, y = (e.clientY - r.top) / k - 160; return Math.sqrt(x * x + y * y) < 82; };
    el.addEventListener('pointerdown', (e) => { if (!this._kOn || !this._kNav || !inCtr(e)) return; e.stopPropagation(); x0 = e.clientX; y0 = e.clientY; id = e.pointerId; });
    el.addEventListener('pointerup', (e) => { if (id === null) return; id = null; const dx = e.clientX - x0, dy = e.clientY - y0; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) this._kNav(dx > 0 ? -1 : 1); });
    el.addEventListener('pointercancel', () => { id = null; });
  }
`),
  t('créneau : flèches au centre de l’horloge', `      <div class="ca-ctr" aria-live="polite">
        <b class="{{clk.c1cls}}">{{clk.c1}}</b>
        <span>{{clk.c2}}</span>
`, `      <sc-if value="{{ kv.on }}" hint-placeholder-val="{{ false }}">
        <button class="ca-ar l" type="button" disabled="{{kv.noPrev}}" onClick="{{ kv.prev }}" aria-label="Créneau précédent"><svg class="i" aria-hidden="true"><use href="#i-chevl"></use></svg></button>
        <button class="ca-ar r" type="button" disabled="{{kv.noNext}}" onClick="{{ kv.next }}" aria-label="Créneau suivant"><svg class="i" aria-hidden="true"><use href="#i-chevr"></use></svg></button>
      </sc-if>
      <div class="{{kv.ctr}}" aria-live="polite">
        <b class="{{clk.c1cls}}">{{clk.c1}}</b>
        <span>{{clk.c2}}</span>
        <sc-if value="{{ kv.on }}" hint-placeholder-val="{{ false }}"><span class="ca-pos">{{kv.pos}}</span></sc-if>
`),
  // Rythme › Jour : un lien discret sous l'horloge « Voir la journée complète » ouvre la journée affichée en frise verticale simplifiée,
  // de son réveil à son coucher : heure à gauche, fil pointillé, soleil = réveil, capsule = dodo (durée à côté), pastille biberon = repas, lune = coucher
  s('frise : calcul', "    const suite = winP.map((w) => ({ t: w.t, lab: w.lab, tag: w.tag }));\n", `    const frD = 27 - pDay, frN = nightOf(frD), frN1 = nightOf(frD + 1);
    const frW = frN.st === 'ok' ? frN.wake : frD * 1440, frB = frN1.st !== 'absent' ? frN1.bed : pDay === 0 ? NOW : (frD + 1) * 1440;
    const frRows = [];
    if (frN.st === 'ok') frRows.push({ a: frW, k: 'w', lab: 'Réveil' });
    allSegsAbs.filter((x) => x.a > frW && x.a < frB).forEach((x) => {
      const m = x.a % 1440, l = (x.run ? NOW : x.b) - x.a;
      frRows.push({ a: x.a, k: 's', lab: m >= 1170 ? 'Dodo du soir' : m >= 420 ? 'Sieste' : 'Dodo', d: dur(l) + (x.run ? ' · en cours' : ''), h: Math.max(40, Math.round(l * 0.4) + 16) });
    });
    FD.filter((f) => f.a >= frW && f.a < frB).forEach((f) => { frRows.push({ a: f.a, k: 'f', lab: f.k === 'bib' ? f.ml + '\u00a0mL' : 'Tétée' }); });
    if (frN1.st !== 'absent') frRows.push({ a: frB, k: 'n', lab: 'Couché' });
    frRows.sort((p, q) => p.a - q.a || (p.k === 'w' ? -1 : q.k === 'w' ? 1 : 0));
    // comparatif avec la médiane des jours complets des 7 jours d'avant (2 jours minimum), mêmes lignes et mêmes écarts que « Cette nuit en détail »
    const frDay = dayOf(frD), frRef = win(Math.max(1, frD - 7), frD - 1).map(dayOf).filter((x) => x.complete);
    const frT = (a, b) => { const df = a - b; return Math.abs(df) < 15 ? 'comme d’habitude' : dur(r5(Math.abs(df))) + (df > 0 ? ' plus tard' : ' plus tôt'); };
    const frD2 = (a, b) => { const df = a - b; return Math.abs(df) < 15 ? 'comme d’habitude' : dur(r5(Math.abs(df))) + (df > 0 ? ' de plus' : ' de moins'); };
    const frC = (a, b) => (a === b ? 'comme d’habitude' : Math.abs(a - b) + (a > b ? ' de plus' : ' de moins'));
    const frOk = frRef.length >= 2, frDone = frDay.complete, NAF = 'non noté';
    const frRows2 = [
      { l: 'Réveil', icon: '#i-sun', a: frDay.wake !== null ? hm(frDay.wake) : NAF, h: frOk ? hm(r5(med(frRef.map((x) => x.wake - x.d * 1440)))) : '', w: frOk && frDay.wake !== null ? frT(frDay.wake - frD * 1440, r5(med(frRef.map((x) => x.wake - x.d * 1440)))) : '' },
      { l: 'Siestes', icon: '#i-moon', a: frDone || pDay > 0 ? String(frDay.naps.length) : frDay.naps.length + ' jusqu’ici', h: frOk ? String(Math.round(med(frRef.map((x) => x.naps.length)))) : '', w: frOk && frDone ? frC(frDay.naps.length, Math.round(med(frRef.map((x) => x.naps.length)))) : '' },
      { l: 'Sommeil de jour', icon: '#i-clock', a: frDone ? dur(r5(frDay.napsTotal)) : NAF, h: frOk ? dur(r5(med(frRef.map((x) => x.napsTotal)))) : '', w: frOk && frDone ? frD2(frDay.napsTotal, r5(med(frRef.map((x) => x.napsTotal)))) : '' },
      { l: 'Repas', icon: '#i-milk', a: frDay.dayFeeds.length ? String(frDay.dayFeeds.length) : NAF, h: frOk ? String(Math.round(med(frRef.map((x) => x.dayFeeds.length)))) : '', w: frOk && frDone ? frC(frDay.dayFeeds.length, Math.round(med(frRef.map((x) => x.dayFeeds.length)))) : '' },
      { l: 'Coucher', icon: '#i-moon', a: frDay.bed !== null ? hm(frDay.bed) : NAF, h: frOk ? hm(r5(med(frRef.map((x) => x.bed - x.d * 1440)))) : '', w: frOk && frDay.bed !== null ? frT(frDay.bed - frD * 1440, r5(med(frRef.map((x) => x.bed - x.d * 1440)))) : '' },
    ].map((r) => Object.assign(r, { icCls: 'sm4-i k-sleep', cls: 'nt-r', hasW: !!r.w, wCls: r.w === 'comme d’habitude' ? 'dl-same' : 'dx', hasI: !!r.w && r.w !== 'comme d’habitude', wi: /plus tard|de plus/.test(r.w) ? '#i-up' : '#i-down', h: r.a !== NAF && r.w && r.w !== 'comme d’habitude' ? r.h : '' }));
    // Siestes du jour comparées à la sieste habituelle du même rang (début habituel, durée médiane)
    const frNaps = typ.ok ? frDay.naps.map((x, i) => {
      const tz = typ.naps.find((z) => z.k === i), m = x.a % 1440, l = x.b - x.a;
      const w = tz ? (Math.abs(l - r5(tz.du)) < 15 ? 'comme d’habitude' : dur(r5(Math.abs(l - r5(tz.du)))) + (l > tz.du ? ' de plus' : ' de moins')) : 'une de plus que d’habitude';
      const late = tz && m > tz.hi + 10, early = tz && m < tz.lo - 10;
      const sub = late || early ? 'Endormi plus ' + (late ? 'tard' : 'tôt') + ' que d’habitude (' + hm(r5(tz.lo)) + ' – ' + hm(r5(tz.hi)) + ')' : '';
      return { l: (ORD[i] || (i + 1) + 'e') + ' sieste', a: hm(x.a) + ' · ' + dur(r5(l)), w, hasI: w !== 'comme d’habitude', wi: /de plus/.test(w) ? '#i-up' : '#i-down', wCls: w === 'comme d’habitude' ? 'dl-same' : 'dx', h: tz && w !== 'comme d’habitude' ? dur(r5(tz.du)) : '', sub, hasSub: !!sub };
    }) : [];
    frRows2.forEach((r) => { r.isNap = r.l === 'Siestes' && frOk && frDone && frNaps.length > 0; r.notNap = !r.isNap; });
    const frDiff = frRows2.filter((r) => r.hasI);
    const fr = {
      sum: !frDone ? 'Journée en cours : seul le réveil se compare.' : frDiff.length ? 'Une journée un peu différente de ses journées habituelles' : 'Une journée comme ses journées habituelles',
      sumSub: frDone && frDiff.length ? frDiff.map((r) => r.l + ' : ' + r.w).join(' · ') : '', hasSumSub: frDone && frDiff.length > 0,
      cmpO: !!s.frCmpO, cmpToggle: set({ frCmpO: !s.frCmpO }), napO: !!s.frNapO, napToggle: set({ frNapO: !s.frNapO }), naps: frNaps, napsN: frNaps.length + (frNaps.length > 1 ? ' siestes' : ' sieste'),
      cmpOn: frOk, cmpRows: frRows2, cmpSub: 'Médiane de ses ' + frRef.length + ' derniers jours complets (sur les 7 derniers).',
      open: set({ sheet: 'frise', err: null }), none: frRows.length === 0,
      rows: frRows.map((r) => ({ t: hm(r.a), isW: r.k === 'w', isF: r.k === 'f', isS: r.k === 's', isN: r.k === 'n', cls: 'fr-b ' + r.k, lab: r.lab, hasD: !!r.d, d: r.d || '', h: r.h || 40 })),
    };
    const suite = winP.map((w) => ({ t: w.t, lab: w.lab, tag: w.tag }));
`),
  s('frise : valeurs', 'wkAw, wAw, kv, wkAvg:', 'wkAw, wAw, kv, fr, wkAvg:'),
  s('frise : feuille, titre', "    SH.wdet = {", "    SH.frise = { title: cap(dLong(27 - pDay)), icon: '#i-clock', icCls: 'ic k-calc' };\n    SH.wdet = {"),
  s('frise : feuille, drapeau', "isWdet: sheet === 'wdet',", "isWdet: sheet === 'wdet', isFrise: sheet === 'frise',"),
  t('frise : lien discret sous l’horloge', '    <div class="lgc-dots ca-dots" role="group" aria-label="Choisir le jour">', `    <button class="fr-cta" type="button" onClick="{{ fr.open }}">Voir la journée complète<svg class="i xs" aria-hidden="true"><use href="#i-chevr"></use></svg></button>
    <div class="lgc-dots ca-dots" role="group" aria-label="Choisir le jour">`),
  t('frise : feuille, gabarit', '      <sc-if value="{{ sh.isWeveil }}" hint-placeholder-val="{{ false }}">', `      <sc-if value="{{ sh.isFrise }}" hint-placeholder-val="{{ false }}">
        <div class="fr" ref="{{ nsh.ref }}">
          <div class="nsh-nav fr-nav" role="group" aria-label="Changer de jour">
            <button class="nsh-p" type="button" disabled="{{nsh.noPrev}}" onClick="{{ nsh.prev }}" aria-label="Jour précédent"><svg class="i sm"><use href="#i-chevl"></use></svg><span>Jour d’avant</span></button>
            <div class="lgc-dots ca-dots nsh-dots" role="group" aria-label="Choisir le jour"><sc-for list="{{ legDots }}" as="x" hint-placeholder-count="7"><button class="{{x.cls}}" type="button" onClick="{{ x.pick }}" aria-label="{{x.aria}}" aria-pressed="{{x.on}}"></button></sc-for></div>
            <button class="nsh-p" type="button" disabled="{{nsh.noNext}}" onClick="{{ nsh.next }}" aria-label="Jour suivant"><span>Jour suivant</span><svg class="i sm"><use href="#i-chevr"></use></svg></button>
          </div>
          <div class="fr-day">
          <sc-if value="{{ fr.cmpOn }}" hint-placeholder-val="{{ true }}">
            <p class="fr-sum">{{fr.sum}}</p>
            <sc-if value="{{ fr.hasSumSub }}" hint-placeholder-val="{{ false }}"><p class="sub fr-cmp-s">{{fr.sumSub}}</p></sc-if>
            <button class="fr-fold" type="button" onClick="{{ fr.cmpToggle }}" aria-expanded="{{fr.cmpO}}"><span>Comparé à ses jours habituels</span><svg class="i sm" aria-hidden="true"><use href="#i-chevr"></use></svg></button>
            <sc-if value="{{ fr.cmpO }}" hint-placeholder-val="{{ false }}">
            <div class="nt fr-cmp">
              <div class="nt-hd"><span>Ce jour</span><span>Écart · médiane</span></div>
              <sc-for list="{{ fr.cmpRows }}" as="t" hint-placeholder-count="5">
                <sc-if value="{{ t.notNap }}" hint-placeholder-val="{{ true }}"><div class="{{t.cls}}"><span class="nt-i"><span class="{{t.icCls}}"><svg class="i sm" aria-hidden="true"><use href="{{t.icon}}"></use></svg></span></span><span class="nt-m"><small>{{t.l}}</small><b>{{t.a}}</b></span><span class="dl-w"><sc-if value="{{ t.hasW }}" hint-placeholder-val="{{ true }}"><span class="{{t.wCls}}"><sc-if value="{{ t.hasI }}" hint-placeholder-val="{{ true }}"><svg class="i xs" aria-hidden="true"><use href="{{t.wi}}"></use></svg></sc-if>{{t.w}}</span></sc-if><span class="dl-h">{{t.h}}</span></span></div></sc-if>
                <sc-if value="{{ t.isNap }}" hint-placeholder-val="{{ false }}"><button class="{{t.cls}} fr-rowbtn" type="button" onClick="{{ fr.napToggle }}" aria-expanded="{{fr.napO}}"><span class="nt-i"><span class="{{t.icCls}}"><svg class="i sm" aria-hidden="true"><use href="{{t.icon}}"></use></svg></span></span><span class="nt-m"><small>{{t.l}}</small><b>{{t.a}}</b></span><span class="dl-w"><sc-if value="{{ t.hasW }}" hint-placeholder-val="{{ true }}"><span class="{{t.wCls}}"><sc-if value="{{ t.hasI }}" hint-placeholder-val="{{ true }}"><svg class="i xs" aria-hidden="true"><use href="{{t.wi}}"></use></svg></sc-if>{{t.w}}</span></sc-if><span class="dl-h">{{t.h}}</span></span><svg class="i sm fr-rc" aria-hidden="true"><use href="#i-chevr"></use></svg></button></sc-if>
                <sc-if value="{{ t.isNap }}" hint-placeholder-val="{{ false }}">
                  <sc-if value="{{ fr.napO }}" hint-placeholder-val="{{ false }}">
                    <sc-for list="{{ fr.naps }}" as="n" hint-placeholder-count="3">
                      <div class="nt-r fr-nap"><span class="nt-m"><small>{{n.l}}</small><b>{{n.a}}</b><sc-if value="{{ n.hasSub }}" hint-placeholder-val="{{ false }}"><small class="fr-nsub">{{n.sub}}</small></sc-if></span><span class="dl-w"><span class="{{n.wCls}}"><sc-if value="{{ n.hasI }}" hint-placeholder-val="{{ true }}"><svg class="i xs" aria-hidden="true"><use href="{{n.wi}}"></use></svg></sc-if>{{n.w}}</span><span class="dl-h">{{n.h}}</span></span></div>
                    </sc-for>
                  </sc-if>
                </sc-if>
              </sc-for>
            </div>
            <p class="sub fr-cmp-s">{{fr.cmpSub}}</p>
            </sc-if>
          </sc-if>
          <sc-if value="{{ fr.none }}" hint-placeholder-val="{{ false }}"><p class="sub">Rien de noté ce jour-là.</p></sc-if>
          <sc-for list="{{ fr.rows }}" as="r" hint-placeholder-count="8">
            <div class="fr-r" style="min-height: {{r.h}}px">
              <span class="fr-t">{{r.t}}</span>
              <span class="fr-l">
                <sc-if value="{{ r.isW }}" hint-placeholder-val="{{ false }}"><i class="fr-n w"><svg class="i xs" aria-hidden="true"><use href="#i-sun"></use></svg></i></sc-if>
                <sc-if value="{{ r.isF }}" hint-placeholder-val="{{ false }}"><i class="fr-n f"><svg class="i xs" aria-hidden="true"><use href="#i-milk"></use></svg></i></sc-if>
                <sc-if value="{{ r.isN }}" hint-placeholder-val="{{ false }}"><i class="fr-n n"><svg class="i xs" aria-hidden="true"><use href="#i-moon"></use></svg></i></sc-if>
                <sc-if value="{{ r.isS }}" hint-placeholder-val="{{ false }}"><i class="fr-c"></i></sc-if>
              </span>
              <span class="{{r.cls}}"><b>{{r.lab}}</b><sc-if value="{{ r.hasD }}" hint-placeholder-val="{{ false }}"><em>{{r.d}}</em></sc-if></span>
            </div>
          </sc-for>
          </div>
        </div>
      </sc-if>

      <sc-if value="{{ sh.isWeveil }}" hint-placeholder-val="{{ false }}">`),
  // « Dernière sieste finie » : écart et habitude dès 2 journées complètes avec sieste (avant : 3), comme le reste de la fiche
  s('nuit : dernière sieste, seuil', 'const usNap = pDays.length >= 3 ?', 'const usNap = pDays.length >= 2 ?'),
  // Habitude de nuit dès 3 nuits complètes (demande de Victor, avant : 4) : alimente « Cette nuit en détail » et « Sa nuit type »
  s('nuit habituelle : seuil', 'if (ns.length < 4) return { ok: false, n: ns.length };', 'if (ns.length < 3) return { ok: false, n: ns.length };'),
  s('nuit type : message', "Sa nuit type se dessine à partir de 4 nuits notées en entier ; ", "Sa nuit type se dessine à partir de 3 nuits notées en entier ; "),
  // « Cette nuit en détail » : durée moyenne d'un cycle de sommeil de la nuit (comme dans la comparaison de la semaine, un cycle = une période de sommeil entre deux réveils
  // notés), comparée à la médiane des 7 nuits précédentes complètes (4 nuits minimum)
  s('nuit : durée moyenne d’un cycle', "    nv.rows = [\n", `    const nCycNs = win(Math.max(1, ND - 7), ND - 1).map(nightOf).filter((x) => x.st === 'ok');
    const cycMean = (c) => c.reduce((t, x) => t + x, 0) / c.length; // moyenne des cycles eux-mêmes ; l'habitude regroupe tous les cycles des nuits de référence (pas une médiane de moyennes par nuit)
    const nCyc = nCycNs.length >= 3 ? r5(cycMean(nCycNs.flatMap((x) => x.bl))) : null, nCycV = N.st === 'ok' ? r5(cycMean(N.bl)) : null;
    nv.rows = [
`),
  s('nuit : ligne cycle', "      { l: 'Réveil du matin', a: N.st === 'ok'", "      { l: 'Durée moyenne d’un cycle', a: nCycV !== null ? dur(nCycV) : NA, h: nCyc !== null ? dur(nCyc) : '', w: nCycV !== null && nCyc !== null ? cmpD(nCycV, nCyc) : '' },\n      { l: 'Réveil du matin', a: N.st === 'ok'"),
  s('nuit : icône du cycle', "'Réveil du matin': ['#i-sun', 'k-calc'] };", "'Durée moyenne d’un cycle': ['#i-clock', 'k-sleep'], 'Réveil du matin': ['#i-sun', 'k-calc'] };"),
  // le moteur (web/src/engine) décide des nuits, des journées et des liens ; l'écran garde ses objets et ses textes
  { name: 'moteur : nuits et journées', in: 'logic', find: /    \/\/ ---------- nuits et journées ----------[\s\S]*?(?=    \/\/ sur quoi repose une habitude)/, replace: `    // ---------- nuits et journées : calculées par le moteur ----------
    const CAL = P.store.engine.calendar({ origin: P.store.origin, now: NOW, events: evs, sleeps: SL, feeds: FD, running: run });
    const nightOf = CAL.nightOf, dayOf = CAL.dayOf;

` },
  s('moteur : sieste entre réveil et coucher', 'const m = a % 1440, isNap = m >= 420 && m < 1170, d0 = Math.floor(a / 1440);', 'const m = a % 1440, d0 = Math.floor(a / 1440), hDay = dayOf(d0), isNap = hDay.wake !== null && hDay.bed !== null ? a > hDay.wake && a < hDay.bed : m >= 420 && m < 1170;'),
  s('moteur : jour de chaque lien', 'lkR.push({ end: ln.b % 1440,', 'lkR.push({ d, end: ln.b % 1440,'),
  s('moteur : test des liens', `      let best = null, enough = false;
      fs.forEach((f) => {
        const A = rows.filter((x) => f.on(x)), B = rows.filter((x) => !f.on(x));
        if (A.length < 5 || B.length < 5) return;
        enough = true;
        os.forEach((o) => {
          const ma = med(A.map((x) => x[o.k])), mb = med(B.map((x) => x[o.k])), df = ma - mb;
          if (Math.abs(df) < o.min) return;`, `      let best = null, enough = false;
      const fkey = (f) => Object.keys(LFX).find((k) => LFX[k] === f);
      const kept = P.store.engine.links(rows, fs.map(fkey), os.map((o) => o.k));
      if (!kept) return { best, enough, n: rows.length };
      fs.forEach((f) => {
        const A = rows.filter((x) => f.on(x)), B = rows.filter((x) => !f.on(x));
        if (A.length < 5 || B.length < 5) return;
        enough = true;
        os.forEach((o) => {
          if (!kept.has(fkey(f) + '|' + o.k)) return;
          const ma = med(A.map((x) => x[o.k])), mb = med(B.map((x) => x[o.k])), df = ma - mb;
          if (Math.abs(df) < o.min) return;`),
  // prochain dodo : modèle de survie en test (décision de Victor, 2026-11-02), le reste de la suite vient des habitudes
  s('moteur : prochain dodo en test', '    let nx = { on: false };', `    const winsH = wins;
    const sv = run === null && lastSleep ? P.store.engine.nextSleep({ origin: P.store.origin, now: NOW, events: evs }) : null;
    if (sv) {
      const a = r5(sv.a), b = r5(sv.b);
      wins = [{ a, b, ts: (a === b ? hm(a) : hm(a) + '–' + hm(b)), t: 'S’endort généralement vers ' + (a === b ? hm(a) : hm(a) + '–' + hm(b)), bed: false, lab: 'Prochain dodo', tag: 'en test' }].concat(winsH.filter((w) => w.a > b));
    }
    let nx = { on: false };`),
  s('moteur : étiquette en test', "lab: w.bed ? 'Prochain dodo · le coucher' : 'Prochain dodo', win: w.t, tag: NOW >= w.a ? 'en ce moment' : 'estimé',", "lab: (w.bed ? 'Prochain dodo · le coucher' : 'Prochain dodo') + (w.tag === 'en test' ? ' · en test' : ''), win: w.t, tag: w.tag === 'en test' ? w.tag : 'estimé',"),
  t('moteur : texte des prochains dodos', 'Estimés d’après ses 7 derniers jours : un repère, pas un horaire à tenir.', 'Estimés d’après ses derniers jours : un repère, pas un horaire à tenir.'),
  // pastilles sous l'horloge : le jour glisse comme au doigt (pas dans la popup de nuit, où le changement reste immédiat)
  s('jour : pastilles animées', "pick: () => { this._noTop = true; this.setState({ pday: k, csel: '' }); } }));", "pick: () => { if (!this.st().nopen && !this.st().sheet && this._jGo && this._jGo(k)) return; this._noTop = true; this.setState({ pday: k, csel: '' }); } }));"),
  t('comparaison : nombre de cartes variable', 'faire glisser pour voir les 6 cartes', 'faire glisser pour voir les cartes'),
  s('comparaison : le carrousel repart du début', "wsD: { cls: wMeal ? '' : 'on', on: !wMeal, pick: set({ wsel: 'dodo' }) }, wsR: { cls: wMeal ? 'on' : '', on: wMeal, pick: set({ wsel: 'repas' }) },", "wsD: { cls: wMeal ? '' : 'on', on: !wMeal, pick: () => { if (this._cw) this._cw.scrollLeft = 0; this.setState({ wsel: 'dodo' }); } }, wsR: { cls: wMeal ? 'on' : '', on: wMeal, pick: () => { if (this._cw) this._cw.scrollLeft = 0; this.setState({ wsel: 'repas' }); } },"),
  // horloge Rythme, par défaut : l'heure, depuis quand il est éveillé et depuis quand il a mangé ; plus de créneau tant qu'on n'en touche pas un
  s('horloge Rythme : dernier repas au centre', "hasPill: run === null && winP.length > 0, pill: winP[0] ? 'Dodo · ' + winP[0].t : '',", "hasPill: pDay === 0 && !!lastFeed, pill: lastFeed ? 'a mangé ' + ago(lastFeed.a) : '',"),
  // un créneau de dodo à venir est la fourchette où il peut s'endormir, pas la durée du dodo : on le dit partout
  s('dodo : créneau = endormissement', "t: hm(a) + ' – ' + hm(b), bed: !!z.bed", "ts: (a === b ? hm(a) : hm(a) + '–' + hm(b)), t: 'S’endort généralement vers ' + (a === b ? hm(a) : hm(a) + '–' + hm(b)), bed: !!z.bed"),
  s('comprendre : siestes, endormissement', "'entre ' + hm(r5(z.lo)) + ' et ' + hm(r5(z.hi))", "'S’endort généralement vers ' + (r5(z.lo) === r5(z.hi) ? hm(r5(z.lo)) : hm(r5(z.lo)) + '–' + hm(r5(z.hi)))"),
  s('comprendre : coucher du soir, endormissement', "d: 'entre ' + hm(r5(bdR[0])) + ' et ' + hm(r5(bdR[1]))", "d: 'S’endort généralement vers ' + (r5(bdR[0]) === r5(bdR[1]) ? hm(r5(bdR[0])) : hm(r5(bdR[0])) + '–' + hm(r5(bdR[1])))"),
  s('comprendre : coucher de nuit, endormissement', "d: 'entre ' + hm(r5(UT.bedR[0])) + ' et ' + hm(r5(UT.bedR[1]))", "d: 'S’endort généralement vers ' + (r5(UT.bedR[0]) === r5(UT.bedR[1]) ? hm(r5(UT.bedR[0])) : hm(r5(UT.bedR[0])) + '–' + hm(r5(UT.bedR[1])))"),
  t('rythme : prochains dodos en deux niveaux', '<span class="t">{{w.t}}</span><span class="l">{{w.lab}}</span><span class="tg">{{w.tag}}</span>', '<span class="t"><small>{{w.lab}} · {{w.tag}}</small>{{w.t}}</span>', 2),
  s('horloge : créneau de dodo au centre', "c1: x.t, c2: x.lab + ' habituelle · ' + x.tag", "c1cls: 'sm win', c1: x.ts, c2: x.lab + '\\nS’endort généralement vers'"),
  s('horloge : créneau de dodo, accessibilité', "aria: w.lab + ' habituelle : ' + w.t + ', ' + w.tag", "aria: w.lab + ' : ' + w.t + ', ' + w.tag"),
  s('popup biberon : prochain dodo, heures', 'big = w.t; tagT = w.tag;', 'big = w.ts; tagT = w.tag;'),
  s('popup biberon : prochain dodo, phrase', "bigL: wins.length && wins[0].bed ? 'Prochain dodo probable · le coucher' : 'Prochain dodo probable'", "bigL: (wins.length && wins[0].bed ? 'Prochain dodo probable · le coucher' : 'Prochain dodo probable') + ' : s’endort généralement vers'"),
  s('dodo : plus de « en ce moment »', "tag: NOW >= a ? 'en ce moment' : z.few ? 'certains jours' : 'estimé'", "tag: z.few ? 'certains jours' : 'estimé'"),
  s('détail du dodo : plage d’endormissement', 'sa plage habituelle', 'sa plage d’endormissement habituelle', 4),
  // ---------------------------------------------------------------- Comprendre : la page native (maquettes/v7-comprendre/, voir src/comprendre/)
  t('comprendre : page native', /<sc-if value="\{\{ tabC \}\}" hint-placeholder-val="\{\{ false \}\}">[\s\S]*?(?=\n\n  <!-- JOURNAL -->)/, '<sc-if value="{{ tabC }}" hint-placeholder-val="{{ false }}">\n    <dc-import name="Comprendre" store="{{ cmpStore }}"></dc-import>\n  </sc-if>'),
  s('comprendre : le store pour la page native', "tabC: tab === 'comprendre',", "tabC: tab === 'comprendre', cmpStore: this.props.store,"),
  // ---------------------------------------------------------------- point sur l'onglet Comprendre : un badge pas encore vu sur cet appareil
  s('onglet Comprendre : badge pas encore vu', "const tabsL = TB.map((t) => ({ t: t[1],", "const embNew = (() => { try { const seen = JSON.parse(localStorage.getItem('canaille.emb.seen') || '[]'), st = this.props.store, all = [].concat(Array.isArray(st.shared.emb) ? st.shared.emb : [], Array.isArray(st.local.emb) ? st.local.emb : []); return all.some((e) => e && typeof e.key === 'string' && !e.hand && !e.hidden && seen.indexOf(e.key) < 0); } catch (e) { return false; } })();\n    const tabsL = TB.map((t) => ({ dot: t[0] === 'comprendre' && tab !== 'comprendre' && embNew, t: t[1],"),
  t('onglet Comprendre : le point', '<span class="pill"><svg class="i"><use href="{{t.icon}}"></use></svg></span>{{t.t}}', '<span class="pill"><svg class="i"><use href="{{t.icon}}"></use></svg><sc-if value="{{ t.dot }}" hint-placeholder-val="{{ false }}"><i class="tab-dot" role="img" aria-label="Nouveau badge"></i></sc-if></span>{{t.t}}'),
  // la fin du jour (19 h 30) est écrite à un seul endroit dans la logique ; dayEnd.test.ts vérifie qu'elle égale threshold('napDayEnd')
  { name: 'bornes : fin du jour nommée', in: 'logic', find: /\b1170\b/g, replace: 'NAP_END', count: 16 },
  { name: 'bornes : constante', in: 'logic', find: 'class Component extends DCLogic {', replace: 'const NAP_END = 1170;\nclass Component extends DCLogic {', count: 1 },
  // ---------------------------------------------------------------- Accueil : Filou en petit dans la carte « Maintenant »
  t('Accueil : Filou dans la carte Maintenant', `<div class="sit-h"><span>Maintenant</span>`, `<div class="sit-top"><div class="sit-h"><span>Maintenant</span>`),
  t('Accueil : Filou à droite', `</sc-if></span></sc-if></div>
          <p class="sit-big">{{sit.big}}</p>`, `</sc-if></span></sc-if></div><dc-import name="HomeFilou" situation="{{ foxS.sit }}" on-open="{{ foxS.open }}"></dc-import></div>
          <p class="sit-big">{{sit.big}}</p>`),
  s('Accueil : foxS dans les valeurs', "      pv, sit, td, hclk,", "      pv, sit, foxS, td, hclk,"),
  s('Accueil : pose de Filou et ouverture de Comprendre', `    // créneaux de dodo à venir : fourchettes habituelles (journée type), jamais un compte à rebours`, `    const foxS = { sit: run !== null ? (run % 1440 >= 1140 || run % 1440 < 300 ? 'night' : 'nap') : !evs.length ? 'none' : 'awake', open: () => { this.setState({ nopen: false }); this.setState({ tab: 'comprendre', sub: 'home' }); } };
    // créneaux de dodo à venir : fourchettes habituelles (journée type), jamais un compte à rebours`),
];

/** Les lignes de détail d'une carte du Résumé (Rythme › Jour) : une phrase quand il n'y a rien, sinon des lignes « intitulé · valeur ». */
function legRows(k) {
  return `<sc-if value="{{ legCur.${k}.hasS }}" hint-placeholder-val="{{ false }}"><span class="lg-s">{{legCur.${k}.s}}</span></sc-if><sc-if value="{{ legCur.${k}.hasRows }}" hint-placeholder-val="{{ false }}"><span class="lg-rows"><sc-for list="{{ legCur.${k}.rows }}" as="q" hint-placeholder-count="2"><span class="lg-q"><span class="lg-ql">{{q.l}}</span><b class="lg-qv">{{q.v}}</b><sc-if value="{{ q.hasS }}" hint-placeholder-val="{{ false }}"><span class="lg-qs">{{q.s}}</span></sc-if></span></sc-for></span></sc-if>`;
}






/** Les lignes de « Cette nuit en détail » (fil, icônes, écarts) : dans la popup de la nuit. */
function ntBlock() {
  return `          <div class="nt">
            <sc-if value="{{ nv.hasHab }}" hint-placeholder-val="{{ true }}"><div class="nt-hd"><span>Cette nuit</span><span>Écart · habitude</span></div></sc-if>
            <sc-for list="{{ nv.rows }}" as="t" hint-placeholder-count="6">
              <div class="{{t.cls}}"><span class="nt-i"><span class="{{t.icCls}}"><svg class="i sm" aria-hidden="true"><use href="{{t.icon}}"></use></svg></span></span><span class="nt-m"><small>{{t.l}}</small><b>{{t.a}}</b></span><span class="dl-w"><sc-if value="{{ t.hasW }}" hint-placeholder-val="{{ true }}"><span class="{{t.wCls}}"><sc-if value="{{ t.hasI }}" hint-placeholder-val="{{ true }}"><svg class="i xs" aria-hidden="true"><use href="{{t.wi}}"></use></svg></sc-if>{{t.w}}</span></sc-if><span class="dl-h">{{t.h}}</span></span></div>
            </sc-for>
          </div>
`;
}
