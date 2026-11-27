/* Simulateurs locaux de Cloudflare pour les tests : D1 (SQLite intégré à Node), R2 (mémoire), envoi d'e-mails (journal).
   Même interface que les services réels, pour tester le Worker sans compte Cloudflare. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '../../serveur-cloudflare/schema.sql'), 'utf8'));
  const prep = sql => {
    const st = { args: [], bind(...a) { st.args = a.map(v => v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v); return st; },
      async first(col) { const r = db.prepare(sql).get(...st.args); return r == null ? null : col ? r[col] : Object.assign({}, r); },
      async all() { return { results: db.prepare(sql).all(...st.args).map(r => Object.assign({}, r)) }; },
      async run() { const r = db.prepare(sql).run(...st.args); return { meta: { changes: r.changes } }; },
      _executer() { return db.prepare(sql).run(...st.args); } };
    return st;
  };
  return {
    prepare: prep,
    async batch(l) { db.exec('BEGIN'); try { l.forEach(s => s._executer()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return l.map(() => ({})); },
    async exec(sql) { db.exec(sql); },
    brut: db
  };
}

function r2() {
  const objets = new Map();
  const vers = v => typeof v === 'string' ? new TextEncoder().encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v);
  return {
    objets,
    async put(cle, valeur, o = {}) { objets.set(cle, { octets: vers(valeur), httpMetadata: o.httpMetadata || {}, uploaded: new Date() }); return {}; },
    async get(cle) {
      const o = objets.get(cle); if (!o) return null;
      return { httpMetadata: o.httpMetadata, uploaded: o.uploaded, async arrayBuffer() { return o.octets.buffer.slice(o.octets.byteOffset, o.octets.byteOffset + o.octets.byteLength); }, async text() { return new TextDecoder().decode(o.octets); } };
    },
    async delete(cle) { objets.delete(cle); }
  };
}

function envoi() { const boite = []; return { boite, async envoyer(m) { boite.push(m); } }; }

/* Fausse réponse HTTP, pour simuler fetch */
const reponse = (statut, corps) => ({ status: statut, async text() { return typeof corps === 'string' ? corps : JSON.stringify(corps); }, async json() { return typeof corps === 'string' ? JSON.parse(corps) : corps; } });

module.exports = { d1, r2, envoi, reponse };
