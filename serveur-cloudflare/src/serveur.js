/* Marchéo · serveur hébergé (Cloudflare Workers), plusieurs comptes isolés.
   Même protocole que serveur/Code.gs : POST {action, jeton, donnees} → {ok, resultat} ou {ok:false, code, message}.
   Données : D1 (une ligne par fiche et par compte). Photos et cache DVF : R2. Alertes : e-mails transférés (Email Routing).
   Toute lecture ou écriture de fiche est filtrée par le compte issu du jeton. */
import commun from '../../serveur/commun.js';
import { lireEmail, adresse } from './mime.js';

const { extraireAnnonces_, fusionnerAnnonce_, extraireDePage_, depuisBienici_, lignesCsv_, ventesUniques_, choisirComparables_, EXPEDITEURS_ALERTES, DVF_TYPES } = commun;

export const COLLS = ['biens', 'contacts', 'relances', 'journal', 'reglages', 'annonces'];
export const DUREE_JETON_JOURS = 60;
export const DUREE_ESSAI_JOURS = 7;
export const ITERATIONS_PBKDF2 = 100000; // maximum accepté par Cloudflare Workers
/* Limites par offre : constantes faciles à changer. null = illimité. */
export const LIMITES = {
  essai: { annoncesMois: null, projetsActifs: null, dvfMois: null, photos: null },
  gratuit: { annoncesMois: 20, projetsActifs: 1, dvfMois: 3, photos: 20 },
  pro: { annoncesMois: null, projetsActifs: null, dvfMois: null, photos: null }
};
export const ESSAIS_CONNEXION = { nombre: 10, fenetreMs: 15 * 60000 }; // par adresse IP et par compte
const ETAPES_INACTIVES = ['ecarte', 'vendu'];

const erreur = (message, code) => Object.assign(new Error(message), { code });
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const aleatoireHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(t) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(t))); }
async function pbkdf2(motDePasse, sel, iterations) {
  const cle = await crypto.subtle.importKey('raw', enc.encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(sel), iterations, hash: 'SHA-256' }, cle, 256));
}
const egal = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
/* Adresse de transfert : 10 caractères sans voyelle ambiguë, impossible à deviner */
function nouvelleAdresse() { const a = 'abcdefghjkmnpqrstuvwxyz23456789', o = crypto.getRandomValues(new Uint8Array(10)); return [...o].map(x => a[x % a.length]).join(''); }

export function creerServeur(env, options = {}) {
  const DB = env.DB, R2 = env.STOCKAGE;
  const fetchF = options.fetch || ((...a) => fetch(...a));
  const maintenant = () => (options.maintenant ? options.maintenant() : new Date());
  const iso = () => maintenant().toISOString();
  const mois = () => iso().slice(0, 7);
  const domaine = () => env.ALERTES_DOMAINE || 'alertes.marcheo.local';
  const envoi = env.ENVOI || { envoyer: async () => {} };

  /* ---------- Comptes ---------- */
  async function compte(id) {
    const c = await DB.prepare('SELECT * FROM comptes WHERE id = ?').bind(id).first();
    if (!c) throw erreur('Compte introuvable.', 'SESSION');
    /* Fin d'essai : bascule automatique en Gratuit, aucune donnée supprimée */
    if (c.offre === 'essai' && c.essai_fin && c.essai_fin < iso()) {
      await DB.prepare("UPDATE comptes SET offre = 'gratuit' WHERE id = ?").bind(id).run();
      c.offre = 'gratuit';
    }
    return c;
  }
  const limites = c => LIMITES[c.offre] || LIMITES.gratuit;
  async function usage(compteId, type, periode) {
    const r = await DB.prepare('SELECT n FROM usage WHERE compte_id = ? AND mois = ? AND type = ?').bind(compteId, periode, type).first();
    return r ? r.n : 0;
  }
  async function compter(compteId, type, periode, n = 1) {
    await DB.prepare('INSERT INTO usage (compte_id, mois, type, n) VALUES (?, ?, ?, ?) ON CONFLICT (compte_id, mois, type) DO UPDATE SET n = n + excluded.n').bind(compteId, periode, type, n).run();
  }
  async function freiner(cle) {
    const t = maintenant().getTime(), r = await DB.prepare('SELECT n, debut FROM essais WHERE cle = ?').bind(cle).first();
    if (r && t - r.debut < ESSAIS_CONNEXION.fenetreMs) {
      if (r.n >= ESSAIS_CONNEXION.nombre) throw erreur('Trop d\'essais de connexion : réessayez dans 15 minutes.', 'FREIN');
      await DB.prepare('UPDATE essais SET n = n + 1 WHERE cle = ?').bind(cle).run();
    } else await DB.prepare('INSERT INTO essais (cle, n, debut) VALUES (?, 1, ?) ON CONFLICT (cle) DO UPDATE SET n = 1, debut = excluded.debut').bind(cle, t).run();
  }
  async function creerJeton(compteId) {
    const jeton = aleatoireHex(32);
    await DB.prepare('INSERT INTO jetons (empreinte, compte_id, expire) VALUES (?, ?, ?)').bind(await sha256(jeton), compteId, maintenant().getTime() + DUREE_JETON_JOURS * 86400000).run();
    return jeton;
  }
  async function verifierJeton(jeton) {
    if (!jeton) throw erreur('Session expirée : reconnectez-vous.', 'SESSION');
    const e = await sha256(jeton), r = await DB.prepare('SELECT compte_id, expire FROM jetons WHERE empreinte = ?').bind(e).first();
    if (!r || r.expire < maintenant().getTime()) { if (r) await DB.prepare('DELETE FROM jetons WHERE empreinte = ?').bind(e).run(); throw erreur('Session expirée : reconnectez-vous.', 'SESSION'); }
    return r.compte_id;
  }
  const emailValide = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  async function inscription(d, ctx) {
    const email = String(d.email || d.identifiant || '').trim().toLowerCase(), mdp = String(d.motDePasse || '');
    if (!emailValide(email)) throw erreur('Adresse e-mail invalide.', 'INSCRIPTION');
    if (mdp.length < 8) throw erreur('Mot de passe : 8 caractères minimum.', 'INSCRIPTION');
    await freiner('inscription|' + (ctx.ip || ''));
    if (await DB.prepare('SELECT id FROM comptes WHERE email = ?').bind(email).first()) throw erreur('Un compte existe déjà avec cette adresse : connectez-vous.', 'EXISTE');
    const id = 'c' + aleatoireHex(8), sel = aleatoireHex(16), cree = iso();
    let adr = nouvelleAdresse();
    while (await DB.prepare('SELECT id FROM comptes WHERE adresse_transfert = ?').bind(adr).first()) adr = nouvelleAdresse();
    const fin = new Date(maintenant().getTime() + DUREE_ESSAI_JOURS * 86400000).toISOString();
    await DB.prepare("INSERT INTO comptes (id, email, sel, empreinte, iterations, adresse_transfert, offre, essai_fin, cree_le) VALUES (?, ?, ?, ?, ?, ?, 'essai', ?, ?)")
      .bind(id, email, sel, await pbkdf2(mdp, sel, ITERATIONS_PBKDF2), ITERATIONS_PBKDF2, adr, fin, cree).run();
    return { jeton: await creerJeton(id), utilisateur: email, adresseTransfert: adr + '@' + domaine(), essaiFin: fin };
  }
  async function connexion(d, ctx) {
    const email = String(d.email || d.identifiant || '').trim().toLowerCase(), mdp = String(d.motDePasse || '');
    await freiner('ip|' + (ctx.ip || '')); await freiner('compte|' + email);
    const c = await DB.prepare('SELECT id, sel, empreinte, iterations FROM comptes WHERE email = ?').bind(email).first();
    const calcule = await pbkdf2(mdp, c ? c.sel : 'aucun', c ? c.iterations : ITERATIONS_PBKDF2); // même durée, compte connu ou non
    if (!c || !egal(calcule, c.empreinte)) throw erreur('Adresse e-mail ou mot de passe incorrect.', 'ACCES');
    return { jeton: await creerJeton(c.id), utilisateur: email };
  }
  async function motDePasseOublie(d, ctx) {
    const email = String(d.email || '').trim().toLowerCase();
    await freiner('oubli|' + (ctx.ip || ''));
    const c = emailValide(email) && await DB.prepare('SELECT id FROM comptes WHERE email = ?').bind(email).first();
    if (c) {
      const j = aleatoireHex(24);
      await DB.prepare('INSERT INTO reinitialisations (empreinte, compte_id, expire) VALUES (?, ?, ?)').bind(await sha256(j), c.id, maintenant().getTime() + 3600000).run();
      await envoi.envoyer({ a: email, sujet: 'Marchéo : nouveau mot de passe', texte: 'Pour choisir un nouveau mot de passe (lien valable une heure) :\n' + (env.APP_URL || '') + '#/reinitialiser/' + j + '\n\nSi vous n\'êtes pas à l\'origine de cette demande, ignorez ce message.' });
    }
    return { fait: true }; // même réponse que le compte existe ou non
  }
  async function reinitialiser(d) {
    const mdp = String(d.motDePasse || ''); if (mdp.length < 8) throw erreur('Mot de passe : 8 caractères minimum.', 'INSCRIPTION');
    const e = await sha256(String(d.jeton || '')), r = await DB.prepare('SELECT compte_id, expire FROM reinitialisations WHERE empreinte = ?').bind(e).first();
    if (!r || r.expire < maintenant().getTime()) throw erreur('Lien expiré : refaites la demande.', 'LIEN');
    const sel = aleatoireHex(16);
    await DB.batch([
      DB.prepare('UPDATE comptes SET sel = ?, empreinte = ?, iterations = ? WHERE id = ?').bind(sel, await pbkdf2(mdp, sel, ITERATIONS_PBKDF2), ITERATIONS_PBKDF2, r.compte_id),
      DB.prepare('DELETE FROM reinitialisations WHERE compte_id = ?').bind(r.compte_id),
      DB.prepare('DELETE FROM jetons WHERE compte_id = ?').bind(r.compte_id)
    ]);
    return { fait: true };
  }

  /* ---------- Fiches ---------- */
  const versFiche = r => ({ coll: r.coll, id: r.id, majLe: r.maj_le, supprime: !!r.supprime, recuLe: r.recu_le,
    data: r.masque ? { id: r.id, masquee: true, recueLe: (JSON.parse(r.json || '{}').recueLe) || r.recu_le } : JSON.parse(r.json || '{}') });
  async function lire(compteId, depuis) {
    const res = await (depuis
      ? DB.prepare('SELECT * FROM fiches WHERE compte_id = ? AND recu_le >= ? ORDER BY recu_le').bind(compteId, depuis)
      : DB.prepare('SELECT * FROM fiches WHERE compte_id = ? ORDER BY recu_le').bind(compteId)).all();
    const l = res.results || [];
    /* >= : une fiche reçue dans la même milliseconde que la lecture précédente n'est jamais perdue (comme Code.gs) */
    return { enregistrements: l.map(versFiche), horodatage: l.reduce((m, r) => r.recu_le > m ? r.recu_le : m, depuis || '') };
  }
  const actif = data => data && !data._supprime && !ETAPES_INACTIVES.includes(data.etape || 'repere');
  async function ecrire(compteId, lot, par) {
    const c = await compte(compteId), lim = limites(c), recu = iso(), refuses = [], bloques = [], ops = [];
    let actifs = null;
    for (const e of Array.isArray(lot) ? lot : []) {
      if (!COLLS.includes(e.coll) || !e.id || !e.majLe) continue;
      const r = await DB.prepare('SELECT * FROM fiches WHERE compte_id = ? AND coll = ? AND id = ?').bind(compteId, e.coll, String(e.id)).first();
      if (r && r.maj_le > e.majLe) { refuses.push(versFiche(r)); continue; } // une version plus récente existe déjà
      /* Offre gratuite : un seul projet actif */
      if (e.coll === 'biens' && lim.projetsActifs != null && !e.supprime && actif(e.data) && !(r && actif(JSON.parse(r.json || '{}')))) {
        if (actifs == null) actifs = ((await DB.prepare("SELECT json FROM fiches WHERE compte_id = ? AND coll = 'biens' AND supprime = 0").bind(compteId).all()).results || []).filter(x => actif(JSON.parse(x.json || '{}'))).length;
        if (actifs >= lim.projetsActifs) { bloques.push({ coll: e.coll, id: e.id, code: 'LIMITE', message: 'Offre gratuite : ' + lim.projetsActifs + ' projet actif au plus. Passez en Pro pour en suivre davantage.' }); continue; }
        actifs++;
      }
      ops.push(DB.prepare('INSERT INTO fiches (compte_id, coll, id, maj_le, supprime, recu_le, masque, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (compte_id, coll, id) DO UPDATE SET maj_le = excluded.maj_le, supprime = excluded.supprime, recu_le = excluded.recu_le, json = excluded.json')
        .bind(compteId, e.coll, String(e.id), e.majLe, e.supprime ? 1 : 0, recu, r ? r.masque : 0, JSON.stringify(e.data || {})));
    }
    if (ops.length) await DB.batch(ops);
    return { ecrits: ops.length, refuses, bloques, par };
  }

  /* ---------- Alertes reçues par e-mail ---------- */
  async function recevoirEmail({ destinataire, octets }) {
    const local = adresse(destinataire).split('@')[0];
    const c = local && await DB.prepare('SELECT id FROM comptes WHERE adresse_transfert = ?').bind(local).first();
    if (!c) return { ignore: 'destinataire inconnu' };
    const m = lireEmail(octets), de = adresse(m.de);
    /* Confirmation de transfert Gmail : on garde le code et le lien, l'application les affiche */
    if (de === 'forwarding-noreply@google.com') {
      const code = (m.objet.match(/#\s?(\d{5,})/) || m.texte.match(/(?:code de confirmation|confirmation code)\D{0,20}(\d{5,})/i) || [])[1] || '';
      const lien = (m.texte.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/vf-[^\s<>"\]]+/) || [])[0] || '';
      await DB.prepare('INSERT INTO transferts (compte_id, recu_le, code, lien) VALUES (?, ?, ?, ?)').bind(c.id, iso(), code, lien).run();
      return { confirmation: true, code, lien };
    }
    /* Seuls les portails d'annonces connus, jugés sur l'expéditeur d'origine (conservé par le transfert Gmail) */
    if (!EXPEDITEURS_ALERTES.some(x => de.includes(x))) return { ignore: 'expéditeur non reconnu : ' + de };
    const annonces = extraireAnnonces_(m.de, m.objet, m.texte, m.date || iso());
    if (!annonces.length) return { annonces: 0 };
    const cpt = await compte(c.id), lim = limites(cpt), recu = iso(), periode = mois(), ops = [];
    let vues = await usage(c.id, 'annonces', periode);
    for (const a of annonces) {
      const r = await DB.prepare("SELECT * FROM fiches WHERE compte_id = ? AND coll = 'annonces' AND id = ?").bind(c.id, a.id).first();
      const base = r ? JSON.parse(r.json || '{}') : null;
      if (!(base && base.surface) && options.completer !== false) await completerBienici(a);
      const d = fusionnerAnnonce_(base, a); d.id = a.id;
      let masque = r ? r.masque : 0;
      if (!r) { vues++; masque = lim.annoncesMois != null && vues > lim.annoncesMois ? 1 : 0; } // au-delà du quota : reçue mais masquée
      ops.push(DB.prepare("INSERT INTO fiches (compte_id, coll, id, maj_le, supprime, recu_le, masque, json) VALUES (?, 'annonces', ?, ?, 0, ?, ?, ?) ON CONFLICT (compte_id, coll, id) DO UPDATE SET maj_le = excluded.maj_le, recu_le = excluded.recu_le, masque = excluded.masque, json = excluded.json")
        .bind(c.id, a.id, recu, recu, masque, JSON.stringify(d)));
    }
    await DB.batch(ops);
    const nouvelles = vues - await usage(c.id, 'annonces', periode);
    if (nouvelles) await compter(c.id, 'annonces', periode, nouvelles);
    return { annonces: annonces.length, nouvelles };
  }
  async function completerBienici(a) {
    if (!a.idSource || a.source !== "Bien'ici" || a.surface) return a;
    try { const x = await lireBienici(a.idSource); if (x) ['surface', 'pieces', 'dpe', 'type', 'chargesAnnuelles', 'texte'].forEach(k => { if (x[k] && !a[k]) a[k] = x[k]; }); } catch (e) { /* l'annonce reste à compléter */ }
    return a;
  }
  async function lireBienici(id) {
    const r = await fetchF('https://www.bienici.com/realEstateAd.json?id=' + encodeURIComponent(id));
    if (r.status !== 200) return null;
    try { return depuisBienici_(await r.json()); } catch (e) { return null; }
  }
  async function etatTransfert(compteId) {
    const c = await compte(compteId);
    const t = await DB.prepare('SELECT code, lien, recu_le FROM transferts WHERE compte_id = ? ORDER BY recu_le DESC LIMIT 1').bind(compteId).first();
    const p = await DB.prepare("SELECT MIN(recu_le) AS le FROM fiches WHERE compte_id = ? AND coll = 'annonces'").bind(compteId).first();
    return { adresse: c.adresse_transfert + '@' + domaine(), confirmation: t ? { code: t.code, lien: t.lien, recuLe: t.recu_le } : null, premiereAnnonce: (p && p.le) || '',
      expediteurs: EXPEDITEURS_ALERTES }; // pour la recherche Gmail à coller dans le filtre
  }
  async function infosCompte(compteId) {
    const c = await compte(compteId), p = mois();
    return { email: c.email, offre: c.offre, essaiFin: c.essai_fin, adresseTransfert: c.adresse_transfert + '@' + domaine(), limites: limites(c),
      usage: { annoncesMois: await usage(compteId, 'annonces', p), dvfMois: await usage(compteId, 'dvf', p), photos: await usage(compteId, 'photos', 'total') },
      masquees: ((await DB.prepare("SELECT COUNT(*) AS n FROM fiches WHERE compte_id = ? AND coll = 'annonces' AND masque = 1").bind(compteId).first()) || {}).n || 0 };
  }

  /* ---------- Lecture d'une annonce par son lien ---------- */
  async function lireAnnonce(url) {
    if (!/^https:\/\/[^\s]+$/.test(url)) throw erreur('Lien invalide.', 'LIEN');
    const bi = url.match(/bienici\.com\/annonce\/(?:[^\/?#]+\/)*?([^\/?#]+)(?:[?#]|$)/);
    if (bi) { const x = await lireBienici(bi[1]); if (x) { x.lien = 'https://www.bienici.com/annonce/' + bi[1]; return x; } }
    const rep = await fetchF(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
    if (rep.status >= 400) return { bloque: true, code: rep.status };
    return extraireDePage_(await rep.text(), url);
  }

  /* ---------- Photos et documents (R2) ---------- */
  async function deposerPhoto(compteId, d) {
    const base64 = String(d.base64 || '');
    if (!base64 || base64.length > 12000000) throw erreur('Photo ou document absent ou trop lourd.', 'PHOTO');
    const c = await compte(compteId), lim = limites(c);
    if (lim.photos != null && await usage(compteId, 'photos', 'total') >= lim.photos) throw erreur('Offre gratuite : ' + lim.photos + ' photos au plus. Passez en Pro pour en ajouter.', 'LIMITE');
    let type = String(d.type || 'image/jpeg'); if (!/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(type)) type = 'image/jpeg';
    const bien = String(d.bienId || 'divers').replace(/[^\w-]/g, '').slice(0, 40) || 'divers', nom = String(d.nom || 'photo.jpg').replace(/[^\w.-]/g, '-').slice(0, 80);
    const cle = compteId + '/' + bien + '/' + aleatoireHex(6) + '-' + nom;
    const bin = atob(base64.replace(/\s/g, '')), octets = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
    await R2.put('photos/' + cle, octets, { httpMetadata: { contentType: type } });
    await compter(compteId, 'photos', 'total');
    return { id: cle };
  }
  async function lirePhoto(compteId, id) {
    id = String(id || '');
    if (!id.startsWith(compteId + '/') || id.includes('..')) throw erreur('Photo inconnue.', 'PHOTO'); // jamais la photo d'un autre compte
    const o = await R2.get('photos/' + id); if (!o) throw erreur('Photo inconnue.', 'PHOTO');
    const u = new Uint8Array(await o.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return { base64: btoa(s) };
  }

  /* ---------- Ventes DVF (fichiers publics Etalab), cache R2 par commune et par année ---------- */
  async function geocoder(adr, cp, ville) {
    const chercher = async (q, extra) => {
      for (const base of ['https://api-adresse.data.gouv.fr/search/', 'https://data.geopf.fr/geocodage/search']) {
        try { const r = await fetchF(base + '?limit=1&q=' + encodeURIComponent(q) + (cp ? '&postcode=' + encodeURIComponent(cp) : '') + (extra || '')); if (r.status === 200) return ((await r.json()).features || [])[0] || null; } catch (e) {}
      }
      return null;
    };
    let f = adr ? await chercher([adr, ville].filter(Boolean).join(' ')) : null;
    const precis = !!(f && f.properties.score >= 0.6 && /housenumber|street/.test(f.properties.type));
    if (!precis) f = (await chercher(ville || cp, '&type=municipality')) || f;
    if (!f) return null;
    return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], insee: f.properties.citycode, commune: f.properties.city, cp: f.properties.postcode, libelle: f.properties.label, precis };
  }
  async function fichierDVF(annee, dep, insee) {
    const cle = 'dvf/' + annee + '/' + insee + '.csv', o = await R2.get(cle);
    const frais = o && (annee < maintenant().getFullYear() - 1 || maintenant().getTime() - new Date(o.uploaded || 0).getTime() < 30 * 86400000);
    if (frais) return o.text();
    const r = await fetchF('https://files.data.gouv.fr/geo-dvf/latest/csv/' + annee + '/communes/' + dep + '/' + insee + '.csv', { redirect: 'follow' });
    if (r.status !== 200) return o ? o.text() : null;
    const t = await r.text(); await R2.put(cle, t, { httpMetadata: { contentType: 'text/csv' } });
    return t;
  }
  async function ventesDVF(compteId, d) {
    const typeLocal = DVF_TYPES[d.type];
    if (!typeLocal) throw erreur('Type non couvert par DVF (box : ventes de dépendances sans surface).', 'DVF');
    const c = await compte(compteId), lim = limites(c), p = mois();
    if (lim.dvfMois != null && await usage(compteId, 'dvf', p) >= lim.dvfMois) throw erreur('Offre gratuite : ' + lim.dvfMois + ' recherches de ventes par mois. Passez en Pro pour continuer.', 'LIMITE');
    const g = (d.lat && d.insee) ? { lat: +d.lat, lon: +d.lon, insee: String(d.insee), commune: d.ville, precis: true } : await geocoder(String(d.adresse || ''), String(d.cp || ''), String(d.ville || ''));
    if (!g || !g.insee) throw erreur('Adresse introuvable dans la Base Adresse Nationale.', 'DVF');
    const dep = /^97/.test(g.insee) ? g.insee.slice(0, 3) : g.insee.slice(0, 2), an = maintenant().getFullYear(), annees = [];
    for (let y = an; y >= an - 4; y--) annees.push(y);
    const textes = await Promise.all(annees.map(y => fichierDVF(y, dep, g.insee).catch(() => null)));
    let ventes = []; const lues = [];
    textes.forEach((t, i) => { if (!t) return; lues.push(annees[i]); ventes = ventes.concat(ventesUniques_(lignesCsv_(t), typeLocal)); });
    if (!lues.length) throw erreur('Fichiers DVF indisponibles pour cette commune.', 'DVF');
    const garder = lues.slice(0, 3).map(String);
    ventes = ventes.filter(v => garder.includes(v.date.slice(0, 4)));
    const res = choisirComparables_(ventes, { lat: g.lat, lon: g.lon, surface: d.surface, pieces: d.pieces }, 3);
    res.lieu = { libelle: g.libelle || '', commune: g.commune || '', insee: g.insee, precis: g.precis, lat: g.lat, lon: g.lon };
    res.periode = garder[garder.length - 1] + '–' + garder[0]; res.derniere = ventes.reduce((m, v) => v.date > m ? v.date : m, '');
    res.type = typeLocal;
    await compter(compteId, 'dvf', p);
    return res;
  }

  /* ---------- Paiement : webhook Stripe (abonnement Pro) ---------- */
  async function signatureStripe(corps, entete) {
    const secret = env.STRIPE_WEBHOOK_SECRET; if (!secret) throw erreur('Webhook Stripe non configuré.', 'STRIPE');
    const p = Object.fromEntries(String(entete || '').split(',').map(x => x.split('=').map(s => s.trim())));
    if (!p.t || !p.v1 || Math.abs(maintenant().getTime() / 1000 - +p.t) > 300) throw erreur('Signature Stripe invalide.', 'STRIPE');
    const cle = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    if (!egal(hex(await crypto.subtle.sign('HMAC', cle, enc.encode(p.t + '.' + corps))), p.v1)) throw erreur('Signature Stripe invalide.', 'STRIPE');
  }
  async function passerPro(compteId, client) {
    await DB.batch([
      DB.prepare("UPDATE comptes SET offre = 'pro', stripe_client = COALESCE(?, stripe_client) WHERE id = ?").bind(client || null, compteId),
      /* les annonces masquées redeviennent visibles et repartent vers les appareils */
      DB.prepare('UPDATE fiches SET masque = 0, recu_le = ? WHERE compte_id = ? AND masque = 1').bind(iso(), compteId)
    ]);
  }
  async function stripe(corps, entete) {
    await signatureStripe(corps, entete);
    const ev = JSON.parse(corps), o = (ev.data && ev.data.object) || {};
    if (ev.type === 'checkout.session.completed') {
      let c = o.client_reference_id ? await DB.prepare('SELECT id FROM comptes WHERE id = ?').bind(o.client_reference_id).first() : null;
      if (!c && o.customer_details && o.customer_details.email) c = await DB.prepare('SELECT id FROM comptes WHERE email = ?').bind(String(o.customer_details.email).toLowerCase()).first();
      if (c) await passerPro(c.id, o.customer || null);
      return { traite: !!c };
    }
    if (ev.type === 'customer.subscription.deleted' && o.customer) {
      await DB.prepare("UPDATE comptes SET offre = 'gratuit' WHERE stripe_client = ?").bind(o.customer).run();
      return { traite: true };
    }
    return { traite: false };
  }

  /* ---------- Aiguillage des actions (mêmes noms que Code.gs) ---------- */
  async function traiter(action, d, jeton, ctx = {}) {
    d = d || {};
    if (action === 'inscription') return inscription(d, ctx);
    if (action === 'connexion') return connexion(d, ctx);
    if (action === 'motDePasseOublie') return motDePasseOublie(d, ctx);
    if (action === 'reinitialiserMotDePasse') return reinitialiser(d);
    const id = await verifierJeton(jeton);
    if (action === 'lire') return lire(id, String(d.depuis || ''));
    if (action === 'ecrire') return ecrire(id, d.enregistrements || [], (await compte(id)).email);
    if (action === 'deconnexion') { await DB.prepare('DELETE FROM jetons WHERE empreinte = ?').bind(await sha256(jeton)).run(); return { fait: true }; }
    if (action === 'compte') return infosCompte(id);
    if (action === 'etatTransfert') return etatTransfert(id);
    if (action === 'lireAnnonce') return lireAnnonce(String(d.url || ''));
    if (action === 'deposerPhoto') return deposerPhoto(id, d);
    if (action === 'lirePhoto') return lirePhoto(id, d.id);
    if (action === 'ventesDVF') return ventesDVF(id, d);
    throw erreur('Action inconnue.', 'ACTION');
  }
  async function appel(corps, ctx) {
    try {
      const req = JSON.parse(corps || '{}');
      return { ok: true, resultat: await traiter(req.action, req.donnees || {}, req.jeton || '', ctx) };
    } catch (err) {
      return { ok: false, code: err.code || 'SERVEUR', message: err.code ? err.message : 'Erreur du serveur.' };
    }
  }
  return { traiter, appel, recevoirEmail, stripe, passerPro };
}
