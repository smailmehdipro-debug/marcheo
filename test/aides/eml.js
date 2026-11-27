/* Fabrication d'e-mails MIME pour les tests (tels que Gmail les transfère) */
'use strict';
function qp(texte) {
  const o = Buffer.from(texte, 'utf8'); let s = '', ligne = '';
  for (const b of o) {
    const c = b === 10 ? '\n' : (b >= 33 && b <= 126 && b !== 61) || b === 32 ? String.fromCharCode(b) : '=' + b.toString(16).toUpperCase().padStart(2, '0');
    if (c === '\n') { s += ligne + '\r\n'; ligne = ''; continue; }
    if (ligne.length + c.length > 75) { s += ligne + '=\r\n'; ligne = ''; }
    ligne += c;
  }
  return s + ligne;
}
const motEncode = t => /^[\x20-\x7e]*$/.test(t) ? t : '=?UTF-8?B?' + Buffer.from(t, 'utf8').toString('base64') + '?=';
function eml({ de, a, objet, texte, html, encodage = 'qp', date = 'Thu, 27 Nov 2026 13:00:00 +0100', transfertPour }) {
  const b = 'frontiere-' + Math.random().toString(36).slice(2);
  const partie = (type, contenu) => encodage === 'base64'
    ? `Content-Type: ${type}; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(contenu, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n')}\r\n`
    : `Content-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${qp(contenu)}\r\n`;
  const parties = [texte != null ? partie('text/plain', texte) : null, html != null ? partie('text/html', html) : null].filter(Boolean);
  return [
    'Received: from mail-sor-f41.google.com', transfertPour ? 'X-Forwarded-To: ' + transfertPour : null, transfertPour ? 'X-Forwarded-For: client@gmail.com ' + transfertPour : null,
    'From: ' + motEncode(de.split('<')[0].trim()) + (de.includes('<') ? ' <' + de.split('<')[1] : ''), 'To: ' + a, 'Subject: ' + motEncode(objet), 'Date: ' + date, 'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${b}"`, '', parties.map(p => '--' + b + '\r\n' + p).join('') + '--' + b + '--', ''
  ].filter(x => x !== null).join('\r\n');
}
module.exports = { eml, qp };
