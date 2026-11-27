/* Marchéo · lecture d'un e-mail brut (MIME), sans dépendance.
   Rend l'expéditeur, l'objet, la date et un texte brut équivalent à getPlainBody() de Gmail :
   la partie text/plain si elle existe, sinon le HTML converti (chaque lien suit son texte sur sa propre ligne). */

/* Octets → « chaîne binaire » (un caractère par octet) pour lire les en-têtes et les séparateurs sans perte */
export function versBinaire(octets) {
  const u = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return s;
}
const binaireVersOctets = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };

function decoderTexte(octets, charset) {
  const c = String(charset || 'utf-8').toLowerCase().replace(/^"|"$/g, '');
  if (/^(us-ascii|ascii)$/.test(c)) return versBinaire(octets);
  try { return new TextDecoder(c === 'latin1' ? 'iso-8859-1' : c).decode(octets); } catch (e) {
    return /8859|1252|latin/.test(c) ? versBinaire(octets) : new TextDecoder('utf-8').decode(octets);
  }
}
function quotedPrintable(s) {
  return binaireVersOctets(s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))));
}
function base64(s) {
  const b = atob(s.replace(/[^A-Za-z0-9+/=]/g, ''));
  return binaireVersOctets(b);
}
/* =?utf-8?Q?...?= et =?utf-8?B?...?= (RFC 2047), espaces entre deux mots encodés supprimés */
export function decoderEntete(v) {
  return String(v || '').replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?)/g, '$1').replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (m, cs, enc, txt) => {
    const octets = enc.toUpperCase() === 'B' ? base64(txt) : quotedPrintable(txt.replace(/_/g, ' '));
    return decoderTexte(octets, cs);
  });
}
function lireEntetes(bloc) {
  const h = {};
  bloc.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach(l => {
    const i = l.indexOf(':'); if (i <= 0) return;
    const k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim();
    if (!(k in h)) h[k] = v; // le premier en-tête l'emporte (le plus récent est en haut)
  });
  return h;
}
const param = (v, nom) => { const m = String(v || '').match(new RegExp(nom + '\\s*=\\s*("([^"]*)"|[^;\\s]+)', 'i')); return m ? (m[2] != null ? m[2] : m[1]) : ''; };

function lirePartie(brut, out) {
  const coupe = brut.search(/\r?\n\r?\n/);
  const entetes = lireEntetes(coupe < 0 ? brut : brut.slice(0, coupe));
  const corps = coupe < 0 ? '' : brut.slice(coupe).replace(/^\r?\n\r?\n/, '');
  const type = (entetes['content-type'] || 'text/plain').split(';')[0].trim().toLowerCase();
  if (type.startsWith('multipart/')) {
    const b = param(entetes['content-type'], 'boundary'); if (!b) return entetes;
    const morceaux = corps.split('--' + b);
    /* le retour à la ligne qui précède chaque séparateur appartient au séparateur (RFC 2046), pas à la partie */
    morceaux.slice(1).forEach(m => { if (/^--/.test(m)) return; lirePartie(m.replace(/^\r?\n/, '').replace(/\r?\n$/, ''), out); });
    return entetes;
  }
  if (type === 'message/rfc822') { lirePartie(corps, out); return entetes; }
  if (type !== 'text/plain' && type !== 'text/html') return entetes;
  if (/attachment/i.test(entetes['content-disposition'] || '')) return entetes;
  const enc = (entetes['content-transfer-encoding'] || '').toLowerCase();
  const octets = enc === 'base64' ? base64(corps) : enc === 'quoted-printable' ? quotedPrintable(corps) : binaireVersOctets(corps);
  const texte = decoderTexte(octets, param(entetes['content-type'], 'charset') || 'utf-8');
  if (type === 'text/plain' && out.texte == null) out.texte = texte;
  if (type === 'text/html' && out.html == null) out.html = texte;
  return entetes;
}

const entites = t => String(t).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&euro;/g, '€').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)));
/* HTML → texte : blocs sur des lignes, lien après son texte, sur sa propre ligne */
export function htmlVersTexte(html) {
  return entites(String(html || '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, t) => '\n' + t.replace(/<[^>]+>/g, ' ') + '\n' + href + '\n')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d|table|td)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
}

/* Adresse e-mail seule, en minuscules : « Bien'ici <no_reply@bienici.com> » → no_reply@bienici.com */
export const adresse = v => ((String(v || '').match(/<([^>]+)>/) || [])[1] || String(v || '').trim()).toLowerCase();

export function lireEmail(octets) {
  const brut = typeof octets === 'string' ? octets : versBinaire(octets);
  const out = { texte: null, html: null };
  const h = lirePartie(brut, out);
  const date = h.date ? new Date(h.date) : null;
  return {
    de: decoderEntete(h.from || ''), a: decoderEntete(h.to || ''), objet: decoderEntete(h.subject || ''),
    date: date && !isNaN(date) ? date.toISOString() : '', entetes: h,
    texte: out.texte != null ? out.texte.replace(/\r\n/g, '\n') : htmlVersTexte(out.html || ''), html: out.html || ''
  };
}
