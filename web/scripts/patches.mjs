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
    wins.forEach((w, i) => { const q = pt((w.a + w.b) / 2, R); hcItems.push({ id: 'w' + i, kind: 'wn', x: q[0], y: q[1], icon: '#i-clock', src: w, aria: w.lab + ' habituelle : ' + w.t + ', ' + w.tag }); });
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
      hasPill: run === null && wins.length > 0, pill: wins[0] ? 'Dodo · ' + wins[0].t : '', hasAct: false, act: null, actL: '',
    };
    const hcItem = hcItems.find((k) => k.id === hcSel);
    if (hcItem) {
      hclk.hasPill = false;
      const x = hcItem.src;
      if (hcItem.kind === 'sl') { const m = x.a % 1440; Object.assign(hclk, { c1: dur((x.run ? NOW : x.b) - x.a), c2: x.run ? 'Dodo en cours depuis ' + hm(x.a) : (m >= 420 && m < 1170 ? 'Sieste' : 'Nuit') + ' · ' + hm(x.a) + ' → ' + hm(x.b), hasAct: true, act: openDetail(x), actL: x.run ? 'Arrêter ou corriger' : 'Voir le détail' }); }
      else if (hcItem.kind === 'fd') { Object.assign(hclk, { c1: x.k === 'bib' ? x.ml + '\\u00a0mL' : (x.dur ? x.dur + '\\u00a0min' : 'Tétée'), c2: (x.k === 'bib' ? 'Biberon' : 'Tétée ' + (SIDE[x.side] || '')) + ' · ' + hm(x.a), hasAct: true, act: openEdit(x), actL: 'Modifier' }); }
      else Object.assign(hclk, { c1cls: 'sm', c1: x.t, c2: x.lab + ' habituelle · ' + x.tag });
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
  t('logo : écrans d\'entrée', '<span class="logo"><svg class="i lg" style="color: var(--sage-x); width: 40px; height: 40px"><use href="#i-flower"></use></svg></span>', '<span class="logo"><img class="logo-img" src="/logo.svg" alt="Margherite"></span>', 2),
  t('logo : bouton de profil', 'aria-label="Profil et sauvegarde"><svg class="i sm"><use href="#i-flower"></use></svg></button>', 'aria-label="Profil et sauvegarde"><img class="pe-logo" src="/logo.svg" alt=""></button>'),

  // Journal tire-lait : le détail des heures de chaque tirage sous le total du jour
  // chaque ligne de jour montre la moyenne par tirage (et non le total du jour)
  s('journal tire-lait : moyenne par tirage', "totL: ps.length ? g + dd + '\\u00a0mL' : '—', sub: ps.length ? ps.length + (ps.length > 1 ? ' tirages' : ' tirage') + ' · gauche ' + g + ' · droite ' + dd : 'aucun tirage noté'", "totL: ps.length ? Math.round((g + dd) / ps.length) + '\\u00a0mL' : '—', sub: ps.length ? 'moy. par tirage · ' + ps.length + (ps.length > 1 ? ' tirages' : ' tirage') + ' · total ' + (g + dd) + '\u00a0mL' : 'aucun tirage noté'"),
  s('journal tire-lait : tirages du jour', 'return { k, n: ps.length, tot: g + dd,', "return { k, n: ps.length, list: ps.slice().sort((x, y) => y.a - x.a).map((p) => ({ t: hm(p.a), v: (p.g + p.d) + '\\u00a0mL', s: 'gauche ' + p.g + ' · droite ' + p.d })), tot: g + dd,"),
  t('journal tire-lait : lignes des tirages', '<span class="pj-m"><b>{{d.totL}}</b><small>{{d.sub}}</small></span></div>', '<span class="pj-m"><b>{{d.totL}}</b><small>{{d.sub}}</small></span></div><sc-for list="{{ d.list }}" as="p" hint-placeholder-count="3"><div class="pj-t"><span class="pj-th">{{p.t}}</span><span class="pj-ts">{{p.s}}</span><b>{{p.v}}</b></div></sc-for>'),

  // Rythme : « La suite probable » devient « Prochains dodos » (elle n'apparaît qu'aujourd'hui, avec 3 journées complètes notées)
  t('rythme : prochains dodos', '<h2 class="h2">La suite probable</h2>', '<h2 class="h2">Prochains dodos</h2>'),
  t('rythme : prochains dodos, sous-titre', 'Des fenêtres estimées d’après ses 7 derniers jours, pas un horaire à tenir.', 'Estimés d’après ses 7 derniers jours : un repère, pas un horaire à tenir.'),
  s('galerie : Maintenant', 'et la suite probable', 'et son prochain dodo'),

  // ---------------------------------------------------------------- retours de Victor (2026-11-01)
  // siestes rapprochées : deux siestes de jour séparées de 30 min au plus comptent pour une seule (20 min, puis 10 min après = 1 sieste).
  // La nuit n'est pas touchée : ses réveils comptent. Une sieste fusionnée garde l'id de sa première partie et la liste de ses parties (`parts`).
  s('siestes rapprochées : une seule sieste', "    const SL = evs.filter((e) => e.k === 'sleep');\n", `    // siestes de jour séparées d'au plus NAP_GAP min = une seule sieste (la nuit n'est pas fusionnée : ses réveils comptent)
    const NAP_GAP = 30, isNapAt = (x) => x.a % 1440 >= 420 && x.a % 1440 < 1170;
    const SL = evs.filter((e) => e.k === 'sleep').reduce((o, e) => {
      const p = o[o.length - 1];
      if (p && isNapAt(p) && isNapAt(e) && Math.floor(p.a / 1440) === Math.floor(e.a / 1440) && e.a - p.b <= NAP_GAP) o[o.length - 1] = Object.assign({}, p, { b: Math.max(p.b, e.b), parts: p.parts.concat([e.id]) });
      else o.push(Object.assign({}, e, { parts: [e.id] }));
      return o;
    }, []);
`),
  s('siestes rapprochées : retrouver une sieste', '    const findEv = (id) => evs.find((e) => e.id === id);', '    const findEv = (id) => SL.find((e) => e.id === id) || evs.find((e) => e.id === id);'),

  // Rythme › Jour › Résumé : Dodo = nuit et siestes « nombre / total », Repas = intervalle moyen entre biberons, nouvelle ligne Éveil
  s('résumé : éveil et détail du jour', /    const legSlides = \[6, 5, 4, 3, 2, 1, 0\]\.map\(\(k\) => \{[\s\S]*?\n    \}\);\n/, `    // éveil d’un jour (k jours en arrière) : temps éveillé, éveils entre deux dodos (réveils de nuit exclus), délai biberon → dodo suivant
    // (biberons de 7 h à 21 h, hors sommeil, dodo dans les 4 h), écarts entre biberons
    const isNapSeg = (x) => x.a % 1440 >= 420 && x.a % 1440 < 1170;
    const awDay = (k) => {
      const a0 = dStart(27 - k), a1 = dStart(28 - k), end = k === 0 ? NOW : a1;
      const sg = allSegsAbs.filter((x) => x.b > a0 && x.a < end).sort((x, y) => x.a - y.a);
      const slp = sg.reduce((n, x) => n + Math.min(x.b, end) - Math.max(x.a, a0), 0);
      const gaps = [], aft = [], bg = [];
      for (let i = 1; i < sg.length; i++) if (sg[i].a > sg[i - 1].b && (isNapSeg(sg[i - 1]) || isNapSeg(sg[i]))) gaps.push(sg[i].a - sg[i - 1].b);
      const bib = FD.filter((f) => f.k === 'bib' && f.a >= a0 && f.a < end);
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
      const part = (arr) => r5(arr.reduce((n, x) => n + Math.min(x.b, a1) - Math.max(x.a, a0), 0));
      const sl = part(sg), nSg = sg.filter((x) => !isNapSeg(x)), pSg = sg.filter(isNapSeg);
      const ml = mk.reduce((n, x) => n + (x.ml || 0), 0), sein = mk.filter((x) => x.k === 'sein').length, bib = mk.length - sein;
      const seinTxt = sein + (sein > 1 ? ' tétées' : ' tétée'), dl = dLong(27 - k);
      const aw = awDay(k), bgA = avgD(aw.bg), gA = avgD(aw.gaps), aA = avgD(aw.aft);
      const row = (l, v, s) => ({ l, v, s: s || '', hasS: !!s });
      return {
        head: k === 0 ? 'Aujourd’hui' : k === 1 ? 'Hier' : cap(dl.split(' ')[0]), date: k < 2 ? dl : dl.split(' ').slice(1).join(' '),
        t1: { v: sl ? dur(sl) : '—', hasS: !sl, s: 'pas encore noté', hasRows: !!sl, rows: !sl ? [] : [].concat(nSg.length ? [row('Nuit', nSg.length + ' / ' + dur(part(nSg)))] : [], [row('Siestes', pSg.length ? pSg.length + ' / ' + dur(part(pSg)) : 'aucune')]) },
        t2: { v: ml ? ml + '\\u00a0mL' : mk.length ? mk.length + ' repas' : '—', hasS: true, s: !mk.length ? 'pas encore noté' : ml ? [bib + (bib > 1 ? ' biberons' : ' biberon'), sein ? seinTxt : ''].filter(Boolean).join(' · ') : seinTxt, hasRows: !!bgA, rows: bgA ? [row('Un biberon toutes les', bgA)] : [] },
        t3: { v: aw.awake !== null ? dur(r5(aw.awake)) : '—', hasS: aw.awake === null, s: 'sommeil non noté', hasRows: !!(gA || aA), rows: [].concat(gA ? [row('Entre deux dodos', gA)] : [], aA ? [row('Après un biberon', aA)] : []) },
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
    const wkAw = { cls: 'wk-aw ' + (wMeal ? 'fd' : 'sl'), title: wMeal ? 'Fréquence des biberons' : 'Éveil', rows: (wMeal ? [['Mange toutes les', awA((x) => x.bg)]] : [['Éveil par 24 h', awA((x) => [x.awake])], ['Entre deux dodos', awA((x) => x.gaps)], ['Après un biberon', awA((x) => x.aft)]]).filter((r) => r[1] !== null).map((r) => ({ l: r[0], v: r[1] })) };
    wkAw.on = wkAw.rows.length > 0;
    const wGrid = [1, 2, 3, 4, 5, 6, 7, 8].map(`),
  s('semaine : éveil, valeur', "wkAvg: Object.assign({ hasV2: false, v2: '', t2: '' }, wkAvg),", "wkAw, wkAvg: Object.assign({ hasV2: false, v2: '', t2: '' }, wkAvg),"),
  t('semaine : éveil, gabarit', '<sc-if value="{{ wkHint }}" hint-placeholder-val="{{ false }}">', '<sc-if value="{{ wkAw.on }}" hint-placeholder-val="{{ false }}"><div class="{{wkAw.cls}}"><span class="wk-awt">{{wkAw.title}}</span><sc-for list="{{ wkAw.rows }}" as="q" hint-placeholder-count="3"><div class="wk-awr"><span>{{q.l}}</span><b>{{q.v}}</b></div></sc-for></div></sc-if>\n        <sc-if value="{{ wkHint }}" hint-placeholder-val="{{ false }}">'),

  // Rythme › Semaine › « Par rapport à la semaine d'avant » : les cartes avec des données d'abord (tri stable : sinon l'ordre d'origine)
  s('comparaison : cartes avec données d’abord', '    const cmpW = {\n      per:', "    cards.forEach((r) => { if (r.b === '—') r.cls += ' none'; });\n    cards.sort((p, q) => (p.b === '—') - (q.b === '—'));\n    const cmpW = {\n      per:"),

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
  t('nuit en détail : gabarit', /          <div class="dl">\n            <sc-if value="\{\{ nv\.hasHab \}\}"[\s\S]*?<\/sc-for>\n          <\/div>\n/, `          <div class="nt">
            <sc-if value="{{ nv.hasHab }}" hint-placeholder-val="{{ true }}"><div class="nt-hd"><span>Cette nuit</span><span>Écart · habitude</span></div></sc-if>
            <sc-for list="{{ nv.rows }}" as="t" hint-placeholder-count="6">
              <div class="{{t.cls}}"><span class="nt-i"><span class="{{t.icCls}}"><svg class="i sm" aria-hidden="true"><use href="{{t.icon}}"></use></svg></span></span><span class="nt-m"><small>{{t.l}}</small><b>{{t.a}}</b></span><span class="dl-w"><sc-if value="{{ t.hasW }}" hint-placeholder-val="{{ true }}"><span class="{{t.wCls}}"><sc-if value="{{ t.hasI }}" hint-placeholder-val="{{ true }}"><svg class="i xs" aria-hidden="true"><use href="{{t.wi}}"></use></svg></sc-if>{{t.w}}</span></sc-if><span class="dl-h">{{t.h}}</span></span></div>
            </sc-for>
          </div>
`),

  // Rythme › Jour : toute la vue se glisse pour changer de jour (voir jBind)
  s('jour : glisser partout', 'mainRef: (el) => { this._main = el; },', "mainRef: (el) => { this._main = el; this._jourOn = tab === 'pilotage' && pview === 'jour'; if (el) { this.jBind(el); el.style.touchAction = this._jourOn ? 'pan-y' : ''; } },"),

  // toucher l'onglet déjà actif ramène en haut de la page
  s('onglets : retour en haut', "pick: () => this.setState({ tab: t[0], sub: t[0] === 'comprendre' ? 'home' : this.st().sub }) }));", "pick: () => { if (tab === t[0]) { if (this._main) this._main.scrollTo({ top: 0, behavior: 'smooth' }); return; } this.setState({ tab: t[0], sub: t[0] === 'comprendre' ? 'home' : this.st().sub }); } }));"),

  // horloge de Rythme : le glisser pour changer de jour suit le doigt sans à-coup (transform seul, touch-action: pan-y, geste bref accepté),
  // et la nouvelle journée n'entre qu'une fois dessinée ; ddBind : glisser dans la fiche d'un dodo pour passer au suivant
  s('horloge : glisser fluide', /  clkBind\(el\) \{[\s\S]*?\n  cwBind\(el\) \{/, `  clkBind() {}
  // Rythme › Jour : glisser n'importe où change de jour, comme un carrousel sans indicateur. L'en-tête (titre, Jour / Semaine) reste en place :
  // seuls le jour, l'horloge et les cartes glissent. Au lâcher, une copie de l'ancien jour sort pendant que le nouveau entre (le rendu
  // se fait pendant que la copie glisse ; les transitions sont sur transform, donc fluides même si le rendu bloque le thread principal).
  jBind(el) {
    if (!el || el._jb) return;
    el._jb = true;
    let x0 = 0, y0 = 0, dx = 0, id = null, drag = false, t0 = 0, raf = 0;
    const day = () => this.st().pday || 0;
    const mv = () => Array.from(el.children).filter((c) => !c.matches('.top, .seg, .jv-old'));
    const jx = (px) => el.style.setProperty('--jx', px + 'px');
    const clear = () => { el.classList.remove('jd', 'jt', 'jh'); el.style.removeProperty('--jx'); const o = el.querySelector('.jv-old'); if (o) o.remove(); };
    el.addEventListener('pointerdown', (e) => {
      if (!this._jourOn || e.button !== 0 || this._anim || (e.target.closest && e.target.closest('input, select, textarea'))) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; id = e.pointerId; drag = false; t0 = e.timeStamp;
    });
    el.addEventListener('pointermove', (e) => {
      if (id === null || e.pointerId !== id) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!drag) { if (Math.abs(mx) < 10 || Math.abs(mx) < Math.abs(my) * 1.2) return; drag = true; try { el.setPointerCapture(id); } catch (_) { /* déjà relâché */ } el.classList.remove('jt'); el.classList.add('jd'); }
      dx = mx;
      const blocked = (dx > 0 && day() >= 6) || (dx < 0 && day() <= 0), px = blocked ? dx * 0.25 : dx;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => jx(px));
    });
    const end = (e) => {
      if (id === null) return;
      id = null;
      cancelAnimationFrame(raf);
      if (!drag) return;
      drag = false; this._ckMoved = true; setTimeout(() => { this._ckMoved = false; }, 0);
      const v = dx / Math.max(1, e.timeStamp - t0); // px/ms : un coup sec suffit même court
      const dir = dx > 70 || v > 0.5 ? 1 : dx < -70 || v < -0.5 ? -1 : 0; // 1 = jour précédent
      const next = day() + dir;
      if (!dir || next < 0 || next > 6) { el.classList.add('jt'); jx(0); setTimeout(clear, 300); return; }
      const W = el.clientWidth, kids = mv();
      if (!kids.length) { clear(); return; }
      this._anim = true;
      // la copie de l'ancien jour, exactement là où il est
      const ov = document.createElement('div'), cs = getComputedStyle(el);
      ov.className = 'jv-old';
      ov.style.cssText = 'top:' + kids[0].offsetTop + 'px;width:' + W + 'px;padding:0 ' + cs.paddingLeft + ';gap:' + cs.rowGap;
      ov.style.setProperty('--jo', dx + 'px');
      kids.forEach((k) => { const c = k.cloneNode(true); c.removeAttribute('id'); ov.appendChild(c); });
      el.appendChild(ov);
      el.classList.add('jh'); // l'ancien jour réel est masqué : seule la copie se voit
      void ov.offsetWidth;
      ov.classList.add('jt'); ov.style.setProperty('--jo', dir * W + 'px'); // la copie sort tout de suite
      this._noTop = true;
      this.setState({ pday: next, csel: '' }, () => {
        // après le rendu : le nouveau jour attend de l'autre côté, puis entre
        el.classList.remove('jt', 'jh'); jx(-dir * W); void el.offsetWidth;
        el.classList.add('jt'); jx(0);
        setTimeout(() => { clear(); this._anim = false; }, 320);
      });
      setTimeout(() => { if (this._anim) { clear(); this._anim = false; } }, 1500);
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
];

/** Les lignes de détail d'une carte du Résumé (Rythme › Jour) : une phrase quand il n'y a rien, sinon des lignes « intitulé · valeur ». */
function legRows(k) {
  return `<sc-if value="{{ legCur.${k}.hasS }}" hint-placeholder-val="{{ false }}"><span class="lg-s">{{legCur.${k}.s}}</span></sc-if><sc-if value="{{ legCur.${k}.hasRows }}" hint-placeholder-val="{{ false }}"><span class="lg-rows"><sc-for list="{{ legCur.${k}.rows }}" as="q" hint-placeholder-count="2"><span class="lg-q"><span class="lg-ql">{{q.l}}</span><b class="lg-qv">{{q.v}}</b><sc-if value="{{ q.hasS }}" hint-placeholder-val="{{ false }}"><span class="lg-qs">{{q.s}}</span></sc-if></span></sc-for></span></sc-if>`;
}





