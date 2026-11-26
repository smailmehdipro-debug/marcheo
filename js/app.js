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
    else if (S.trvForfait != null) S.trvReel = S.trvForfait; // budget forfaitaire repris de l'annonce, tant que le détail des postes n'est pas choisi
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
    { g: 'Acquisition', id: 'visite', l: 'Visite', d: 'Page mobile de visite', i: I.biens, href: 'visite.html' },
    { g: 'Acquisition', id: 'biens', l: 'Projets en cours', d: 'Du repérage à la vente', i: I.biens },
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
    if (!$('#listeModules')) return; // page Visite : pas de menu latéral
    const r = route(), q = ($('#rechercheModule') || {}).value || '', C = compteurs();
    const mods = MODULES.filter(m => !q || (m.l + ' ' + m.d).toLowerCase().includes(q.toLowerCase()));
    let g = '', h = '';
    mods.forEach(m => {
      if (m.g !== g) { g = m.g; h += `<div class="nav-groupe">${esc(g)}</div>`; }
      const n = m.id === 'relances' ? C.relances : m.id === 'biens' ? C.biens : m.id === 'annonces' ? C.annonces : 0;
      const actif = r.m === m.id || (r.m === 'bien' && m.id === 'biens');
      h += `<a class="nav-lien${actif ? ' actif' : ''}" href="${m.href || '#/' + m.id}"><span class="pastille-module">${m.i}</span><span class="nav-texte"><span class="nav-libelle">${esc(m.l)}</span><span class="nav-desc">${esc(m.d)}</span></span>${n ? `<span class="nav-compteur${m.id === 'relances' && C.retard ? ' alerte' : ''}">${n}</span>` : ''}</a>`;
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
    if (MODE_VISITE) { vueVisiteAccueil(); return; }
    const r = route(), c = $('#contenu');
    $('.app').classList.remove('menu-ouvert');
    majNav();
    const cle = r.m + '/' + r.id + '/' + r.o;
    const garderDefilement = cle === vueCourante;
    if (!garderDefilement) $$('.modale-fond').forEach(m => m.remove()); // changement de page : les fenêtres ouvertes se ferment
    vueCourante = cle;
    const y = c.scrollTop, yw = window.scrollY;
    try {
      ({ tableau: vueTableau, annonces: vueAnnonces, biens: vueBiens, bien: vueBien, comparateur: vueComparateur, relances: vueRelances, contacts: vueContacts, reperes: vueReperes, reglages: vueReglages }[r.m] || vueTableau)(c, r);
    } catch (e) { console.error(e); c.innerHTML = `<div class="alerte-bandeau">Erreur d'affichage : ${esc(e.message)}</div>`; }
    if (garderDefilement) { c.scrollTop = y; window.scrollTo(0, yw); } else { c.scrollTop = 0; window.scrollTo(0, 0); }
  }

  /* ================= Tableau de bord ================= */
  function vueTableau(c) {
    titre('Tableau de bord', 'Prospection, projets, capital, bilan', I.tableau);
    const R = reglages(), biens = D.liste('biens'), t = aujourdhui();
    const parEtape = Object.fromEntries(ETAPES.map(e => [e[0], biens.filter(b => (b.etape || 'repere') === e[0])]));
    const engages = biens.filter(b => ENGAGE.includes(b.etape)), engage = engages.reduce((s, b) => s + analyse(b).r.treso, 0);
    const offres = parEtape.offre, journal = D.liste('journal');
    const montantOffre = b => { const o = journal.filter(j => j.bienId === b.id && (j.type === 'offre' || j.type === 'contre') && j.montant).sort((a, z) => (z.date || '').localeCompare(a.date || ''))[0]; return o ? o.montant : 0; };
    const rel = D.liste('relances').filter(x => !x.fait), duJour = rel.filter(x => x.date === t), retard = rel.filter(x => x.date && x.date < t);
    const depass = biens.filter(b => b.etape === 'chantier' && analyse(b).chantier && analyse(b).chantier.alerte);
    const actifs = biens.filter(b => !['ecarte', 'vendu'].includes(b.etape));
    const suivis = actifs.filter(b => RANG[b.etape || 'repere'] >= RANG.compromis).map(b => [b, suiviProjet(b)]), enRetard = suivis.filter(x => x[1].retard > 0);
    const margeMoy = actifs.length ? actifs.reduce((s, b) => s + analyse(b).r.m, 0) / actifs.length : 0;
    const dispo = R.enveloppe - engage;
    const annonces = D.liste('annonces').filter(aExaminer).sort((x, y) => (evalAnnonce(y).score || 0) - (evalAnnonce(x).score || 0));
    c.innerHTML = `
      <div class="en-tete-page"><div><h1>Tableau de bord</h1><p>Au ${dateFr(t)}</p></div>
        <div class="actions"><a class="bouton bouton-vert" href="visite.html">Visite</a><button class="bouton bouton-principal" id="nouveauBien">+ Nouveau projet</button></div></div>
      <div class="section-titre"><h2>Prospection</h2></div>
      <div class="indicateurs">
        ${indic('Annonces à examiner', annonces.length, { etat: annonces.length ? 'vert' : '', detail: annonces.length ? 'passent les trois étapes du tri' : 'aucune pour l\'instant', lien: '#/annonces/examiner' })}
        ${indic('Relances du jour', duJour.length, { detail: retard.length ? retard.length + ' en retard' : 'aucune en retard', etat: retard.length ? 'rouge' : '', lien: '#/relances' })}
        ${indic('Offres en cours', offres.length, { detail: offres.length ? eur(offres.reduce((s, b) => s + montantOffre(b), 0)) + ' offerts' : 'aucune', lien: '#/biens' })}
      </div>
      <div class="deux-colonnes">
        <div class="carte"><h2>Annonces à examiner</h2>${annonces.length ? `<div class="compte">${annonces.slice(0, 6).map(a => { const e = evalAnnonce(a); return ligneCompte(`<a href="#/annonces/a/${a.id}">${esc(a.titre || 'Annonce')}</a><small class="discret">${esc([a.ville, e.surface ? e.surface + ' m²' : '', a.source].filter(Boolean).join(' · '))}</small>`, eur(e.prix) + `<small class="sous-ligne vert">marge brute ${pc(e.margeBrute, 0)}</small>`); }).join('')}</div>${annonces.length > 6 ? `<p class="aide"><a href="#/annonces/examiner">Voir les ${annonces.length} annonces</a></p>` : ''}` : '<div class="vide">Aucune annonce à examiner.</div>'}</div>
        <div class="carte"><h2>À faire</h2>${listeRelances(retard.concat(duJour), true) || '<div class="vide">Rien d\'échu.</div>'}</div>
      </div>
      <div class="section-titre"><h2>Projets en cours</h2></div>
      <div class="indicateurs">
        ${indic('Projets actifs', actifs.length, { detail: parEtape.vendu.length + ' vendu(s), ' + parEtape.ecarte.length + ' écarté(s)', lien: '#/biens' })}
        ${indic('Projets en retard', enRetard.length, { detail: enRetard.length ? enRetard.map(x => esc(titreBien(x[0]))).join(', ') : 'aucun', etat: enRetard.length ? 'rouge' : '' })}
        ${indic('Chantiers en dépassement', depass.length, { detail: depass.length ? depass.map(b => esc(titreBien(b))).join(', ') : 'aucun', etat: depass.length ? 'rouge' : '' })}
        ${indic('Marge nette moyenne', pc(margeMoy), { detail: 'projets actifs, objectif ' + R.obj + ' %', etat: margeMoy >= R.obj / 100 ? 'vert' : 'orange' })}
      </div>
      <div class="deux-colonnes">
        <div class="carte"><h2>Projets par étape</h2>
          <div class="compte">${ETAPES.filter(e => parEtape[e[0]].length || !['ecarte', 'vendu'].includes(e[0])).map(e => ligneCompte(`<a href="#/biens" data-filtre-etape="${e[0]}">${e[1]}</a>`, parEtape[e[0]].length + (ENGAGE.includes(e[0]) && parEtape[e[0]].length ? ' · ' + eur(parEtape[e[0]].reduce((s, b) => s + analyse(b).r.treso, 0)) : ''))).join('')}</div>
        </div>
        <div class="carte"><h2>Prochaines actions</h2>${prochainesActions(actifs)}</div>
      </div>
      <div class="section-titre"><h2>Capital</h2></div>
      <div class="indicateurs">
        ${indic('Enveloppe', eur(R.enveloppe), { detail: 'modifiable dans les Réglages', lien: '#/reglages' })}
        ${indic('Capital engagé', eur(engage), { detail: engages.length + ' projet(s), trésorerie maximale', etat: engage > R.enveloppe ? 'rouge' : '' })}
        ${indic('Capital disponible', eur(dispo), { detail: pc(R.enveloppe ? dispo / R.enveloppe : 0, 0) + ' de l\'enveloppe', etat: dispo < 0 ? 'rouge' : dispo < R.enveloppe * .2 ? 'orange' : 'vert', c: dispo < 0 ? 'rouge' : '' })}
      </div>
      <div class="section-titre"><h2>Bilan comptable</h2></div>
      ${bilanComptable(biens)}`;
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
    titre('Projets en cours', 'Du repérage à la vente', I.biens);
    c.innerHTML = `
      <div class="en-tete-page"><div><h1>Projets en cours</h1></div><div class="actions">
        <div class="segments" role="group" aria-label="Affichage"><button data-vue="liste" aria-pressed="${filtres.vue === 'liste'}">Liste</button><button data-vue="colonnes" aria-pressed="${filtres.vue === 'colonnes'}">Colonnes</button></div>
        <button class="bouton bouton-principal" id="nouveauBien">+ Nouveau projet</button></div></div>
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
    if (!l.length) { z.innerHTML = '<div class="vide">Aucun projet ne correspond.</div>'; return; }
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
    modale('Nouveau projet', `<div class="grille-champs">
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
  const ONGLETS = [['synthese', 'Synthèse'], ['visite', 'Visite'], ['avancement', 'Avancement'], ['simulation', 'Simulation'], ['travaux', 'Travaux'], ['journal', 'Journal'], ['contacts', 'Contacts'], ['pieces', 'Pièces'], ['comparables', 'Comparables']];
  function vueBien(c, r) {
    const b = D.obtenir('biens', r.id);
    if (!b) { c.innerHTML = '<div class="vide">Bien introuvable. <a href="#/biens">Retour à la liste</a></div>'; return; }
    b.sim = M.normalize(b.sim); b.comps = b.comps || []; b.pieces = b.pieces || {}; b.liens = b.liens || []; b.travaux = b.travaux || { lignes: [], utiliserReel: false };
    const o = ONGLETS.some(x => x[0] === r.o) ? r.o : 'synthese', A = analyse(b);
    titre(titreBien(b), typeBien(b) + ' · ' + ETAPE[b.etape || 'repere'], I.biens);
    const courant = RANG[b.etape || 'repere'];
    c.innerHTML = `
      <div class="fiche-tete"><div><a class="bouton-lien" href="#/biens">${'‹'} Projets en cours</a><h1>${esc(titreBien(b))}</h1><div class="sous">${esc(typeBien(b))} · ${surfaceBien(b)}${b.source ? ' · ' + esc(b.source) : ''}${b.lien ? ` · <a href="${esc(b.lien)}" target="_blank" rel="noopener">annonce</a>` : ''}</div></div>
        <div class="actions"><span id="enteteMarge">${voyantEtat(A.etat)}</span><button class="bouton bouton-petit bouton-vert" id="bVisite">${b.visiteBrouillon ? 'Reprendre la visite' : 'Visite'}</button><button class="bouton bouton-petit" id="bPdf">PDF</button><button class="bouton bouton-petit" id="bDup">Dupliquer</button><button class="bouton bouton-petit bouton-danger" id="bSuppr">Supprimer</button></div></div>
      <div class="etapes" role="group" aria-label="Étape">${ETAPES.map((e, i) => `<button data-etape="${e[0]}" class="${e[0] === 'ecarte' ? 'ecarte ' : ''}${e[0] === (b.etape || 'repere') ? 'courante' : (b.etape !== 'ecarte' && i < courant ? 'passee' : '')}" aria-pressed="${e[0] === (b.etape || 'repere')}">${e[1]}</button>`).join('')}</div>
      ${b.etape === 'ecarte' && b.motif ? `<div class="info-bandeau">Écarté : ${esc(b.motif)}</div>` : ''}
      <nav class="onglets" role="tablist">${ONGLETS.map(x => `<button role="tab" class="${x[0] === o ? 'actif' : ''}" data-onglet="${x[0]}">${x[1]}${x[0] === 'journal' ? ' ' + compteJournal(b) : x[0] === 'pieces' ? ' ' + compteurPieces(b) : ''}</button>`).join('')}</nav>
      <div id="ongletContenu"></div>`;
    $$('[data-etape]', c).forEach(x => x.onclick = () => { if (x.dataset.etape !== b.etape) changerEtape(b, x.dataset.etape); });
    $$('[data-onglet]', c).forEach(x => x.onclick = () => aller('#/bien/' + b.id + '/' + x.dataset.onglet));
    $('#bPdf').onclick = () => pdf(b);
    $('#bVisite').onclick = () => ouvrirVisite(b);
    $('#bDup').onclick = () => { const n = clone(b); delete n.id; delete n._maj; n.sim.adresse = (n.sim.adresse || '') + ' (copie)'; n.etape = 'etude'; const x = D.enregistrer('biens', n); aller('#/bien/' + x.id); };
    $('#bSuppr').onclick = () => confirmer('Supprimer définitivement ce bien, son journal et ses relances ?', () => {
      D.liste('journal').filter(j => j.bienId === b.id).forEach(j => D.supprimer('journal', j.id));
      D.liste('relances').filter(j => j.bienId === b.id).forEach(j => D.supprimer('relances', j.id));
      D.supprimer('biens', b.id); aller('#/biens');
    });
    const z = $('#ongletContenu');
    ({ synthese: ongletSynthese, visite: ongletVisite, avancement: ongletAvancement, simulation: ongletSimulation, travaux: ongletTravaux, journal: ongletJournal, contacts: ongletContacts, pieces: ongletPieces, comparables: ongletComparables }[o])(z, b);
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
      const note = $('#trvReelNote'); note.hidden = !r.reel;
      if (r.reel && S.trvForfait != null && !(b.travaux && b.travaux.utiliserReel)) {
        note.innerHTML = 'Le calcul retient le budget forfaitaire ' + (S.trvForfaitOrigine === 'visite' ? 'de la visite' : 'de l\'annonce') + ' : <b>' + eur(r.T) + '</b>, aléas compris. Les postes ci-dessus ne comptent pas. <button type="button" class="bouton-lien" id="trvDetail">Chiffrer poste par poste</button>';
        $('#trvDetail').onclick = () => { S.trvForfait = null; maj(); };
      } else if (r.reel) note.textContent = 'Le calcul retient le coût réel du chantier : ' + eur(r.T) + ' (onglet Travaux).';
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

  /* ================= Mode Visite (téléphone) ================= */
  /* Parcours en QCM, une étape par écran, photos à chaque étape. Les réponses cochent les postes de travaux,
     fixent le niveau, les charges, la taxe foncière et le DPE du projet. */
  const ETAT4 = ['Neufs', 'Bon état', 'Passables', 'À refaire'];
  const VISITE = [
    { id: 'arrivee', t: 'Arrivée et immeuble', aide: 'Photo de la façade et de l\'entrée en arrivant.', q: [
      { id: 'typologie', l: 'Typologie', o: ['Studio', 'F2', 'F3 ou plus'] },
      { id: 'communs', l: 'Parties communes', o: ['Bon état', 'Passables', 'Dégradées'] },
      { id: 'facade', l: 'Façade et toiture vues de dehors', o: ['Bon état', 'Passables', 'Dégradées'] },
      { id: 'etage', l: 'Étage', o: ['RDC', '1er', '2e', '3e', '4e et +'] },
      { id: 'ascenseur', l: 'Ascenseur', o: ['Oui', 'Non'] }] },
    { id: 'sejour', t: 'Pièce de vie', q: [
      { id: 'sols', l: 'Sols', o: ETAT4 },
      { id: 'murs', l: 'Murs et plafonds', o: ['Bon état', 'À rafraîchir', 'À reprendre (enduits, fissures)'] },
      { id: 'fenetres', l: 'Fenêtres', o: ['Double vitrage récent', 'Double vitrage ancien', 'Simple vitrage'] },
      { id: 'lumiere', l: 'Luminosité', o: ['Lumineux', 'Moyen', 'Sombre'] }] },
    { id: 'chambre', t: 'Chambre', q: [
      { id: 'sols', l: 'Sols', o: ETAT4 },
      { id: 'murs', l: 'Murs et plafonds', o: ['Bon état', 'À rafraîchir', 'À reprendre (enduits, fissures)'] },
      { id: 'fenetres', l: 'Fenêtres', o: ['Double vitrage récent', 'Double vitrage ancien', 'Simple vitrage'] }] },
    { id: 'cuisine', t: 'Cuisine', q: [
      { id: 'etat', l: 'État', o: ['Récente', 'Correcte', 'À refaire', 'Absente'] },
      { id: 'type', l: 'Disposition', o: ['Ouverte', 'Séparée', 'Coin cuisine'] }] },
    { id: 'sdb', t: 'Salle d\'eau et WC', q: [
      { id: 'etat', l: 'Salle d\'eau', o: ['Récente', 'Correcte', 'À refaire'] },
      { id: 'wc', l: 'WC', o: ['Séparés, bon état', 'Séparés, à refaire', 'Dans la salle d\'eau'] },
      { id: 'ventilation', l: 'Ventilation', o: ['VMC', 'Fenêtre', 'Aucune'] }] },
    { id: 'chauffage', t: 'Chauffage et eau chaude', q: [
      { id: 'energie', l: 'Chauffage', o: ['Gaz, chaudière', 'Électrique', 'Pompe à chaleur', 'Collectif'] },
      { id: 'mode', l: 'Installation', o: ['Individuelle', 'Collective'] },
      { id: 'radiateurs', l: 'Radiateurs', o: ['Neufs', 'Bon état', 'Passables', 'À changer'] },
      { id: 'ecs', l: 'Eau chaude', o: ['Chaudière', 'Ballon électrique', 'Collective'] },
      { id: 'ballon', l: 'Ballon ou chaudière', o: ['Récent', 'Ancien', 'Sans objet'] }] },
    { id: 'electricite', t: 'Électricité', q: [
      { id: 'tableau', l: 'Tableau électrique', o: ['Récent, aux normes', 'Ancien', 'Vétuste, à fusibles'] },
      { id: 'terre', l: 'Prises reliées à la terre', o: ['Oui', 'En partie', 'Non'] }] },
    { id: 'eau', t: 'Plomberie et humidité', q: [
      { id: 'humidite', l: 'Traces d\'humidité', o: ['Aucune', 'Légères', 'Importantes'] },
      { id: 'fuites', l: 'Fuites ou dégâts des eaux', o: ['Non', 'Traces anciennes', 'Oui'] },
      { id: 'canalisations', l: 'Canalisations visibles', o: ['Récentes', 'Anciennes', 'Plomb'] }] },
    { id: 'questions', t: 'Questions à poser', aide: 'À poser en fin de rendez-vous.', photo: false, q: [
      { id: 'dpe', l: 'DPE', o: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'Inconnu'] },
      { id: 'charges', l: 'Charges de copropriété par an', o: ['Moins de 600 €', '600 à 1 200 €', '1 200 à 2 000 €', 'Plus de 2 000 €'], saisie: '€ par an, si connu' },
      { id: 'travauxVotes', l: 'Travaux votés en copropriété', o: ['Aucun', 'Oui', 'Ne sait pas'], saisie: 'montant, si connu' },
      { id: 'procedures', l: 'Procédures en cours dans la copropriété', o: ['Non', 'Oui', 'Ne sait pas'] },
      { id: 'taxeFonciere', l: 'Taxe foncière par an', o: [], saisie: '€ par an' },
      { id: 'motif', l: 'Motif de la vente', o: ['Succession', 'Mutation', 'Divorce', 'Investisseur', 'Autre'] },
      { id: 'enVente', l: 'En vente depuis', o: ['Moins d\'1 mois', '1 à 3 mois', '3 à 6 mois', 'Plus de 6 mois'] },
      { id: 'offres', l: 'Offres déjà reçues', o: ['Aucune', 'Oui'] },
      { id: 'negociable', l: 'Prix négociable', o: ['Oui', 'Peut-être', 'Non'] },
      { id: 'occupation', l: 'Occupation', o: ['Libre', 'Occupé par le vendeur', 'Loué'] }] },
    { id: 'bilan', t: 'Bilan', photo: false, q: [
      { id: 'suite', l: 'Suite à donner', o: ['Faire une offre', 'Rappeler', 'Écarter'] }] }
  ];
  const CHARGES_MILIEU = { 'Moins de 600 €': 450, '600 à 1 200 €': 900, '1 200 à 2 000 €': 1600, 'Plus de 2 000 €': 2500 };
  /* Réponses → postes de travaux, niveau, alertes */
  function analyseVisite(R, b) {
    const v = (e, q) => (R[e] || {})[q] || '', postes = new Set(['nett', 'peint', 'deco']), alertes = [], lourds = new Set();
    const ajoute = (p, lourd) => { postes.add(p); if (lourd) lourds.add(p); };
    ['sejour', 'chambre'].forEach(e => {
      if (e === 'chambre' && estStudio(R)) return;
      if (['Passables', 'À refaire'].includes(v(e, 'sols'))) ajoute('sols');
      if (v(e, 'murs').startsWith('À reprendre')) { ajoute('enduit', true); ajoute('peint'); }
      if (v(e, 'fenetres') === 'Simple vitrage') ajoute('fen', true);
    });
    if (['À refaire', 'Absente'].includes(v('cuisine', 'etat'))) ajoute('cuis', true);
    if (v('sdb', 'etat') === 'À refaire') ajoute('sdb', true);
    if (v('sdb', 'wc') === 'Séparés, à refaire') ajoute('wc');
    if (v('sdb', 'ventilation') === 'Aucune') ajoute('vmc');
    if (['Passables', 'À changer'].includes(v('chauffage', 'radiateurs'))) ajoute('chauf', v('chauffage', 'radiateurs') === 'À changer');
    if (v('chauffage', 'ballon') === 'Ancien') ajoute('ecs');
    if (v('electricite', 'tableau') !== '' && v('electricite', 'tableau') !== 'Récent, aux normes' || v('electricite', 'terre') === 'Non') ajoute('elec', true);
    if (v('eau', 'fuites') === 'Oui' || ['Anciennes', 'Plomb'].includes(v('eau', 'canalisations'))) ajoute('plomb', true);
    if (v('eau', 'humidite') === 'Importante' || v('eau', 'humidite') === 'Importantes') { ajoute('macon', true); alertes.push('Humidité importante : chercher la cause avant toute offre.'); }
    if (v('eau', 'canalisations') === 'Plomb') alertes.push('Canalisations en plomb : à remplacer.');
    if (v('electricite', 'tableau') === 'Vétuste, à fusibles') alertes.push('Électricité vétuste : réfection complète.');
    if (v('questions', 'procedures') === 'Oui') alertes.push('Procédure en cours dans la copropriété : demander les procès-verbaux.');
    if (v('questions', 'travauxVotes') === 'Oui') alertes.push('Travaux votés : qui les paie ? À négocier dans le prix.');
    if (v('questions', 'occupation') === 'Loué') alertes.push('Bien loué : vente occupée, délai de libération.');
    if (['Dégradées'].includes(v('arrivee', 'communs')) || v('arrivee', 'facade') === 'Dégradées') alertes.push('Immeuble dégradé : risque de travaux de copropriété.');
    if (['F', 'G'].includes(v('questions', 'dpe'))) alertes.push('DPE ' + v('questions', 'dpe') + (v('questions', 'dpe') === 'G' ? ' : location interdite depuis 2025' : ' : location interdite à partir de 2028') + '. Argument de négociation ; viser une meilleure étiquette après travaux.');
    const niveau = lourds.size >= 5 || (lourds.has('elec') && lourds.has('plomb') && lourds.has('macon')) ? 'l' : lourds.size >= 2 ? 'c' : 'r';
    /* Budgets : au m² selon les critères, et poste par poste selon les repères */
    const S = M.normalize(clone(b.sim)), C = Object.assign({}, MA.CRITERES_DEF, reglages().criteres || {}), BT = Object.assign({}, MA.CRITERES_DEF.travaux, C.travaux || {}), bt = BT[niveau];
    const typo = (R.arrivee || {}).typologie, pieces = estStudio(R) ? 1 : typo === 'F2' ? 2 : typo === 'F3 ou plus' ? Math.max(3, +S.pieces || 3) : Math.max(+S.pieces || 1, R.chambre && Object.keys(R.chambre).length ? 2 : 1);
    const budgetM2 = Math.round(Math.max(+bt.min || 0, (+bt.m2 || 0) * S.surf + (+bt.piece || 0) * pieces) * (1 + S.aleas / 100));
    M.W.forEach(i => { if (S.w[i.id]) { S.w[i.id].on = M.vis(i, S.type) && postes.has(i.id); S.w[i.id].val = null; } });
    S.niveau = niveau; S.trvForfait = null; S.trvReel = null;
    const budgetPostes = Math.round(M.travaux(S).tot);
    return { postes: [...postes], niveau, alertes, budgetM2, budgetPostes, pieces };
  }
  function compteRendu(R) {
    return VISITE.filter(e => e.id !== 'bilan').map(e => {
      const x = R[e.id] || {}; if (e.id === 'chambre' && estStudio(R)) return '';
      const l = e.q.map(q => x[q.id] || x[q.id + '_saisie'] ? q.l + ' : ' + [x[q.id], x[q.id + '_saisie'] ? x[q.id + '_saisie'] + (q.saisie && q.saisie.startsWith('€') ? ' €' : '') : ''].filter(Boolean).join(', ') : '').filter(Boolean);
      const notes = e.q.map(q => x[q.id + '_note'] ? q.l + ' : ' + x[q.id + '_note'] : '').filter(Boolean);
      return l.length ? e.t + ' — ' + l.join(' ; ') + (notes.length ? ' ; notes : ' + notes.join(' ; ') : '') + '.' : '';
    }).filter(Boolean).join('\n');
  }
  /* Un écran par point : question, réponses en grands boutons, photos du point. Toucher une réponse passe au point suivant. */
  const estStudio = R => (R.arrivee || {}).typologie === 'Studio' || !!(R.chambre || {})._saute;
  function pointsVisite(R) {
    const l = [];
    VISITE.forEach(e => { if (e.id === 'chambre' && estStudio(R)) return; e.q.forEach((q, i) => l.push({ e, q, rang: i + 1, total: e.q.length })); });
    return l;
  }
  function ouvrirVisite(b, apresFin) {
    b.visiteBrouillon = b.visiteBrouillon || { debut: new Date().toISOString(), point: 0, reponses: {}, photos: [], budget: 'm2' };
    const V = b.visiteBrouillon; if (V.point == null) V.point = 0;
    const ecran = document.createElement('div'); ecran.className = 'visite'; document.body.appendChild(ecran);
    const sauver = () => sauverPlusTard('biens', b, 300);
    let sommaire = false, minuteurAvance = null;
    const dessiner = () => {
      const P = pointsVisite(V.reponses); V.point = Math.min(V.point, P.length - 1);
      const { e: E, q: Q, rang, total } = P[V.point], R = V.reponses[E.id] = V.reponses[E.id] || {};
      const bilan = E.id === 'bilan', A = bilan ? analyseVisite(V.reponses, b) : null;
      const photos = V.photos.filter(p => p.etape === E.id && (p.point || '') === Q.id);
      const repondu = Q.o.length ? !!R[Q.id] : !!R[Q.id + '_saisie'];
      const faits = P.filter(x => (V.reponses[x.e.id] || {})[x.q.id] || (V.reponses[x.e.id] || {})[x.q.id + '_saisie']).length;
      ecran.innerHTML = `
        <header class="visite-tete"><button class="bouton-icone" data-v="fermer" aria-label="Fermer">${I.fermer}</button><div><strong>Visite</strong><small>${esc(titreBien(b))}</small></div><button class="bouton bouton-petit visite-sommaire-bouton" data-v="sommaire">Sommaire</button><span class="visite-chrono">${Math.max(0, Math.round((Date.now() - new Date(V.debut)) / 60000))} min</span></header>
        <div class="visite-progression"><span style="width:${Math.round((V.point + 1) / P.length * 100)}%"></span></div>
        ${sommaire ? `<main class="visite-corps"><h2>Sommaire</h2><div class="compte">${VISITE.filter(e => !(e.id === 'chambre' && estStudio(V.reponses))).map(e => { const i = P.findIndex(x => x.e.id === e.id), n = e.q.filter(q => (V.reponses[e.id] || {})[q.id] || (V.reponses[e.id] || {})[q.id + '_saisie']).length; return `<button class="visite-sommaire${P[V.point].e.id === e.id ? ' actif' : ''}" data-saut-point="${i}"><span>${esc(e.t)}</span><b class="${n === e.q.length ? 'vert' : ''}">${n} / ${e.q.length}</b></button>`; }).join('')}</div><p class="aide">${faits} point(s) renseigné(s) sur ${P.length}.</p></main>` : `
        <main class="visite-corps">
          <div class="visite-section">${esc(E.t)} · ${rang} / ${total}</div>
          <h2>${esc(Q.l)}</h2>${rang === 1 && E.aide ? `<p class="aide">${esc(E.aide)}</p>` : ''}
          ${Q.o.length ? `<div class="puces puces-point">${Q.o.map(o => `<button class="puce${R[Q.id] === o ? ' choisie' : ''}" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>` : ''}
          ${Q.saisie ? `<input class="visite-saisie" data-saisie inputmode="numeric" placeholder="${esc(Q.saisie)}" value="${esc(R[Q.id + '_saisie'] || '')}">` : ''}
          ${A ? `<div class="visite-bilan">
              <div class="compte">${ligneCompte('Niveau de travaux', M.NIVEAUX[A.niveau])}${ligneCompte('Budget au m² (tes critères)', eur(A.budgetM2), { s: A.pieces + ' pièce(s), aléas compris' })}${ligneCompte('Budget poste par poste (repères)', eur(A.budgetPostes))}</div>
              <div class="visite-l" style="margin-top:.8rem">Postes à prévoir</div><div class="etiquettes">${A.postes.map(p => `<span class="etiquette">${esc((M.W.find(i => i.id === p) || { l: p }).l.split(',')[0])}</span>`).join('')}</div>
              <div class="segments" style="margin:.6rem 0"><button data-budget="m2" aria-pressed="${V.budget !== 'postes'}">Retenir le budget au m²</button><button data-budget="postes" aria-pressed="${V.budget === 'postes'}">Retenir le détail</button></div>
              ${A.alertes.map(x => `<div class="alerte-bandeau">${esc(x)}</div>`).join('')}
              ${faits < P.length - 1 ? `<p class="aide orange">${P.length - 1 - faits} point(s) sans réponse : « Sommaire » pour y revenir.</p>` : ''}
            </div>` : ''}
          ${bilan ? '' : `<div class="visite-photos">${photos.map(p => `<img data-photo="${p.id}" alt="">`).join('')}<label class="bouton visite-photo">${photos.length ? 'Autre photo' : 'Photo'}<input type="file" accept="image/*" capture="environment" multiple hidden data-prise></label></div>`}
          <details class="visite-note-bloc"${R[Q.id + '_note'] ? ' open' : ''}><summary>Note</summary><textarea class="visite-note" data-note rows="2">${esc(R[Q.id + '_note'] || '')}</textarea></details>
        </main>`}
        <footer class="visite-pied"><button class="bouton" data-v="prec"${V.point === 0 && !sommaire ? ' disabled' : ''}>‹ Précédent</button>${sommaire ? '<button class="bouton bouton-principal" data-v="retour">Reprendre</button>' : bilan ? '<button class="bouton bouton-principal" data-v="fin">Enregistrer la visite</button>' : `<button class="bouton ${repondu ? 'bouton-principal' : ''}" data-v="suiv">${repondu ? 'Suivant ›' : 'Passer ›'}</button>`}</footer>`;
      const aller_ = i => { clearTimeout(minuteurAvance); sommaire = false; V.point = Math.max(0, Math.min(P.length - 1, i)); sauver(); dessiner(); };
      $$('img[data-photo]', ecran).forEach(img => { const m = V.photos.find(p => p.id === img.dataset.photo); MarcheoPhotos.url(m).then(u => { if (u) img.src = u; }).catch(() => {}); });
      $$('[data-o]', ecran).forEach(x => x.onclick = () => {
        const nouveau = R[Q.id] !== x.dataset.o; R[Q.id] = nouveau ? x.dataset.o : '';
        if (E.id === 'arrivee' && Q.id === 'typologie') { V.reponses.chambre = V.reponses.chambre || {}; V.reponses.chambre._saute = R[Q.id] === 'Studio'; }
        sauver(); dessiner();
        /* réponse donnée : point suivant, sauf si une saisie complète la réponse ou si c'est le bilan */
        if (nouveau && !Q.saisie && !bilan) minuteurAvance = setTimeout(() => aller_(V.point + 1), 280);
      });
      const sa = $('[data-saisie]', ecran); if (sa) sa.oninput = () => { R[Q.id + '_saisie'] = sa.value.replace(/[^\d]/g, ''); sauver(); const s = $('[data-v="suiv"]', ecran); if (s) { s.textContent = 'Suivant ›'; s.classList.add('bouton-principal'); } };
      const no = $('[data-note]', ecran); if (no) no.oninput = () => { R[Q.id + '_note'] = no.value; sauver(); };
      $$('[data-budget]', ecran).forEach(x => x.onclick = () => { V.budget = x.dataset.budget; sauver(); dessiner(); });
      const prise = $('[data-prise]', ecran);
      if (prise) prise.onchange = async () => { clearTimeout(minuteurAvance); for (const f of prise.files) { try { const m = await MarcheoPhotos.ajouter(b.id, E.id, f); m.point = Q.id; V.photos.push(m); } catch (err) { notifier(err.message, 'erreur'); } } sauverMaintenant('biens', b); dessiner(); };
      $$('[data-saut-point]', ecran).forEach(x => x.onclick = () => aller_(+x.dataset.sautPoint));
      $('[data-v="sommaire"]', ecran).onclick = () => { clearTimeout(minuteurAvance); sommaire = !sommaire; dessiner(); };
      $('[data-v="fermer"]', ecran).onclick = () => { clearTimeout(minuteurAvance); sauverMaintenant('biens', b); ecran.remove(); notifier('Visite gardée en brouillon : « Reprendre la visite » ' + (MODE_VISITE ? 'dans la liste.' : 'sur la fiche du projet.')); afficher(); };
      $('[data-v="prec"]', ecran).onclick = () => sommaire ? (sommaire = false, dessiner()) : aller_(V.point - 1);
      const ret = $('[data-v="retour"]', ecran); if (ret) ret.onclick = () => { sommaire = false; dessiner(); };
      const suiv = $('[data-v="suiv"]', ecran); if (suiv) suiv.onclick = () => aller_(V.point + 1);
      const fin = $('[data-v="fin"]', ecran); if (fin) fin.onclick = () => { enregistrerVisite(b, analyseVisite(V.reponses, b)); ecran.remove(); if (apresFin) apresFin(b); else { aller('#/bien/' + b.id + '/visite'); afficher(); } };
      const corps = $('.visite-corps', ecran); if (corps) corps.scrollTop = 0;
    };
    dessiner();
  }
  /* Fin de visite : tout part dans le projet */
  function enregistrerVisite(b, A) {
    const V = b.visiteBrouillon, R = V.reponses, q = (e, k) => (R[e] || {})[k] || '', saisie = (e, k) => +((R[e] || {})[k + '_saisie'] || 0);
    const S = b.sim = M.normalize(b.sim);
    M.W.forEach(i => { if (S.w[i.id] && M.vis(i, S.type)) { S.w[i.id].on = A.postes.includes(i.id); S.w[i.id].val = null; } });
    S.niveau = A.niveau;
    S.trvForfait = V.budget === 'postes' ? null : A.budgetM2; S.trvForfaitOrigine = 'visite';
    const charges = saisie('questions', 'charges') || CHARGES_MILIEU[q('questions', 'charges')] || 0;
    if (charges && S.x.copro) S.x.copro = { on: true, val: Math.round(charges * S.duree / 12 / 50) * 50 };
    const tf = saisie('questions', 'taxeFonciere');
    if (tf && S.x.tf) S.x.tf = { on: true, val: Math.round(tf * S.duree / 12 / 50) * 50 };
    if (q('questions', 'dpe') && q('questions', 'dpe') !== 'Inconnu') b.dpe = q('questions', 'dpe');
    b.visite = Object.assign({}, V, { fin: new Date().toISOString(), analyse: A, chargesAnnuelles: charges || null, taxeFonciere: tf || null });
    delete b.visiteBrouillon;
    const suite = q('bilan', 'suite');
    if (RANG[b.etape || 'repere'] < RANG.visite) b.etape = 'visite';
    b.avancement = b.avancement || { jalons: {}, depenses: [] }; b.avancement.jalons = b.avancement.jalons || {};
    b.avancement.jalons.visite = Object.assign({}, b.avancement.jalons.visite, { reelle: aujourdhui() });
    if (suite === 'Faire une offre') b.prochaine = { action: 'Faire une offre', date: aujourdhui() };
    if (suite === 'Rappeler') { b.prochaine = { action: 'Rappeler après la visite', date: jours(aujourdhui(), 1) }; D.enregistrer('relances', { date: jours(aujourdhui(), 1), objet: 'Rappeler après la visite', bienId: b.id, contactId: ((b.liens || [])[0] || {}).contactId || '', fait: false }); }
    if (suite === 'Écarter') { b.etape = 'ecarte'; b.motif = 'Après visite' + (A.alertes[0] ? ' : ' + A.alertes[0] : ''); }
    sauverMaintenant('biens', b); cacheAnalyse.clear();
    D.enregistrer('journal', { bienId: b.id, date: aujourdhui(), type: 'visite', texte: 'Visite (' + Math.max(1, Math.round((Date.now() - new Date(V.debut)) / 60000)) + ' min, ' + V.photos.length + ' photo(s)). Travaux : ' + M.NIVEAUX[A.niveau].toLowerCase() + ', ' + eur(V.budget === 'postes' ? A.budgetPostes : A.budgetM2) + '.\n' + compteRendu(R) + (A.alertes.length ? '\nPoints d\'attention : ' + A.alertes.join(' ') : ''), auto: true });
    notifier('Visite enregistrée : simulation, travaux, charges et journal mis à jour.', 'succes');
  }
  function ongletVisite(z, b) {
    const V = b.visite, B = b.visiteBrouillon;
    if (!V && !B) { z.innerHTML = `<div class="vide"><p>Pas encore de visite.</p><button class="bouton bouton-vert bouton-large" id="viDemarrer">Démarrer la visite</button><p class="aide">Pensé pour le téléphone : une étape par écran, réponses en un toucher, photos à chaque étape. Environ 10 minutes pour un studio.</p></div>`; $('#viDemarrer').onclick = () => ouvrirVisite(b); return; }
    const X = V || B, A = V ? V.analyse : analyseVisite(B.reponses, b);
    z.innerHTML = `
      ${B ? `<div class="info-bandeau">Visite en cours, commencée le ${dateFr(B.debut.slice(0, 10))}. <button class="bouton bouton-petit bouton-principal" id="viReprendre">Reprendre la visite</button></div>` : ''}
      ${V ? `<div class="actions" style="margin-bottom:.8rem"><button class="bouton" id="viRefaire">Refaire une visite</button><span class="discret">Visite du ${dateFr(V.fin.slice(0, 10))}, ${Math.max(1, Math.round((new Date(V.fin) - new Date(V.debut)) / 60000))} min</span></div>` : ''}
      <div class="indicateurs">
        ${indic('Niveau de travaux', M.NIVEAUX[A.niveau])}
        ${indic('Budget travaux', eur(X.budget === 'postes' ? A.budgetPostes : A.budgetM2), { detail: X.budget === 'postes' ? 'détail poste par poste' : 'au m², selon tes critères' })}
        ${indic('Points d\'attention', A.alertes.length, { etat: A.alertes.length ? 'orange' : '' })}
        ${indic('Photos', X.photos.length)}
      </div>
      ${A.alertes.map(x => `<div class="alerte-bandeau">${esc(x)}</div>`).join('')}
      ${VISITE.filter(e => e.id !== 'bilan').map(e => { const R = X.reponses[e.id] || {}, ph = X.photos.filter(p => p.etape === e.id); if (!Object.keys(R).length && !ph.length) return ''; return `<div class="carte"><h2>${esc(e.t)}</h2>${e.id === 'chambre' && estStudio(X.reponses) ? '<p class="discret">Studio : sans objet.</p>' : `<div class="compte">${e.q.filter(q => R[q.id] || R[q.id + '_saisie'] || ph.some(p => p.point === q.id)).map(q => { const pq = ph.filter(p => p.point === q.id); return ligneCompte(esc(q.l) + (R[q.id + '_note'] ? `<small class="discret">${esc(R[q.id + '_note'])}</small>` : '') + (pq.length ? `<span class="visite-photos petites">${pq.map(p => `<img data-photo="${p.id}" alt="">`).join('')}</span>` : ''), esc([R[q.id], R[q.id + '_saisie'] ? Number(R[q.id + '_saisie']).toLocaleString('fr-FR') + ' €' : ''].filter(Boolean).join(' · ')) || '—'); }).join('')}</div>`}${R._note ? `<p class="aide">Note : ${esc(R._note)}</p>` : ''}${ph.filter(p => !p.point).length ? `<div class="visite-photos">${ph.filter(p => !p.point).map(p => `<img data-photo="${p.id}" alt="">`).join('')}</div>` : ''}</div>`; }).join('')}`;
    $$('img[data-photo]', z).forEach(img => { const m = X.photos.find(p => p.id === img.dataset.photo); MarcheoPhotos.url(m).then(u => { if (u) { img.src = u; img.onclick = () => window.open(u, '_blank'); } }).catch(() => { img.alt = 'Photo non disponible sur cet appareil'; }); });
    const rp = $('#viReprendre'); if (rp) rp.onclick = () => ouvrirVisite(b);
    const rf = $('#viRefaire'); if (rf) rf.onclick = () => confirmer('Commencer une nouvelle visite ? Les réponses de la précédente restent dans le journal.', () => { b.visiteBrouillon = null; ouvrirVisite(b); });
  }

  /* ================= Projet : avancement, budget, comptabilité ================= */
  /* Jalons d'un projet, de la visite à la distribution. Dates prévues déduites de la durée de l'opération
     (acte d'achat → acte de vente = durée), modifiables ; dates réelles saisies au fil de l'eau. */
  const JALONS = [
    { id: 'visite', l: 'Visite', g: 'Acquisition' },
    { id: 'offre', l: 'Offre acceptée', g: 'Acquisition' },
    { id: 'compromis', l: 'Compromis signé', g: 'Acquisition' },
    { id: 'financement', l: 'Financement obtenu', g: 'Acquisition' },
    { id: 'autorisation', l: 'Autorisations de travaux', g: 'Administratif' },
    { id: 'acte', l: 'Acte d\'achat signé', g: 'Acquisition' },
    { id: 'assurance', l: 'Assurances souscrites', g: 'Administratif' },
    { id: 'comptaAchat', l: 'Achat et frais comptabilisés', g: 'Comptable' },
    { id: 'debutTravaux', l: 'Début des travaux', g: 'Chantier' },
    { id: 'finTravaux', l: 'Réception des travaux', g: 'Chantier' },
    { id: 'miseEnVente', l: 'Mise en vente', g: 'Revente' },
    { id: 'compromisVente', l: 'Compromis de vente', g: 'Revente' },
    { id: 'acteVente', l: 'Acte de vente signé', g: 'Revente' },
    { id: 'tva', l: 'Déclaration de TVA sur marge', g: 'Comptable' },
    { id: 'cloture', l: 'Clôture et impôt sur les sociétés', g: 'Comptable' },
    { id: 'distribution', l: 'Distribution aux associés', g: 'Comptable' }
  ];
  const COULEUR_GROUPE = { Acquisition: 'var(--accent)', Administratif: 'var(--texte-2)', Chantier: 'var(--laiton)', Revente: 'var(--vert)', Comptable: '#5b3a52' };
  const CATEGORIES_DEPENSE = [['achat', 'Achat'], ['notaire', 'Notaire et agence'], ['travaux', 'Travaux hors chantier suivi'], ['annexes', 'Frais annexes'], ['autre', 'Autre']];
  const jours = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const mois = (d, n) => { const x = new Date(d + 'T12:00'); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); };
  const ecartJours = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000);
  /* Dates prévues par défaut, ancrées sur l'acte d'achat (réel, sinon prévu, sinon création + 3,5 mois) */
  function datesPrevues(b) {
    const av = (b.avancement || {}).jalons || {}, S = b.sim || {}, duree = Math.max(1, +S.duree || 9);
    const debut = av.visite && av.visite.reelle || (b.creeLe || aujourdhui());
    const acte = (av.acte && (av.acte.reelle || av.acte.prevue)) || jours(debut, 111);
    const acteVente = mois(acte, duree), compromisVente = jours(acteVente, -90), miseEnVente = jours(compromisVente, -45);
    const def = { visite: debut, offre: jours(debut, 7), compromis: jours(debut, 21), financement: jours(acte, -45), autorisation: jours(acte, -30), acte,
      assurance: acte, comptaAchat: jours(acte, 30), debutTravaux: jours(acte, 14), finTravaux: jours(miseEnVente, -7), miseEnVente, compromisVente, acteVente,
      tva: jours(acteVente, 30), cloture: jours(acteVente, 120), distribution: jours(acteVente, 180) };
    return Object.fromEntries(JALONS.map(j => [j.id, (av[j.id] && av[j.id].prevue) || def[j.id]]));
  }
  /* Synthèse d'avancement : jalons, retard, fin projetée, budget prévu / dépensé / projeté, marge projetée */
  function suiviProjet(b) {
    const A = analyse(b), r = A.r, t = aujourdhui(), av = b.avancement || {}, J = av.jalons || {}, P = datesPrevues(b);
    const liste = JALONS.map(j => { const x = J[j.id] || {}; return Object.assign({}, j, { prevue: P[j.id], reelle: x.reelle || '', fait: !!x.reelle, retard: !x.reelle && P[j.id] < t ? ecartJours(P[j.id], t) : 0 }); });
    const premierOuvert = liste.find(j => !j.fait), retard = premierOuvert ? Math.max(0, premierOuvert.retard) : 0;
    const finPrevue = P.acteVente, finProjetee = J.acteVente && J.acteVente.reelle ? J.acteVente.reelle : jours(finPrevue, retard);
    const debut = P.visite, faits = liste.filter(j => j.fait).length;
    /* Budget */
    const dep = (av.depenses || []), somme = c => dep.filter(d => d.categorie === c).reduce((s, d) => s + (+d.montant || 0), 0);
    const ch = A.chantier, travauxPayes = (ch ? ch.paye : 0) + somme('travaux');
    const prevu = { achat: r.achat, notaire: r.acq, travaux: r.T, annexes: r.anx + r.agV + r.mis };
    const depense = { achat: somme('achat'), notaire: somme('notaire'), travaux: travauxPayes, annexes: somme('annexes') + somme('autre') };
    const travauxProjete = Math.max(prevu.travaux, ch ? ch.reel : 0, ch ? ch.engage : 0, depense.travaux);
    const projete = { achat: Math.max(prevu.achat, depense.achat), notaire: Math.max(prevu.notaire, depense.notaire), travaux: travauxProjete, annexes: Math.max(prevu.annexes, depense.annexes) };
    const tot = o => o.achat + o.notaire + o.travaux + o.annexes;
    const S2 = clone(A.S); S2.trvReel = travauxProjete; S2.agA = (+S2.agA || 0) + (projete.achat - prevu.achat) + (projete.notaire - prevu.notaire) + (projete.annexes - prevu.annexes);
    const rProj = M.compute(S2);
    return { A, liste, retard, finPrevue, finProjetee, debut, faits, avancementJalons: faits / liste.length,
      avancementTemps: Math.min(1, Math.max(0, ecartJours(debut, t) / Math.max(1, ecartJours(debut, finProjetee)))),
      moisRestants: Math.max(0, ecartJours(t, finProjetee) / 30.4), prevu, depense, projete, totalPrevu: tot(prevu), totalDepense: tot(depense), totalProjete: tot(projete), rProj };
  }
  function ongletAvancement(z, b) {
    b.avancement = b.avancement || { jalons: {}, depenses: [] }; b.avancement.jalons = b.avancement.jalons || {}; b.avancement.depenses = b.avancement.depenses || [];
    const P = suiviProjet(b), t = aujourdhui(), r = P.A.r;
    const pos = d => Math.min(100, Math.max(0, ecartJours(P.debut, d) / Math.max(1, ecartJours(P.debut, P.finProjetee > P.liste[P.liste.length - 1].prevue ? P.finProjetee : P.liste[P.liste.length - 1].prevue)) * 100));
    const ecart = P.totalProjete - P.totalPrevu;
    z.innerHTML = `
      ${P.retard ? `<div class="alerte-bandeau">Retard de ${P.retard} jour(s) sur « ${esc(P.liste.find(j => !j.fait).l)} » : fin projetée au ${dateFr(P.finProjetee)} au lieu du ${dateFr(P.finPrevue)}.</div>` : ''}
      <div class="indicateurs">
        ${indic('Avancement', pc(P.avancementJalons, 0), { detail: P.faits + ' jalon(s) sur ' + P.liste.length + ' · temps écoulé ' + pc(P.avancementTemps, 0) })}
        ${indic('Temps restant', P.moisRestants.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' mois', { detail: 'fin projetée le ' + dateFr(P.finProjetee), etat: P.retard ? 'rouge' : '' })}
        ${indic('Dépensé', eur(P.totalDepense), { detail: pc(P.totalPrevu ? P.totalDepense / P.totalPrevu : 0, 0) + ' du budget prévu' })}
        ${indic('Budget projeté', eur(P.totalProjete), { detail: (ecart > 0 ? '+ ' : ecart < 0 ? '− ' : '') + eur(Math.abs(ecart)) + ' sur le prévu', etat: ecart > 0 ? 'orange' : '' })}
        ${indic('Bénéfice net projeté', eur(P.rProj.N), { detail: 'prévu ' + eur(r.N) + ' · marge ' + pc(P.rProj.m), etat: P.rProj.N < r.N ? 'orange' : 'vert' })}
      </div>
      <div class="carte"><h2>Frise chronologique</h2>
        <div class="frise"><div class="frise-ligne"></div><div class="frise-aujourdhui" style="left:${pos(t)}%"><span>aujourd'hui</span></div>
          ${P.liste.map(j => `<div class="frise-point${j.fait ? ' fait' : j.retard ? ' retard' : ''}" style="left:${pos(j.reelle || j.prevue)}%;--c:${COULEUR_GROUPE[j.g]}" title="${esc(j.l)} · ${dateFr(j.reelle || j.prevue)}"></div>`).join('')}
        </div>
        <div class="frise-legende">${Object.entries(COULEUR_GROUPE).map(([g, c]) => `<span><i style="background:${c}"></i>${g}</span>`).join('')}<span><i class="cercle"></i>à venir</span><span><i class="cercle plein"></i>fait</span><span><i class="cercle rouge"></i>en retard</span></div>
      </div>
      <div class="tableau-conteneur" style="margin-top:.8rem"><table class="tableau adaptable"><thead><tr><th>Jalon</th><th>Famille</th><th>Prévu</th><th>Réalisé</th><th>État</th></tr></thead><tbody>
        ${P.liste.map(j => `<tr><td data-titre="Jalon"><strong>${esc(j.l)}</strong></td><td data-titre="Famille"><span class="pastille-groupe" style="--c:${COULEUR_GROUPE[j.g]}"></span>${j.g}</td>
          <td data-titre="Prévu"><input type="date" data-jprev="${j.id}" value="${j.prevue}"></td><td data-titre="Réalisé"><input type="date" data-jreel="${j.id}" value="${j.reelle}"></td>
          <td data-titre="État">${j.fait ? voyant('vert', 'Fait') : j.retard ? voyant('rouge', j.retard + ' j de retard') : voyant('gris', 'À venir')}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="section-titre"><h2>Budget</h2>${!b.avancement.depenses.some(d => d.categorie === 'achat') && b.avancement.jalons.acte && b.avancement.jalons.acte.reelle ? '<button class="bouton bouton-petit" id="avAchat">Comptabiliser l\'achat et le notaire</button>' : ''}</div>
      <div class="tableau-conteneur"><table class="tableau"><thead><tr><th>Poste</th><th class="nombre">Prévu</th><th class="nombre">Dépensé</th><th class="nombre">Reste prévu</th><th class="nombre">Projection finale</th></tr></thead><tbody>
        ${[['achat', 'Achat'], ['notaire', 'Notaire et agence'], ['travaux', 'Travaux'], ['annexes', 'Frais annexes et prestations']].map(([k, l]) => `<tr><td>${l}${k === 'travaux' && P.A.chantier ? '<span class="sous-ligne">paiements du chantier suivi compris</span>' : ''}</td><td class="nombre">${eur(P.prevu[k])}</td><td class="nombre">${eur(P.depense[k])}</td><td class="nombre">${eur(Math.max(0, P.prevu[k] - P.depense[k]))}</td><td class="nombre ${P.projete[k] > P.prevu[k] ? 'orange' : ''}">${eur(P.projete[k])}</td></tr>`).join('')}
      </tbody><tfoot><tr><td>Coût de revient</td><td class="nombre">${eur(P.totalPrevu)}</td><td class="nombre">${eur(P.totalDepense)}</td><td class="nombre">${eur(Math.max(0, P.totalPrevu - P.totalDepense))}</td><td class="nombre">${eur(P.totalProjete)}</td></tr></tfoot></table></div>
      <div class="section-titre"><h2>Dépenses</h2><button class="bouton bouton-petit" id="avDep">+ Dépense</button></div>
      ${b.avancement.depenses.length ? `<div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th class="nombre">Montant</th><th></th></tr></thead><tbody>${b.avancement.depenses.slice().sort((x, y) => (y.date || '').localeCompare(x.date || '')).map(d => `<tr><td data-titre="Date">${dateFr(d.date)}</td><td data-titre="Libellé">${esc(d.libelle || '')}</td><td data-titre="Catégorie">${(CATEGORIES_DEPENSE.find(c => c[0] === d.categorie) || ['', ''])[1]}</td><td class="nombre" data-titre="Montant">${eur(d.montant)}</td><td><button class="bouton-icone" data-depsuppr="${d.id}" aria-label="Supprimer">${I.fermer}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="vide">Aucune dépense saisie. Les paiements du chantier (onglet Travaux) sont comptés automatiquement.</div>'}`;
    const sauver = () => { sauverMaintenant('biens', b); cacheAnalyse.clear(); afficher(); };
    $$('[data-jprev]', z).forEach(el => el.onchange = () => { const k = el.dataset.jprev; b.avancement.jalons[k] = Object.assign({}, b.avancement.jalons[k], { prevue: el.value }); sauver(); });
    $$('[data-jreel]', z).forEach(el => el.onchange = () => {
      const k = el.dataset.jreel; b.avancement.jalons[k] = Object.assign({}, b.avancement.jalons[k], { reelle: el.value });
      const etape = { offre: 'offre', compromis: 'compromis', acte: 'acte', debutTravaux: 'chantier', miseEnVente: 'vente', acteVente: 'vendu' }[k];
      if (el.value && etape && RANG[etape] > RANG[b.etape || 'repere']) { b.etape = etape; notifier('Étape du projet : ' + ETAPE[etape] + '.', 'succes'); }
      sauver();
    });
    const ach = $('#avAchat'); if (ach) ach.onclick = () => { const d = b.avancement.jalons.acte.reelle; b.avancement.depenses.push({ id: D.nouvelId('d'), date: d, libelle: 'Prix d\'achat', categorie: 'achat', montant: Math.round(r.achat) }, { id: D.nouvelId('d'), date: d, libelle: 'Notaire et agence à l\'achat', categorie: 'notaire', montant: Math.round(r.acq) }); sauver(); };
    $('#avDep').onclick = () => modale('Nouvelle dépense', `<div class="grille-champs alignee">
        <div class="champ"><label for="dDate">Date</label><input id="dDate" type="date" value="${t}"></div>
        <div class="champ"><label for="dCat">Catégorie</label><select id="dCat">${CATEGORIES_DEPENSE.map(c => `<option value="${c[0]}">${c[1]}</option>`).join('')}</select></div>
        <div class="champ"><label for="dMont">Montant (€)</label><input id="dMont" type="number" inputmode="decimal"></div>
        <div class="champ" style="grid-column:1/-1"><label for="dLib">Libellé</label><input id="dLib" placeholder="Facture, appel de fonds, taxe…"></div></div>`,
      [{ l: 'Annuler' }, { l: 'Ajouter', classe: 'bouton-principal', f: f => { const m = nb($('#dMont', f).value); if (!m) { notifier('Saisir le montant.', 'erreur'); return false; } b.avancement.depenses.push({ id: D.nouvelId('d'), date: $('#dDate', f).value, categorie: $('#dCat', f).value, libelle: $('#dLib', f).value.trim(), montant: m }); sauver(); } }]);
    $$('[data-depsuppr]', z).forEach(x => x.onclick = () => confirmer('Supprimer cette dépense ?', () => { b.avancement.depenses = b.avancement.depenses.filter(d => d.id !== x.dataset.depsuppr); sauver(); }));
  }

  /* Bilan comptable du tableau de bord : projets acquis (acte signé, chantier, en vente) et vendus */
  function bilanComptable(biens) {
    const port = biens.filter(b => ['acte', 'chantier', 'vente'].includes(b.etape)), vendus = biens.filter(b => b.etape === 'vendu');
    const cumul = l => l.reduce((o, b) => { const P = suiviProjet(b), r = P.A.r; o.n++; o.achat += r.achat; o.notaire += r.acq; o.travaux += r.T; o.travauxPayes += P.depense.travaux; o.annexes += r.anx + r.agV + r.mis; o.C += r.C; o.vente += r.vente; o.tva += r.tva; o.int += r.int; o.is += r.is; o.N += r.N; o.depense += P.totalDepense; o.projete += P.totalProjete; o.Nproj += P.rProj.N; return o; },
      { n: 0, achat: 0, notaire: 0, travaux: 0, travauxPayes: 0, annexes: 0, C: 0, vente: 0, tva: 0, int: 0, is: 0, N: 0, depense: 0, projete: 0, Nproj: 0 });
    const a = cumul(port), v = cumul(vendus), T = Object.fromEntries(Object.keys(a).map(k => [k, a[k] + v[k]]));
    const L = [['Nombre de projets', 'n', x => x], ['Achats', 'achat'], ['Notaire et agence', 'notaire'], ['Travaux prévus', 'travaux'], ['Travaux payés', 'travauxPayes'], ['Frais annexes et prestations', 'annexes'], ['Coût de revient', 'C', null, 1], ['Dépensé à ce jour', 'depense'], ['Coût de revient projeté', 'projete'],
      ['Revente', 'vente', null, 1], ['Marge brute', null, null, 0, x => x.vente - x.C], ['TVA sur marge', 'tva'], ['Intérêts associé investisseur', 'int'], ['Impôt sur les sociétés', 'is'], ['Bénéfice net prévu', 'N', null, 1], ['Bénéfice net projeté', 'Nproj']];
    if (!a.n && !v.n) return '<div class="vide">Aucun projet acquis pour l\'instant : le bilan se remplit à la signature de l\'acte d\'achat.</div>';
    return `<div class="tableau-conteneur"><table class="tableau"><thead><tr><th></th><th class="nombre">En portefeuille</th><th class="nombre">Vendus</th><th class="nombre">Total</th></tr></thead><tbody>
      ${L.map(([l, k, f, gras, calc]) => { const val = o => calc ? calc(o) : o[k], fmt = f || eur; return `<tr${gras ? ' class="ligne-forte"' : ''}><td>${l}</td><td class="nombre">${fmt(val(a))}</td><td class="nombre">${fmt(val(v))}</td><td class="nombre">${fmt(val(T))}</td></tr>`; }).join('')}
    </tbody></table></div><p class="aide">Portefeuille : acte signé, chantier, en vente. Chiffres prévisionnels des simulations ; « projeté » tient compte des dépenses et du chantier réels.</p>`;
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
  const STATUTS_ANALYSE = { signalee: ['vert', 'À examiner'], ecartee: ['gris', 'Écartée par l\'analyse'], a_completer: ['orange', 'À compléter'] };
  const aExaminer = a => !['retenue', 'ecartee'].includes(a.statutTri) && evalAnnonce(a).statut === 'signalee';
  const statutAnnonce = (a, e) => a.statutTri === 'retenue' ? ['vert', 'Retenue'] : a.statutTri === 'ecartee' ? ['gris', 'Écartée'] : STATUTS_ANALYSE[e.statut];
  const nomSite = a => a.source || ((a.lien || '').match(/https?:\/\/(?:www\.)?([^\/.]+)/) || [])[1] || 'le site';
  const fa = { onglet: 'examiner', q: '', source: '', type: '', surligne: '' };
  /* Routes : #/annonces/<onglet> ou #/annonces/a/<identifiant> (ouvre la fiche et met la ligne en évidence) */
  function vueAnnonces(c, r) {
    titre('Annonces', 'Alertes e-mail analysées', I.annonces);
    const ouvrir = r && r.id === 'a' ? r.o : '';
    let recue = null;
    if (r && r.id === 'importer') { try { recue = JSON.parse(decodeURIComponent(location.hash.split('/importer/')[1] || '')); } catch (e) { notifier('Données de l\'annonce illisibles.', 'erreur'); } history.replaceState(null, '', '#/annonces/' + fa.onglet); vueCourante = 'annonces/' + fa.onglet + '/'; }
    else if (r && r.id && r.id !== 'a') fa.onglet = r.id;
    if (ouvrir) fa.surligne = ouvrir;
    const toutes = D.liste('annonces'), E = new Map(toutes.map(a => [a.id, evalAnnonce(a)]));
    const groupes = {
      examiner: toutes.filter(aExaminer),
      completer: toutes.filter(a => !['retenue', 'ecartee'].includes(a.statutTri) && E.get(a.id).statut === 'a_completer'),
      toutes,
      ecartees: toutes.filter(a => !['retenue', 'ecartee'].includes(a.statutTri) && E.get(a.id).statut === 'ecartee'),
      traitees: toutes.filter(a => ['retenue', 'ecartee'].includes(a.statutTri))
    };
    if (ouvrir) {
      const x = toutes.find(a => a.id === ouvrir); if (x && !groupes[fa.onglet].includes(x)) fa.onglet = 'toutes';
      /* l'adresse « ouvrir telle annonce » ne sert qu'une fois : sinon chaque enregistrement rouvrirait la fiche */
      history.replaceState(null, '', '#/annonces/' + fa.onglet); vueCourante = 'annonces/' + fa.onglet + '/';
    }
    const ONG = [['examiner', 'À examiner'], ['completer', 'À compléter'], ['ecartees', 'Écartées par l\'analyse'], ['traitees', 'Traitées'], ['toutes', 'Toutes']];
    const sources = [...new Set(toutes.map(a => a.source).filter(Boolean))].sort();
    const derniere = toutes.reduce((m, a) => (a.vueLe || a.recueLe || '') > m ? (a.vueLe || a.recueLe) : m, '');
    c.innerHTML = `
      <div class="en-tete-page"><div><h1>Annonces</h1><p>${toutes.length} reçue(s)${derniere ? ' · dernière alerte le ' + dateFr(derniere.slice(0, 10)) : ''}</p></div>
        <div class="actions"><button class="bouton" id="anAjout">+ Annonce</button><button class="bouton" id="anCrit">Modifier les critères</button></div></div>
      <div class="info-bandeau">${esc(resumeCriteres(reglages()))}</div>
      <nav class="onglets">${ONG.map(o => `<button class="${fa.onglet === o[0] ? 'actif' : ''}" data-ong="${o[0]}">${o[1]} <small class="discret">${groupes[o[0]].length}</small></button>`).join('')}</nav>
      <div class="barre-outils"><input type="search" id="anQ" placeholder="Rechercher : ville, titre…" value="${esc(fa.q)}" aria-label="Rechercher">
        <select id="anSrc" aria-label="Source"><option value="">Toutes les sources</option>${sources.map(s => `<option${fa.source === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <select id="anType" aria-label="Type"><option value="">Tous les types</option>${Object.entries(M.TYPES).map(([k, t]) => `<option value="${k}"${fa.type === k ? ' selected' : ''}>${t.n}</option>`).join('')}</select></div>
      <div id="anZone"></div>`;
    const zone = () => {
      const q = fa.q.trim().toLowerCase();
      const l = groupes[fa.onglet].filter(a => (!fa.source || a.source === fa.source) && (!fa.type || E.get(a.id).type === fa.type) && (!q || [a.titre, a.ville, a.cp, a.texte].join(' ').toLowerCase().includes(q)))
        .sort((x, y) => (aExaminer(y) - aExaminer(x)) || (E.get(y.id).score ?? -1) - (E.get(x.id).score ?? -1) || (y.recueLe || '').localeCompare(x.recueLe || ''));
      const vis = l.slice(0, 200);
      $('#anZone').innerHTML = !l.length ? `<div class="vide">${fa.onglet === 'examiner' ? 'Aucune annonce ne mérite l\'attention pour l\'instant.' : 'Aucune annonce.'}</div>` :
        `<div class="tableau-conteneur"><table class="tableau adaptable tableau-annonces"><thead><tr><th>Annonce</th><th class="nombre">Prix affiché</th><th class="nombre">Revente</th><th class="nombre">Travaux</th><th class="nombre">À sortir</th><th class="nombre">Marge brute</th><th class="nombre">Prix max.</th><th>Analyse</th></tr></thead><tbody>${vis.map(a => {
          const e = E.get(a.id), st = statutAnnonce(a, e), ex = aExaminer(a);
          return `<tr class="cliquable${ex ? ' a-examiner' : ''}${a.id === fa.surligne ? ' surligne' : ''}" data-id="${a.id}"><td data-titre="Annonce"><strong>${esc(a.titre || 'Annonce')}</strong>${a.statutTri === 'nouvelle' ? ' <span class="etiquette">nouvelle</span>' : ''}<span class="sous-ligne">${esc([M.TYPES[e.type] ? M.TYPES[e.type].n : '', e.surface ? e.surface + ' m²' : '', e.pieces ? e.pieces + ' p.' : '', [a.cp, a.ville].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</span><span class="sous-ligne">${esc(a.source || '')} · ${dateFr((a.recueLe || '').slice(0, 10))}${e.signaux.length ? ' · <span class="vert">' + esc(e.signaux.join(', ')) + '</span>' : ''}</span></td>
            <td class="nombre" data-titre="Prix affiché">${eur(e.prix)}${e.surface ? `<span class="sous-ligne">${eur(e.prix / e.surface)} /m²</span>` : ''}${a.prixPrecedent ? `<span class="sous-ligne vert">avant ${eur(a.prixPrecedent)}</span>` : ''}</td>
            <td class="nombre" data-titre="Revente">${e.vente ? eur(e.vente) : '—'}</td>
            <td class="nombre" data-titre="Travaux">${e.travaux ? eur(e.travaux.total) + `<span class="sous-ligne">${M.NIVEAUX[e.travaux.niveau].toLowerCase()}</span>` : '—'}</td>
            <td class="nombre" data-titre="À sortir">${e.tresoAffiche ? `<span class="${+e.criteres.tresoMax && e.tresoAffiche > e.criteres.tresoMax ? 'rouge' : ''}">${eur(e.tresoAffiche)}</span>` : '—'}</td>
            <td class="nombre" data-titre="Marge brute">${e.margeBrute != null ? `<span class="${e.margeBrute >= e.criteres.margeBruteMin / 100 ? 'vert' : 'rouge'}">${pc(e.margeBrute)}</span><span class="sous-ligne">${eur(e.margeBruteEur)}</span>` : '—'}</td>
            <td class="nombre" data-titre="Prix max.">${e.achatMax ? eur(Math.floor(e.achatMax / 1000) * 1000) + `<span class="sous-ligne ${e.nego <= 0 ? 'vert' : e.statut === 'signalee' ? 'orange' : 'rouge'}">${e.nego <= 0 ? 'sans négociation' : '− ' + pc(e.nego, 0)}</span>` : '—'}</td>
            <td data-titre="Analyse">${voyant(st[0], st[1])}${e.score != null ? ` <b class="montant">${e.score}</b>` : ''}<span class="sous-ligne">${esc(e.motifs.join(' · '))}</span></td></tr>`;
        }).join('')}</tbody></table></div>${l.length > 200 ? `<p class="aide">200 premières sur ${l.length}. Affiner la recherche.</p>` : ''}`;
      $$('tr[data-id]', $('#anZone')).forEach(tr => tr.onclick = () => ficheAnnonce(D.obtenir('annonces', tr.dataset.id)));
      const sl = $('tr.surligne', $('#anZone')); if (sl) sl.scrollIntoView({ block: 'center' });
    };
    $$('[data-ong]', c).forEach(b => b.onclick = () => aller('#/annonces/' + b.dataset.ong));
    $('#anQ').oninput = e => { fa.q = e.target.value; zone(); };
    $('#anSrc').onchange = e => { fa.source = e.target.value; zone(); };
    $('#anType').onchange = e => { fa.type = e.target.value; zone(); };
    $('#anAjout').onclick = () => ajouterAnnonce();
    $('#anCrit').onclick = () => editerCriteres();
    zone();
    if (ouvrir) { const x = D.obtenir('annonces', ouvrir); if (x) ficheAnnonce(x); }
    if (recue) ajouterAnnonce(recue);
  }
  function ficheAnnonce(a, message) {
    if (!a) return;
    if (a.statutTri === 'nouvelle') { a.statutTri = 'vue'; D.enregistrer('annonces', a); majNav(); }
    const e = evalAnnonce(a), st = statutAnnonce(a, e);
    const ligne = (l, v, s) => ligneCompte(l, v, { s });
    const tv = e.travaux;
    const fond = modale(a.titre || 'Annonce', `
      ${message ? `<div class="info-bandeau">${message}</div>` : ''}
      ${a.lien ? `<a class="bouton bouton-vert bouton-large" href="${esc(a.lien)}" target="_blank" rel="noopener">Voir l'annonce sur ${esc(nomSite(a))} ↗</a>` : '<p class="aide">Pas de lien vers l\'annonce.</p>'}
      <div class="bilan-annonce">${voyant(st[0], st[1])}${e.score != null ? ` <span class="discret">score ${e.score}</span>` : ''}<span class="discret">${esc(e.motifs.join(' · '))}</span></div>
      <div class="compte">
        ${ligne('Source', esc(a.source || '—') + (a.agence ? ' · ' + esc(a.agence) : ''), 'reçue le ' + dateFr((a.recueLe || '').slice(0, 10)) + (a.alertes > 1 ? ', ' + a.alertes + ' alertes' : ''))}
        ${ligne('Bien', esc([M.TYPES[e.type] ? M.TYPES[e.type].n : e.type, e.surface ? e.surface + ' m²' : 'surface inconnue', e.pieces ? e.pieces + ' pièce' + (e.pieces > 1 ? 's' : '') + ' à vivre' : ''].filter(Boolean).join(' · ')), esc([a.cp, a.ville].filter(Boolean).join(' ')))}
        ${ligne('Prix affiché', eur(e.prix), (a.historiquePrix || []).length > 1 ? a.historiquePrix.map(h => dateFr(h.date.slice(0, 10)) + ' : ' + eur(h.prix)).join(' · ') : '')}
        ${e.r ? ligne('Revente estimée', eur(e.vente), eur(e.pm2) + ' /m² × ' + e.surface + ' m² · ' + (e.secteur && e.secteur.origine === 'DVF' ? 'référence DVF, ' + (e.type === 'maison' ? e.secteur.nMaisons + ' ventes de maisons' : e.secteur.n + ' ventes d\'appartements') : 'prix saisi'))
          + ligne('Travaux estimés', eur(e.r.T), M.NIVEAUX[tv.niveau].toLowerCase() + ' · ' + eur(tv.m2) + ' /m² × ' + e.surface + ' m²' + (tv.piece && tv.pieces ? ' + ' + eur(tv.piece) + ' × ' + tv.pieces + ' pièce' + (tv.pieces > 1 ? 's' : '') : '') + (tv.ht <= tv.min ? ' (minimum ' + eur(tv.min) + ')' : '') + ', aléas ' + tv.aleas + ' % compris')
          + ligne('Argent total à sortir', `<span class="${+e.criteres.tresoMax && e.tresoAffiche > e.criteres.tresoMax ? 'rouge' : ''}">${eur(e.tresoAffiche)}</span>`, 'au prix affiché · plafond ' + eur(e.criteres.tresoMax))
          + ligne('Marge brute', `<span class="${e.margeBrute >= e.criteres.margeBruteMin / 100 ? 'vert' : 'rouge'}">${pc(e.margeBrute)} · ${eur(e.margeBruteEur)}</span>`, 'au prix affiché · minimum ' + e.criteres.margeBruteMin + ' % de la revente')
          + ligne('Bénéfice net', eur(e.r.N), 'au prix affiché, après TVA, intérêts et impôt')
          + ligne('Prix d\'achat maximum', e.achatMax ? eur(e.achatMax) : 'aucun', e.nego > 0 ? 'négociation nécessaire : ' + pc(e.nego, 0) : 'le prix affiché passe') : ''}
        ${a.chargesAnnuelles ? ligne('Charges de copropriété', eur(a.chargesAnnuelles) + ' par an', 'annoncées par le site') : ''}
        ${e.signaux.length ? ligne('Signaux', `<span class="vert">${esc(e.signaux.join(', '))}</span>`) : ''}
      </div>
      ${a.texte ? `<details style="margin-top:.6rem"><summary class="aide">Texte de l'alerte</summary><p class="aide">${esc(a.texte)}</p></details>` : ''}`,
      [{ l: 'Écarter', classe: 'bouton-danger', f: () => { a.statutTri = 'ecartee'; D.enregistrer('annonces', a); afficher(); } },
       { l: 'Corriger', f: () => { setTimeout(() => corrigerAnnonce(D.obtenir('annonces', a.id)), 0); } },
       { l: 'Retenir et prendre rendez-vous', classe: 'bouton-principal', f: () => retenirAnnonce(D.obtenir('annonces', a.id)) }]);
    return fond;
  }
  /* Correction : nouveaux champs, recalcul complet (travaux, coûts, statut, classement) et retour sur la fiche avec les écarts */
  function corrigerAnnonce(a) {
    const e = evalAnnonce(a), k = a.corrections || {};
    modale('Corriger l\'annonce', `<div class="grille-champs alignee">
        <div class="champ"><label for="akType">Type</label><select id="akType">${Object.entries(M.TYPES).map(([x, t]) => `<option value="${x}"${e.type === x ? ' selected' : ''}>${t.n}</option>`).join('')}</select></div>
        <div class="champ"><label for="akPrix">Prix affiché (€)</label><input id="akPrix" type="number" inputmode="numeric" value="${e.prix || ''}"></div>
        <div class="champ"><label for="akSurf">Surface (m²)</label><input id="akSurf" type="number" inputmode="decimal" value="${e.surface || ''}"></div>
        <div class="champ"><label for="akPieces">Pièces à vivre</label><input id="akPieces" type="number" inputmode="numeric" min="1" value="${e.pieces || ''}"><small class="aide">F2 = 2</small></div>
        <div class="champ"><label for="akNiv">Travaux</label><select id="akNiv">${Object.entries(M.NIVEAUX).map(([x, l]) => `<option value="${x}"${(e.niveau || k.niveau) === x ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="champ"><label for="akCp">Code postal</label><input id="akCp" inputmode="numeric" value="${esc(a.cp || '')}"></div>
        <div class="champ"><label for="akVille">Ville</label><input id="akVille" value="${esc(a.ville || '')}"></div>
        <div class="champ"><label for="akPm2">Prix du secteur (€/m²)</label><input id="akPm2" type="number" inputmode="numeric" value="${e.pm2 || ''}"></div>
      </div>
      <label class="case"><input type="checkbox" id="akSecteur"> Enregistrer ce prix pour tout le code postal</label>`,
      [k && Object.keys(k).length ? { l: 'Annuler les corrections', classe: 'bouton-danger', f: () => { const avant = evalAnnonce(a); delete a.corrections; D.enregistrer('annonces', a); cacheAnn.clear(); afficher(); setTimeout(() => montrerRecalcul(a, avant), 0); } } : null,
       { l: 'Annuler', f: () => { setTimeout(() => ficheAnnonce(D.obtenir('annonces', a.id)), 0); } },
       { l: 'Recalculer et enregistrer', classe: 'bouton-principal', f: f => { const avant = evalAnnonce(a); appliquerCorrection(a, f, avant); afficher(); setTimeout(() => montrerRecalcul(D.obtenir('annonces', a.id), avant), 0); } }].filter(Boolean));
  }
  function appliquerCorrection(a, f, e) {
    const v = id => $(id, f).value.trim(), n = id => nb($(id, f).value);
    const C = a.corrections = Object.assign({}, a.corrections || {});
    const fixe = (cle, val, auto) => { if (val && val !== auto) C[cle] = val; else if (val === auto) delete C[cle]; };
    fixe('type', v('#akType'), MA.typeDepuisTexte([a.titre, a.texte].join(' ')) || 'appt');
    if (n('#akPrix')) { if (n('#akPrix') !== +a.prix) C.prix = n('#akPrix'); else delete C.prix; }
    if (n('#akSurf')) { if (n('#akSurf') !== +a.surface) C.surface = n('#akSurf'); else delete C.surface; }
    if (n('#akPieces')) C.pieces = Math.max(1, Math.round(n('#akPieces')));
    C.niveau = v('#akNiv');
    if (v('#akCp')) a.cp = v('#akCp');
    if (v('#akVille')) a.ville = v('#akVille');
    const pm2 = n('#akPm2');
    delete C.pm2;
    if (pm2 && $('#akSecteur', f).checked && a.cp) {
      const R = reglages(); R.criteres = Object.assign({}, MA.CRITERES_DEF, R.criteres || {}); R.criteres.secteurs = (R.criteres.secteurs || []).map(x => Object.assign({}, x));
      const s = R.criteres.secteurs.find(x => String(x.cp) === String(a.cp)), champ = (C.type || e.type) === 'box' ? 'prixBox' : 'pm2';
      if (s) s[champ] = pm2; else R.criteres.secteurs.push({ cp: a.cp, commune: a.ville || '', [champ]: pm2 });
      D.enregistrer('reglages', R);
    } else if (pm2 && pm2 !== e.pm2) C.pm2 = pm2;
    D.enregistrer('annonces', a); cacheAnn.clear();
  }
  function montrerRecalcul(a, avant) {
    const apres = evalAnnonce(a), d = [];
    const cmp = (l, x, y, f) => { if (Math.round(x || 0) !== Math.round(y || 0)) d.push(l + ' : ' + f(x) + ' → <b>' + f(y) + '</b>'); };
    cmp('Travaux', avant.travaux && avant.travaux.total, apres.travaux && apres.travaux.total, eur);
    cmp('Argent à sortir', avant.tresoAffiche, apres.tresoAffiche, eur);
    cmp('Revente', avant.vente, apres.vente, eur);
    if (avant.margeBrute != null || apres.margeBrute != null) cmp('Marge brute', (avant.margeBrute || 0) * 1000, (apres.margeBrute || 0) * 1000, x => pc(x / 1000));
    cmp('Prix maximum', avant.achatMax, apres.achatMax, eur);
    const sa = STATUTS_ANALYSE[avant.statut][1], sb = STATUTS_ANALYSE[apres.statut][1];
    const msg = 'Recalculé. ' + (sa !== sb ? 'Statut : ' + sa + ' → <b>' + sb + '</b>. ' : 'Statut inchangé : ' + sb + '. ') + (d.length ? d.join(' · ') : 'Aucun chiffre ne change.');
    ficheAnnonce(a, msg);
  }
  /* Retenir : crée le projet, relie le contact de l'agence, relance de prise de rendez-vous */
  function retenirAnnonce(a) {
    creerProjet(a);
    notifier('Projet créé, relance « Prendre rendez-vous » pour aujourd\'hui.', 'succes');
    aller('#/bien/' + a.bienId);
  }
  function creerProjet(a) {
    const e = evalAnnonce(a), R = reglages();
    let S = e.S ? clone(e.S) : M.fresh(e.type);
    if (!e.S) { ['taux', 'obj', 'part', 'pfu', 'dmax', 'tvaT', 'tvaMode'].forEach(k => { if (R[k] != null) S[k] = R[k]; }); if (e.surface) S.surf = e.surface; if (e.prix) S.achat = e.prix; M.applyLevel(S); }
    S.adresse = [a.titre, a.ville].filter(Boolean).join(', ');
    const liens = [];
    if (a.agence) {
      let ag = D.liste('contacts').find(x => x.nom && x.nom.toLowerCase() === a.agence.toLowerCase());
      if (!ag) ag = D.enregistrer('contacts', { nom: a.agence, categorie: 'agent', notes: 'Créé depuis une alerte ' + (a.source || '') + '.' });
      liens.push({ contactId: ag.id, role: 'Agent' });
    }
    const b = D.enregistrer('biens', { etape: 'repere', source: a.source, lien: a.lien || '', prixAffiche: e.prix, sim: S, comps: [], pieces: {}, liens, travaux: { lignes: [], utiliserReel: false }, creeLe: aujourdhui(), annonceId: a.id,
      prochaine: { action: 'Prendre rendez-vous de visite', date: aujourdhui() } });
    D.enregistrer('relances', { date: aujourdhui(), objet: 'Prendre rendez-vous de visite', bienId: b.id, contactId: liens[0] ? liens[0].contactId : '', fait: false });
    D.enregistrer('journal', { bienId: b.id, date: (a.recueLe || aujourdhui()).slice(0, 10), type: 'note', texte: 'Annonce ' + (a.source || '') + (a.agence ? ' (' + a.agence + ')' : '') + ' reçue par alerte. Analyse : ' + (e.score != null ? 'score ' + e.score + ', ' : '') + (e.motifs.join(', ') || 'à examiner') + '.', auto: true });
    a.statutTri = 'retenue'; a.bienId = b.id; D.enregistrer('annonces', a);
    return b;
  }
  /* Ajout : coller le lien (lecture par le serveur) et, si le site bloque, le texte de la page */
  /* Bouton de favori « Envoyer à Marchéo » : lu par le navigateur de l'utilisateur sur la page qu'il consulte.
     Données structurées quand le site en publie (Leboncoin, JSON-LD), sinon texte de la page analysé par Marchéo. */
  function favoriMarcheo() {
    const cible = location.origin + location.pathname + '#/annonces/importer/';
    const code = `(()=>{const d=document,x={lien:location.href};try{const n=d.getElementById('__NEXT_DATA__');const ad=n&&JSON.parse(n.textContent).props.pageProps.ad;if(ad){const t={};(ad.attributes||[]).forEach(a=>t[a.key]=a.value);Object.assign(x,{titre:ad.subject,prix:+(ad.price||[])[0]||0,surface:+t.square||0,pieces:+t.rooms||0,dpe:t.energy_rate||'',cp:(ad.location||{}).zipcode,ville:(ad.location||{}).city,texte:String(ad.body||'').slice(0,3000)})}}catch(e){}try{d.querySelectorAll('script[type="application/ld+json"]').forEach(s=>{[].concat(JSON.parse(s.textContent)).forEach(o=>{const of=o.offers||{};if(!x.prix&&(of.price||o.price))x.prix=+(of.price||o.price);if(!x.titre&&o.name)x.titre=o.name;const fs=o.floorSize||{};if(!x.surface&&fs.value)x.surface=+fs.value;if(!x.pieces&&o.numberOfRooms)x.pieces=+o.numberOfRooms;const ad=o.address||{};if(!x.cp&&ad.postalCode)x.cp=ad.postalCode;if(!x.ville&&ad.addressLocality)x.ville=ad.addressLocality})})}catch(e){}if(!x.titre){const h=d.querySelector('h1');x.titre=(h&&h.innerText.trim())||d.title}x.page=(d.title+'\\n'+(d.body.innerText||'')).slice(0,6000);window.open('${cible}'+encodeURIComponent(JSON.stringify(x)))})()`;
    return 'javascript:' + encodeURI(code);
  }
  function ajouterAnnonce(recue) {
    const distant = D.etat().mode === 'distant';
    const fond = modale('Ajouter une annonce', `
      <div class="champ"><label for="naL">Lien de l'annonce</label><div class="actions" style="flex-wrap:nowrap"><input id="naL" type="url" inputmode="url" placeholder="https://www.leboncoin.fr/ad/…"><button type="button" class="bouton bouton-principal" id="naLire">Lire</button></div>
        <small class="aide" id="naEtat">${distant ? 'Collez le lien puis « Lire ». Si le site bloque la lecture, collez aussi le texte de la page ci-dessous.' : 'Mode démonstration : la lecture du lien passe par le serveur. Collez le texte de la page ci-dessous.'}</small></div>
      <details class="favori"><summary>Plus rapide : le bouton « Envoyer à Marchéo » dans les favoris</summary>
        <p class="aide">Une fois installé, un clic sur ce favori depuis une annonce Leboncoin, SeLoger, Bien'ici ou autre ouvre cette fenêtre déjà remplie. C'est le navigateur qui lit la page affichée : aucun blocage.</p>
        <p><a class="bouton bouton-vert" href="${favoriMarcheo()}" onclick="return false" draggable="true">Envoyer à Marchéo</a></p>
        <p class="aide">Installation sur ordinateur : afficher la barre de favoris (Ctrl + Maj + B), puis glisser ce bouton vert dessus.</p></details>
      <div class="champ"><label for="naX">Texte de l'annonce</label><textarea id="naX" rows="4" placeholder="Sur la page de l'annonce : tout sélectionner, copier, coller ici."></textarea></div>
      <div class="compte-titre">Annonce lue</div>
      <div class="grille-champs alignee">
        <div class="champ" style="grid-column:1/-1"><label for="naT">Titre</label><input id="naT"></div>
        <div class="champ"><label for="naP">Prix affiché (€)</label><input id="naP" type="number" inputmode="numeric"></div>
        <div class="champ"><label for="naS">Surface (m²)</label><input id="naS" type="number" inputmode="decimal"></div>
        <div class="champ"><label for="naPi">Pièces à vivre</label><input id="naPi" type="number" inputmode="numeric"></div>
        <div class="champ"><label for="naCp">Code postal</label><input id="naCp" inputmode="numeric"></div>
        <div class="champ"><label for="naV">Ville</label><input id="naV"></div>
        <div class="champ"><label for="naSrc">Source</label><input id="naSrc"></div>
      </div>`,
      [{ l: 'Annuler' }, { l: 'Ajouter et analyser', classe: 'bouton-principal', f: f => {
        const g = id => $(id, f).value.trim(); if (!nb(g('#naP'))) { notifier('Prix manquant : lire le lien ou coller le texte.', 'erreur'); return false; }
        const a = D.enregistrer('annonces', { titre: g('#naT') || 'Annonce', prix: nb(g('#naP')), surface: nb(g('#naS')) || undefined, pieces: nb(g('#naPi')) || undefined, cp: g('#naCp'), ville: g('#naV'), source: g('#naSrc'), lien: g('#naL'), texte: g('#naX').slice(0, 3000), dpe: f.dataset.dpe || '', type: f.dataset.type || '', chargesAnnuelles: +f.dataset.charges || 0, recueLe: new Date().toISOString(), statutTri: 'vue', manuel: true });
        setTimeout(() => aller('#/annonces/a/' + a.id), 0);
      } }]);
    const remplir = x => {
      const set = (id, v) => { if (v && !$(id, fond).value) $(id, fond).value = v; };
      set('#naT', x.titre); set('#naP', x.prix); set('#naS', x.surface); set('#naPi', x.pieces); set('#naCp', x.cp); set('#naV', x.ville);
      if (x.dpe) fond.dataset.dpe = x.dpe;
      if (x.type) fond.dataset.type = x.type;
      if (x.chargesAnnuelles) fond.dataset.charges = x.chargesAnnuelles;
    };
    const sourceDuLien = u => ({ leboncoin: 'Leboncoin', seloger: 'SeLoger', bienici: "Bien'ici", pap: 'PAP', 'logic-immo': 'Logic-Immo' })[((u.match(/https?:\/\/(?:www\.)?([^\/.]+)/) || [])[1] || '')] || '';
    $('#naL', fond).addEventListener('change', e => { const s = sourceDuLien(e.target.value); if (s) $('#naSrc', fond).value = s; });
    $('#naX', fond).addEventListener('input', e => remplir(MA.lireTexte(e.target.value)));
    if (recue) {
      $('#naL', fond).value = recue.lien || ''; const s0 = sourceDuLien(recue.lien || ''); if (s0) $('#naSrc', fond).value = s0;
      $('#naX', fond).value = (recue.texte || recue.page || '').slice(0, 3000);
      remplir(recue); remplir(MA.lireTexte((recue.titre || '') + '\n' + (recue.page || recue.texte || '')));
      $('#naEtat', fond).innerHTML = '<span class="vert">Annonce reçue depuis ' + esc(s0 || 'la page') + '. Vérifier les champs puis « Ajouter et analyser ».</span>';
    }
    $('#naLire', fond).onclick = async () => {
      const url = $('#naL', fond).value.trim(), etat = $('#naEtat', fond);
      if (!/^https:\/\//.test(url)) { etat.textContent = 'Coller un lien commençant par https://'; return; }
      const s = sourceDuLien(url); if (s) $('#naSrc', fond).value = s;
      if (!distant) { etat.textContent = 'Mode démonstration : coller le texte de la page ci-dessous.'; return; }
      etat.textContent = 'Lecture en cours…';
      try {
        const x = await D.action('lireAnnonce', { url });
        if (x.bloque) { etat.innerHTML = '<span class="orange">Le site refuse la lecture automatique (' + x.code + '). Copier le texte de la page et le coller ci-dessous.</span>'; return; }
        remplir(x); if (x.texte && !$('#naX', fond).value) $('#naX', fond).value = x.texte.slice(0, 3000);
        etat.innerHTML = '<span class="vert">Annonce lue' + (x.chargesAnnuelles ? ' · charges de copropriété ' + eur(x.chargesAnnuelles) + ' par an' : '') + '. Vérifier les champs puis « Ajouter et analyser ».</span>';
      } catch (err) { etat.innerHTML = '<span class="rouge">' + esc(err.message) + ' Coller le texte de la page ci-dessous.</span>'; }
    };
  }
  function champsCriteres(R) {
    const C = Object.assign({}, MA.CRITERES_DEF, R.criteres || {});
    return `<div class="grille-champs alignee">
        <div class="champ"><label for="crPrix">1. Prix affiché maximum (€)</label><input id="crPrix" data-cr="prixAfficheMax" type="number" inputmode="numeric" step="5000" value="${C.prixAfficheMax}"><small class="aide">au-dessus : écartée d'office, sans calcul</small></div>
        <div class="champ"><label for="crTreso">2. Argent total à sortir maximum (€)</label><input id="crTreso" data-cr="tresoMax" type="number" inputmode="numeric" step="5000" value="${C.tresoMax}"><small class="aide">achat, frais d'agence, notaire, travaux et aléas, annexes, TVA des travaux avancée</small></div>
        <div class="champ"><label for="crMb">3. Marge brute minimum (% de la revente)</label><input id="crMb" data-cr="margeBruteMin" type="number" inputmode="decimal" value="${C.margeBruteMin}"><small class="aide">revente moins coût de revient</small></div>
        <div class="champ"><label for="crNego">Négociation maximum (%)</label><input id="crNego" data-cr="negoMax" type="number" inputmode="numeric" value="${C.negoMax}"><small class="aide">les étapes 2 et 3 s'apprécient au prix négocié</small></div>
        <div class="champ" style="grid-column:1/-1"><label>Budget travaux, hors aléas</label>
          <table class="tableau"><thead><tr><th>Niveau</th><th class="nombre">€/m²</th><th class="nombre">Minimum par bien (€)</th></tr></thead><tbody>
          ${['r', 'c', 'l'].map(n => { const t = Object.assign({}, MA.CRITERES_DEF.travaux, C.travaux || {})[n]; return `<tr><td>${M.NIVEAUX[n]}</td><td><input data-crt="${n}.m2" type="number" inputmode="numeric" step="10" value="${t.m2}" style="width:90px"></td><td><input data-crt="${n}.min" type="number" inputmode="numeric" step="500" value="${t.min}" style="width:110px"></td></tr>`; }).join('')}
          </tbody></table>
          <label for="crNivDef" style="margin-top:.5rem">Niveau supposé quand l'annonce ne dit rien</label><select id="crNivDef" data-crtdef>${['r', 'c', 'l'].map(n => `<option value="${n}"${Object.assign({}, MA.CRITERES_DEF.travaux, C.travaux || {}).defaut === n ? ' selected' : ''}>${M.NIVEAUX[n]}</option>`).join('')}</select>
          <small class="aide">« à rénover » ou DPE F, G : rénovation complète ; « gros œuvre », « à réhabiliter » : lourde ; « bon état », « refait » : rafraîchissement. Les aléas de chantier de la simulation s'ajoutent.</small></div>
        <div class="champ" style="grid-column:1/-1"><label>Types analysés</label><div class="actions">${Object.entries(M.TYPES).map(([k, t]) => `<label class="case"><input type="checkbox" data-crtype="${k}"${C.types.includes(k) ? ' checked' : ''}> ${t.n}</label>`).join('')}</div><small class="aide">Immeubles et types non cochés : importés, écartés d'office. 0 dans un plafond le désactive.</small></div>
        <div class="champ" style="grid-column:1/-1"><label for="crZone">Zone</label><textarea id="crZone" data-crz rows="4">${esc((C.zone || []).join(', '))}</textarea><small class="aide">départements (95), codes postaux ou communes, séparés par des virgules ; vide = partout. Hors zone : importée, écartée d'office.</small></div>
        <div class="champ" style="grid-column:1/-1"><label for="crExclus">Mots exclus</label><input id="crExclus" data-crl="exclus" value="${esc(C.exclus.join(', '))}"></div>
        <div class="champ" style="grid-column:1/-1"><label for="crSignaux">Signaux favorables</label><input id="crSignaux" data-crl="signaux" value="${esc(C.signaux.join(', '))}"></div>
      </div>`;
  }
  const zoneCourte = z => { const d = {}; z.forEach(x => { const m = String(x).match(/^(\d{2})/); const k = m ? m[1] : x; d[k] = (d[k] || 0) + 1; }); return Object.entries(d).map(([k, n]) => n > 1 ? k + ' (' + n + ' communes)' : k).join(', '); };
  const resumeCriteres = R => { const C = Object.assign({}, MA.CRITERES_DEF, R.criteres || {}); return 'Prix affiché ≤ ' + eur(C.prixAfficheMax) + ' · argent à sortir ≤ ' + eur(C.tresoMax) + ' · marge brute ≥ ' + C.margeBruteMin + ' % de la revente · travaux ' + (() => { const t = Object.assign({}, MA.CRITERES_DEF.travaux, C.travaux || {}); return t.r.m2 + ' / ' + t.c.m2 + ' / ' + t.l.m2 + ' €/m², par défaut ' + M.NIVEAUX[t.defaut].toLowerCase(); })() + ' · négociation ≤ ' + C.negoMax + ' % · zone : ' + (C.zone && C.zone.length ? zoneCourte(C.zone) : 'partout') + ' · ' + C.types.map(k => M.TYPES[k] ? M.TYPES[k].n.toLowerCase() : k).join(', '); };
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
        <p class="aide">Les prix saisis ici remplacent la référence DVF du code postal.</p>
        <details style="margin-top:.6rem"><summary class="aide">Référence DVF : ${MA.DVF.secteurs.length} codes postaux · ${esc(MA.DVF.source)}</summary>
          <p class="aide">Prix d'un logement rénové approché par le 3e quartile du prix au m² des ventes réelles (appartements de 20 à 60 m²), maisons à part.</p>
          <table class="tableau"><thead><tr><th>Code postal</th><th>Commune</th><th class="nombre">Ventes</th><th class="nombre">Médiane</th><th class="nombre">Rénové €/m²</th><th class="nombre">Maison €/m²</th></tr></thead><tbody>
          ${MA.DVF.secteurs.map(x => `<tr><td>${x.cp}</td><td>${esc(x.commune)}</td><td class="nombre">${x.n}</td><td class="nombre">${x.mediane ? eur(x.mediane) : '—'}</td><td class="nombre">${x.pm2 ? eur(x.pm2) : '—'}</td><td class="nombre">${x.pm2Maison ? eur(x.pm2Maison) : '—'}</td></tr>`).join('')}</tbody></table></details></div>`;
  }
  function brancherCriteres(c) {
    const maj = f => { const R = reglages(); R.criteres = Object.assign({}, MA.CRITERES_DEF, R.criteres || {}); R.criteres.secteurs = (R.criteres.secteurs || []).map(s => Object.assign({}, s)); f(R.criteres); D.enregistrer('reglages', R); cacheAnn.clear(); };
    $$('[data-cr]', c).forEach(el => el.onchange = () => { maj(C => C[el.dataset.cr] = nb(el.value)); notifier('Critère enregistré.', 'succes'); });
    const majTravaux = f => maj(C => { const t = JSON.parse(JSON.stringify(Object.assign({}, MA.CRITERES_DEF.travaux, C.travaux || {}))); f(t); C.travaux = t; });
    $$('[data-crt]', c).forEach(el => el.onchange = () => { const [n, k] = el.dataset.crt.split('.'); majTravaux(t => t[n][k] = nb(el.value)); notifier('Budget travaux enregistré.', 'succes'); });
    $$('[data-crtdef]', c).forEach(el => el.onchange = () => { majTravaux(t => t.defaut = el.value); notifier('Budget travaux enregistré.', 'succes'); });
    $$('[data-crz]', c).forEach(el => el.onchange = () => { maj(C => C.zone = el.value.split(',').map(x => x.trim()).filter(Boolean)); notifier('Zone enregistrée.', 'succes'); });
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
    const ligne = (g, k, lib, unite) => { const d = M.REF_DEF[g][k], v = (ref[g] || {})[k], mod = v != null && v !== d; return `<tr><td data-titre="Poste">${esc(lib)}${est.has(g + '.' + k) ? ' <span class="etiquette orange">estimation</span>' : ''}</td><td class="nombre" data-titre="Unité">${unite}</td><td class="nombre" data-titre="Par défaut">${d.toLocaleString('fr-FR')}</td><td data-titre="Retenu"><input type="number" inputmode="decimal" min="0" step="any" data-ref="${g}.${k}" data-initial="${v != null ? v : d}" value="${v != null ? v : d}" style="width:110px" class="${mod ? 'orange' : ''}"></td></tr>`; };
    c.innerHTML = `<div class="en-tete-page"><div><h1>Repères</h1><p>Prix unitaires du chiffrage poste par poste des projets. Relevés fin novembre 2026 ; les lignes « estimation » n'ont pas de source vérifiée.</p></div><div class="actions"><button class="bouton" id="refRaz">Valeurs par défaut</button></div></div>
      <div class="info-bandeau">Mettre ici les prix des artisans et fournisseurs habituels. L'analyse des annonces, elle, utilise le budget travaux au m² des critères.</div>
      <div class="section-titre"><h2>Travaux</h2><span class="aide">avant coefficient de gamme</span></div>
      <div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Poste</th><th class="nombre">Unité</th><th class="nombre">Par défaut</th><th>Retenu</th></tr></thead><tbody>
        ${M.W.map(i => ligne('w', i.id, i.l, UNITE_W[i.per])).join('')}${ligne('w', 'deco_min', 'Décoration et mise en scène : minimum', '€')}</tbody></table></div>
      <div class="section-titre"><h2>Frais annexes</h2></div>
      <div class="tableau-conteneur"><table class="tableau adaptable"><thead><tr><th>Poste</th><th class="nombre">Unité</th><th class="nombre">Par défaut</th><th>Retenu</th></tr></thead><tbody>
        ${Object.keys(M.REF_DEF.x).map(k => ligne('x', k, LIB_X[k] || k, k.endsWith('pct') ? '%' : '€')).join('')}</tbody></table></div>
      <div class="barre-enregistrer"><span id="refEtat" class="discret">Aucune modification</span><span class="actions"><button class="bouton" id="refAnnuler" disabled>Annuler</button><button class="bouton bouton-principal" id="refEnr" disabled>Enregistrer les modifications</button></span></div>`;
    const modifies = () => $$('[data-ref]', c).filter(el => nb(el.value) !== nb(el.dataset.initial));
    const majBarre = () => { const n = modifies().length; $('#refEtat').textContent = n ? n + ' modification' + (n > 1 ? 's' : '') + ' non enregistrée' + (n > 1 ? 's' : '') : 'Aucune modification'; $('#refEtat').className = n ? 'orange' : 'discret'; $('#refEnr').disabled = $('#refAnnuler').disabled = !n; };
    $$('[data-ref]', c).forEach(el => el.addEventListener('input', () => { el.classList.toggle('modifie', nb(el.value) !== nb(el.dataset.initial)); majBarre(); }));
    $('#refAnnuler').onclick = () => afficher();
    $('#refEnr').onclick = () => {
      const R2 = reglages(); R2.ref = JSON.parse(JSON.stringify(R2.ref || { w: {}, x: {} })); R2.ref.w = R2.ref.w || {}; R2.ref.x = R2.ref.x || {};
      const l = modifies();
      l.forEach(el => { const [g, k] = el.dataset.ref.split('.'), v = nb(el.value); if (v === M.REF_DEF[g][k]) delete R2.ref[g][k]; else R2.ref[g][k] = v; });
      D.enregistrer('reglages', R2); appliquerReperes(); cacheAnalyse.clear(); notifier(l.length + ' repère(s) enregistré(s).', 'succes'); afficher();
    };
    $('#refRaz').onclick = () => confirmer('Revenir à tous les repères par défaut ?', () => { const R2 = reglages(); R2.ref = { w: {}, x: {} }; D.enregistrer('reglages', R2); appliquerReperes(); afficher(); });
  }

  /* ================= Réglages ================= */
  function vueReglages(c) {
    titre('Réglages', 'Paramètres et synchronisation', I.reglages);
    const R = reglages(), E = D.etat(), cf = D.conf();
    const champ = (k, l, aide) => `<div class="champ"><label for="g-${k}">${l}</label><input id="g-${k}" data-g="${k}" type="number" inputmode="decimal" min="0" step="any" value="${R[k]}">${aide ? `<small class="aide">${aide}</small>` : ''}</div>`;
    c.innerHTML = `<div class="en-tete-page"><div><h1>Réglages</h1></div></div>
      <div class="pile">
        <div class="carte"><h2>Synchronisation</h2><div class="compte">
          ${ligneCompte('Mode', E.mode === 'demo' ? 'Démonstration, données dans ce navigateur' : 'Serveur Google Apps Script')}
          ${E.mode === 'distant' ? ligneCompte('État', esc(E.message || 'À jour')) + ligneCompte('Modifications en attente', D.enAttente()) + ligneCompte('Serveur', `<small>${esc((cf.url || '').replace(/^https:\/\/script\.google\.com\/macros\/s\//, '…/').slice(0, 40))}</small>`) : ''}
        </div><div class="actions" style="margin-top:.8rem">
          ${E.mode === 'demo' ? '<button class="bouton bouton-principal" id="gConnect">Connecter un serveur</button><button class="bouton" id="gVider">Partir d\'une base vide</button><button class="bouton" id="gDemo">Recharger la démonstration</button>' : '<button class="bouton" id="gSync">Synchroniser</button><button class="bouton" id="gDeco">Se déconnecter</button><button class="bouton bouton-danger" id="gOubli">Oublier ce serveur</button>'}
          <button class="bouton" id="gExport">Exporter une sauvegarde</button><label class="bouton" for="gImport">Importer une sauvegarde</label><input id="gImport" type="file" accept=".json" hidden>
        </div></div>
        <div class="carte"><h2>Capital</h2><div class="grille-champs alignee">${champ('enveloppe', 'Enveloppe disponible (€)', 'commune à tous les projets')}${champ('seuilTravaux', 'Alerte de dépassement des travaux (%)')}</div></div>
        <div class="carte"><h2>Valeurs par défaut des nouveaux projets</h2><div class="grille-champs alignee">
          ${champ('taux', 'Intérêts associé investisseur (%/an)')}${champ('obj', 'Objectif de marge nette (%)')}${champ('part', 'Part associé opérateur (%)')}${champ('pfu', 'Prélèvement sur dividendes (%)')}${champ('dmax', 'Durée maximum (mois)')}
          <div class="champ"><label for="g-tvaT">TVA sur les travaux</label><select id="g-tvaT" data-gs="tvaT"><option value="10">10 %</option><option value="20">20 %</option><option value="5.5">5,5 %</option></select></div>
          <div class="champ"><label for="g-tvaMode">TVA à la revente</label><select id="g-tvaMode" data-gs="tvaMode"><option value="marge">Sur la marge</option><option value="total">Sur le prix total</option><option value="none">Aucune</option></select></div>
        </div></div>
        ${carteCriteres(R)}
        <div class="carte"><h2>Affichage</h2><div class="segments" id="theme"><button data-v="clair" aria-pressed="${R.theme !== 'sombre'}">Clair</button><button data-v="sombre" aria-pressed="${R.theme === 'sombre'}">Sombre</button></div></div>
      </div>`;
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

  /* ================= Page Visite (visite.html) : accueil mobile ================= */
  const MODE_VISITE = document.documentElement.dataset.mode === 'visite';
  const fv = { q: '', fin: null };
  function vueVisiteAccueil() {
    const c = $('#contenu'); if (!c) return;
    if (fv.fin) return resumeVisite(c, D.obtenir('biens', fv.fin));
    const q = fv.q.trim().toLowerCase();
    const l = D.liste('biens').filter(b => !['ecarte', 'vendu'].includes(b.etape) && (!q || (titreBien(b) + ' ' + (b.source || '')).toLowerCase().includes(q)))
      .sort((a, z) => (!!z.visiteBrouillon - !!a.visiteBrouillon) || (z._maj || '').localeCompare(a._maj || ''));
    c.innerHTML = `
      <button class="bouton bouton-vert bouton-large" id="vNouveau">+ Nouveau bien</button>
      <div class="vacc-titre">Biens en cours</div>
      <input type="search" id="vQ" placeholder="Rechercher : adresse, ville…" value="${esc(fv.q)}" aria-label="Rechercher">
      <div class="vacc-liste">${l.map(b => { const B = b.visiteBrouillon, V = b.visite; return `<button class="vacc-bien" data-id="${b.id}"><span><strong>${esc(titreBien(b))}</strong><small>${esc([typeBien(b), surfaceBien(b), b.prixAffiche ? eur(b.prixAffiche) : ''].filter(Boolean).join(' · '))}</small></span><span class="vacc-etat">${B ? '<b class="orange">Visite en cours</b>' : V ? '<b class="vert">Visité le ' + dateFr(V.fin.slice(0, 10)) + '</b>' : esc(ETAPE[b.etape || 'repere'])}</span></button>`; }).join('') || '<div class="vide">Aucun bien en cours. « + Nouveau bien » pour commencer.</div>'}</div>`;
    $('#vNouveau').onclick = nouveauBienVisite;
    $('#vQ').oninput = e => { fv.q = e.target.value; const pos = e.target.selectionStart; vueVisiteAccueil(); const x = $('#vQ'); x.focus(); x.setSelectionRange(pos, pos); };
    $$('[data-id]', c).forEach(x => x.onclick = () => ouvrirVisite(D.obtenir('biens', x.dataset.id), b => { fv.fin = b.id; vueVisiteAccueil(); }));
  }
  function resumeVisite(c, b) {
    if (!b || !b.visite) { fv.fin = null; return vueVisiteAccueil(); }
    const V = b.visite, A = V.analyse, r = analyse(b).r;
    c.innerHTML = `
      <div class="vacc-titre">Visite enregistrée</div><h1 class="vacc-bien-titre">${esc(titreBien(b))}</h1>
      <div class="indicateurs">
        ${indic('Travaux', eur(r.T), { detail: M.NIVEAUX[A.niveau].toLowerCase() })}
        ${indic('Marge brute', pc(r.vente ? (r.vente - r.C) / r.vente : 0), { detail: eur(r.vente - r.C) })}
        ${indic('Bénéfice net', eur(r.N), { detail: 'marge nette ' + pc(r.m) })}
        ${indic('Photos', V.photos.length)}
      </div>
      ${A.alertes.map(x => `<div class="alerte-bandeau">${esc(x)}</div>`).join('')}
      <a class="bouton bouton-principal bouton-large" href="index.html#/bien/${b.id}/visite">Ouvrir le projet dans Marchéo</a>
      <button class="bouton bouton-large" id="vAutre">Nouvelle visite</button>`;
    $('#vAutre').onclick = () => { fv.fin = null; vueVisiteAccueil(); };
  }
  /* Nouveau bien depuis la page Visite : lien (Bien'ici lu par le serveur), texte collé ou saisie */
  function nouveauBienVisite() {
    const distant = D.etat().mode === 'distant';
    const fond = modale('Nouveau bien', `
      <div class="champ"><label for="nvL">Lien de l'annonce</label><div class="actions" style="flex-wrap:nowrap"><input id="nvL" type="url" inputmode="url" placeholder="https://…"><button type="button" class="bouton bouton-principal" id="nvLire">Lire</button></div><small class="aide" id="nvEtat">Bien'ici est lu directement. Pour les autres sites, coller aussi le texte de l'annonce.</small></div>
      <div class="champ"><label for="nvX">Texte de l'annonce</label><textarea id="nvX" rows="3" placeholder="Copier le texte de l'annonce et le coller ici."></textarea></div>
      <div class="grille-champs alignee">
        <div class="champ" style="grid-column:1/-1"><label for="nvT">Adresse ou titre</label><input id="nvT"></div>
        <div class="champ"><label for="nvType">Type</label><select id="nvType">${Object.entries(M.TYPES).map(([k, t]) => `<option value="${k}">${t.n}</option>`).join('')}</select></div>
        <div class="champ"><label for="nvP">Prix affiché (€)</label><input id="nvP" type="number" inputmode="numeric"></div>
        <div class="champ"><label for="nvS">Surface (m²)</label><input id="nvS" type="number" inputmode="decimal"></div>
        <div class="champ"><label for="nvPi">Pièces à vivre</label><input id="nvPi" type="number" inputmode="numeric"></div>
        <div class="champ"><label for="nvCp">Code postal</label><input id="nvCp" inputmode="numeric"></div>
        <div class="champ"><label for="nvV">Ville</label><input id="nvV"></div>
      </div>`,
      [{ l: 'Annuler' }, { l: 'Créer et commencer la visite', classe: 'bouton-principal', f: f => {
        const g = id => $(id, f).value.trim();
        if (!g('#nvT') && !g('#nvCp') && !g('#nvL')) { notifier('Renseigner au moins l\'adresse, le code postal ou le lien.', 'erreur'); return false; }
        const a = D.enregistrer('annonces', { titre: g('#nvT') || 'Bien visité', type: g('#nvType'), prix: nb(g('#nvP')) || 0, surface: nb(g('#nvS')) || undefined, pieces: nb(g('#nvPi')) || undefined, cp: g('#nvCp'), ville: g('#nvV'), lien: g('#nvL'), source: sourceDuLien(g('#nvL')) || 'Visite', texte: g('#nvX').slice(0, 3000), dpe: f.dataset.dpe || '', recueLe: new Date().toISOString(), statutTri: 'vue', manuel: true });
        const b = creerProjet(D.obtenir('annonces', a.id));
        setTimeout(() => ouvrirVisite(b, x => { fv.fin = x.id; vueVisiteAccueil(); }), 0);
      } }]);
    const remplir = x => {
      const set = (id, v) => { if (v && !$(id, fond).value) $(id, fond).value = v; };
      set('#nvT', x.titre); set('#nvP', x.prix); set('#nvS', x.surface); set('#nvPi', x.pieces); set('#nvCp', x.cp); set('#nvV', x.ville);
      if (x.type && M.TYPES[x.type]) $('#nvType', fond).value = x.type;
      if (x.dpe) fond.dataset.dpe = x.dpe;
    };
    $('#nvX', fond).addEventListener('input', e => remplir(MA.lireTexte(e.target.value)));
    $('#nvLire', fond).onclick = async () => {
      const url = $('#nvL', fond).value.trim(), etat = $('#nvEtat', fond);
      if (!/^https:\/\//.test(url)) { etat.textContent = 'Coller un lien commençant par https://'; return; }
      if (!distant) { etat.textContent = 'Mode démonstration : coller le texte de l\'annonce ci-dessous.'; return; }
      etat.textContent = 'Lecture en cours…';
      try {
        const x = await D.action('lireAnnonce', { url });
        if (x.bloque) { etat.innerHTML = '<span class="orange">Ce site refuse la lecture automatique : coller le texte de l\'annonce ci-dessous.</span>'; return; }
        remplir(x); etat.innerHTML = '<span class="vert">Annonce lue. Vérifier puis « Créer et commencer la visite ».</span>';
      } catch (err) { etat.innerHTML = '<span class="rouge">' + esc(err.message) + '</span>'; }
    };
  }
  function coquilleVisite() {
    document.body.innerHTML = `<div class="page-visite">
      <header class="vacc-tete"><img class="logo" src="icone-visite.svg" alt=""><div><strong>Marchéo</strong><small>Visite</small></div><span class="etat-synchro" id="etatSynchro"></span><a class="bouton bouton-petit vacc-crm" href="index.html">CRM</a></header>
      ${D.etat().mode === 'demo' ? '<div class="bandeau-demo">Mode démonstration : données fictives stockées dans ce navigateur.</div>' : ''}
      <main class="vacc-contenu" id="contenu"></main></div><div id="notifications"></div>`;
  }

  const sourceDuLien = u => ({ leboncoin: 'Leboncoin', seloger: 'SeLoger', bienici: "Bien'ici", pap: 'PAP', 'logic-immo': 'Logic-Immo' })[((String(u || '').match(/https?:\/\/(?:www\.)?([^\/.]+)/) || [])[1] || '')] || '';

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
    appliquerTheme(); if (MODE_VISITE) coquilleVisite(); else coquille(); appliquerReperes();
    D.abonner(e => { majSynchro(e); if (e.mode === 'distant' && e.session === false) ecranConnexion(false); });
    majSynchro(E);
    /* Données reçues d'un autre appareil : on redessine hors saisie en cours. */
    let dernier = '';
    D.abonner(() => { const k = D.liste('biens').map(b => b._maj).join() + D.liste('relances').length + D.liste('contacts').length + D.liste('journal').length + D.liste('annonces').map(x => x._maj).join(); if (k !== dernier) { dernier = k; const a = document.activeElement; if (!a || !/INPUT|TEXTAREA|SELECT/.test(a.tagName)) { cacheAnalyse.clear(); afficher(); } else majNav(); } });
    if (!MODE_VISITE) window.addEventListener('hashchange', afficher);
    afficher();
  }
  window.Marcheo = { ETAPES, PIECES, analyse, partsRepartition, COULEURS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
