/* Marchéo · dossier PDF d'un bien (jsPDF), repris du générateur du simulateur d'origine.
   Pages : synthèse et décompte fiscal ; associé investisseur, contrôles, indicateurs, limites, scénarios, comparables,
   décision à signer ; avancement des travaux (bien en chantier) ; annexe détaillée des postes. */
(function (global) {
  'use strict';
  function creer(o) {
    const M = global.MDB, b = o.b, A = o.A, S = o.S, r = A.r, P = A.partage, J = global.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, MG = 12, CW = W - 2 * MG; let y = 0;
    const FOND = [248, 244, 236], ENCRE = [14, 42, 29], TX = [21, 33, 27], MU = [90, 103, 95], LN = [217, 207, 187], PAN = [236, 229, 215], AC = [15, 74, 48], BLANC = [250, 246, 238], CLAIR = [201, 171, 116], LAITON = [168, 134, 79];
    const VC = { ok: [46, 107, 52], juste: [154, 90, 12], ko: [142, 31, 36], '': MU };
    const eur = n => (isFinite(n) ? Math.round(n) : 0).toLocaleString('fr-FR') + ' €';
    const pc = (n, d = 1) => (isFinite(n) ? n * 100 : 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
    /* Polices standard en WinAnsi : espaces fines et signes absents remplacés */
    const c = t => String(t == null ? '' : t).replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/–/g, '-').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/²/g, '2').replace(/[✓≥≤]/g, m => m === '≥' ? '>=' : m === '≤' ? '<=' : '').replace(/[‘’]/g, "'");
    const fill = a => doc.setFillColor(a[0], a[1], a[2]), draw = a => doc.setDrawColor(a[0], a[1], a[2]);
    const T = (t, x, yy, op = {}) => { doc.setFont('helvetica', op.bold ? 'bold' : 'normal'); doc.setFontSize(op.size || 9.5); const a = op.color || TX; doc.setTextColor(a[0], a[1], a[2]); doc.text(c(t), x, yy, op.align ? { align: op.align } : undefined); };
    const tw = (t, size, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); return doc.getTextWidth(c(t)); };
    const fit = (t, w, size, bold) => { t = c(t); if (tw(t, size, bold) <= w) return t; while (t.length > 1 && tw(t + '...', size, bold) > w) t = t.slice(0, -1); return t.replace(/[ ,·]+$/, '') + '...'; };
    const wrap = (t, w, size, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); return doc.splitTextToSize(c(t), w); };
    const page = () => { fill(FOND); doc.rect(0, 0, W, H, 'F'); };
    const need = h => { if (y + h > 282) { doc.addPage(); page(); y = 16; } };
    const titre = t => { need(18); y += 3; T(t.toUpperCase(), MG, y, { bold: true, size: 9, color: AC }); draw(LAITON); doc.setLineWidth(0.3); doc.line(MG, y + 1.6, MG + 18, y + 1.6); y += 4.5; };
    const ligne = (lab, sub, val, op = {}) => { need(7.6); T(fit(lab, CW * .55, 9.6, op.bold), MG + 2, y + 5, { size: 9.6, bold: op.bold, color: op.color || TX }); if (sub) { const sx = MG + 2 + Math.min(tw(lab, 9.6, op.bold), CW * .55) + 3; T(fit(sub, W - MG - 2 - tw(val, 9.6, true) - 5 - sx, 7.8, false), sx, y + 5, { size: 7.8, color: MU }); } T(val, W - MG - 2, y + 5, { size: 9.6, bold: true, color: op.vcolor || op.color || TX, align: 'right' }); draw(LN); doc.setLineWidth(0.2); doc.line(MG, y + 7.2, W - MG, y + 7.2); y += 7.2; };
    const bande = (lab, val, sub, fond, txt) => { need(11); y += 1.2; fill(fond || ENCRE); doc.roundedRect(MG, y, CW, 9.2, 1.2, 1.2, 'F'); T(lab, MG + 4, y + 6.1, { bold: true, size: 10, color: txt || BLANC }); if (sub) T(sub, MG + 4 + tw(lab, 10, true) + 4, y + 6.1, { size: 8.2, color: txt ? MU : CLAIR }); T(val, W - MG - 4, y + 6.2, { bold: true, size: 11.5, color: txt || BLANC, align: 'right' }); y += 10.6; };
    const dateTxt = new Date().toLocaleDateString('fr-FR');
    const TY = M.TYPES[S.type], U = A.quartier.unite;
    const unite = S.type === 'box' ? S.pieces + ' boxes' : S.type === 'terrain' ? S.surf + ' m² de terrain, ' + S.pieces + ' lots' : S.surf + ' m², ' + S.pieces + ' pièce' + (S.pieces > 1 ? 's' : '');
    const etatLib = o.etats[A.etat][1];
    const tvaTxt = S.tvaMode === 'marge' ? '(revente - achat) / 6' : S.tvaMode === 'total' ? 'revente / 6, pire cas' : 'non appliquée';
    const isTxt = r.R <= 0 ? 'pas de bénéfice, pas d\'impôt' : r.R <= 42500 ? '15 % du résultat' : '15 % jusqu\'à 42 500 €, 25 % au-delà';

    /* ---------- Page 1 : synthèse et décompte ---------- */
    page(); fill(ENCRE); doc.rect(0, 0, W, 43, 'F'); fill(LAITON); doc.rect(0, 43, W, 0.8, 'F');
    const tag = 'MARCHÉO · DOSSIER D\'OPÉRATION'; draw(LAITON); doc.setLineWidth(0.4); doc.roundedRect(MG, 7, tw(tag, 7, true) + 5, 6, 1, 1, 'S'); T(tag, MG + 2.5, 11.1, { bold: true, size: 7, color: CLAIR });
    T('Établi le ' + dateTxt + ' · étape : ' + o.etape, W - MG, 11.1, { size: 8.5, color: CLAIR, align: 'right' });
    const al = wrap((S.adresse || '').trim() || 'Adresse à compléter', CW, 16, true).slice(0, 2); al.forEach((l, i) => { doc.setFont('times', 'bold'); doc.setFontSize(19); doc.setTextColor(BLANC[0], BLANC[1], BLANC[2]); doc.text(c(l), MG, 23.5 + i * 7.2); });
    T(TY.n + ' · ' + unite + ' · ' + S.duree + ' mois' + (b.source ? ' · source : ' + b.source : ''), MG, al.length > 1 ? 38 : 31.5, { size: 10, color: CLAIR });
    y = 48;
    const vc = VC[A.etat]; fill(BLANC); draw(vc); doc.setLineWidth(0.9); doc.roundedRect(MG, y, CW, 15, 1.4, 1.4, 'FD');
    T(etatLib.toUpperCase(), MG + 5, y + 9.8, { bold: true, size: 15, color: vc });
    T('Marge nette ' + pc(r.m) + ' du coût de revient · objectif ' + S.obj + ' % · contrôles ' + A.controles.score + '/4', W - MG - 5, y + 9.4, { size: 9.5, color: vc, align: 'right' }); y += 19;
    const k4 = [['BÉNÉFICE NET', eur(r.N)], ['NET DE L\'ASSOCIÉ OPÉRATEUR', eur(P.operateur.net)], ['COÛT DE REVIENT', eur(r.C)], ['TRÉSORERIE MAXIMALE', eur(r.treso)]], kw = (CW - 9) / 4;
    k4.forEach((k, i) => { const x = MG + i * (kw + 3); fill(PAN); doc.roundedRect(x, y, kw, 16, 1.2, 1.2, 'F'); fill(LAITON); doc.rect(x, y, 0.9, 16, 'F'); T(k[0], x + 3, y + 5.4, { bold: true, size: 6.2, color: MU }); doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(TX[0], TX[1], TX[2]); doc.text(c(k[1]), x + 3, y + 12.6); }); y += 21;

    T('Répartition du prix de revente', MG, y, { bold: true, size: 10.5 }); y += 2.5;
    const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const parts = global.Marcheo.partsRepartition(r).filter(p => p[1] > 0), tot = parts.reduce((s, p) => s + p[1], 0) || 1; let x = MG;
    parts.forEach(p => { const w = p[1] / tot * CW; fill(hex(global.Marcheo.COULEURS[p[0]])); doc.rect(x, y, w, 7, 'F'); if (w > 11) T(Math.round(p[1] / tot * 100) + ' %', x + w / 2, y + 4.8, { bold: true, size: 7.5, color: p[0] === 'Bénéfice net' || p[0] === 'IS' || p[0] === 'Annexes' ? ENCRE : BLANC, align: 'center' }); x += w; });
    y += 10.5; parts.forEach((p, i) => { const lx = MG + (i % 3) * (CW / 3), ly = y + Math.floor(i / 3) * 4.8; fill(hex(global.Marcheo.COULEURS[p[0]])); doc.rect(lx, ly - 2.5, 2.8, 2.8, 'F'); T(p[0] + ' : ' + eur(p[1]), lx + 4.2, ly, { size: 8 }); });
    y += Math.ceil(parts.length / 3) * 4.8 + 4;

    titre('Fiscalité et marge nette');
    ligne('Prix de revente', S.type === 'box' ? eur(S.vente / (S.pieces || 1)) + ' par box' : eur(S.vente / (S.surf || 1)) + ' par m²', eur(r.vente));
    ligne('- Prix d\'achat hors frais d\'agence', 'décote de ' + pc(r.vente ? 1 - r.achat / r.vente : 0, 0) + ' sur la revente' + (b.prixAffiche ? ' · prix affiché ' + eur(b.prixAffiche) : ''), eur(r.achat));
    ligne('- Notaire et agence à l\'achat', 'régime marchand de biens, dont droits réduits ' + eur(P.droits), eur(r.acq));
    ligne('- Travaux hors taxes', r.reel ? 'coût réel du chantier' : eur(r.T / U.q) + (S.type === 'box' ? ' par box' : ' par m²') + ', aléas de ' + S.aleas + ' % compris', eur(r.T));
    ligne('- Frais annexes', '', eur(r.anx + r.agV));
    ligne('- Prestations de la société partenaire', r.mis ? String(Math.round(r.misPct * 10) / 10).replace('.', ',') + ' % du prix de revente' : 'aucune', eur(r.mis));
    bande('MARGE BRUTE', eur(P.brut), pc(P.brut / (r.vente || 1), 0) + ' du prix de revente', PAN, TX);
    ligne('- TVA à la revente', tvaTxt, eur(r.tva));
    ligne('- Intérêts versés à l\'associé investisseur', String(S.taux).replace('.', ',') + ' % par an sur ' + r.duree + ' mois', eur(r.int));
    ligne('= Résultat avant impôt', '', eur(r.R), { bold: true });
    ligne('- Impôt sur les sociétés', isTxt, eur(r.is));
    bande('BÉNÉFICE NET DE LA SOCIÉTÉ', eur(r.N), 'marge nette ' + pc(r.m), ENCRE);
    ligne('Part de l\'associé opérateur, en dividendes bruts', S.part + ' % du bénéfice net', eur(P.operateur.dividendes));
    ligne('- Prélèvement sur dividendes', String(S.pfu).replace('.', ',') + ' %', eur(P.operateur.prelevement));
    ligne('= Net perçu par l\'associé opérateur', '', eur(P.operateur.net), { bold: true, vcolor: VC.ok });
    ligne('Total fiscalité de l\'opération', 'droits d\'achat, TVA, IS, prélèvement sur dividendes', eur(P.fiscalite));
    ligne('TVA des travaux avancée puis récupérée', 'pèse sur la trésorerie, pas sur la marge', eur(P.tvaTravaux));

    /* ---------- Page 2 : analyse et décision ---------- */
    doc.addPage(); page(); y = 16;
    doc.setFont('times', 'bold'); doc.setFontSize(18); doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]); doc.text(c('Analyse et décision'), MG, y); y += 8;
    titre('Revenus de l\'associé investisseur');
    ligne('Capital avancé, remboursé à la revente', 'trésorerie maximale sortie', eur(P.investisseur.capital));
    ligne('Intérêts reçus', String(S.taux).replace('.', ',') + ' % par an sur ' + r.duree + ' mois', eur(P.investisseur.interets));
    ligne('Dividendes reçus', (100 - S.part) + ' % du bénéfice net', eur(P.investisseur.dividendes));
    ligne('- IS de l\'associé investisseur, estimation', '15 % sur les intérêts et sur 5 % des dividendes', eur(P.investisseur.is));
    bande('REVENUS NETS DE L\'ASSOCIÉ INVESTISSEUR', eur(P.investisseur.net), pc(P.investisseur.rendement) + ' du capital, ' + pc(P.investisseur.rendementAn) + ' par an', ENCRE);
    y += 4;
    titre('Contrôles avant décision');
    const CT = A.controles, conf = CT.score === 4; need(34);
    fill(BLANC); draw(conf ? VC.ok : VC.ko); doc.setLineWidth(0.9); doc.roundedRect(MG, y, CW, 30, 1.4, 1.4, 'FD');
    T(CT.score + '/4', MG + 17, y + 17, { bold: true, size: 28, color: conf ? VC.ok : VC.ko, align: 'center' }); T('contrôles validés', MG + 17, y + 23, { size: 7.2, color: MU, align: 'center' });
    const detail = { marge: pc(r.m), duree: S.duree + ' mois', comps: CT.liste[2].v + ' vente(s)', zones: 'ABF : ' + (S.abf || 'non renseigné') + ' · préemption : ' + (S.preempt || 'non renseigné') };
    CT.liste.forEach((k, i) => { const yy = y + 7 + i * 5.8; T(k.ok ? 'OUI' : 'NON', MG + 38, yy, { bold: true, size: 8, color: k.ok ? VC.ok : VC.ko }); T(fit(k.l + ' · ' + detail[k.k], CW - 54, 8.6, false), MG + 48, yy, { size: 8.6 }); });
    y += 35;
    titre('Indicateurs');
    const ind = A.ind, sgn = v => (v >= 0 ? '+ ' : '- ') + pc(Math.abs(v));
    ligne('Décote achat / revente', 'repère : 40 % ou plus', pc(ind.decote.v, 0), { vcolor: VC[ind.decote.etat] });
    if (ind.ecartQuartier.v != null) ligne('Revente / prix du quartier', 'revente visée ' + eur(A.quartier.vise) + ' · marge au prix du quartier ' + pc(ind.ecartQuartier.margeAuQuartier), sgn(ind.ecartQuartier.v), { vcolor: VC[ind.ecartQuartier.etat === 'juste' ? 'juste' : ''] });
    ligne('Marge de négociation', 'écart au prix d\'achat maximum', eur(ind.negociation.v), { vcolor: VC[ind.negociation.etat] });
    ligne('Travaux', pc(ind.travauxPart.v, 0) + ' du coût de revient' + (r.tr.top ? ' · plus gros poste : ' + r.tr.top.l.toLowerCase() : ''), eur(ind.travauxU.v) + (S.type === 'box' ? ' /box' : ' /m²'));
    ligne('Écart du budget travaux aux repères', ind.ecartRepere.etat ? 'à justifier par des devis signés' : '', sgn(ind.ecartRepere.v), { vcolor: VC[ind.ecartRepere.etat] });
    ligne('Baisse de revente supportable', 'avant la perte : ' + pc(Math.max(0, ind.baissePerte.v)), pc(Math.max(0, ind.baisseObjectif.v)));
    ligne('Coût d\'un mois de retard', 'sur le bénéfice net', eur(ind.coutMois.v));
    if (ind.fiscaliteMarge.v != null) ligne('TVA et IS sur la marge brute', '', pc(ind.fiscaliteMarge.v, 0));
    ligne('Trésorerie / enveloppe', 'enveloppe ' + eur(S.env), ind.tresorerie.reste >= 0 ? 'reste ' + eur(ind.tresorerie.reste) : 'manque ' + eur(-ind.tresorerie.reste), { vcolor: VC[ind.tresorerie.etat] });
    ind.alertesType.forEach(a => ligne('Point de vigilance', '', a, { vcolor: VC.juste }));
    if (S.abf === 'Oui') ligne('Zone ABF', 'accord requis pour les travaux visibles', 'délais allongés', { vcolor: VC.juste });
    if (S.preempt === 'Oui') ligne('Zone de préemption', 'délai de réponse de la mairie', 'à prévoir', { vcolor: VC.juste });
    y += 4;
    titre('Limites de l\'opération pour ' + S.obj + ' %');
    const L = A.lim;
    ligne('Prix d\'achat maximum', '', L.achatMax ? eur(L.achatMax) : 'aucun');
    ligne('Revente minimum', '', eur(L.venteMin)); ligne('Revente au point mort', '', eur(L.venteZero));
    ligne('Budget travaux maximum', '', L.travauxMax ? eur(L.travauxMax) : 'aucun');
    ligne('Retard supportable', '', L.retard < 0 ? 'objectif non atteint' : L.retard >= 36 ? 'plus de 36 mois' : L.retard + ' mois');
    y += 4;
    titre('Scénarios défavorables');
    A.scenarios.forEach(q => { need(7); T(q.l, MG + 2, y + 5, { size: 9.4 }); T(eur(q.N), W - MG - 34, y + 5, { size: 9.4, bold: true, align: 'right' }); T(pc(q.m), W - MG - 2, y + 5, { size: 9.4, bold: true, color: VC[q.etat], align: 'right' }); draw(LN); doc.setLineWidth(0.2); doc.line(MG, y + 7.2, W - MG, y + 7.2); y += 7.2; });
    y += 4;
    titre('Ventes comparables');
    const C = A.comp;
    if (C.comps.length) {
      C.comps.slice(0, 12).forEach(q => ligne(fit(q.adresse || 'Sans adresse', 84, 9.6, false), q.surface.toLocaleString('fr-FR') + ' m² · ' + eur(q.prix) + (q.date ? ' · ' + q.date : ''), eur(q.m2) + ' /m²'));
      bande('MOYENNE DES VENTES COMPARABLES', eur(C.moy) + ' /m²', C.ecart != null ? 'revente souhaitée ' + (C.ecart >= 0 ? '+ ' : '- ') + pc(Math.abs(C.ecart)) : '', PAN, TX);
    } else { need(8); T('Aucune vente comparable : la revente repose sur le prix du quartier saisi (' + eur(S.pm2) + (S.type === 'box' ? ' par box' : ' par m²') + ').', MG + 2, y + 4, { size: 9, color: VC.ko }); y += 8; }
    y += 4; need(40); draw(TX); doc.setLineWidth(0.6); fill(BLANC); doc.roundedRect(MG, y, CW, 36, 1.2, 1.2, 'FD');
    T('DÉCISION DE L\'ASSOCIÉ INVESTISSEUR', MG + 5, y + 7.5, { bold: true, size: 10.5 }); doc.setLineWidth(0.5);
    [['Accord', MG + 5], ['À revoir', MG + 42], ['Refus', MG + 79]].forEach(q => { doc.rect(q[1], y + 13, 4.5, 4.5); T(q[0], q[1] + 7, y + 16.8, { size: 10.5 }); });
    T('Montant accordé : ........................ €', MG + 112, y + 16.8, { size: 10 }); T('Date :', MG + 5, y + 28, { size: 10 }); T('Signature :', MG + 70, y + 28, { size: 10 });
    y += 40;

    /* ---------- Avancement des travaux (bien en chantier) ---------- */
    const lignes = (b.travaux && b.travaux.lignes) || [];
    if (lignes.length && ['chantier', 'vente', 'vendu'].includes(b.etape)) {
      doc.addPage(); page(); y = 16;
      doc.setFont('times', 'bold'); doc.setFontSize(18); doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]); doc.text(c('Avancement des travaux'), MG, y); y += 8;
      const TC = A.chantier || M.totauxChantier(lignes, S.aleas, 15);
      const k = [['BUDGET', eur(TC.budget)], ['ENGAGÉ', eur(TC.engage)], ['PAYÉ', eur(TC.paye)], ['AVANCEMENT', pc(TC.avancement, 0)]];
      k.forEach((q, i) => { const xx = MG + i * (kw + 3); fill(PAN); doc.roundedRect(xx, y, kw, 16, 1.2, 1.2, 'F'); T(q[0], xx + 3, y + 5.4, { bold: true, size: 6.2, color: MU }); T(q[1], xx + 3, y + 12.4, { bold: true, size: 13, color: i === 1 && TC.alerte ? VC.ko : TX }); }); y += 21;
      if (TC.alerte) { T('Dépassement : engagé ' + pc(TC.depassement, 0) + ' au-dessus du budget.', MG, y, { bold: true, size: 9.5, color: VC.ko }); y += 6; }
      const nomArtisan = id => { const a = (o.contacts || []).find(x => x.id === id); return a ? a.nom : ''; };
      const c1 = MG + 2, c2 = W - MG - 92, c3 = W - MG - 64, c4 = W - MG - 36, c5 = W - MG - 16, c6 = W - MG - 2;
      need(8); [['Poste', c1, 'left'], ['Budget', c2, 'right'], ['Devis', c3, 'right'], ['Facturé', c4, 'right'], ['Payé', c5, 'right'], ['%', c6, 'right']].forEach(q => T(q[0], q[1], y, { size: 7.6, color: MU, align: q[2] === 'right' ? 'right' : undefined }));
      draw(TX); doc.setLineWidth(0.35); doc.line(MG, y + 1.6, W - MG, y + 1.6); y += 2;
      lignes.forEach(l => { need(9); T(fit(l.l, c2 - c1 - 22, 8.6, false), c1, y + 4.2, { size: 8.6 }); const sub = [nomArtisan(l.artisanId), l.debut ? 'début ' + new Date(l.debut).toLocaleDateString('fr-FR') : '', l.fin ? 'fin ' + new Date(l.fin).toLocaleDateString('fr-FR') : ''].filter(Boolean).join(' · '); if (sub) T(fit(sub, c2 - c1 - 22, 7, false), c1, y + 7.4, { size: 7, color: MU });
        T(eur(l.budget), c2, y + 4.2, { size: 8.6, color: MU, align: 'right' }); T(l.devis ? eur(l.devis) : '-', c3, y + 4.2, { size: 8.6, bold: true, align: 'right', color: l.devis > l.budget * 1.15 ? VC.ko : TX }); T(l.facture ? eur(l.facture) : '-', c4, y + 4.2, { size: 8.6, align: 'right' }); T(l.paye ? eur(l.paye) : '-', c5, y + 4.2, { size: 8.6, align: 'right' }); T((l.avancement || 0) + ' %', c6, y + 4.2, { size: 8.6, align: 'right' });
        draw(LN); doc.setLineWidth(0.2); doc.line(MG, y + 8.6, W - MG, y + 8.6); y += 8.6; });
      y += 3; ligne('Reste à payer sur engagé', '', eur(TC.reste), { bold: true }); ligne('Coût réel estimé du chantier', 'devis signés, budget et aléas pour le reste', eur(TC.reel), { bold: true });
    }

    /* ---------- Annexe : détail des postes ---------- */
    doc.addPage(); page(); y = 16;
    doc.setFont('times', 'bold'); doc.setFontSize(18); doc.setTextColor(ENCRE[0], ENCRE[1], ENCRE[2]); doc.text(c('Annexe : détail des postes'), MG, y); y += 8;
    const table = (rows, foot) => {
      const c1 = MG + 2, c2 = W - MG - 62, c3 = W - MG - 32, c4 = W - MG - 2; need(8);
      T('Poste', c1, y, { size: 7.6, color: MU }); T('Repère', c2, y, { size: 7.6, color: MU, align: 'right' }); T('Retenu', c3, y, { size: 7.6, color: MU, align: 'right' }); T('Écart', c4, y, { size: 7.6, color: MU, align: 'right' });
      draw(TX); doc.setLineWidth(0.35); doc.line(MG, y + 1.6, W - MG, y + 1.6); y += 2;
      rows.forEach(q => { need(6.2); const d = q[2] - q[1]; T(fit(q[0], c2 - c1 - 24, 8.8, false), c1, y + 4.2, { size: 8.8 }); T(eur(q[1]), c2, y + 4.2, { size: 8.8, color: MU, align: 'right' }); T(eur(q[2]), c3, y + 4.2, { size: 8.8, bold: true, align: 'right' }); T(Math.round(d) === 0 ? '-' : (d > 0 ? '+ ' : '- ') + eur(Math.abs(d)), c4, y + 4.2, { size: 8.8, color: d > 0 ? VC.juste : d < 0 ? VC.ok : MU, align: 'right' }); draw(LN); doc.setLineWidth(0.2); doc.line(MG, y + 6, W - MG, y + 6); y += 6; });
      foot.forEach(f => { need(6.6); T(f[0], c1, y + 4.6, { size: 9.2, bold: true }); T(f[1], c4, y + 4.6, { size: 9.2, bold: true, align: 'right' }); y += 6.2; }); y += 5;
    };
    titre('Acquisition');
    table([['Frais de notaire, régime marchand de biens', M.notaire(S.achat), r.not], ['Frais d\'agence à l\'achat', S.agA, S.agA]].filter(q => q[1] || q[2]), [['Total acquisition', eur(r.acq)]]);
    titre('Travaux' + (M.ALLB.includes(S.type) ? ' : ' + M.NIVEAUX[S.niveau].toLowerCase() + ', gamme ' + (M.GAMMES[String(S.gamme)] || '').toLowerCase() : ''));
    const wr = M.W.filter(i => M.vis(i, S.type) && S.w[i.id].on).map(i => { const d = M.wDef(i, S).v, p = S.w[i.id]; return [i.l, d, p.val == null ? d : p.val]; });
    table(wr.length ? wr : [['Aucun poste coché', 0, 0]], [['Postes cochés', eur(r.tr.base)], ['Aléas de chantier, ' + S.aleas + ' %', eur(r.tr.tot - r.tr.base)], ['Total travaux hors taxes, budget', eur(r.tr.tot)]].concat(r.reel ? [['Coût réel retenu dans le calcul', eur(r.T)]] : []));
    titre('Frais annexes');
    const xr = M.XI.filter(i => M.xVis(i, S.type) && S.x[i.id].on).map(i => { const d = i.d(S, S.duree, r.T, S.vente).v, p = S.x[i.id]; return [i.l, d, p.val == null ? d : p.val]; });
    if (r.agV) xr.push(['Honoraires d\'agence à la revente, ' + String(S.agV).replace('.', ',') + ' %', r.agV, r.agV]);
    table(xr.length ? xr : [['Aucun frais coché', 0, 0]], [['Total frais annexes', eur(r.anx + r.agV)]]);
    if (r.mis) {
      need(34); titre('Prestations confiées à une société partenaire');
      [['Mission 1', M.M1, S.m1], ['Mission 2', M.M2, S.m2]].forEach(m => { const sel = m[1].filter((p, i) => m[2][i]); if (!sel.length) return; const p = sel.reduce((t, q) => t + q[1], 0); ligne(m[0] + (sel.length === 3 ? ' complète' : ', prestation partielle'), sel.map(q => q[0].toLowerCase()).join(', ') + ' · ' + String(Math.round(p * 10) / 10).replace('.', ',') + ' %', eur(S.vente * p / 100)); });
    }
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); T('Simulation indicative, à valider par l\'expert-comptable et le notaire', MG, 291, { size: 7.5, color: MU }); T('Page ' + i + ' sur ' + n, W - MG, 291, { size: 7.5, color: MU, align: 'right' }); }
    return doc;
  }
  /* Document simple aux couleurs de Marchéo : lettre d'offre, dossier pour le notaire, procès-verbal de réserves.
     o = { titre, sous, sections: [{ titre, lignes: [[libellé, valeur]], paragraphes: [], cases: [[coché, libellé]], images: [dataUrl], signature: [gauche, droite] }] } */
  function documentSimple(o) {
    const J = global.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4' });
    const W = 210, MG = 14, CW = W - 2 * MG; let y = 0;
    const FOND = [248, 244, 236], ENCRE = [14, 42, 29], TX = [21, 33, 27], MU = [90, 103, 95], LN = [217, 207, 187], AC = [15, 74, 48], BLANC = [250, 246, 238], CLAIR = [201, 171, 116], LAITON = [168, 134, 79];
    const c = t => String(t == null ? '' : t).replace(/[   ]/g, ' ').replace(/−/g, '-').replace(/[–—]/g, '-').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/²/g, '2').replace(/[‘’]/g, "'").replace(/[≥]/g, '>=').replace(/[≤]/g, '<=').replace(/…/g, '...').replace(/[^\x00-\xff€]/g, '');
    const fill = a => doc.setFillColor(a[0], a[1], a[2]), draw = a => doc.setDrawColor(a[0], a[1], a[2]);
    const T = (t, x, yy, op = {}) => { doc.setFont(op.serif ? 'times' : 'helvetica', op.bold ? 'bold' : 'normal'); doc.setFontSize(op.size || 10); const a = op.color || TX; doc.setTextColor(a[0], a[1], a[2]); doc.text(c(t), x, yy, op.align ? { align: op.align } : undefined); };
    const wrap = (t, w, size, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); return doc.splitTextToSize(c(t), w); };
    const page = () => { fill(FOND); doc.rect(0, 0, W, 297, 'F'); };
    const need = h => { if (y + h > 282) { doc.addPage(); page(); y = 16; } };
    page(); fill(ENCRE); doc.rect(0, 0, W, 34, 'F'); fill(LAITON); doc.rect(0, 34, W, 0.8, 'F');
    T('MARCHÉO', MG, 10, { bold: true, size: 7.5, color: CLAIR }); T('Établi le ' + new Date().toLocaleDateString('fr-FR'), W - MG, 10, { size: 8, color: CLAIR, align: 'right' });
    T(o.titre || '', MG, 21, { serif: true, bold: true, size: 19, color: BLANC });
    if (o.sous) T(wrap(o.sous, CW, 9.5)[0], MG, 29, { size: 9.5, color: CLAIR });
    y = 42;
    (o.sections || []).forEach(s => {
      if (s.titre) { need(14); y += 3; T(s.titre.toUpperCase(), MG, y, { bold: true, size: 8.8, color: AC }); draw(LAITON); doc.setLineWidth(0.3); doc.line(MG, y + 1.6, MG + 18, y + 1.6); y += 5; }
      (s.lignes || []).forEach(([l, v]) => {
        const vl = wrap(v == null || v === '' ? '—' : String(v), CW * 0.6, 9.8, true), h = Math.max(7.2, vl.length * 4.6 + 2.6); need(h);
        T(l, MG + 1, y + 5, { size: 9.4, color: MU }); vl.forEach((x, i) => T(x, W - MG - 1, y + 5 + i * 4.6, { size: 9.8, bold: true, align: 'right' }));
        draw(LN); doc.setLineWidth(0.2); doc.line(MG, y + h, W - MG, y + h); y += h;
      });
      (s.paragraphes || []).forEach(p => { const l = wrap(p, CW, 9.8); need(l.length * 4.8 + 3); y += 2; l.forEach(x => { T(x, MG, y + 4); y += 4.8; }); });
      (s.cases || []).forEach(([ok, l]) => { need(7); draw(ok ? AC : MU); doc.setLineWidth(0.35); doc.rect(MG + 1, y + 1.6, 3.6, 3.6); if (ok) { fill(AC); doc.rect(MG + 1.7, y + 2.3, 2.2, 2.2, 'F'); } T(l + (ok ? '  (reçu)' : '  (à fournir)'), MG + 7, y + 4.8, { size: 9.6, color: ok ? TX : MU }); y += 6.6; });
      if ((s.images || []).length) {
        const L = 58, H = 43; let x = MG; need(H + 4); y += 2;
        s.images.forEach(src => {
          if (x + L > W - MG + 0.1) { x = MG; y += H + 3; need(H + 4); }
          try { const pr = doc.getImageProperties(src), k = Math.min(L / pr.width, H / pr.height), w = pr.width * k, h = pr.height * k; doc.addImage(src, 'JPEG', x + (L - w) / 2, y + (H - h) / 2, w, h, undefined, 'FAST'); } catch (e) {}
          x += L + 4;
        });
        y += H + 3;
      }
      if (s.signature) { need(36); y += 8; const w = (CW - 10) / 2; s.signature.forEach((l, i) => { const x = MG + i * (w + 10); T(l, x, y, { size: 9, color: MU }); T('Date et signature', x, y + 4.5, { size: 7.5, color: MU }); draw(LN); doc.setLineWidth(0.3); doc.rect(x, y + 7, w, 20); }); y += 30; }
      y += 2;
    });
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); T('Marchéo · ' + c(o.titre || '') + ' · page ' + i + ' / ' + n, W / 2, 291, { size: 7.5, color: MU, align: 'center' }); }
    return doc;
  }

  global.MarcheoPDF = { creer, document: documentSimple };
})(typeof window !== 'undefined' ? window : globalThis);
