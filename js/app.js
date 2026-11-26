/* Marchéo · application (navigation, vues, saisie). Calcul : calc.js ; données : donnees.js ; PDF : pdf.js */
(function () {
  'use strict';
  const D = window.Donnees, M = window.MDB;

  /* ================= Référentiels ================= */
  const ETAPES = [
    ['repere', 'Repéré'], ['visite', 'Visité'], ['etude', 'Étude'], ['offre', 'Offre envoyée'], ['compromis', 'Compromis'],
    ['acte', 'Acte signé'], ['chantier', 'Chantier'], ['vente', 'En vente'], ['vendu', 'Vendu'], ['ecarte', 'Écarté']
  ];
  const ETAPE = Object.fromEntries(ETAPES);
  const RANG = Object.fromEntries(ETAPES.map((e, i) => [e[0], i]));
  const ENGAGE = ['compromis', 'acte', 'chantier', 'vente']; // capital mobilisé sur l'enveloppe
  const PIECES = [
    ['diagnostics', 'Diagnostics techniques'], ['pv', "Procès-verbaux d'assemblée (3 dernières années)"], ['reglement', 'Règlement de copropriété'],
    ['tf', 'Avis de taxe foncière'], ['titre', 'Titre de propriété'], ['urbanisme', "Renseignements d'urbanisme"]
  ];
  const CATEGORIES = [['agent', 'Agent'], ['notaire', 'Notaire'], ['vendeur', 'Vendeur'], ['artisan', 'Artisan'], ['apporteur', 'Apporteur'], ['autre', 'Autre']];
  const CATEGORIE = Object.fromEntries(CATEGORIES);
  const TYPES_JOURNAL = [['visite', 'Visite'], ['appel', 'Appel'], ['offre', 'Offre'], ['contre', 'Contre-proposition'], ['note', 'Note']];
  const TYPE_JOURNAL = Object.fromEntries(TYPES_JOURNAL);
  const ETATS = { ok: ['vert', 'Objectif atteint'], juste: ['orange', 'Marge juste'], ko: ['rouge', 'Marge insuffisante'] };
  const REGLAGES_DEF = { id: 'reglages', enveloppe: 130000, taux: 4, obj: 10, part: 50, pfu: 31.4, dmax: 18, tvaT: 10, tvaMode: 'marge', seuilTravaux: 15, ref: { w: {}, x: {} }, theme: 'clair', criteres: null };

  /* ================= Outils ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = n => (isFinite(n) ? Math.round(n) : 0).toLocaleString('fr-FR') + ' €';
  const pc = (n, d = 1) => (isFinite(n) ? n * 100 : 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
  const nb = v => { const x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
  const aujourdhui = () => new Date().toISOString().slice(0, 10);
  const dateFr = d => d ? new Date(d + (d.length === 10 ? 'T12:00' : '')).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
  const clone = o => JSON.parse(JSON.stringify(o));
  const ico = p => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I = {
    annonces: ico('<path d="M4 4h16v13H7l-3 3z"/><path d="M8 9h8M8 13h5"/>'),
    tableau: ico('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
    biens: ico('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
    comparateur: ico('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    relances: ico('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M5 3 2 6M19 3l3 3"/>'),
    contacts: ico('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2"/>'),
    reperes: ico('<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="18" cy="18" r="2.5"/>'),
    reglages: ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    menu: ico('<path d="M3 6h18M3 12h18M3 18h18"/>'),
    loupe: ico('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    sortie: ico('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    fermer: ico('<path d="M18 6 6 18M6 6l12 12"/>'),
    retour: ico('<path d="M15 18l-6-6 6-6"/>')
  };
  const voyant = (couleur, texte) => `<span class="voyant voyant-${couleur}"><span class="pastille"></span>${esc(texte)}</span>`;
  const voyantEtat = e => voyant(ETATS[e][0], ETATS[e][1]);
  const ligneCompte = (l, v, o = {}) => `<div class="compte-ligne${o.total ? ' total' : ''}"><span>${l}${o.s ? `<small class="discret">${o.s}</small>` : ''}</span><b class="${o.c || ''}">${v}</b></div>`;
  const indic = (titre, valeur, o = {}) => `<${o.lien ? 'a href="' + o.lien + '"' : 'div'} class="indicateur${o.etat ? ' indicateur-' + o.etat : ''}"><div class="indicateur-texte"><div class="indicateur-titre">${titre}</div>${o.detail ? `<div class="indicateur-detail">${o.detail}</div>` : ''}</div><div class="indicateur-valeur ${o.c || ''}">${valeur}</div></${o.lien ? 'a' : 'div'}>`;

  function notifier(texte, type = '') {
    const zone = $('#notifications'), n = document.createElement('div');
    n.className = 'notification' + (type ? ' notification-' + type : ''); n.textContent = texte; zone.appendChild(n);
    setTimeout(() => { n.classList.add('sortie'); setTimeout(() => n.remove(), 350); }, 3200);
  }
  function modale(titre, corps, actions, surOuverture) {
    const fond = document.createElement('div'); fond.className = 'modale-fond';
    fond.innerHTML = `<div class="modale" role="dialog" aria-modal="true" aria-label="${esc(titre)}"><div class="modale-tete"><h2>${esc(titre)}</h2><button class="bouton-icone" data-fermer aria-label="Fermer">${I.fermer}</button></div><div class="modale-corps">${corps}</div><div class="modale-actions"></div></div>`;
    const fermer = () => fond.remove();
    (actions || []).forEach(a => { const b = document.createElement('button'); b.className = 'bouton ' + (a.classe || ''); b.textContent = a.l; b.onclick = () => { if (a.f && a.f(fond) === false) return; fermer(); }; $('.modale-actions', fond).appendChild(b); });
    fond.addEventListener('click', e => { if (e.target === fond || e.target.closest('[data-fermer]')) fermer(); });
    document.body.appendChild(fond); if (surOuverture) surOuverture(fond);
    const premier = $('input, select, textarea', fond); if (premier) premier.focus();
    return fond;
  }
  const confirmer = (texte, f) => modale('Confirmation', `<p>${esc(texte)}</p>`, [{ l: 'Annuler' }, { l: 'Confirmer', classe: 'bouton-principal', f }]);

  /* ================= Réglages, analyses ================= */
  function reglages() { return Object.assign(clone(REGLAGES_DEF), D.obtenir('reglages', 'reglages') || {}); }
  let refCle = '';
  function appliquerReperes() { const R = reglages(), k = JSON.stringify(R.ref || {}); if (k !== refCle) { M.setRef(R.ref); refCle = k; cacheAnalyse.clear(); } }

  /* État de simulation effectivement calculé : enveloppe commune, coût réel des travaux si demandé */
  function simEffective(b) {
    const R = reglages(), S = M.normalize(clone(b.sim || M.fresh()));
    S.env = R.enveloppe;
    S.trvReel = null;
    if (b.travaux && b.travaux.utiliserReel && (b.travaux.lignes || []).length) S.trvReel = M.totauxChantier(b.travaux.lignes, S.aleas, seuilTravaux(b)).reel;
    return S;
  }
  const seuilTravaux = b => (b.travaux && b.travaux.seuil != null) ? b.travaux.seuil : reglages().seuilTravaux;
  const cacheAnalyse = new Map();
  function analyse(b) {
    appliquerReperes();
    const R = D.obtenir('reglages', 'reglages'), k = b.id + '|' + b._maj + '|' + (R ? R._maj : '');
    if (cacheAnalyse.has(k)) return cacheAnalyse.get(k);
    const S = simEffective(b), A = M.analyse(S, b.comps || []);
    A.S = S; A.chantier = (b.travaux && b.travaux.lignes && b.travaux.lignes.length) ? M.totauxChantier(b.travaux.lignes, S.aleas, seuilTravaux(b)) : null;
    cacheAnalyse.set(k, A); return A;
  }
  const titreBien = b => (b.sim && b.sim.adresse) || 'Bien sans adresse';
  const typeBien = b => (M.TYPES[(b.sim || {}).type] || M.TYPES.appt).n;
  function surfaceBien(b) { const S = b.sim || {}; return S.type === 'box' ? S.pieces + ' boxes' : (S.surf || 0).toLocaleString('fr-FR') + ' m²'; }

  /* Enregistrement différé pendant la saisie */
  const minuteurs = {};
  function sauverPlusTard(coll, obj, delai = 500) { clearTimeout(minuteurs[obj.id]); minuteurs[obj.id] = setTimeout(() => { D.enregistrer(coll, obj); majNav(); }, delai); }
  function sauverMaintenant(coll, obj) { clearTimeout(minuteurs[obj.id]); D.enregistrer(coll, obj); majNav(); }

  /* ================= Navigation ================= */
  const MODULES = [
    { g: 'Pilotage', id: 'tableau', l: 'Tableau de bord', d: 'Pipeline, capital, alertes', i: I.tableau },
    { g: 'Acquisition', id: 'annonces', l: 'Annonces', d: 'Alertes e-mail analysées', i: I.annonces },
    { g: 'Acquisition', id: 'biens', l: 'Biens', d: 'Pipeline et fiches', i: I.biens },
    { g: 'Acquisition', id: 'comparateur', l: 'Comparateur', d: 'Deux à quatre biens', i: I.comparateur },
    { g: 'Suivi', id: 'relances', l: 'Relances', d: 'Aujourd\'hui et en retard', i: I.relances },
    { g: 'Suivi', id: 'contacts', l: 'Contacts', d: 'Agents, notaires, artisans', i: I.contacts },
    { g: 'Réglages', id: 'reperes', l: 'Repères', d: 'Prix unitaires des postes', i: I.reperes },
    { g: 'Réglages', id: 'reglages', l: 'Réglages', d: 'Paramètres et synchronisation', i: I.reglages }
  ];
  function route() { const h = location.hash.replace(/^#\/?/, '').split('/'); return { m: h[0] || 'tableau', id: h[1] || '', o: h[2] || '' }; }
  const aller = h => { location.hash = h; };

  function compteurs() {
    const t = aujourdhui(), rel = D.liste('relances').filter(r => !r.fait && r.date && r.date <= t);
    return { annonces: D.liste('annonces').filter(a => a.statutTri !== 'vue' && aExaminer(a)).length, relances: rel.length, retard: rel.some(r => r.date < t), biens: D.liste('biens').filter(b => b.etape !== 'ecarte' && b.etape !== 'vendu').length };
  }
  function majNav() {
    const r = route(), q = ($('#rechercheModule') || {}).value || '', C = compteurs();
    const mods = MODULES.filter(m => !q || (m.l + ' ' + m.d).toLowerCase().includes(q.toLowerCase()));
    let g = '', h = '';
    mods.forEach(m => {
      if (m.g !== g) { g = m.g; h += `<div class="nav-groupe">${esc(g)}</div>`; }
      const n = m.id === 'relances' ? C.relances : m.id === 'biens' ? C.biens : m.id === 'annonces' ? C.annonces : 0;
      const actif = r.m === m.id || (r.m === 'bien' && m.id === 'biens');
      h += `<a class="nav-lien${actif ? ' actif' : ''}" href="#/${m.id}"><span class="pastille-module">${m.i}</span><span class="nav-texte"><span class="nav-libelle">${esc(m.l)}</span><span class="nav-desc">${esc(m.d)}</span></span>${n ? `<span class="nav-compteur${m.id === 'relances' && C.retard ? ' alerte' : ''}">${n}</span>` : ''}</a>`;
    });
    $('#listeModules').innerHTML = h || '<div class="nav-vide">Aucun module</div>';
  }
  function titre(t, s, icone) { $('#titreModule').innerHTML = `<span class="pastille-module">${icone || ''}</span><span class="titre-texte"><strong>${esc(t)}</strong>${s ? `<small>${esc(s)}</small>` : ''}</span>`; }
  function majSynchro(e) {
    const z = $('#etatSynchro'); if (!z) return;
    if (e.mode === 'demo') { z.className = 'etat-synchro'; z.innerHTML = '<span class="pastille"></span><span>Démonstration</span>'; return; }
    z.className = 'etat-synchro' + (e.statut === 'attente' ? ' attente' : e.statut === 'erreur' ? ' erreur' : '');
    z.innerHTML = `<span class="pastille"></span><span>${esc(e.message || 'Synchronisé')}</span>`;
    z.title = e.message || '';
  }

  /* ================= Rendu principal ================= */
  let vueCourante = '';
  function afficher() {
    const r = route(), c = $('#contenu');
    $('.app').classList.remove('menu-ouvert');
    majNav();
    const cle = r.m + '/' + r.id + '/' + r.o;
    const garderDefilement = cle === vueCourante;
    vueCourante = cle;
    const y = c.scrollTop, yw = window.scrollY;
    try {
      ({ tableau: vueTableau, annonces: vueAnnonces, biens: vueBiens, bien: vueBien, comparateur: vueComparateur, relances: vueRelances, contacts: vueContacts, reperes: vueReperes, reglages: vueReglages }[r.m] || vueTableau)(c, r);
    } catch (e) { console.error(e); c.innerHTML = `<div class="alerte-bandeau">Erreur d'affichage : ${esc(e.message)}</div>`; }
    if (garderDefilement) { c.scrollTop = y; window.scrollTo(0, yw); } else { c.scrollTop = 0; window.scrollTo(0, 0); }
  }

  /* ================= Tableau de bord ================= */
  function vueTableau(c) {
    titre('Tableau de bord', 'Indicateurs calculés, sans saisie', I.tableau);
    const R = reglages(), biens = D.liste('biens'), t = aujourdhui();
    const parEtape = Object.fromEntries(ETAPES.map(e => [e[0], biens.filter(b => (b.etape || 'repere') === e[0])]));
    const engages = biens.filter(b => ENGAGE.includes(b.etape)), engage = engages.reduce((s, b) => s + analyse(b).r.treso, 0);
    const offres = parEtape.offre, journal = D.liste('journal');
    const montantOffre = b => { const o = journal.filter(j => j.bienId === b.id && (j.type === 'offre' || j.type === 'contre') && j.montant).sort((a, z) => (z.date || '').localeCompare(a.date || ''))[0]; return o ? o.montant : 0; };
    const rel = D.liste('relances').filter(x => !x.fait), duJour = rel.filter(x => x.date === t), retard = rel.filter(x => x.date && x.date < t);
    const depass = biens.filter(b => b.etape === 'chantier' && analyse(b).chantier && analyse(b).chantier.alerte);
    const actifs = biens.filter(b => !['ecarte', 'vendu'].includes(b.etape));
    const margeMoy = actifs.length ? actifs.reduce((s, b) => s + analyse(b).r.m, 0) / actifs.length : 0;
    const dispo = R.enveloppe - engage;
    c.innerHTML = `
      <div class="en-tete-page"><div><h1>Tableau de bord</h1><p>Au ${dateFr(t)} · enveloppe ${eur(R.enveloppe)}</p></div>
        <div class="actions"><button class="bouton bouton-principal" id="nouveauBien">+ Nouveau bien</button></div></div>
      <div class="indicateurs">
        ${indic('Dossiers actifs', actifs.length, { detail: biens.length + ' au total, ' + parEtape.ecarte.length + ' écartés', lien: '#/biens' })}
        ${indic('Offres en cours', offres.length, { detail: offres.length ? eur(offres.reduce((s, b) => s + montantOffre(b), 0)) + ' offerts' : 'aucune', lien: '#/biens' })}
        ${indic('Capital engagé', eur(engage), { detail: engages.length + ' opération(s), trésorerie maximale', etat: engage > R.enveloppe ? 'rouge' : '' })}
        ${indic('Capital disponible', eur(dispo), { detail: pc(R.enveloppe ? dispo / R.enveloppe : 0, 0) + ' de l\'enveloppe', etat: dispo < 0 ? 'rouge' : dispo < R.enveloppe * .2 ? 'orange' : 'vert', c: dispo < 0 ? 'rouge' : '' })}
        ${indic('Relances du jour', duJour.length, { detail: retard.length ? retard.length + ' en retard' : 'aucune en retard', etat: retard.length ? 'rouge' : '', lien: '#/relances' })}
        ${indic('Chantiers en dépassement', depass.length, { detail: depass.length ? depass.map(b => esc(titreBien(b))).join(', ') : 'aucun', etat: depass.length ? 'rouge' : '' })}
        ${(() => { const n = D.liste('annonces').filter(aExaminer).length; return indic('Annonces à examiner', n, { etat: n ? 'vert' : '', detail: n ? 'signalées par l\'analyse' : 'aucune pour l\'instant', lien: '#/annonces' }); })()}
        ${indic('Marge nette moyenne', pc(margeMoy), { detail: 'dossiers actifs, objectif ' + R.obj + ' %', etat: margeMoy >= R.obj / 100 ? 'vert' : 'orange' })}
      </div>
      <div class="deux-colonnes">
        <div class="carte"><h2>Dossiers par étape</h2>
          <div class="compte">${ETAPES.map(e => ligneCompte(`<a href="#/biens" data-filtre-etape="${e[0]}">${e[1]}</a>`, parEtape[e[0]].length + (ENGAGE.includes(e[0]) && parEtape[e[0]].length ? ' · ' + eur(parEtape[e[0]].reduce((s, b) => s + analyse(b).r.treso, 0)) : ''))).join('')}</div>
        </div>
        <div class="colonne">
          <div class="carte"><h2>À faire</h2>${listeRelances(retard.concat(duJour), true) || '<div class="vide">Rien d\'échu.</div>'}</div>
          <div class="carte"><h2>Prochaines actions</h2>${prochainesActions(actifs)}</div>
        </div>
      </div>`;
    $('#nouveauBien').onclick = nouveauBien;
    $$('[data-filtre-etape]', c).forEach(a => a.onclick = () => { filtres.etape = a.dataset.filtreEtape; });
    brancherRelances(c);
  }
  function prochainesActions(biens) {
    const l = biens.filter(b => b.prochaine && b.prochaine.action).sort((a, z) => (a.prochaine.date || '9').localeCompare(z.prochaine.date || '9')).slice(0, 8);
    if (!l.length) return '<div class="vide">Aucune action planifiée.</div>';
    const t = aujourdhui();
    return `<div class="compte">${l.map(b => ligneCompte(`<a href="#/bien/${b.id}">${esc(titreBien(b))}</a><small class="discret">${esc(b.prochaine.action)}</small>`, `<span class="${b.prochaine.date && b.prochaine.date < t ? 'rouge' : ''}">${dateFr(b.prochaine.date) || '—'}</span>`)).join('')}</div>`;
  }

  /* ================= Biens : liste et colonnes ================= */
  const filtres = { q: '', etape: '', type: '', vue: localStorage.getItem('marcheo-vue') || 'liste', tri: 'maj', sens: -1, ecartes: false };
  function vueBiens(c) {
    titre('Biens', 'Pipeline d\'acquisition', I.biens);
    c.innerHTML = `
      <div class="en-tete-page"><div><h1>Biens</h1></div><div class="actions">
        <div class="segments" role="group" aria-label="Affichage"><button data-vue="liste" aria-pressed="${filtres.vue === 'liste'}">Liste</button><button data-vue="colonnes" aria-pressed="${filtres.vue === 'colonnes'}">Colonnes</button></div>
        <button class="bouton bouton-principal" id="nouveauBien">+ Nouveau bien</button></div></div>
      <div class="barre-outils">
        <input type="search" id="fQ" placeholder="Rechercher : adresse, source…" value="${esc(filtres.q)}" aria-label="Rechercher">
        <select id="fEtape" aria-label="Étape"><option value="">Toutes les étapes</option>${ETAPES.map(e => `<option value="${e[0]}"${filtres.etape === e[0] ? ' selected' : ''}>${e[1]}</option>`).join('')}</select>
        <select id="fType" aria-label="Type"><option value="">Tous les types</option>${Object.entries(M.TYPES).map(([k, t]) => `<option value="${k}"${filtres.type === k ? ' selected' : ''}>${t.n}</option>`).join('')}</select>
        <label class="case"><input type="checkbox" id="fEcartes"${filtres.ecartes ? ' checked' : ''}> Afficher les écartés</label>
      </div>
      <div id="zoneBiens"></div>`;
    $('#nouveauBien').onclick = nouveauBien;
    $$('[data-vue]', c).forEach(b => b.onclick = () => { filtres.vue = b.dataset.vue; try { localStorage.setItem('marcheo-vue', filtres.vue); } catch (e) {} vueBiens(c); });
    $('#fQ').oninput = e => { filtres.q = e.target.value; zoneBiens(); };
    $('#fEtape').onchange = e => { filtres.etape = e.target.value; zoneBiens(); };
    $('#fType').onchange = e => { filtres.type = e.target.value; zoneBiens(); };
    $('#fEcartes').onchange = e => { filtres.ecartes = e.target.checked; zoneBiens(); };
    zoneBiens();
  }
  function biensFiltres() {
    const q = filtres.q.trim().toLowerCase();
    return D.liste('biens').filter(b => {
      if (filtres.etape && (b.etape || 'repere') !== filtres.etape) return false;
      if (!filtres.etape && !filtres.ecartes && b.etape === 'ecarte') return false;
      if (filtres.type && (b.sim || {}).type !== filtres.type) return false;
      if (q && !(titreBien(b) + ' ' + (b.source || '') + ' ' + ((b.prochaine || {}).action || '')).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  const COLONNES = [
    ['adresse', 'Bien', b => titreBien(b)], ['etape', 'Étape', b => RANG[b.etape || 'repere']], ['surface', 'Surface', b => (b.sim || {}).surf || 0],
    ['prix', 'Prix affiché', b => b.prixAffiche || 0], ['source', 'Source', b => b.source || ''], ['marge', 'Marge nette', b => analyse(b).r.m],
    ['action', 'Prochaine action', b => (b.prochaine || {}).date || '9999'], ['maj', 'Modifié', b => b._maj || '']
  ];
  function zoneBiens() {
    const z = $('#zoneBiens'); if (!z) return;
    const l = biensFiltres(), t = aujourdhui();
    if (filtres.vue === 'colonnes') {
      const etapes = ETAPES.filter(e => filtres.etape ? e[0] === filtres.etape : (e[0] !== 'ecarte' || filtres.ecartes));
      z.innerHTML = `<div class="colonnes">${etapes.map(e => { const bs = l.filter(b => (b.etape || 'repere') === e[0]); return `<div class="colonne-etape" data-etape="${e[0]}"><div class="colonne-tete"><span>${e[1]}</span><span>${bs.length}</span></div>${bs.map(b => { const A = analyse(b); return `<div class="fiche-mini" draggable="true" data-id="${b.id}"><strong>${esc(titreBien(b))}</strong><div class="ligne"><span>${esc(typeBien(b))} · ${surfaceBien(b)}</span><b>${eur(b.prixAffiche || A.r.achat)}</b></div><div class="ligne"><span>${b.prochaine && b.prochaine.date ? `<span class="${b.prochaine.date < t ? 'rouge' : ''}">${dateFr(b.prochaine.date)}</span>` : ''}</span><b class="${ETATS[A.etat][0]}">${pc(A.r.m)}</b></div></div>`; }).join('')}</div>`; }).join('')}</div>`;
      $$('.fiche-mini', z).forEach(f => {
        f.onclick = () => aller('#/bien/' + f.dataset.id);
        f.ondragstart = e => e.dataTransfer.setData('text/plain', f.dataset.id);
      });
      $$('.colonne-etape', z).forEach(col => {
        col.ondragover = e => { e.preventDefault(); col.classList.add('survol'); };
        col.ondragleave = () => col.classList.remove('survol');
        col.ondrop = e => { e.preventDefault(); col.classList.remove('survol'); const b = D.obtenir('biens', e.dataTransfer.getData('text/plain')); if (b) changerEtape(b, col.dataset.etape, zoneBiens); };
      });
      return;
    }
    const col = COLONNES.find(x => x[0] === filtres.tri) || COLONNES[7];
    l.sort((a, b) => { const x = col[2](a), y = col[2](b); return (x < y ? -1 : x > y ? 1 : 0) * filtres.sens; });
    if (!l.length) { z.innerHTML = '<div class="vide">Aucun bien ne correspond.</div>'; return; }
    const th = (k, lib, n) => `<th class="triable${n ? ' nombre' : ''}" data-tri="${k}">${lib}${filtres.tri === k ? (filtres.sens > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    z.innerHTML = `<div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr>${th('adresse', 'Bien')}${th('etape', 'Étape')}${th('surface', 'Surface', 1)}${th('prix', 'Prix affiché', 1)}${th('source', 'Source')}${th('marge', 'Marge nette', 1)}${th('action', 'Prochaine action')}</tr></thead><tbody>${l.map(b => {
      const A = analyse(b), p = b.prochaine || {};
      return `<tr class="cliquable" data-id="${b.id}"><td data-titre="Bien"><strong>${esc(titreBien(b))}</strong><span class="sous-ligne">${esc(typeBien(b))}${b.lien ? ` · <a href="${esc(b.lien)}" target="_blank" rel="noopener" data-stop>annonce</a>` : ''}</span></td><td data-titre="Étape"><span class="etiquette">${ETAPE[b.etape || 'repere']}</span>${b.etape === 'ecarte' && b.motif ? `<span class="sous-ligne">${esc(b.motif)}</span>` : ''}</td><td class="nombre" data-titre="Surface">${surfaceBien(b)}</td><td class="nombre" data-titre="Prix affiché">${b.prixAffiche ? eur(b.prixAffiche) : '—'}</td><td data-titre="Source">${esc(b.source || '')}</td><td class="nombre" data-titre="Marge nette">${voyant(ETATS[A.etat][0], pc(A.r.m))}<span class="sous-ligne">${eur(A.r.N)}</span></td><td data-titre="Prochaine action">${p.action ? `${esc(p.action)}<span class="sous-ligne ${p.date && p.date < t ? 'rouge' : ''}">${dateFr(p.date)}</span>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>`;
    $$('th[data-tri]', z).forEach(h => h.onclick = () => { if (filtres.tri === h.dataset.tri) filtres.sens *= -1; else { filtres.tri = h.dataset.tri; filtres.sens = 1; } zoneBiens(); });
    $$('tr[data-id]', z).forEach(tr => tr.onclick = e => { if (!e.target.closest('[data-stop]')) aller('#/bien/' + tr.dataset.id); });
  }

  function nouveauBien() {
    const R = reglages();
    modale('Nouveau bien', `<div class="grille-champs">
      <div class="champ large" style="grid-column:1/-1"><label for="nbAdr">Adresse ou référence</label><input id="nbAdr" autocomplete="off"></div>
      <div class="champ"><label for="nbType">Type</label><select id="nbType">${Object.entries(M.TYPES).map(([k, t]) => `<option value="${k}">${t.n}</option>`).join('')}</select></div>
      <div class="champ"><label for="nbPrix">Prix affiché (€)</label><input id="nbPrix" type="number" inputmode="numeric" min="0" step="1000"></div>
      <div class="champ"><label for="nbSurf">Surface (m²)</label><input id="nbSurf" type="number" inputmode="decimal" min="0"></div>
      <div class="champ"><label for="nbSource">Source</label><input id="nbSource" list="sources" placeholder="Leboncoin, agence…"></div>
      <div class="champ" style="grid-column:1/-1"><label for="nbLien">Lien de l'annonce</label><input id="nbLien" type="url" inputmode="url"></div></div>
      <datalist id="sources"><option>Leboncoin</option><option>SeLoger</option><option>Agence</option><option>Réseau direct</option><option>Apporteur</option><option>Notaire</option><option>Enchères</option></datalist>`,
      [{ l: 'Annuler' }, { l: 'Créer', classe: 'bouton-principal', f: f => {
        const type = $('#nbType', f).value, S = M.fresh(type);
        ['taux', 'obj', 'part', 'pfu', 'dmax', 'tvaT', 'tvaMode'].forEach(k => { if (R[k] != null) S[k] = R[k]; });
        S.adresse = $('#nbAdr', f).value.trim();
        const prix = nb($('#nbPrix', f).value), surf = nb($('#nbSurf', f).value);
        if (surf > 0) S.surf = surf;
        if (prix > 0) S.achat = prix;
        M.applyLevel(S);
        const b = D.enregistrer('biens', { etape: 'repere', source: $('#nbSource', f).value.trim(), lien: $('#nbLien', f).value.trim(), prixAffiche: prix, sim: S, comps: [], pieces: {}, liens: [], travaux: { lignes: [], utiliserReel: false }, creeLe: aujourdhui() });
        aller('#/bien/' + b.id + '/simulation');
      } }]);
  }
  function changerEtape(b, etape, apres) {
    const faire = motif => {
      const avant = b.etape; b.etape = etape; if (motif != null) b.motif = motif;
      sauverMaintenant('biens', b);
      D.enregistrer('journal', { bienId: b.id, date: aujourdhui(), type: 'note', texte: 'Étape : ' + ETAPE[avant || 'repere'] + ' → ' + ETAPE[etape] + (motif ? ' (' + motif + ')' : ''), auto: true });
      if (etape === 'chantier') synchroniserLignes(b, true);
      apres ? apres() : afficher();
    };
    if (etape === 'ecarte') {
      modale('Écarter le bien', `<div class="champ"><label for="motif">Motif</label><select id="motif"><option>Prix vendeur trop élevé</option><option>Marge insuffisante</option><option>Travaux trop lourds</option><option>Copropriété à risque</option><option>Bien vendu à un autre acquéreur</option><option>Urbanisme ou servitude</option><option>Autre</option></select></div><div class="champ"><label for="motifTxt">Précision</label><input id="motifTxt"></div>`,
        [{ l: 'Annuler' }, { l: 'Écarter', classe: 'bouton-principal', f: f => { const p = $('#motifTxt', f).value.trim(); faire($('#motif', f).value + (p ? ' : ' + p : '')); } }]);
    } else faire(null);
  }

  /* ================= Fiche bien ================= */
  const ONGLETS = [['synthese', 'Synthèse'], ['simulation', 'Simulation'], ['travaux', 'Travaux'], ['journal', 'Journal'], ['contacts', 'Contacts'], ['pieces', 'Pièces'], ['comparables', 'Comparables']];
  function vueBien(c, r) {
    const b = D.obtenir('biens', r.id);
    if (!b) { c.innerHTML = '<div class="vide">Bien introuvable. <a href="#/biens">Retour à la liste</a></div>'; return; }
    b.sim = M.normalize(b.sim); b.comps = b.comps || []; b.pieces = b.pieces || {}; b.liens = b.liens || []; b.travaux = b.travaux || { lignes: [], utiliserReel: false };
    const o = ONGLETS.some(x => x[0] === r.o) ? r.o : 'synthese', A = analyse(b);
    titre(titreBien(b), typeBien(b) + ' · ' + ETAPE[b.etape || 'repere'], I.biens);
    const courant = RANG[b.etape || 'repere'];
    c.innerHTML = `
      <div class="fiche-tete"><div><a class="bouton-lien" href="#/biens">${'‹'} Biens</a><h1>${esc(titreBien(b))}</h1><div class="sous">${esc(typeBien(b))} · ${surfaceBien(b)}${b.source ? ' · ' + esc(b.source) : ''}${b.lien ? ` · <a href="${esc(b.lien)}" target="_blank" rel="noopener">annonce</a>` : ''}</div></div>
        <div class="actions"><span id="enteteMarge">${voyantEtat(A.etat)}</span><button class="bouton bouton-petit" id="bPdf">PDF</button><button class="bouton bouton-petit" id="bDup">Dupliquer</button><button class="bouton bouton-petit bouton-danger" id="bSuppr">Supprimer</button></div></div>
      <div class="etapes" role="group" aria-label="Étape">${ETAPES.map((e, i) => `<button data-etape="${e[0]}" class="${e[0] === 'ecarte' ? 'ecarte ' : ''}${e[0] === (b.etape || 'repere') ? 'courante' : (b.etape !== 'ecarte' && i < courant ? 'passee' : '')}" aria-pressed="${e[0] === (b.etape || 'repere')}">${e[1]}</button>`).join('')}</div>
      ${b.etape === 'ecarte' && b.motif ? `<div class="info-bandeau">Écarté : ${esc(b.motif)}</div>` : ''}
      <nav class="onglets" role="tablist">${ONGLETS.map(x => `<button role="tab" class="${x[0] === o ? 'actif' : ''}" data-onglet="${x[0]}">${x[1]}${x[0] === 'journal' ? ' ' + compteJournal(b) : x[0] === 'pieces' ? ' ' + compteurPieces(b) : ''}</button>`).join('')}</nav>
      <div id="ongletContenu"></div>`;
    $$('[data-etape]', c).forEach(x => x.onclick = () => { if (x.dataset.etape !== b.etape) changerEtape(b, x.dataset.etape); });
    $$('[data-onglet]', c).forEach(x => x.onclick = () => aller('#/bien/' + b.id + '/' + x.dataset.onglet));
    $('#bPdf').onclick = () => pdf(b);
    $('#bDup').onclick = () => { const n = clone(b); delete n.id; delete n._maj; n.sim.adresse = (n.sim.adresse || '') + ' (copie)'; n.etape = 'etude'; const x = D.enregistrer('biens', n); aller('#/bien/' + x.id); };
    $('#bSuppr').onclick = () => confirmer('Supprimer définitivement ce bien, son journal et ses relances ?', () => {
      D.liste('journal').filter(j => j.bienId === b.id).forEach(j => D.supprimer('journal', j.id));
      D.liste('relances').filter(j => j.bienId === b.id).forEach(j => D.supprimer('relances', j.id));
      D.supprimer('biens', b.id); aller('#/biens');
    });
    const z = $('#ongletContenu');
    ({ synthese: ongletSynthese, simulation: ongletSimulation, travaux: ongletTravaux, journal: ongletJournal, contacts: ongletContacts, pieces: ongletPieces, comparables: ongletComparables }[o])(z, b);
  }
  const compteJournal = b => { const n = D.liste('journal').filter(j => j.bienId === b.id).length; return n ? `<small class="discret">${n}</small>` : ''; };
  const compteurPieces = b => `<small class="discret">${PIECES.filter(p => (b.pieces[p[0]] || {}).ok).length}/${PIECES.length}</small>`;
  function majEntete(b) { const e = $('#enteteMarge'); if (e) e.innerHTML = voyantEtat(analyse(b).etat); }

  /* ---------- Synthèse ---------- */
  function ongletSynthese(z, b) {
    const A = analyse(b), r = A.r, S = A.S, p = b.prochaine || {}, ctl = A.controles, ind = A.ind;
    const etatI = e => e === 'ok' ? 'vert' : e === 'juste' ? 'orange' : e === 'ko' ? 'rouge' : '';
    z.innerHTML = `
      ${A.chantier && A.chantier.alerte ? `<div class="alerte-bandeau">Travaux engagés : ${pc(A.chantier.depassement, 0)} au-dessus du budget (seuil ${seuilTravaux(b)} %).</div>` : ''}
      <div class="indicateurs">
        ${indic('Bénéfice net', eur(r.N), { c: r.N < 0 ? 'rouge' : '', detail: 'objectif ' + S.obj + ' % du coût de revient' })}
        ${indic('Marge nette', pc(r.m), { etat: ETATS[A.etat][0], c: ETATS[A.etat][0], detail: ETATS[A.etat][1] })}
        ${indic('Coût de revient', eur(r.C), { detail: r.reel ? 'travaux au coût réel' : 'travaux au budget' })}
        ${indic('Trésorerie maximale', eur(r.treso), { etat: ind.tresorerie.etat === 'ok' ? '' : 'rouge', detail: 'enveloppe ' + eur(S.env) })}
        ${indic('Prix d\'achat maximum', A.lim.achatMax ? eur(A.lim.achatMax) : 'aucun', { detail: 'pour ' + S.obj + ' % · achat simulé ' + eur(S.achat) })}
        ${indic('Contrôles', ctl.score + ' / 4', { etat: ctl.score === 4 ? 'vert' : ctl.score >= 2 ? 'orange' : 'rouge' })}
      </div>
      <div class="deux-colonnes">
        <div class="colonne">
          <div class="carte"><h2>Identification</h2><div class="grille-champs">
            <div class="champ" style="grid-column:1/-1"><label for="sAdr">Adresse ou référence</label><input id="sAdr" value="${esc(S.adresse)}"></div>
            <div class="champ"><label for="sPrix">Prix affiché (€)</label><input id="sPrix" type="number" inputmode="numeric" value="${b.prixAffiche || ''}"></div>
            <div class="champ"><label for="sSource">Source</label><input id="sSource" value="${esc(b.source || '')}" list="sources2"></div>
            <div class="champ" style="grid-column:1/-1"><label for="sLien">Lien de l'annonce</label><input id="sLien" type="url" value="${esc(b.lien || '')}"></div>
          </div><datalist id="sources2"><option>Leboncoin</option><option>SeLoger</option><option>Agence</option><option>Réseau direct</option><option>Apporteur</option><option>Notaire</option></datalist>
          <p class="aide">Type, surface, pièces, prix d'achat et revente se règlent dans l'onglet Simulation.</p></div>
          <div class="carte"><h2>Prochaine action</h2><div class="grille-champs">
            <div class="champ" style="grid-column:1/-1"><label for="pAct">Action</label><input id="pAct" value="${esc(p.action || '')}"></div>
            <div class="champ"><label for="pDate">Date</label><input id="pDate" type="date" value="${esc(p.date || '')}"></div>
            <div class="champ" style="justify-content:flex-end"><button class="bouton" id="pRel">Créer la relance</button></div></div></div>
          <div class="carte"><h2>Chiffres clés</h2><div class="compte">
            ${ligneCompte('Prix affiché', b.prixAffiche ? eur(b.prixAffiche) : '—')}
            ${ligneCompte('Prix d\'achat simulé, hors frais d\'agence', eur(r.achat), { s: b.prixAffiche ? 'négociation ' + pc(1 - r.achat / b.prixAffiche, 0) + ' sur le prix affiché' : '' })}
            ${ligneCompte('Notaire et agence à l\'achat', eur(r.acq))}
            ${ligneCompte('Travaux hors taxes', eur(r.T), { s: r.reel ? 'coût réel du chantier' : 'budget, aléas compris' })}
            ${ligneCompte('Frais annexes et prestations', eur(r.anx + r.agV + r.mis))}
            ${ligneCompte('Coût de revient', eur(r.C), { total: 1 })}
            ${ligneCompte('Revente souhaitée', eur(r.vente), { s: A.quartier.vise ? 'prix du quartier ' + eur(A.quartier.vise) : '' })}
            ${ligneCompte('Bénéfice net', eur(r.N) + ' · ' + pc(r.m), { total: 1, c: ETATS[A.etat][0] })}
            ${ligneCompte('Net de l\'associé opérateur', eur(A.partage.operateur.net))}
            ${ligneCompte('Revenus nets de l\'associé investisseur', eur(A.partage.investisseur.net), { s: pc(A.partage.investisseur.rendementAn) + ' par an' })}
          </div></div>
        </div>
        <div class="colonne">
          <div class="carte"><h2>Contrôles avant décision</h2>
            <div class="score"><b class="${ctl.score === 4 ? 'vert' : 'rouge'}">${ctl.score}</b><span class="discret">/ 4 validés</span></div>
            ${ctl.liste.map(x => `<div class="controle">${voyant(x.ok ? 'vert' : 'rouge', x.ok ? 'Oui' : 'Non')}<span>${esc(x.l)}${x.k === 'comps' ? ` <small class="discret">(${x.v})</small>` : x.k === 'marge' ? ` <small class="discret">(${pc(r.m)})</small>` : x.k === 'duree' ? ` <small class="discret">(${S.duree} mois)</small>` : ''}</span></div>`).join('')}
            <div class="grille-champs" style="margin-top:.8rem">
              <div class="champ"><label for="cAbf">Zone ABF</label><select id="cAbf">${['', 'Oui', 'Non', 'À vérifier'].map(v => `<option value="${v}"${S.abf === v ? ' selected' : ''}>${v || 'Choisir'}</option>`).join('')}</select></div>
              <div class="champ"><label for="cPre">Zone de préemption</label><select id="cPre">${['', 'Oui', 'Non', 'À vérifier'].map(v => `<option value="${v}"${S.preempt === v ? ' selected' : ''}>${v || 'Choisir'}</option>`).join('')}</select></div>
            </div></div>
          <div class="carte"><h2>Indicateurs</h2><div class="compte">
            ${ligneCompte('Décote achat / revente', `<span class="${etatI(ind.decote.etat)}">${pc(ind.decote.v, 0)}</span>`, { s: 'repère : 40 % ou plus' })}
            ${ind.ecartQuartier.v != null ? ligneCompte('Revente / prix du quartier', `<span class="${etatI(ind.ecartQuartier.etat)}">${(ind.ecartQuartier.v >= 0 ? '+ ' : '− ') + pc(Math.abs(ind.ecartQuartier.v))}</span>`, { s: 'marge au prix du quartier : ' + pc(ind.ecartQuartier.margeAuQuartier) }) : ''}
            ${ligneCompte('Marge de négociation', `<span class="${etatI(ind.negociation.etat)}">${eur(ind.negociation.v)}</span>`, { s: 'écart au prix d\'achat maximum' })}
            ${ligneCompte('Travaux', eur(ind.travauxU.v) + (S.type === 'box' ? ' /box' : ' /m²'), { s: pc(ind.travauxPart.v, 0) + ' du coût de revient' })}
            ${ligneCompte('Écart du budget aux repères', `<span class="${etatI(ind.ecartRepere.etat)}">${(ind.ecartRepere.v >= 0 ? '+ ' : '− ') + pc(Math.abs(ind.ecartRepere.v), 0)}</span>`, { s: ind.ecartRepere.etat ? 'sous les repères : devis signés à obtenir' : '' })}
            ${ligneCompte('Baisse de revente supportable', pc(Math.max(0, ind.baisseObjectif.v)), { s: 'avant de passer sous l\'objectif · ' + pc(Math.max(0, ind.baissePerte.v)) + ' avant la perte' })}
            ${ligneCompte('Coût d\'un mois de retard', eur(ind.coutMois.v), { s: A.lim.retard < 0 ? 'objectif non atteint' : 'retard supportable : ' + (A.lim.retard >= 36 ? 'plus de 36' : A.lim.retard) + ' mois' })}
            ${ind.fiscaliteMarge.v != null ? ligneCompte('TVA et IS sur la marge brute', pc(ind.fiscaliteMarge.v, 0)) : ''}
            ${ligneCompte('Reste dans l\'enveloppe', `<span class="${ind.tresorerie.etat === 'ok' ? '' : 'rouge'}">${eur(ind.tresorerie.reste)}</span>`)}
            ${ind.alertesType.map(a => ligneCompte('<span class="orange">Point de vigilance</span>', '', { s: esc(a) })).join('')}
            ${S.abf === 'Oui' ? ligneCompte('<span class="orange">Zone ABF</span>', '', { s: 'accord requis sur les travaux visibles, délais allongés' }) : ''}
            ${S.preempt === 'Oui' ? ligneCompte('<span class="orange">Zone de préemption</span>', '', { s: 'délai de réponse de la mairie à prévoir' }) : ''}
          </div></div>
          ${A.chantier ? `<div class="carte"><h2>Chantier</h2><div class="compte">${ligneCompte('Avancement', pc(A.chantier.avancement, 0))}${ligneCompte('Engagé / budget', eur(A.chantier.engage) + ' / ' + eur(A.chantier.budget), { c: A.chantier.alerte ? 'rouge' : '' })}${ligneCompte('Reste à payer', eur(A.chantier.reste))}</div></div>` : ''}
        </div>
      </div>`;
    const sauver = () => { sauverPlusTard('biens', b); };
    $('#sAdr').oninput = e => { b.sim.adresse = e.target.value; sauver(); };
    $('#sPrix').oninput = e => { b.prixAffiche = nb(e.target.value); sauver(); };
    $('#sSource').oninput = e => { b.source = e.target.value; sauver(); };
    $('#sLien').oninput = e => { b.lien = e.target.value.trim(); sauver(); };
    $('#pAct').oninput = e => { b.prochaine = Object.assign(b.prochaine || {}, { action: e.target.value }); sauver(); };
    $('#pDate').onchange = e => { b.prochaine = Object.assign(b.prochaine || {}, { date: e.target.value }); sauver(); };
    $('#pRel').onclick = () => { const p = b.prochaine || {}; if (!p.action) { notifier('Saisir d\'abord l\'action.', 'erreur'); return; } D.enregistrer('relances', { date: p.date || aujourdhui(), objet: p.action, bienId: b.id, fait: false }); notifier('Relance créée.', 'succes'); majNav(); };
    $('#cAbf').onchange = e => { b.sim.abf = e.target.value; sauverMaintenant('biens', b); afficher(); };
    $('#cPre').onchange = e => { b.sim.preempt = e.target.value; sauverMaintenant('biens', b); afficher(); };
  }

  /* ---------- Simulation ---------- */
  function ongletSimulation(z, b) {
    const S = b.sim, TY = M.TYPES[S.type];
    const champ = (id, l, o = {}) => `<div class="champ${o.large ? ' large' : ''}"><label for="${id}" ${o.lid ? `id="${o.lid}"` : ''}>${l}</label><input id="${id}" data-k="${o.k || id}" type="number" inputmode="${o.dec ? 'decimal' : 'numeric'}" min="0" step="${o.step || 1}" value="${S[o.k || id]}">${o.aide ? `<small class="aide" id="${id}Aide"></small>` : ''}</div>`;
    const poste = (k, id, l) => `<div class="poste" data-poste="${k}-${id}"><input type="checkbox" data-coche="${k}-${id}" aria-label="Compter : ${esc(l)}"><label class="poste-nom" for="v-${k}-${id}">${esc(l)}</label><input type="number" id="v-${k}-${id}" data-val="${k}-${id}" inputmode="numeric" min="0" step="50"><div class="poste-repere"><span>Repère <b data-rep="${k}-${id}"></b></span><span data-h="${k}-${id}"></span><span data-ecart="${k}-${id}"></span><button type="button" class="bouton-lien" data-raz="${k}-${id}" hidden>revenir au repère</button></div></div>`;
    z.innerHTML = `
      <div class="deux-colonnes">
        <div class="colonne" id="saisie">
          <div class="carte"><h2>Bien</h2>
            <div class="segments" role="group" aria-label="Type de bien" id="segType" style="margin-bottom:.8rem">${Object.entries(M.TYPES).map(([k, t]) => `<button data-v="${k}" aria-pressed="${S.type === k}">${t.n}</button>`).join('')}</div>
            <p class="aide" id="typeNote">${esc(TY.note)}</p>
            <div class="grille-champs">
              ${champ('surf', TY.sl, { lid: 'surfL', dec: 1 })}${champ('pieces', TY.pl, { lid: 'piecesL' })}${champ('duree', 'Durée totale (mois)')}
              ${champ('achat', 'Prix d\'achat hors FAI (€)', { step: 500, aide: 1 })}${champ('pm2', TY.ql, { lid: 'pm2L', step: 50, aide: 1 })}${champ('vente', 'Revente souhaitée (€)', { step: 500, aide: 1 })}
            </div><button class="bouton bouton-petit" id="useQ" hidden>Revente au prix du quartier</button></div>
          <div class="carte"><h2>Acquisition</h2><div id="acq">${poste('n', 'not', 'Frais de notaire, régime marchand de biens')}</div>
            <div class="grille-champs" style="margin-top:.6rem">${champ('agA', 'Frais d\'agence à l\'achat (€)', { step: 500 })}</div></div>
          <div class="carte"><h2>Travaux</h2>
            <div id="nivBlock" class="champ"><label>Niveau</label><div class="segments" id="segNiv">${Object.entries(M.NIVEAUX).map(([k, l]) => `<button data-v="${k}" aria-pressed="${S.niveau === k}">${l}</button>`).join('')}</div></div>
            <div class="champ"><label>Gamme</label><div class="segments" id="segGam">${Object.entries(M.GAMMES).map(([k, l]) => `<button data-v="${k}" aria-pressed="${String(S.gamme) === k}">${l}</button>`).join('')}</div></div>
            <div id="trv">${M.W.map(i => poste('w', i.id, i.l)).join('')}</div>
            <div class="grille-champs" style="margin-top:.6rem">${champ('aleas', 'Aléas de chantier (%)')}</div>
            <div class="compte">${'<div class="compte-ligne"><span>Postes cochés</span><b id="trvBase"></b></div><div class="compte-ligne"><span>Repères des postes cochés</span><b id="trvRef"></b></div><div class="compte-ligne total"><span>Total travaux hors taxes</span><b id="trvTot"></b></div>'}</div>
            <p class="aide" id="trvReelNote" hidden></p></div>
          <div class="carte"><h2>Frais annexes</h2><div id="anx">${M.X.map(i => i.g ? `<div class="poste-groupe">${esc(i.g)}</div>` : poste('x', i.id, i.l)).join('')}</div>
            <div class="grille-champs" style="margin-top:.6rem">${champ('agV', 'Agence à la revente (%)', { dec: 1, step: .5 })}</div></div>
          <div class="carte"><h2>Prestations d'une société partenaire</h2>
            ${[['m1', M.M1, 'Mission 1'], ['m2', M.M2, 'Mission 2']].map(([k, L, t]) => `<div class="poste-groupe">${t}</div>${L.map((p, i) => `<label class="case"><input type="checkbox" data-mis="${k}-${i}"${S[k][i] ? ' checked' : ''}> <span style="flex:1">${esc(p[0])} <small class="discret">${String(p[1]).replace('.', ',')} %</small></span><b class="montant" data-misv="${k}-${i}"></b></label>`).join('')}`).join('')}</div>
          <div class="carte"><h2>Paramètres de l'opération</h2><div class="grille-champs">
            ${champ('taux', 'Intérêts de l\'associé investisseur (% par an)', { dec: 1, step: .5 })}${champ('obj', 'Objectif de marge nette (%)', { dec: 1 })}
            ${champ('part', 'Part de l\'associé opérateur (%)')}${champ('pfu', 'Prélèvement sur dividendes (%)', { dec: 1, step: .1 })}
            ${champ('dmax', 'Durée maximum (mois)')}
            <div class="champ"><label for="tvaT">TVA sur les travaux</label><select id="tvaT"><option value="10">10 %</option><option value="20">20 %</option><option value="5.5">5,5 %</option></select></div>
            <div class="champ"><label for="tvaMode">TVA à la revente</label><select id="tvaMode"><option value="marge">Sur la marge</option><option value="total">Sur le prix total</option><option value="none">Aucune</option></select></div>
          </div><button class="bouton bouton-petit" id="razSim">Réinitialiser les postes du type</button></div>
        </div>
        <div class="colonne" id="resultats" style="position:sticky;top:0"></div>
      </div>`;
    $('#tvaT').value = String(S.tvaT); $('#tvaMode').value = S.tvaMode;
    const champsNum = $$('input[data-k]', z);
    const maj = (sauver = true) => {
      if (sauver) sauverPlusTard('biens', b, 400);
      cacheAnalyse.clear();
      const A = analyse(Object.assign({}, b, { _maj: 'saisie' + Date.now() })), r = A.r, TYc = M.TYPES[S.type], Q = A.quartier, U = Q.unite;
      champsNum.forEach(el => { if (document.activeElement !== el) el.value = S[el.dataset.k]; });
      $('#surfL').textContent = TYc.sl; $('#piecesL').textContent = TYc.pl; $('#pm2L').textContent = TYc.ql; $('#typeNote').textContent = TYc.note;
      $('#nivBlock').hidden = !M.ALLB.includes(S.type);
      $('#achatAide').textContent = eur(Q.achatU) + U.s;
      $('#pm2Aide').textContent = Q.vise ? 'Revente visée ' + eur(Q.vise) : '';
      $('#venteAide').textContent = eur(Q.venteU) + U.s + (Q.vise ? ' · ' + (Math.abs(Q.ecart) < .005 ? 'au prix du quartier' : (Q.ecart > 0 ? '+ ' : '− ') + pc(Math.abs(Q.ecart)) + ' / quartier') : '');
      $('#venteAide').className = 'aide' + (Q.ecart > .05 ? ' orange' : '');
      $('#useQ').hidden = !Q.vise || Math.round(Q.vise) === Math.round(S.vente);
      const ligne = (k, id, p, d, visible) => {
        const row = $(`[data-poste="${k}-${id}"]`, z); row.hidden = !visible; if (!visible) return;
        row.classList.toggle('inactif', !p.on);
        const cb = $(`[data-coche="${k}-${id}"]`, z); cb.checked = !!p.on; if (k === 'n') cb.disabled = true;
        const inp = $(`[data-val="${k}-${id}"]`, z); if (document.activeElement !== inp) inp.value = p.val == null ? d.v : p.val;
        $(`[data-rep="${k}-${id}"]`, z).textContent = eur(d.v); $(`[data-h="${k}-${id}"]`, z).textContent = d.h;
        const cust = p.val != null && p.val !== d.v, ec = $(`[data-ecart="${k}-${id}"]`, z);
        ec.textContent = cust ? (p.val > d.v ? '+ ' : '− ') + eur(Math.abs(p.val - d.v)) : ''; ec.className = cust ? (p.val > d.v ? 'orange' : 'vert') : '';
        $(`[data-raz="${k}-${id}"]`, z).hidden = !cust;
      };
      M.W.forEach(i => ligne('w', i.id, S.w[i.id], M.wDef(i, S), M.vis(i, S.type)));
      M.XI.forEach(i => ligne('x', i.id, S.x[i.id], i.d(S, S.duree, r.T, S.vente), M.xVis(i, S.type)));
      ligne('n', 'not', { on: true, val: S.notaire }, { v: M.notaire(S.achat), h: pc(M.notaire(S.achat) / (S.achat || 1)) + ' du prix' }, true);
      [['m1', M.M1], ['m2', M.M2]].forEach(([k, L]) => L.forEach((p, i) => { $(`[data-misv="${k}-${i}"]`, z).textContent = S[k][i] ? eur(S.vente * p[1] / 100) : ''; }));
      $('#trvBase').textContent = eur(r.tr.base); $('#trvRef').textContent = eur(r.tr.ref); $('#trvTot').textContent = eur(r.tr.tot);
      const note = $('#trvReelNote'); note.hidden = !r.reel; if (r.reel) note.textContent = 'Le calcul retient le coût réel du chantier : ' + eur(r.T) + ' (onglet Travaux).';
      $('#resultats').innerHTML = panneauResultats(A, A.S);
      majEntete(b);
    };
    /* événements */
    champsNum.forEach(el => el.addEventListener('input', () => { S[el.dataset.k] = nb(el.value); if (el.dataset.k === 'pieces') S.pieces = Math.max(1, Math.round(S.pieces)); maj(); }));
    $('#tvaT').onchange = e => { S.tvaT = parseFloat(e.target.value); maj(); };
    $('#tvaMode').onchange = e => { S.tvaMode = e.target.value; maj(); };
    $('#segType').onclick = e => { const x = e.target.closest('button'); if (!x || x.dataset.v === S.type) return; const adr = S.adresse, keep = {}; ['taux', 'obj', 'part', 'pfu', 'dmax', 'tvaT', 'tvaMode', 'abf', 'preempt'].forEach(k => keep[k] = S[k]); M.setType(S, x.dataset.v); Object.assign(S, keep); S.adresse = adr; $$('button', $('#segType')).forEach(y => y.setAttribute('aria-pressed', y === x)); maj(); };
    $('#segNiv').onclick = e => { const x = e.target.closest('button'); if (!x) return; S.niveau = x.dataset.v; M.applyLevel(S); $$('button', $('#segNiv')).forEach(y => y.setAttribute('aria-pressed', y === x)); maj(); };
    $('#segGam').onclick = e => { const x = e.target.closest('button'); if (!x) return; S.gamme = parseFloat(x.dataset.v); $$('button', $('#segGam')).forEach(y => y.setAttribute('aria-pressed', y === x)); maj(); };
    const store = k => k === 'n' ? { get val() { return S.notaire; }, set val(v) { S.notaire = v; }, on: true } : null;
    z.addEventListener('input', e => {
      const c = e.target.dataset.coche, v = e.target.dataset.val, ms = e.target.dataset.mis;
      if (c) { const [k, id] = c.split('-'); S[k][id].on = e.target.checked; maj(); }
      else if (v) { const [k, id] = v.split('-'); const p = k === 'n' ? store(k) : S[k][id]; p.val = e.target.value === '' ? null : nb(e.target.value); if (k !== 'n') p.on = true; maj(); }
      else if (ms) { const [k, i] = ms.split('-'); S[k][+i] = e.target.checked; maj(); }
    });
    z.addEventListener('click', e => { const rz = e.target.dataset && e.target.dataset.raz; if (rz) { const [k, id] = rz.split('-'); if (k === 'n') S.notaire = null; else S[k][id].val = null; maj(); } });
    z.addEventListener('focusout', () => maj(false));
    $('#useQ').onclick = () => { S.vente = Math.round(S.pm2 * (S.type === 'box' ? S.pieces : S.surf)); maj(); };
    $('#razSim').onclick = () => confirmer('Remettre les postes de travaux et de frais annexes aux valeurs par défaut du type ?', () => { M.initLines(S); maj(); });
    maj(false);
  }
  const COULEURS = { 'Achat': '#0e2a1d', 'Notaire et agence': '#4f6b5a', 'Travaux': '#1f5c3e', 'Annexes': '#8aa592', 'Prestations': '#6d7f74', 'TVA': '#8e1f24', 'Intérêts': '#5b3a52', 'IS': '#a8864f', 'Bénéfice net': '#c9ab74' };
  function partsRepartition(r) { return [['Achat', r.achat], ['Notaire et agence', r.acq], ['Travaux', r.T], ['Annexes', r.anx + r.agV], ['Prestations', r.mis], ['TVA', r.tva], ['Intérêts', r.int], ['IS', r.is], ['Bénéfice net', Math.max(0, r.N)]]; }
  function panneauResultats(A, S) {
    const r = A.r, P = A.partage, L = A.lim, parts = partsRepartition(r), tot = parts.reduce((s, p) => s + p[1], 0) || 1;
    const tvaTxt = S.tvaMode === 'marge' ? '(revente − achat) ÷ 6' : S.tvaMode === 'total' ? 'revente ÷ 6' : 'non appliquée';
    const isTxt = r.R <= 0 ? 'aucun bénéfice' : r.R <= 42500 ? '15 %' : '15 % jusqu\'à 42 500 €, 25 % au-delà';
    return `
      <div class="indicateurs" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin:0">
        ${indic('Marge nette', pc(r.m), { etat: ETATS[A.etat][0], c: ETATS[A.etat][0], detail: 'objectif ' + S.obj + ' %' })}
        ${indic('Bénéfice net', eur(r.N), { c: r.N < 0 ? 'rouge' : '' })}
        ${indic('Coût de revient', eur(r.C))}
        ${indic('Trésorerie maximale', eur(r.treso), { etat: r.treso > S.env ? 'rouge' : '', detail: 'enveloppe ' + eur(S.env) })}
      </div>
      <div class="carte"><h2>Répartition du prix de revente</h2>
        <div class="repartition">${parts.map(p => `<i style="width:${p[1] / tot * 100}%;background:${COULEURS[p[0]]}" title="${p[0]}"></i>`).join('')}</div>
        <div class="legende">${parts.filter(p => p[1] > 0).map(p => `<span><i style="background:${COULEURS[p[0]]}"></i>${p[0]} ${pc(p[1] / tot, 0)}</span>`).join('')}</div></div>
      <div class="carte"><h2>Fiscalité et marge nette</h2><div class="compte">
        ${ligneCompte('Prix de revente', eur(r.vente))}
        ${ligneCompte('− Achat', eur(r.achat))}
        ${ligneCompte('− Notaire et agence à l\'achat', eur(r.acq), { s: 'dont droits réduits ' + eur(P.droits) })}
        ${ligneCompte('− Travaux hors taxes', eur(r.T), { s: r.reel ? 'coût réel du chantier' : '' })}
        ${ligneCompte('− Frais annexes', eur(r.anx + r.agV))}
        ${ligneCompte('− Prestations de la société partenaire', eur(r.mis), { s: r.mis ? String(Math.round(r.misPct * 10) / 10).replace('.', ',') + ' % du prix de revente' : '' })}
        ${ligneCompte('= Marge brute', eur(P.brut) + ' · ' + pc(P.brut / (r.vente || 1), 0), { total: 1 })}
        ${ligneCompte('− TVA à la revente', eur(r.tva), { s: tvaTxt })}
        ${ligneCompte('− Intérêts de l\'associé investisseur', eur(r.int), { s: String(S.taux).replace('.', ',') + ' % par an sur ' + r.duree + ' mois' })}
        ${ligneCompte('= Résultat avant impôt', eur(r.R), { total: 1 })}
        ${ligneCompte('− Impôt sur les sociétés', eur(r.is), { s: isTxt })}
        ${ligneCompte('= Bénéfice net de la société', eur(r.N) + ' · ' + pc(r.m), { total: 1, c: r.N >= 0 ? 'vert' : 'rouge' })}
        ${ligneCompte('Dividendes de l\'associé opérateur', eur(P.operateur.dividendes), { s: S.part + ' % du bénéfice net' })}
        ${ligneCompte('− Prélèvement sur dividendes', eur(P.operateur.prelevement), { s: String(S.pfu).replace('.', ',') + ' %' })}
        ${ligneCompte('= Net de l\'associé opérateur', eur(P.operateur.net), { total: 1 })}
        ${ligneCompte('Fiscalité totale de l\'opération', eur(P.fiscalite), { s: 'droits, TVA, IS, prélèvement' })}
        ${ligneCompte('TVA des travaux avancée puis récupérée', eur(P.tvaTravaux), { s: 'pèse sur la trésorerie' })}
      </div>
      <div class="compte-titre">Associé investisseur</div><div class="compte">
        ${ligneCompte('Capital avancé', eur(P.investisseur.capital), { s: 'trésorerie maximale' })}
        ${ligneCompte('Intérêts reçus', eur(P.investisseur.interets))}
        ${ligneCompte('Dividendes reçus', eur(P.investisseur.dividendes), { s: (100 - S.part) + ' % du bénéfice net' })}
        ${ligneCompte('− IS estimé', eur(P.investisseur.is), { s: '15 % des intérêts et de 5 % des dividendes' })}
        ${ligneCompte('= Revenus nets', eur(P.investisseur.net), { total: 1 })}
        ${ligneCompte('Rendement', pc(P.investisseur.rendement) + ' · ' + pc(P.investisseur.rendementAn) + ' /an')}
      </div></div>
      <div class="carte"><h2>Limites pour ${S.obj} %</h2><div class="compte">
        ${ligneCompte('Prix d\'achat maximum', L.achatMax ? eur(L.achatMax) : 'aucun')}
        ${ligneCompte('Revente minimum', eur(L.venteMin))}
        ${ligneCompte('Revente au point mort', eur(L.venteZero))}
        ${ligneCompte('Budget travaux maximum', L.travauxMax ? eur(L.travauxMax) : 'aucun')}
        ${ligneCompte('Retard supportable', L.retard < 0 ? 'objectif non atteint' : L.retard >= 36 ? 'plus de 36 mois' : L.retard + ' mois')}
      </div></div>
      <div class="carte"><h2>Scénarios</h2><table class="tableau"><thead><tr><th>Scénario</th><th class="nombre">Bénéfice net</th><th class="nombre">Marge</th></tr></thead><tbody>
        ${A.scenarios.map(s => `<tr><td>${esc(s.l)}</td><td class="nombre">${eur(s.N)}</td><td class="nombre ${ETATS[s.etat][0]}">${pc(s.m)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- Travaux ---------- */
  /* Les postes cochés dans la simulation deviennent les lignes du suivi ; les lignes déjà engagées sont conservées. */
  function synchroniserLignes(b, sauver) {
    const S = M.normalize(b.sim), src = M.lignesChantier(S), L = b.travaux.lignes || [];
    const engagee = l => l.devis || l.facture || l.paye || l.avancement || l.artisanId || l.commentaire;
    const out = [];
    src.forEach(s => { const ex = L.find(l => l.poste === s.poste); out.push(ex ? Object.assign(ex, { l: s.l, budget: s.budget }) : Object.assign(s, { artisanId: '', devis: 0, devisDate: '', facture: 0, paye: 0, avancement: 0, debut: '', fin: '', commentaire: '' })); });
    L.forEach(l => { if (!out.includes(l) && (!l.poste || engagee(l))) out.push(Object.assign(l, l.poste ? { horsSimulation: true } : {})); });
    b.travaux.lignes = out;
    if (sauver) sauverMaintenant('biens', b);
  }
  function ongletTravaux(z, b) {
    synchroniserLignes(b, false);
    const artisans = D.liste('contacts').filter(x => x.categorie === 'artisan').sort((a, c) => a.nom.localeCompare(c.nom));
    const dessiner = () => {
      const S = M.normalize(b.sim), L = b.travaux.lignes, seuil = seuilTravaux(b), T = M.totauxChantier(L, S.aleas, seuil);
      const base = M.compute(Object.assign({}, simEffective(Object.assign({}, b, { travaux: { lignes: L, utiliserReel: false } })), { trvReel: null }));
      const reel = M.compute(Object.assign(simEffective(b), { trvReel: T.reel }));
      z.innerHTML = `
        ${T.alerte ? `<div class="alerte-bandeau">Engagé ${eur(T.engage)} pour un budget de ${eur(T.budget)} : dépassement de ${pc(T.depassement, 0)}, au-delà du seuil de ${seuil} %.</div>` : ''}
        <div class="indicateurs">
          ${indic('Budget', eur(T.budget), { detail: 'postes ' + eur(T.budgetPostes) + ' + aléas ' + S.aleas + ' %' })}
          ${indic('Engagé', eur(T.engage), { etat: T.alerte ? 'rouge' : '', detail: T.engage ? 'devis signés · ' + (T.depassement >= 0 ? '+ ' : '− ') + pc(Math.abs(T.depassement), 0) + ' / budget' : 'aucun devis signé' })}
          ${indic('Facturé', eur(T.facture))}
          ${indic('Payé', eur(T.paye), { detail: 'reste à payer ' + eur(T.reste) })}
          ${indic('Avancement global', pc(T.avancement, 0), { detail: 'pondéré par le budget des postes' })}
          ${indic('Coût réel estimé', eur(T.reel), { detail: 'devis signés, budget + aléas ailleurs' })}
        </div>
        <div class="carte" style="margin-bottom:.8rem"><div class="grille-champs">
          <label class="case" style="grid-column:1/-1"><input type="checkbox" id="tReel"${b.travaux.utiliserReel ? ' checked' : ''}> Calculer la marge avec le coût réel du chantier</label>
          <div class="champ"><label for="tSeuil">Seuil d'alerte (%)</label><input id="tSeuil" type="number" inputmode="numeric" min="0" value="${seuil}"></div>
          <div class="champ"><span class="aide">Marge au budget</span><b class="${base.m >= S.obj / 100 ? 'vert' : 'rouge'}">${pc(base.m)} · ${eur(base.N)}</b></div>
          <div class="champ"><span class="aide">Marge au coût réel</span><b class="${reel.m >= S.obj / 100 ? 'vert' : 'rouge'}">${pc(reel.m)} · ${eur(reel.N)}</b></div>
        </div></div>
        ${L.length ? `<div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Poste</th><th>Artisan</th><th class="nombre">Budget</th><th class="nombre">Devis signé</th><th>Date du devis</th><th class="nombre">Facturé</th><th class="nombre">Payé</th><th class="nombre">Avancement</th><th>Début</th><th>Fin</th><th>Commentaire</th><th></th></tr></thead><tbody>
          ${L.map((l, i) => `<tr data-i="${i}">
            <td data-titre="Poste">${l.poste ? `<strong>${esc(l.l)}</strong>${l.horsSimulation ? '<span class="sous-ligne orange">décoché dans la simulation</span>' : ''}` : `<input data-f="l" value="${esc(l.l)}" aria-label="Intitulé">`}</td>
            <td data-titre="Artisan"><select data-f="artisanId" aria-label="Artisan"><option value="">—</option>${artisans.map(a => `<option value="${a.id}"${l.artisanId === a.id ? ' selected' : ''}>${esc(a.nom)}</option>`).join('')}</select></td>
            <td class="nombre" data-titre="Budget">${l.poste ? eur(l.budget) : `<input data-f="budget" type="number" inputmode="numeric" value="${l.budget || 0}" style="width:100px">`}</td>
            <td data-titre="Devis signé"><input data-f="devis" type="number" inputmode="numeric" min="0" value="${l.devis || ''}" style="width:100px" class="${l.devis > l.budget * (1 + seuil / 100) ? 'rouge' : ''}"></td>
            <td data-titre="Date du devis"><input data-f="devisDate" type="date" value="${esc(l.devisDate || '')}"></td>
            <td data-titre="Facturé"><input data-f="facture" type="number" inputmode="numeric" min="0" value="${l.facture || ''}" style="width:100px"></td>
            <td data-titre="Payé"><input data-f="paye" type="number" inputmode="numeric" min="0" value="${l.paye || ''}" style="width:100px"></td>
            <td data-titre="Avancement"><input data-f="avancement" type="number" inputmode="numeric" min="0" max="100" step="10" value="${l.avancement || 0}" style="width:70px"></td>
            <td data-titre="Début"><input data-f="debut" type="date" value="${esc(l.debut || '')}"></td>
            <td data-titre="Fin"><input data-f="fin" type="date" value="${esc(l.fin || '')}"></td>
            <td data-titre="Commentaire"><input data-f="commentaire" value="${esc(l.commentaire || '')}"></td>
            <td>${!l.poste || l.horsSimulation ? `<button class="bouton-icone" data-suppr="${i}" aria-label="Retirer la ligne">${I.fermer}</button>` : ''}</td></tr>`).join('')}
          </tbody><tfoot><tr><td>Total</td><td></td><td class="nombre">${eur(T.budgetPostes)}</td><td class="nombre">${eur(T.engage)}</td><td></td><td class="nombre">${eur(T.facture)}</td><td class="nombre">${eur(T.paye)}</td><td class="nombre">${pc(T.avancement, 0)}</td><td colspan="4"></td></tr></tfoot></table></div>` : '<div class="vide">Aucun poste coché dans la simulation.</div>'}
        <div class="actions" style="margin-top:.8rem"><button class="bouton" id="tAjout">+ Ligne hors simulation</button><a class="bouton" href="#/bien/${b.id}/simulation">Modifier les postes</a></div>`;
      $('#tReel').onchange = e => { b.travaux.utiliserReel = e.target.checked; sauverMaintenant('biens', b); dessiner(); majEntete(b); };
      $('#tSeuil').onchange = e => { b.travaux.seuil = nb(e.target.value); sauverMaintenant('biens', b); dessiner(); };
      $('#tAjout').onclick = () => { b.travaux.lignes.push({ poste: null, l: 'Poste supplémentaire', budget: 0, artisanId: '', devis: 0, devisDate: '', facture: 0, paye: 0, avancement: 0, debut: '', fin: '', commentaire: '' }); sauverMaintenant('biens', b); dessiner(); };
      $$('[data-suppr]', z).forEach(x => x.onclick = () => { b.travaux.lignes.splice(+x.dataset.suppr, 1); sauverMaintenant('biens', b); dessiner(); });
      $$('tr[data-i] [data-f]', z).forEach(el => el.addEventListener('change', () => {
        const l = b.travaux.lignes[+el.closest('tr').dataset.i], f = el.dataset.f;
        l[f] = ['devis', 'facture', 'paye', 'avancement', 'budget'].includes(f) ? Math.max(0, f === 'avancement' ? Math.min(100, nb(el.value)) : nb(el.value)) : el.value;
        sauverMaintenant('biens', b); dessiner(); majEntete(b);
      }));
    };
    dessiner();
  }

  /* ---------- Journal ---------- */
  function ongletJournal(z, b) {
    const l = D.liste('journal').filter(j => j.bienId === b.id).sort((a, c) => (c.date || '').localeCompare(a.date || '') || (c._maj || '').localeCompare(a._maj || ''));
    z.innerHTML = `
      <div class="carte" style="margin-bottom:.8rem"><div class="grille-champs">
        <div class="champ"><label for="jDate">Date</label><input id="jDate" type="date" value="${aujourdhui()}"></div>
        <div class="champ"><label for="jType">Type</label><select id="jType">${TYPES_JOURNAL.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select></div>
        <div class="champ"><label for="jMontant">Montant (€)</label><input id="jMontant" type="number" inputmode="numeric" min="0" step="500"></div>
        <div class="champ" style="grid-column:1/-1"><label for="jTexte">Note</label><textarea id="jTexte" rows="2" style="min-height:60px"></textarea></div>
      </div><button class="bouton bouton-principal" id="jAjout">Ajouter au journal</button></div>
      <div class="carte">${l.length ? l.map(j => `<div class="entree-journal"><time>${dateFr(j.date)}</time><span class="type"><span class="etiquette">${TYPE_JOURNAL[j.type] || 'Note'}</span>${j.montant ? ` <b class="montant">${eur(j.montant)}</b>` : ''}</span><span class="texte">${esc(j.texte || '')}</span><button class="bouton-icone" data-suppr="${j.id}" aria-label="Supprimer">${I.fermer}</button></div>`).join('') : '<div class="vide">Journal vide.</div>'}</div>`;
    $('#jAjout').onclick = () => {
      const t = $('#jTexte').value.trim(), m = nb($('#jMontant').value), type = $('#jType').value;
      if (!t && !m) { notifier('Saisir une note ou un montant.', 'erreur'); return; }
      D.enregistrer('journal', { bienId: b.id, date: $('#jDate').value || aujourdhui(), type, montant: m || null, texte: t });
      if (type === 'offre' && RANG[b.etape || 'repere'] < RANG.offre) { b.etape = 'offre'; sauverMaintenant('biens', b); notifier('Étape passée à « Offre envoyée ».', 'succes'); }
      afficher();
    };
    $$('[data-suppr]', z).forEach(x => x.onclick = () => confirmer('Supprimer cette entrée du journal ?', () => { D.supprimer('journal', x.dataset.suppr); afficher(); }));
  }

  /* ---------- Contacts du bien ---------- */
  function ongletContacts(z, b) {
    const tous = D.liste('contacts').sort((a, c) => a.nom.localeCompare(c.nom));
    const liens = b.liens.map((l, i) => ({ l, i, c: D.obtenir('contacts', l.contactId) })).filter(x => x.c);
    z.innerHTML = `
      <div class="carte" style="margin-bottom:.8rem"><div class="grille-champs">
        <div class="champ"><label for="cChoix">Contact du carnet</label><select id="cChoix"><option value="">Choisir</option>${tous.map(c => `<option value="${c.id}">${esc(c.nom)} · ${CATEGORIE[c.categorie] || ''}</option>`).join('')}</select></div>
        <div class="champ"><label for="cRole">Rôle sur ce bien</label><input id="cRole" list="roles" placeholder="Agent, vendeur, notaire…"></div>
        <div class="champ" style="justify-content:flex-end;flex-direction:row;gap:.5rem;align-items:flex-end"><button class="bouton bouton-principal" id="cLier">Lier</button><button class="bouton" id="cNouveau">Nouveau contact</button></div>
      </div><datalist id="roles">${['Agent', 'Vendeur', 'Notaire', 'Notaire du vendeur', 'Syndic', 'Électricien', 'Plombier', 'Plaquiste', 'Maçon', 'Peintre', 'Apporteur'].map(r => `<option>${r}</option>`).join('')}</datalist></div>
      ${liens.length ? `<div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Contact</th><th>Rôle</th><th>Téléphone</th><th>E-mail</th><th></th></tr></thead><tbody>${liens.map(x => `<tr><td data-titre="Contact"><strong>${esc(x.c.nom)}</strong><span class="sous-ligne">${CATEGORIE[x.c.categorie] || ''}${x.c.personne ? ' · ' + esc(x.c.personne) : ''}</span></td><td data-titre="Rôle">${esc(x.l.role || '')}</td><td data-titre="Téléphone">${x.c.tel ? `<a href="tel:${esc(x.c.tel.replace(/\s/g, ''))}">${esc(x.c.tel)}</a>` : ''}</td><td data-titre="E-mail">${x.c.email ? `<a href="mailto:${esc(x.c.email)}">${esc(x.c.email)}</a>` : ''}</td><td class="nombre"><button class="bouton bouton-petit" data-relance="${x.c.id}">Relance</button> <button class="bouton-icone" data-delier="${x.i}" aria-label="Retirer">${I.fermer}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="vide">Aucun contact lié.</div>'}`;
    $('#cLier').onclick = () => { const id = $('#cChoix').value; if (!id) return; b.liens.push({ contactId: id, role: $('#cRole').value.trim() }); sauverMaintenant('biens', b); afficher(); };
    $('#cNouveau').onclick = () => ficheContact(null, c => { b.liens.push({ contactId: c.id, role: $('#cRole').value.trim() || CATEGORIE[c.categorie] }); sauverMaintenant('biens', b); afficher(); });
    $$('[data-delier]', z).forEach(x => x.onclick = () => { b.liens.splice(+x.dataset.delier, 1); sauverMaintenant('biens', b); afficher(); });
    $$('[data-relance]', z).forEach(x => x.onclick = () => nouvelleRelance({ bienId: b.id, contactId: x.dataset.relance }));
  }

  /* ---------- Pièces ---------- */
  function ongletPieces(z, b) {
    z.innerHTML = `<div class="carte">${PIECES.map(p => { const v = b.pieces[p[0]] || {}; return `<div class="poste" style="grid-template-columns:22px minmax(0,1fr) 150px"><input type="checkbox" id="pc-${p[0]}" data-piece="${p[0]}"${v.ok ? ' checked' : ''}><label class="poste-nom" for="pc-${p[0]}">${p[1]}</label><input type="date" data-pdate="${p[0]}" value="${esc(v.date || '')}" aria-label="Date de réception"><div class="poste-repere"><input data-pnote="${p[0]}" value="${esc(v.note || '')}" placeholder="Note" style="min-height:30px"></div></div>`; }).join('')}
      <p class="aide" style="margin-top:.6rem">${PIECES.filter(p => (b.pieces[p[0]] || {}).ok).length} pièce(s) reçue(s) sur ${PIECES.length}.</p></div>`;
    const get = k => (b.pieces[k] = b.pieces[k] || {});
    $$('[data-piece]', z).forEach(x => x.onchange = () => { const p = get(x.dataset.piece); p.ok = x.checked; if (x.checked && !p.date) p.date = aujourdhui(); sauverMaintenant('biens', b); afficher(); });
    $$('[data-pdate]', z).forEach(x => x.onchange = () => { get(x.dataset.pdate).date = x.value; sauverPlusTard('biens', b); });
    $$('[data-pnote]', z).forEach(x => x.oninput = () => { get(x.dataset.pnote).note = x.value; sauverPlusTard('biens', b); });
  }

  /* ---------- Comparables ---------- */
  function ongletComparables(z, b) {
    const dessiner = () => {
      const A = analyse(b), C = A.comp, S = b.sim;
      z.innerHTML = `
        <div class="indicateurs">
          ${indic('Ventes comparables', C.comps.length, { etat: C.comps.length >= 3 ? 'vert' : 'orange', detail: 'au moins trois pour le contrôle' })}
          ${indic('Moyenne au m²', C.moy ? eur(C.moy) : '—')}
          ${indic('Revente souhaitée au m²', S.type === 'box' ? '—' : eur(C.venteM2))}
          ${indic('Écart à la moyenne', C.ecart != null ? (C.ecart >= 0 ? '+ ' : '− ') + pc(Math.abs(C.ecart)) : '—', { etat: C.ecart != null && C.ecart > .05 ? 'orange' : '' })}
        </div>
        <div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Adresse</th><th class="nombre">Surface (m²)</th><th class="nombre">Prix (€)</th><th>Date</th><th class="nombre">Prix au m²</th><th></th></tr></thead><tbody>
          ${b.comps.map((x, i) => `<tr data-i="${i}"><td data-titre="Adresse"><input data-f="adresse" value="${esc(x.adresse || '')}"></td><td data-titre="Surface"><input data-f="surface" type="number" inputmode="decimal" value="${x.surface || ''}" style="width:90px"></td><td data-titre="Prix"><input data-f="prix" type="number" inputmode="numeric" value="${x.prix || ''}" style="width:120px"></td><td data-titre="Date"><input data-f="date" value="${esc(x.date || '')}" placeholder="2026-05" style="width:110px"></td><td class="nombre" data-titre="Prix au m²">${x.surface > 0 && x.prix > 0 ? eur(x.prix / x.surface) : '—'}</td><td><button class="bouton-icone" data-suppr="${i}" aria-label="Supprimer">${I.fermer}</button></td></tr>`).join('') || '<tr><td colspan="6" class="discret">Aucune vente saisie.</td></tr>'}
        </tbody></table></div>
        <div class="actions" style="margin-top:.8rem"><button class="bouton" id="cAjout">+ Vente</button><button class="bouton" id="cColler">Coller des lignes</button><label class="bouton" for="cFichier">Importer un fichier</label><input type="file" id="cFichier" accept=".csv,.txt" hidden>
          ${C.moy && S.type !== 'box' && Math.round(C.moy) !== Math.round(S.pm2) ? `<button class="bouton bouton-principal" id="cQuartier">Prix du quartier = ${eur(C.moy)} /m²</button>` : ''}</div>
        <p class="aide">Format des lignes : adresse ; surface ; prix ; date (séparateur point-virgule ou tabulation). Source suggérée : base DVF des valeurs foncières.</p>`;
      $('#cAjout').onclick = () => { b.comps.push({ adresse: '', surface: 0, prix: 0, date: '' }); sauverMaintenant('biens', b); dessiner(); };
      $$('[data-suppr]', z).forEach(x => x.onclick = () => { b.comps.splice(+x.dataset.suppr, 1); sauverMaintenant('biens', b); dessiner(); });
      $$('tr[data-i] [data-f]', z).forEach(el => el.addEventListener('change', () => { const x = b.comps[+el.closest('tr').dataset.i], f = el.dataset.f; x[f] = ['surface', 'prix'].includes(f) ? nb(el.value) : el.value; sauverMaintenant('biens', b); dessiner(); }));
      const importer = txt => { const l = M.parseComps(txt); l.forEach(x => b.comps.push({ adresse: x.adresse, surface: x.surface, prix: x.prix, date: x.date })); sauverMaintenant('biens', b); notifier(l.length + ' vente(s) importée(s).', l.length ? 'succes' : 'erreur'); dessiner(); };
      $('#cColler').onclick = () => modale('Coller des ventes', '<div class="champ"><label for="cTxt">Une vente par ligne</label><textarea id="cTxt" rows="8" placeholder="12 rue Exemple;42;150000;2026-03"></textarea></div>', [{ l: 'Annuler' }, { l: 'Importer', classe: 'bouton-principal', f: f => importer($('#cTxt', f).value) }]);
      $('#cFichier').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => importer(String(rd.result || '')); rd.readAsText(f); };
      const q = $('#cQuartier'); if (q) q.onclick = () => { b.sim.pm2 = Math.round(C.moy); sauverMaintenant('biens', b); notifier('Prix du quartier mis à jour.', 'succes'); dessiner(); };
    };
    dessiner();
  }

  /* ================= Annonces (alertes e-mail) ================= */
  const MA = window.MarcheoAnnonces;
  const cacheAnn = new Map();
  function evalAnnonce(a) {
    appliquerReperes();
    const R = reglages(), Rr = D.obtenir('reglages', 'reglages'), k = a.id + '|' + a._maj + '|' + (Rr ? Rr._maj : '');
    if (!cacheAnn.has(k)) cacheAnn.set(k, MA.evaluer(a, R));
    return cacheAnn.get(k);
  }
  const STATUTS_ANALYSE = { signalee: ['vert', 'Signalée'], ecartee: ['gris', 'Écartée par l\'analyse'], a_completer: ['orange', 'À compléter'] };
  const aExaminer = a => !['retenue', 'ecartee'].includes(a.statutTri) && evalAnnonce(a).statut === 'signalee';
  const fa = { onglet: 'examiner', q: '', source: '', type: '' };
  function vueAnnonces(c) {
    titre('Annonces', 'Alertes e-mail analysées', I.annonces);
    const toutes = D.liste('annonces'), E = new Map(toutes.map(a => [a.id, evalAnnonce(a)]));
    const groupes = {
      examiner: toutes.filter(aExaminer),
      completer: toutes.filter(a => !['retenue', 'ecartee'].includes(a.statutTri) && E.get(a.id).statut === 'a_completer'),
      toutes,
      ecartees: toutes.filter(a => !['retenue', 'ecartee'].includes(a.statutTri) && E.get(a.id).statut === 'ecartee'),
      traitees: toutes.filter(a => ['retenue', 'ecartee'].includes(a.statutTri))
    };
    const ONG = [['examiner', 'À examiner'], ['completer', 'À compléter'], ['ecartees', 'Écartées par l\'analyse'], ['traitees', 'Traitées'], ['toutes', 'Toutes']];
    const sources = [...new Set(toutes.map(a => a.source).filter(Boolean))].sort();
    const derniere = toutes.reduce((m, a) => (a.vueLe || a.recueLe || '') > m ? (a.vueLe || a.recueLe) : m, '');
    c.innerHTML = `
      <div class="en-tete-page"><div><h1>Annonces</h1><p>${toutes.length} reçue(s)${derniere ? ' · dernière alerte le ' + dateFr(derniere.slice(0, 10)) : ''} · tri automatique selon les critères des Réglages</p></div>
        <div class="actions"><button class="bouton" id="anAjout">+ Annonce</button><button class="bouton" id="anCrit">Modifier les critères</button></div></div>
      <div class="info-bandeau">${esc(resumeCriteres(reglages()))}</div>
      <div class="indicateurs">
        ${indic('À examiner', groupes.examiner.length, { etat: groupes.examiner.length ? 'vert' : '', detail: 'négociation réaliste pour l\'objectif de marge' })}
        ${indic('À compléter', groupes.completer.length, { etat: groupes.completer.length ? 'orange' : '', detail: 'surface ou prix du secteur manquant' })}
        ${indic('Écartées par l\'analyse', groupes.ecartees.length, { detail: 'consultables à tout moment' })}
      </div>
      <nav class="onglets">${ONG.map(o => `<button class="${fa.onglet === o[0] ? 'actif' : ''}" data-ong="${o[0]}">${o[1]} <small class="discret">${groupes[o[0]].length}</small></button>`).join('')}</nav>
      <div class="barre-outils"><input type="search" id="anQ" placeholder="Rechercher : ville, titre…" value="${esc(fa.q)}" aria-label="Rechercher">
        <select id="anSrc" aria-label="Source"><option value="">Toutes les sources</option>${sources.map(s => `<option${fa.source === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <select id="anType" aria-label="Type"><option value="">Tous les types</option>${Object.entries(M.TYPES).map(([k, t]) => `<option value="${k}"${fa.type === k ? ' selected' : ''}>${t.n}</option>`).join('')}</select></div>
      <div id="anZone"></div>`;
    const zone = () => {
      const q = fa.q.trim().toLowerCase();
      const l = groupes[fa.onglet].filter(a => (!fa.source || a.source === fa.source) && (!fa.type || E.get(a.id).type === fa.type) && (!q || [a.titre, a.ville, a.cp, a.texte].join(' ').toLowerCase().includes(q)))
        .sort((x, y) => (E.get(y.id).score ?? -1) - (E.get(x.id).score ?? -1) || (y.recueLe || '').localeCompare(x.recueLe || ''));
      const vis = l.slice(0, 200);
      $('#anZone').innerHTML = !l.length ? `<div class="vide">${fa.onglet === 'examiner' ? 'Aucune annonce ne mérite l\'attention pour l\'instant.' : 'Aucune annonce.'}</div>` :
        `<div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Annonce</th><th class="nombre">Prix affiché</th><th class="nombre">Revente estimée</th><th class="nombre">Trésorerie</th><th class="nombre">Prix maximum</th><th class="nombre">Négociation</th><th>Analyse</th></tr></thead><tbody>${vis.map(a => {
          const e = E.get(a.id), st = a.statutTri === 'retenue' ? ['vert', 'Retenue'] : a.statutTri === 'ecartee' ? ['gris', 'Écartée'] : STATUTS_ANALYSE[e.statut];
          return `<tr class="cliquable" data-id="${a.id}"><td data-titre="Annonce"><strong>${esc(a.titre || 'Annonce')}</strong>${a.statutTri === 'nouvelle' ? ' <span class="etiquette">nouvelle</span>' : ''}<span class="sous-ligne">${esc([M.TYPES[e.type] ? M.TYPES[e.type].n : '', e.surface ? e.surface + ' m²' : '', e.lots && e.type === 'immeuble' ? e.lots + ' lots' : '', [a.cp, a.ville].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</span><span class="sous-ligne">${esc(a.source || '')} · ${dateFr((a.recueLe || '').slice(0, 10))}${e.signaux.length ? ' · <span class="vert">' + esc(e.signaux.join(', ')) + '</span>' : ''}</span></td>
            <td class="nombre" data-titre="Prix affiché">${eur(e.prix)}${e.surface ? `<span class="sous-ligne">${eur(e.prix / e.surface)} /m²</span>` : ''}${a.prixPrecedent ? `<span class="sous-ligne vert">avant ${eur(a.prixPrecedent)}</span>` : ''}</td>
            <td class="nombre" data-titre="Revente estimée">${e.vente ? eur(e.vente) : '—'}</td>
            <td class="nombre" data-titre="Trésorerie">${e.tresoAffiche ? `<span class="${e.criteres && e.tresoAffiche > e.criteres.tresoMax ? 'rouge' : ''}">${eur(e.tresoAffiche)}</span><span class="sous-ligne">au prix affiché</span>` : '—'}</td>
            <td class="nombre" data-titre="Prix maximum">${e.achatMax ? eur(Math.floor(e.achatMax / 1000) * 1000) : '—'}</td>
            <td class="nombre" data-titre="Négociation">${e.nego != null ? `<span class="${e.nego <= 0 ? 'vert' : e.statut === 'signalee' ? 'orange' : 'rouge'}">${e.nego <= 0 ? 'aucune' : '− ' + pc(e.nego, 0)}</span>` : '—'}</td>
            <td data-titre="Analyse">${voyant(st[0], st[1])}${e.score != null ? ` <b class="montant">${e.score}</b>` : ''}<span class="sous-ligne">${esc(e.motifs.join(' · '))}</span></td></tr>`;
        }).join('')}</tbody></table></div>${l.length > 200 ? `<p class="aide">200 premières sur ${l.length}. Affiner la recherche.</p>` : ''}`;
      $$('tr[data-id]', $('#anZone')).forEach(tr => tr.onclick = () => ficheAnnonce(D.obtenir('annonces', tr.dataset.id)));
    };
    $$('[data-ong]', c).forEach(b => b.onclick = () => { fa.onglet = b.dataset.ong; vueAnnonces(c); });
    $('#anQ').oninput = e => { fa.q = e.target.value; zone(); };
    $('#anSrc').onchange = e => { fa.source = e.target.value; zone(); };
    $('#anType').onchange = e => { fa.type = e.target.value; zone(); };
    $('#anAjout').onclick = () => ajouterAnnonce();
    $('#anCrit').onclick = () => editerCriteres();
    zone();
  }
  function ficheAnnonce(a) {
    if (!a) return;
    if (a.statutTri === 'nouvelle') { a.statutTri = 'vue'; D.enregistrer('annonces', a); majNav(); }
    const e = evalAnnonce(a), k = a.corrections || {}, R = reglages();
    const ligne = (l, v, s) => ligneCompte(l, v, { s });
    modale(a.titre || 'Annonce', `
      <div class="compte">
        ${ligne('Source', esc(a.source || '') + (a.lien ? ` · <a href="${esc(a.lien)}" target="_blank" rel="noopener">voir l'annonce</a>` : ''), 'reçue le ' + dateFr((a.recueLe || '').slice(0, 10)) + (a.alertes > 1 ? ', ' + a.alertes + ' alertes' : ''))}
        ${ligne('Lieu', esc([a.cp, a.ville].filter(Boolean).join(' ') || '—'), e.secteur ? 'secteur : ' + eur(e.secteur.pm2 || 0) + ' /m²' : 'secteur sans prix de référence')}
        ${ligne('Prix affiché', eur(e.prix), (a.historiquePrix || []).length > 1 ? a.historiquePrix.map(h => dateFr(h.date.slice(0, 10)) + ' : ' + eur(h.prix)).join(' · ') : '')}
        ${e.r ? ligne('Revente estimée', eur(e.vente), eur(e.pm2) + ' /m² × ' + e.surface + ' m²') + ligne('Travaux estimés', eur(e.r.T), M.NIVEAUX[e.niveau].toLowerCase()) + ligne('Coût de revient', eur(e.r.C)) + ligne('Trésorerie maximale au prix affiché', `<span class="${e.tresoAffiche > e.criteres.tresoMax ? 'rouge' : ''}">${eur(e.tresoAffiche)}</span>`, 'plafond ' + eur(e.criteres.tresoMax) + (e.tresoAuMax ? ' · ' + eur(e.tresoAuMax) + ' au prix maximum' : '')) + ligne('Marge nette au prix affiché', `<span class="${e.marge >= e.S.obj / 100 ? 'vert' : 'rouge'}">${pc(e.marge)}</span>`) + ligne('Prix d\'achat maximum', e.achatMax ? eur(e.achatMax) : 'aucun', e.nego > 0 ? 'négociation nécessaire : ' + pc(e.nego, 0) : 'sous le prix maximum') : ''}
        ${ligne('Analyse', voyant(STATUTS_ANALYSE[e.statut][0], STATUTS_ANALYSE[e.statut][1]) + (e.score != null ? ' · score ' + e.score : ''), esc(e.motifs.concat(e.signaux.length ? ['signaux : ' + e.signaux.join(', ')] : []).join(' · ')))}
      </div>
      <div class="compte-titre">Corriger ou compléter</div>
      <div class="grille-champs">
        <div class="champ"><label for="akType">Type</label><select id="akType">${Object.entries(M.TYPES).map(([x, t]) => `<option value="${x}"${e.type === x ? ' selected' : ''}>${t.n}</option>`).join('')}</select></div>
        <div class="champ"><label for="akSurf">Surface (m²)</label><input id="akSurf" type="number" inputmode="decimal" value="${k.surface || a.surface || ''}"></div>
        <div class="champ"><label for="akLots">Lots ou pièces</label><input id="akLots" type="number" inputmode="numeric" value="${k.lots || a.lots || ''}"></div>
        <div class="champ"><label for="akNiv">Travaux</label><select id="akNiv">${Object.entries(M.NIVEAUX).map(([x, l]) => `<option value="${x}"${(k.niveau || e.niveau) === x ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="champ"><label for="akPm2">Prix du secteur (€/m²)</label><input id="akPm2" type="number" inputmode="numeric" value="${k.pm2 || e.pm2 || ''}"></div>
        <div class="champ"><label for="akCp">Code postal</label><input id="akCp" inputmode="numeric" value="${esc(a.cp || '')}"></div>
      </div>
      <label class="case"><input type="checkbox" id="akSecteur" checked> Enregistrer ce prix pour tout le secteur ${esc(a.cp || '')}</label>
      ${a.texte ? `<details style="margin-top:.6rem"><summary class="aide">Texte de l'alerte</summary><p class="aide">${esc(a.texte)}</p></details>` : ''}`,
      [{ l: 'Écarter', classe: 'bouton-danger', f: () => { a.statutTri = 'ecartee'; D.enregistrer('annonces', a); afficher(); } },
       { l: 'Enregistrer', f: f => { corriger(a, f); afficher(); } },
       { l: 'Retenir et prendre rendez-vous', classe: 'bouton-principal', f: f => { corriger(a, f); retenirAnnonce(D.obtenir('annonces', a.id)); } }]);
  }
  function corriger(a, f) {
    const v = id => $(id, f).value.trim(), n = id => nb($(id, f).value);
    const e = evalAnnonce(a);
    a.corrections = Object.assign({}, a.corrections || {});
    if (v('#akType') !== e.type || a.corrections.type) a.corrections.type = v('#akType');
    ['surface', 'lots'].forEach((k2, i) => { const x = n(['#akSurf', '#akLots'][i]); if (x) a.corrections[k2] = x; });
    if (v('#akNiv') !== MA.niveauDepuisTexte([a.titre, a.texte].join(' '), a.dpe) || a.corrections.niveau) a.corrections.niveau = v('#akNiv');
    if (v('#akCp')) a.cp = v('#akCp');
    const pm2 = n('#akPm2');
    if (pm2 && $('#akSecteur', f).checked && a.cp) {
      const R = reglages(); R.criteres = Object.assign({}, MA.CRITERES_DEF, R.criteres || {}); R.criteres.secteurs = (R.criteres.secteurs || []).slice();
      const s = R.criteres.secteurs.find(x => String(x.cp) === String(a.cp));
      const champ = (a.corrections.type || e.type) === 'box' ? 'prixBox' : 'pm2';
      if (s) s[champ] = pm2; else R.criteres.secteurs.push({ cp: a.cp, commune: a.ville || '', [champ]: pm2 });
      D.enregistrer('reglages', R); delete a.corrections.pm2;
    } else if (pm2 && pm2 !== e.pm2) a.corrections.pm2 = pm2;
    D.enregistrer('annonces', a); cacheAnn.clear();
  }
  function retenirAnnonce(a) {
    const e = evalAnnonce(a), R = reglages();
    let S = e.S ? clone(e.S) : M.fresh(e.type);
    if (!e.S) { ['taux', 'obj', 'part', 'pfu', 'dmax', 'tvaT', 'tvaMode'].forEach(k => { if (R[k] != null) S[k] = R[k]; }); if (e.surface) S.surf = e.surface; if (e.prix) S.achat = e.prix; M.applyLevel(S); }
    S.adresse = [a.titre, a.ville].filter(Boolean).join(', ');
    const b = D.enregistrer('biens', { etape: 'repere', source: a.source, lien: a.lien || '', prixAffiche: e.prix, sim: S, comps: [], pieces: {}, liens: [], travaux: { lignes: [], utiliserReel: false }, creeLe: aujourdhui(), annonceId: a.id,
      prochaine: { action: 'Prendre rendez-vous de visite', date: aujourdhui() } });
    D.enregistrer('relances', { date: aujourdhui(), objet: 'Prendre rendez-vous de visite', bienId: b.id, fait: false });
    D.enregistrer('journal', { bienId: b.id, date: (a.recueLe || aujourdhui()).slice(0, 10), type: 'note', texte: 'Annonce ' + (a.source || '') + ' reçue par alerte. Analyse : ' + (e.score != null ? 'score ' + e.score + ', ' : '') + (e.motifs.join(', ') || 'signalée') + '.', auto: true });
    a.statutTri = 'retenue'; a.bienId = b.id; D.enregistrer('annonces', a);
    notifier('Bien créé, relance « Prendre rendez-vous » pour aujourd\'hui.', 'succes');
    aller('#/bien/' + b.id);
  }
  function ajouterAnnonce() {
    modale('Ajouter une annonce', `<div class="grille-champs">
      <div class="champ" style="grid-column:1/-1"><label for="naT">Titre</label><input id="naT" placeholder="Immeuble 4 lots à rénover"></div>
      <div class="champ"><label for="naP">Prix affiché (€)</label><input id="naP" type="number" inputmode="numeric"></div>
      <div class="champ"><label for="naS">Surface (m²)</label><input id="naS" type="number" inputmode="decimal"></div>
      <div class="champ"><label for="naCp">Code postal</label><input id="naCp" inputmode="numeric"></div>
      <div class="champ"><label for="naV">Ville</label><input id="naV"></div>
      <div class="champ"><label for="naSrc">Source</label><input id="naSrc" value="Leboncoin"></div>
      <div class="champ" style="grid-column:1/-1"><label for="naL">Lien</label><input id="naL" type="url"></div>
      <div class="champ" style="grid-column:1/-1"><label for="naX">Description</label><textarea id="naX" rows="3"></textarea></div></div>`,
      [{ l: 'Annuler' }, { l: 'Ajouter', classe: 'bouton-principal', f: f => {
        const g = id => $(id, f).value.trim(); if (!nb(g('#naP'))) { notifier('Saisir le prix.', 'erreur'); return false; }
        D.enregistrer('annonces', { titre: g('#naT'), prix: nb(g('#naP')), surface: nb(g('#naS')) || undefined, cp: g('#naCp'), ville: g('#naV'), source: g('#naSrc'), lien: g('#naL'), texte: g('#naX'), recueLe: new Date().toISOString(), statutTri: 'nouvelle', manuel: true });
        afficher();
      } }]);
  }
  function champsCriteres(R) {
    const C = Object.assign({}, MA.CRITERES_DEF, R.criteres || {});
    return `<div class="grille-champs">
        <div class="champ"><label for="crTreso">Plafond de trésorerie (€)</label><input id="crTreso" data-cr="tresoMax" type="number" inputmode="numeric" step="5000" value="${C.tresoMax}"><small class="aide">achat, frais d'agence, notaire, travaux et aléas, annexes, TVA des travaux avancée</small></div>
        <div class="champ"><label for="crEcart">Revente au-dessus de la trésorerie (%)</label><input id="crEcart" data-cr="ecartRevente" type="number" inputmode="numeric" value="${C.ecartRevente}"><small class="aide">écart minimum entre revente estimée et trésorerie</small></div>
        <div class="champ"><label for="crObj">Objectif de marge nette (%)</label><input id="crObj" data-cr="obj" type="number" inputmode="decimal" value="${C.obj != null ? C.obj : R.obj}"></div>
        <div class="champ"><label for="crNego">Négociation maximum (%)</label><input id="crNego" data-cr="negoMax" type="number" inputmode="numeric" value="${C.negoMax}"><small class="aide">au-delà, l'annonce est écartée</small></div>
        <div class="champ" style="grid-column:1/-1"><label>Types analysés</label><div class="actions">${Object.entries(M.TYPES).map(([k, t]) => `<label class="case"><input type="checkbox" data-crtype="${k}"${C.types.includes(k) ? ' checked' : ''}> ${t.n}</label>`).join('')}</div><small class="aide">Immeubles et types non cochés : importés, écartés d'office.</small></div>
        <div class="champ" style="grid-column:1/-1"><label for="crExclus">Mots exclus</label><input id="crExclus" data-crl="exclus" value="${esc(C.exclus.join(', '))}"></div>
        <div class="champ" style="grid-column:1/-1"><label for="crSignaux">Signaux favorables</label><input id="crSignaux" data-crl="signaux" value="${esc(C.signaux.join(', '))}"></div>
      </div>`;
  }
  const resumeCriteres = R => { const C = Object.assign({}, MA.CRITERES_DEF, R.criteres || {}); return 'Trésorerie ≤ ' + eur(C.tresoMax) + ' · revente ≥ trésorerie + ' + C.ecartRevente + ' % · marge ≥ ' + (C.obj != null ? C.obj : R.obj) + ' % · négociation ≤ ' + C.negoMax + ' % · ' + C.types.map(k => M.TYPES[k] ? M.TYPES[k].n.toLowerCase() : k).join(', '); };
  function editerCriteres() {
    modale('Critères d\'analyse', champsCriteres(reglages()), [{ l: 'Fermer', classe: 'bouton-principal', f: () => afficher() }], f => brancherCriteres(f));
  }
  function carteCriteres(R) {
    const C = Object.assign({}, MA.CRITERES_DEF, R.criteres || {});
    return `<div class="carte"><h2>Analyse des annonces</h2>${champsCriteres(R)}</div>
      <div class="carte"><h2>Prix des secteurs</h2>
        <table class="tableau"><thead><tr><th>Code postal</th><th>Commune</th><th class="nombre">Logement rénové €/m²</th><th class="nombre">Box €</th><th></th></tr></thead><tbody>
        ${(C.secteurs || []).map((s, i) => `<tr data-sec="${i}"><td><input data-sf="cp" value="${esc(s.cp || '')}" inputmode="numeric" style="width:80px"></td><td><input data-sf="commune" value="${esc(s.commune || '')}"></td><td><input data-sf="pm2" type="number" value="${s.pm2 || ''}" style="width:100px"></td><td><input data-sf="prixBox" type="number" value="${s.prixBox || ''}" style="width:90px"></td><td><button class="bouton-icone" data-secsuppr="${i}" aria-label="Supprimer">${I.fermer}</button></td></tr>`).join('') || '<tr><td colspan="5" class="discret">Aucun secteur : les annonces resteront « à compléter ».</td></tr>'}
        </tbody></table><button class="bouton bouton-petit" id="secAjout" style="margin-top:.6rem">+ Secteur</button>
        <p class="aide">Source conseillée : prix de vente réels de la base DVF (data.gouv.fr), logements rénovés du secteur.</p></div>`;
  }
  function brancherCriteres(c) {
    const maj = f => { const R = reglages(); R.criteres = Object.assign({}, MA.CRITERES_DEF, R.criteres || {}); R.criteres.secteurs = (R.criteres.secteurs || []).map(s => Object.assign({}, s)); f(R.criteres); D.enregistrer('reglages', R); cacheAnn.clear(); };
    $$('[data-cr]', c).forEach(el => el.onchange = () => { maj(C => C[el.dataset.cr] = nb(el.value)); notifier('Critère enregistré.', 'succes'); });
    $$('[data-crtype]', c).forEach(el => el.onchange = () => { maj(C => C.types = $$('[data-crtype]', c).filter(x => x.checked).map(x => x.dataset.crtype)); notifier('Critère enregistré.', 'succes'); });
    $$('[data-crl]', c).forEach(el => el.onchange = () => { maj(C => C[el.dataset.crl] = el.value.split(',').map(x => x.trim()).filter(Boolean)); notifier('Critère enregistré.', 'succes'); });
    $$('tr[data-sec] [data-sf]', c).forEach(el => el.onchange = () => maj(C => { const s = C.secteurs[+el.closest('tr').dataset.sec]; s[el.dataset.sf] = ['cp', 'commune'].includes(el.dataset.sf) ? el.value.trim() : nb(el.value); }));
    $$('[data-secsuppr]', c).forEach(el => el.onclick = () => { maj(C => C.secteurs.splice(+el.dataset.secsuppr, 1)); afficher(); });
    const a = $('#secAjout', c); if (a) a.onclick = () => { maj(C => C.secteurs.push({ cp: '', commune: '' })); afficher(); };
  }

  /* ================= Comparateur ================= */
  let selection = [], selectionInit = false;
  function vueComparateur(c) {
    titre('Comparateur', 'Deux à quatre biens côte à côte', I.comparateur);
    const biens = D.liste('biens').filter(b => b.etape !== 'ecarte').sort((a, z) => titreBien(a).localeCompare(titreBien(z)));
    selection = selection.filter(id => biens.some(b => b.id === id));
    if (!selectionInit) { selectionInit = true; selection = biens.filter(b => ['etude', 'offre', 'visite'].includes(b.etape)).slice(0, 3).map(b => b.id); }
    const choisis = selection.map(id => biens.find(b => b.id === id)).filter(Boolean);
    const lignes = [
      ['Prix d\'achat', A => A.r.achat, -1, eur], ['Travaux HT', A => A.r.T, -1, eur], ['Coût de revient', A => A.r.C, -1, eur], ['Revente', A => A.r.vente, 1, eur],
      ['Bénéfice net', A => A.r.N, 1, eur], ['Marge nette', A => A.r.m, 1, v => pc(v)], ['Trésorerie maximale', A => A.r.treso, -1, eur], ['Durée', A => A.S.duree, -1, v => v + ' mois'],
      ['Contrôles', A => A.controles.score, 1, v => v + ' / 4'], ['Prix d\'achat maximum', A => A.lim.achatMax || 0, 0, v => v ? eur(v) : 'aucun'],
      ['Revenus nets de l\'associé investisseur', A => A.partage.investisseur.net, 1, eur], ['Rendement annuel de l\'associé investisseur', A => A.partage.investisseur.rendementAn, 1, v => pc(v)],
      ['Net de l\'associé opérateur', A => A.partage.operateur.net, 1, eur]
    ];
    const As = choisis.map(analyse);
    c.innerHTML = `
      <div class="en-tete-page"><div><h1>Comparateur</h1><p>${choisis.length} bien(s) sélectionné(s), quatre au plus.</p></div></div>
      <div class="carte" style="margin-bottom:.8rem"><div class="grille-champs">${biens.map(b => `<label class="case"><input type="checkbox" data-sel="${b.id}"${selection.includes(b.id) ? ' checked' : ''}${!selection.includes(b.id) && selection.length >= 4 ? ' disabled' : ''}> <span>${esc(titreBien(b))} <small class="discret">${ETAPE[b.etape || 'repere']}</small></span></label>`).join('') || '<div class="vide">Aucun bien.</div>'}</div></div>
      ${choisis.length >= 2 ? `<div class="tableau-conteneur"><table class="tableau comparateur"><thead><tr><th></th>${choisis.map(b => `<th><a href="#/bien/${b.id}">${esc(titreBien(b))}</a></th>`).join('')}</tr></thead><tbody>
        ${lignes.map(([l, f, sens, fmt]) => { const v = As.map(f), best = sens ? (sens > 0 ? Math.max(...v) : Math.min(...v)) : null; return `<tr><td>${l}</td>${v.map(x => `<td class="${sens && x === best && v.filter(y => y === best).length === 1 ? 'meilleur' : ''}">${fmt(x)}</td>`).join('')}</tr>`; }).join('')}
        <tr><td>État</td>${As.map(A => `<td>${voyantEtat(A.etat)}</td>`).join('')}</tr>
      </tbody></table></div>` : '<div class="vide">Sélectionner au moins deux biens.</div>'}`;
    $$('[data-sel]', c).forEach(x => x.onchange = () => { selection = x.checked ? selection.concat(x.dataset.sel).slice(0, 4) : selection.filter(i => i !== x.dataset.sel); vueComparateur(c); });
  }

  /* ================= Relances ================= */
  function listeRelances(l, compact) {
    if (!l.length) return '';
    const t = aujourdhui();
    return `<div class="compte">${l.sort((a, z) => (a.date || '').localeCompare(z.date || '')).map(x => { const b = x.bienId && D.obtenir('biens', x.bienId), c = x.contactId && D.obtenir('contacts', x.contactId); return `<div class="compte-ligne"><span><label class="case" style="margin:0"><input type="checkbox" data-fait="${x.id}"${x.fait ? ' checked' : ''}> <span>${esc(x.objet)}</span></label><small class="discret">${[b ? `<a href="#/bien/${b.id}">${esc(titreBien(b))}</a>` : '', c ? esc(c.nom) + (c.tel ? ` · <a href="tel:${esc(c.tel.replace(/\s/g, ''))}">${esc(c.tel)}</a>` : '') : ''].filter(Boolean).join(' · ')}</small></span><b class="${!x.fait && x.date < t ? 'rouge' : ''}">${dateFr(x.date)}${compact ? '' : ` <button class="bouton-icone" data-modif="${x.id}" aria-label="Modifier">✎</button>`}</b></div>`; }).join('')}</div>`;
  }
  function brancherRelances(c) {
    $$('[data-fait]', c).forEach(x => x.onchange = () => { const r = D.obtenir('relances', x.dataset.fait); r.fait = x.checked; r.faitLe = x.checked ? aujourdhui() : ''; sauverMaintenant('relances', r); afficher(); });
    $$('[data-modif]', c).forEach(x => x.onclick = () => nouvelleRelance(D.obtenir('relances', x.dataset.modif)));
  }
  function vueRelances(c) {
    titre('Relances', 'Suivi daté des contacts', I.relances);
    const t = aujourdhui(), l = D.liste('relances');
    const retard = l.filter(x => !x.fait && x.date < t), jour = l.filter(x => !x.fait && x.date === t), avenir = l.filter(x => !x.fait && x.date > t), faites = l.filter(x => x.fait).sort((a, z) => (z.faitLe || '').localeCompare(a.faitLe || '')).slice(0, 20);
    const bloc = (tt, l, et) => `<div class="carte"><h2>${tt} · ${l.length}</h2>${listeRelances(l) || '<div class="vide">Rien.</div>'}</div>`;
    c.innerHTML = `<div class="en-tete-page"><div><h1>Relances</h1></div><div class="actions"><button class="bouton bouton-principal" id="rNouv">+ Relance</button></div></div>
      <div class="indicateurs">${indic('En retard', retard.length, { etat: retard.length ? 'rouge' : '' })}${indic('Aujourd\'hui', jour.length, { etat: jour.length ? 'orange' : '' })}${indic('À venir', avenir.length)}</div>
      <div class="deux-colonnes"><div class="colonne">${bloc('En retard', retard)}${bloc('Aujourd\'hui', jour)}</div><div class="colonne">${bloc('À venir', avenir)}${bloc('Faites récemment', faites)}</div></div>`;
    $('#rNouv').onclick = () => nouvelleRelance({});
    brancherRelances(c);
  }
  function nouvelleRelance(r) {
    r = r || {}; const ex = !!r.id;
    const biens = D.liste('biens').filter(b => b.etape !== 'ecarte'), contacts = D.liste('contacts').sort((a, z) => a.nom.localeCompare(z.nom));
    modale(ex ? 'Relance' : 'Nouvelle relance', `<div class="grille-champs">
      <div class="champ" style="grid-column:1/-1"><label for="rObj">Objet</label><input id="rObj" value="${esc(r.objet || '')}"></div>
      <div class="champ"><label for="rDate">Date</label><input id="rDate" type="date" value="${esc(r.date || aujourdhui())}"></div>
      <div class="champ"><label for="rBien">Bien</label><select id="rBien"><option value="">—</option>${biens.map(b => `<option value="${b.id}"${r.bienId === b.id ? ' selected' : ''}>${esc(titreBien(b))}</option>`).join('')}</select></div>
      <div class="champ"><label for="rCont">Contact</label><select id="rCont"><option value="">—</option>${contacts.map(x => `<option value="${x.id}"${r.contactId === x.id ? ' selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></div></div>`,
      [ex ? { l: 'Supprimer', classe: 'bouton-danger', f: () => { D.supprimer('relances', r.id); afficher(); } } : null, { l: 'Annuler' }, { l: 'Enregistrer', classe: 'bouton-principal', f: f => {
        const o = $('#rObj', f).value.trim(); if (!o) { notifier('Saisir l\'objet.', 'erreur'); return false; }
        D.enregistrer('relances', Object.assign(r, { objet: o, date: $('#rDate', f).value, bienId: $('#rBien', f).value, contactId: $('#rCont', f).value, fait: !!r.fait })); afficher();
      } }].filter(Boolean));
  }

  /* ================= Contacts ================= */
  const fc = { q: '', cat: '' };
  function vueContacts(c) {
    titre('Contacts', 'Carnet commun à tous les biens', I.contacts);
    c.innerHTML = `<div class="en-tete-page"><div><h1>Contacts</h1></div><div class="actions"><button class="bouton bouton-principal" id="ctNouv">+ Contact</button></div></div>
      <div class="barre-outils"><input type="search" id="ctQ" placeholder="Rechercher" value="${esc(fc.q)}" aria-label="Rechercher"><select id="ctCat" aria-label="Catégorie"><option value="">Toutes les catégories</option>${CATEGORIES.map(x => `<option value="${x[0]}"${fc.cat === x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select></div><div id="ctZone"></div>`;
    const zone = () => {
      const q = fc.q.toLowerCase(), biens = D.liste('biens');
      const l = D.liste('contacts').filter(x => (!fc.cat || x.categorie === fc.cat) && (!q || [x.nom, x.personne, x.metier, x.tel, x.email, x.notes].join(' ').toLowerCase().includes(q))).sort((a, z) => a.nom.localeCompare(z.nom));
      $('#ctZone').innerHTML = l.length ? `<div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Nom</th><th>Catégorie</th><th>Téléphone</th><th>E-mail</th><th>Biens</th></tr></thead><tbody>${l.map(x => { const bs = biens.filter(b => (b.liens || []).some(y => y.contactId === x.id)); return `<tr class="cliquable" data-id="${x.id}"><td data-titre="Nom"><strong>${esc(x.nom)}</strong>${x.personne || x.metier ? `<span class="sous-ligne">${esc([x.personne, x.metier].filter(Boolean).join(' · '))}</span>` : ''}</td><td data-titre="Catégorie">${CATEGORIE[x.categorie] || ''}</td><td data-titre="Téléphone">${x.tel ? `<a href="tel:${esc(x.tel.replace(/\s/g, ''))}" data-stop>${esc(x.tel)}</a>` : ''}</td><td data-titre="E-mail">${x.email ? `<a href="mailto:${esc(x.email)}" data-stop>${esc(x.email)}</a>` : ''}</td><td data-titre="Biens">${bs.map(b => `<a href="#/bien/${b.id}" data-stop>${esc(titreBien(b))}</a>`).join(', ')}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="vide">Aucun contact.</div>';
      $$('tr[data-id]', $('#ctZone')).forEach(tr => tr.onclick = e => { if (!e.target.closest('[data-stop]')) ficheContact(D.obtenir('contacts', tr.dataset.id), () => afficher()); });
    };
    $('#ctQ').oninput = e => { fc.q = e.target.value; zone(); };
    $('#ctCat').onchange = e => { fc.cat = e.target.value; zone(); };
    $('#ctNouv').onclick = () => ficheContact(null, () => afficher());
    zone();
  }
  function ficheContact(x, apres) {
    x = x || { categorie: 'agent' }; const ex = !!x.id;
    modale(ex ? x.nom : 'Nouveau contact', `<div class="grille-champs">
      <div class="champ" style="grid-column:1/-1"><label for="kNom">Nom ou société</label><input id="kNom" value="${esc(x.nom || '')}"></div>
      <div class="champ"><label for="kCat">Catégorie</label><select id="kCat">${CATEGORIES.map(c => `<option value="${c[0]}"${x.categorie === c[0] ? ' selected' : ''}>${c[1]}</option>`).join('')}</select></div>
      <div class="champ"><label for="kPers">Interlocuteur</label><input id="kPers" value="${esc(x.personne || '')}"></div>
      <div class="champ"><label for="kMetier">Métier</label><input id="kMetier" value="${esc(x.metier || '')}" placeholder="Artisans"></div>
      <div class="champ"><label for="kTel">Téléphone</label><input id="kTel" type="tel" inputmode="tel" value="${esc(x.tel || '')}"></div>
      <div class="champ" style="grid-column:1/-1"><label for="kMail">E-mail</label><input id="kMail" type="email" inputmode="email" value="${esc(x.email || '')}"></div>
      <div class="champ" style="grid-column:1/-1"><label for="kNotes">Notes</label><textarea id="kNotes" rows="3">${esc(x.notes || '')}</textarea></div></div>`,
      [ex ? { l: 'Supprimer', classe: 'bouton-danger', f: () => { D.supprimer('contacts', x.id); apres && apres(); } } : null, { l: 'Annuler' }, { l: 'Enregistrer', classe: 'bouton-principal', f: f => {
        const nom = $('#kNom', f).value.trim(); if (!nom) { notifier('Saisir le nom.', 'erreur'); return false; }
        Object.assign(x, { nom, categorie: $('#kCat', f).value, personne: $('#kPers', f).value.trim(), metier: $('#kMetier', f).value.trim(), tel: $('#kTel', f).value.trim(), email: $('#kMail', f).value.trim(), notes: $('#kNotes', f).value.trim() });
        const r = D.enregistrer('contacts', x); apres && apres(r);
      } }].filter(Boolean));
  }

  /* ================= Repères ================= */
  const LIB_X = {
    plans_m2: 'Plans et relevé : prix au m²', plans_min: 'Plans et relevé : minimum', archi_local: 'Architecte : local transformé', archi: 'Architecte : autres biens', struct: "Bureau d'études structure",
    geo_terrain: 'Géomètre : terrain', geo: 'Géomètre : division', sol_lot: 'Étude de sol, par lot', modif: 'Modificatif du règlement de copropriété', do_pct: 'Dommages-ouvrage : % des travaux', do_min: 'Dommages-ouvrage : minimum',
    copro_box: 'Charges de copropriété : par box et par mois', copro_m2: 'Charges de copropriété : par m² et par mois', tf_terrain: 'Taxe foncière : terrain, par m² et par an', tf_box: 'Taxe foncière : boxes, par m² et par an', tf_m2: 'Taxe foncière : logement, par m² et par an',
    assur: 'Assurance, par mois', abo: 'Eau et électricité de chantier, par mois', diag_maison: 'Diagnostics : maison', diag_box: 'Diagnostics : boxes', diag_terrain: 'Diagnostics : terrain', diag_appt: 'Diagnostics : appartement ou local',
    audit: 'Audit énergétique', edate: 'État daté', photo: 'Photos et annonces', compta: 'Comptabilité et juridique', banque: 'Frais bancaires, par mois', banque_min: 'Frais bancaires : minimum'
  };
  const UNITE_W = { m2: '€/m²', f: '€ forfait', fen: '€ par fenêtre', porte: '€ par porte', unit: '€ par unité' };
  function vueReperes(c) {
    titre('Repères', 'Prix unitaires modifiables', I.reperes);
    const R = reglages(), ref = R.ref || { w: {}, x: {} }, est = new Set(M.REF_ESTIME);
    const ligne = (g, k, lib, unite) => { const d = M.REF_DEF[g][k], v = (ref[g] || {})[k], mod = v != null && v !== d; return `<tr><td data-titre="Poste">${esc(lib)}${est.has(g + '.' + k) ? ' <span class="etiquette orange">estimation</span>' : ''}</td><td class="nombre" data-titre="Unité">${unite}</td><td class="nombre" data-titre="Par défaut">${d.toLocaleString('fr-FR')}</td><td data-titre="Retenu"><input type="number" inputmode="decimal" min="0" step="any" data-ref="${g}.${k}" value="${v != null ? v : d}" style="width:110px" class="${mod ? 'orange' : ''}"></td></tr>`; };
    c.innerHTML = `<div class="en-tete-page"><div><h1>Repères</h1><p>Relevés fin novembre 2026. Les lignes « estimation » n'ont pas de source vérifiée.</p></div><div class="actions"><button class="bouton" id="refRaz">Valeurs par défaut</button></div></div>
      <div class="info-bandeau">Les repères servent au calcul de tous les biens. Un montant saisi poste par poste dans une simulation reste prioritaire.</div>
      <div class="section-titre"><h2>Travaux</h2><span class="aide">avant coefficient de gamme</span></div>
      <div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Poste</th><th class="nombre">Unité</th><th class="nombre">Par défaut</th><th>Retenu</th></tr></thead><tbody>
        ${M.W.map(i => ligne('w', i.id, i.l, UNITE_W[i.per])).join('')}${ligne('w', 'deco_min', 'Décoration et mise en scène : minimum', '€')}</tbody></table></div>
      <div class="section-titre"><h2>Frais annexes</h2></div>
      <div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Poste</th><th class="nombre">Unité</th><th class="nombre">Par défaut</th><th>Retenu</th></tr></thead><tbody>
        ${Object.keys(M.REF_DEF.x).map(k => ligne('x', k, LIB_X[k] || k, k.endsWith('pct') ? '%' : '€')).join('')}</tbody></table></div>`;
    $$('[data-ref]', c).forEach(el => el.addEventListener('change', () => {
      const [g, k] = el.dataset.ref.split('.'), v = nb(el.value), R2 = reglages();
      R2.ref = R2.ref || { w: {}, x: {} }; R2.ref[g] = R2.ref[g] || {};
      if (v === M.REF_DEF[g][k]) delete R2.ref[g][k]; else R2.ref[g][k] = v;
      D.enregistrer('reglages', R2); appliquerReperes(); el.classList.toggle('orange', v !== M.REF_DEF[g][k]); notifier('Repère enregistré.', 'succes');
    }));
    $('#refRaz').onclick = () => confirmer('Revenir à tous les repères par défaut ?', () => { const R2 = reglages(); R2.ref = { w: {}, x: {} }; D.enregistrer('reglages', R2); appliquerReperes(); afficher(); });
  }

  /* ================= Réglages ================= */
  function vueReglages(c) {
    titre('Réglages', 'Paramètres et synchronisation', I.reglages);
    const R = reglages(), E = D.etat(), cf = D.conf();
    const champ = (k, l, aide) => `<div class="champ"><label for="g-${k}">${l}</label><input id="g-${k}" data-g="${k}" type="number" inputmode="decimal" min="0" step="any" value="${R[k]}">${aide ? `<small class="aide">${aide}</small>` : ''}</div>`;
    c.innerHTML = `<div class="en-tete-page"><div><h1>Réglages</h1></div></div>
      <div class="deux-colonnes"><div class="colonne">
        <div class="carte"><h2>Capital</h2><div class="grille-champs">${champ('enveloppe', 'Enveloppe disponible (€)', 'commune à tous les biens')}${champ('seuilTravaux', 'Alerte de dépassement des travaux (%)')}</div></div>
        <div class="carte"><h2>Valeurs par défaut des nouveaux biens</h2><div class="grille-champs">
          ${champ('taux', 'Intérêts de l\'associé investisseur (% par an)')}${champ('obj', 'Objectif de marge nette (%)')}${champ('part', 'Part de l\'associé opérateur (%)')}${champ('pfu', 'Prélèvement sur dividendes (%)')}${champ('dmax', 'Durée maximum (mois)')}
          <div class="champ"><label for="g-tvaT">TVA sur les travaux</label><select id="g-tvaT" data-gs="tvaT"><option value="10">10 %</option><option value="20">20 %</option><option value="5.5">5,5 %</option></select></div>
          <div class="champ"><label for="g-tvaMode">TVA à la revente</label><select id="g-tvaMode" data-gs="tvaMode"><option value="marge">Sur la marge</option><option value="total">Sur le prix total</option><option value="none">Aucune</option></select></div>
        </div></div>
        ${carteCriteres(R)}
        <div class="carte"><h2>Affichage</h2><div class="segments" id="theme"><button data-v="clair" aria-pressed="${R.theme !== 'sombre'}">Clair</button><button data-v="sombre" aria-pressed="${R.theme === 'sombre'}">Sombre</button></div></div>
      </div><div class="colonne">
        <div class="carte"><h2>Synchronisation</h2><div class="compte">
          ${ligneCompte('Mode', E.mode === 'demo' ? 'Démonstration, données dans ce navigateur' : 'Serveur Google Apps Script')}
          ${E.mode === 'distant' ? ligneCompte('État', esc(E.message || 'À jour')) + ligneCompte('Modifications en attente', D.enAttente()) + ligneCompte('Serveur', `<small>${esc((cf.url || '').replace(/^https:\/\/script\.google\.com\/macros\/s\//, '…/').slice(0, 40))}</small>`) : ''}
        </div><div class="actions" style="margin-top:.8rem">
          ${E.mode === 'demo' ? '<button class="bouton bouton-principal" id="gConnect">Connecter un serveur</button><button class="bouton" id="gVider">Partir d\'une base vide</button><button class="bouton" id="gDemo">Recharger la démonstration</button>' : '<button class="bouton" id="gSync">Synchroniser</button><button class="bouton" id="gDeco">Se déconnecter</button><button class="bouton bouton-danger" id="gOubli">Oublier ce serveur</button>'}
        </div><p class="aide" style="margin-top:.6rem">Installation du serveur : voir marcheo/serveur/Code.gs. Gratuit, sur le compte Google de l'utilisateur.</p></div>
        <div class="carte"><h2>Sauvegarde</h2><div class="actions"><button class="bouton" id="gExport">Exporter (JSON)</button><label class="bouton" for="gImport">Importer</label><input id="gImport" type="file" accept=".json" hidden></div></div>
      </div></div>`;
    $('#g-tvaT').value = String(R.tvaT); $('#g-tvaMode').value = R.tvaMode;
    brancherCriteres(c);
    const sauver = (k, v) => { const R2 = reglages(); R2[k] = v; D.enregistrer('reglages', R2); cacheAnalyse.clear(); };
    $$('[data-g]', c).forEach(el => el.addEventListener('change', () => { sauver(el.dataset.g, nb(el.value)); notifier('Réglage enregistré.', 'succes'); }));
    $$('[data-gs]', c).forEach(el => el.addEventListener('change', () => sauver(el.dataset.gs, el.dataset.gs === 'tvaT' ? parseFloat(el.value) : el.value)));
    $('#theme').onclick = e => { const x = e.target.closest('button'); if (!x) return; sauver('theme', x.dataset.v); appliquerTheme(); afficher(); };
    const on = (id, f) => { const x = $('#' + id); if (x) x.onclick = f; };
    on('gConnect', () => ecranConnexion(true));
    on('gVider', () => confirmer('Effacer les données de démonstration et partir d\'une base vide ?', () => { D.reinitialiserDemo(); D.quitterDemo(); location.reload(); }));
    on('gDemo', () => confirmer('Remplacer les données de ce navigateur par la démonstration ?', () => { D.reinitialiserDemo(); location.reload(); }));
    on('gSync', () => D.synchroniser().then(() => { notifier('Synchronisation terminée.', 'succes'); afficher(); }));
    on('gDeco', () => D.deconnexion().then(() => location.reload()));
    on('gOubli', () => confirmer('Oublier l\'adresse du serveur sur cet appareil ? Les données restent sur le serveur.', () => { D.oublierServeur(); location.reload(); }));
    $('#gExport').onclick = () => { const blob = new Blob([JSON.stringify(D.exporter(), null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'marcheo-sauvegarde-' + aujourdhui() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
    $('#gImport').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const n = D.importer(JSON.parse(rd.result)); notifier(n + ' fiche(s) importée(s).', 'succes'); afficher(); } catch (err) { notifier(err.message, 'erreur'); } }; rd.readAsText(f); };
  }
  function appliquerTheme() { document.documentElement.dataset.theme = reglages().theme === 'sombre' ? 'sombre' : 'clair'; }

  /* ================= PDF ================= */
  function pdf(b) {
    if (!window.jspdf || !window.jspdf.jsPDF) { notifier('Le générateur de PDF n\'a pas pu se charger. Vérifier la connexion internet.', 'erreur'); return; }
    try {
      const A = analyse(b), journal = D.liste('journal').filter(j => j.bienId === b.id);
      const doc = window.MarcheoPDF.creer({ b, A, S: A.S, journal, contacts: D.liste('contacts'), etape: ETAPE[b.etape || 'repere'], pieces: PIECES, etats: ETATS });
      const d = new Date(), nom = 'marcheo-' + (A.S.adresse || 'bien').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + d.toISOString().slice(0, 10) + '.pdf';
      doc.save(nom); notifier('PDF créé.', 'succes');
    } catch (e) { console.error(e); notifier('Le PDF n\'a pas pu être créé : ' + e.message, 'erreur'); }
  }

  /* ================= Connexion ================= */
  function ecranConnexion(depuisDemo) {
    const cf = D.conf() || {};
    document.body.innerHTML = `<div class="page-connexion"><div class="carte boite-connexion">
      <div class="marque"><img class="logo" src="icone.svg" alt=""><span class="marque-titre">Marchéo</span></div>
      <form id="fConn"><div class="champ"><label for="cUrl">Adresse du serveur</label><input id="cUrl" type="url" inputmode="url" required value="${esc(cf.url || '')}" placeholder="https://script.google.com/macros/s/…/exec"><small class="aide">Adresse de l'application Web Apps Script, à saisir une fois par appareil.</small></div>
      <div class="champ"><label for="cId">Identifiant</label><input id="cId" autocomplete="username" required autocapitalize="off"></div>
      <div class="champ"><label for="cMdp">Mot de passe</label><input id="cMdp" type="password" autocomplete="current-password" required></div>
      <button class="bouton bouton-principal" style="width:100%" type="submit">Se connecter</button><p id="cMsg" class="aide" role="status" style="margin-top:.6rem"></p></form>
      <button class="bouton-lien" id="cDemo">${depuisDemo ? 'Revenir à la démonstration' : 'Ouvrir la démonstration'}</button></div></div><div id="notifications"></div>`;
    $('#fConn').onsubmit = async e => {
      e.preventDefault(); const msg = $('#cMsg'); msg.textContent = 'Connexion…'; msg.className = 'aide';
      try { await D.connexion($('#cUrl').value, $('#cId').value.trim().toLowerCase(), $('#cMdp').value); location.hash = '#/tableau'; location.reload(); }
      catch (err) { msg.textContent = err.message; msg.className = 'aide rouge'; }
    };
    $('#cDemo').onclick = () => { D.oublierServeur(); location.reload(); };
  }

  /* ================= Démarrage ================= */
  function coquille() {
    document.body.innerHTML = `<div class="app">
      <aside class="nav-laterale"><div class="panneau-tete"><a class="marque" href="#/tableau"><img class="logo" src="icone.svg" alt=""><span class="marque-titre">Marchéo</span></a></div>
        <div class="recherche-modules"><span class="loupe">${I.loupe}</span><input id="rechercheModule" type="search" placeholder="Rechercher un module" aria-label="Rechercher un module"></div>
        <nav class="liste-modules" id="listeModules"></nav>
        <div class="panneau-pied"><span class="avatar">AO</span><span class="pied-texte"><strong id="nomUtilisateur">Associé opérateur</strong><small id="modeUtilisateur"></small></span></div></aside>
      <main class="principal"><header class="barre-haut"><button class="bouton-icone bouton-menu" id="bMenu" aria-label="Menu">${I.menu}</button><div class="titre-module" id="titreModule"></div><span class="espace"></span><span class="etat-synchro" id="etatSynchro"></span></header>
        ${D.etat().mode === 'demo' ? '<div class="bandeau-demo">Mode démonstration : données fictives stockées dans ce navigateur.</div>' : ''}
        <section class="contenu" id="contenu"></section></main></div><div id="notifications"></div>`;
    $('#bMenu').onclick = () => $('.app').classList.toggle('menu-ouvert');
    $('.app').addEventListener('click', e => { if (e.target === $('.app')) $('.app').classList.remove('menu-ouvert'); });
    $('#rechercheModule').oninput = majNav;
    $('#rechercheModule').onkeydown = e => { if (e.key === 'Enter') { const a = $('#listeModules a'); if (a) { aller(a.getAttribute('href')); e.target.value = ''; } } };
    const E = D.etat(); $('#modeUtilisateur').textContent = E.mode === 'demo' ? 'Démonstration' : (E.utilisateur || 'Connecté');
  }
  function demarrer() {
    const E = D.demarrer();
    if (E.mode === 'distant' && !E.session) { ecranConnexion(false); return; }
    appliquerTheme(); coquille(); appliquerReperes();
    D.abonner(e => { majSynchro(e); if (e.mode === 'distant' && e.session === false) ecranConnexion(false); });
    majSynchro(E);
    /* Données reçues d'un autre appareil : on redessine hors saisie en cours. */
    let dernier = '';
    D.abonner(() => { const k = D.liste('biens').map(b => b._maj).join() + D.liste('relances').length + D.liste('contacts').length + D.liste('journal').length + D.liste('annonces').map(x => x._maj).join(); if (k !== dernier) { dernier = k; const a = document.activeElement; if (!a || !/INPUT|TEXTAREA|SELECT/.test(a.tagName)) { cacheAnalyse.clear(); afficher(); } else majNav(); } });
    window.addEventListener('hashchange', afficher);
    afficher();
  }
  window.Marcheo = { ETAPES, PIECES, analyse, partsRepartition, COULEURS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
