/* Marchéo · point d'entrée du Worker Cloudflare.
   - fetch : POST / (protocole de l'application), GET / (état du serveur), POST /stripe (webhook de paiement)
   - email : alertes d'annonces et confirmations de transfert reçues sur <adresse>@<ALERTES_DOMAINE> (Email Routing, catch-all) */
import { creerServeur } from './serveur.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o, statut = 200) => new Response(JSON.stringify(o), { status: statut, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS) });

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url), S = creerServeur(env);
    if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (requete.method === 'GET') return json({ ok: true, application: 'Marchéo', message: 'Serveur en service.' });
    if (requete.method !== 'POST') return json({ ok: false, code: 'METHODE', message: 'Méthode non acceptée.' }, 405);
    const corps = await requete.text();
    if (url.pathname === '/stripe') {
      try { return json({ ok: true, resultat: await S.stripe(corps, requete.headers.get('Stripe-Signature')) }); }
      catch (e) { return json({ ok: false, code: e.code || 'STRIPE', message: e.message }, 400); }
    }
    return json(await S.appel(corps, { ip: requete.headers.get('CF-Connecting-IP') || '' }));
  },
  async email(message, env) {
    const octets = new Uint8Array(await new Response(message.raw).arrayBuffer());
    await creerServeur(env).recevoirEmail({ destinataire: message.to, octets });
  }
};
