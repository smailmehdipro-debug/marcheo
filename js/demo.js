/* Marchéo · jeu de données fictif du mode démonstration */
(function (global) {
  'use strict';
  const jour = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  function sim(type, o) { const S = MDB.fresh(type); Object.assign(S, o || {}); return S; }

  function remplir(D) {
    const c = (o) => D.enregistrer('contacts', o);
    const agent = c({ nom: 'Agence du Centre', categorie: 'agent', personne: 'Responsable transactions', tel: '02 00 00 00 01', email: 'contact@agence-exemple.fr' });
    const notaire = c({ nom: 'Office notarial Exemple', categorie: 'notaire', personne: 'Clerc', tel: '02 00 00 00 02', email: 'office@notaire-exemple.fr' });
    const vendeur = c({ nom: 'Vendeur particulier', categorie: 'vendeur', tel: '06 00 00 00 03' });
    const elec = c({ nom: 'Électricité Exemple', categorie: 'artisan', metier: 'Électricien', tel: '06 00 00 00 04' });
    const plaquiste = c({ nom: 'Plâtrerie Exemple', categorie: 'artisan', metier: 'Plaquiste', tel: '06 00 00 00 05' });
    const apporteur = c({ nom: 'Apporteur exemple', categorie: 'apporteur', tel: '06 00 00 00 06' });

    const b = o => D.enregistrer('biens', Object.assign({ comps: [], pieces: {}, liens: [], travaux: { lignes: [], utiliserReel: false }, creeLe: jour(-30) }, o));

    const b1 = b({ etape: 'etude', source: 'Leboncoin', lien: '', prixAffiche: 89000,
      sim: sim('appt', { adresse: 'Rue des Exemples, T2 au 2e étage' }),
      comps: [{ adresse: 'Rue voisine A', surface: 40, prix: 140000, date: '2026-03' }, { adresse: 'Rue voisine B', surface: 45, prix: 162000, date: '2026-05' }],
      pieces: { diagnostics: { ok: true, date: jour(-5) }, pv: { ok: false } },
      liens: [{ contactId: agent.id, role: 'Agent' }, { contactId: vendeur.id, role: 'Vendeur' }],
      prochaine: { action: 'Rappeler l\'agent pour les procès-verbaux', date: jour(0) } });

    const b2 = b({ etape: 'offre', source: 'Réseau direct', prixAffiche: 79000,
      sim: sim('maison', { adresse: 'Maison de ville, quartier gare', abf: 'Non', preempt: 'Non', achat: 68000 }),
      comps: [{ adresse: 'Maison A', surface: 72, prix: 175000, date: '2026-01' }, { adresse: 'Maison B', surface: 65, prix: 158000, date: '2026-04' }, { adresse: 'Maison C', surface: 80, prix: 186000, date: '2026-06' }],
      liens: [{ contactId: agent.id, role: 'Agent' }, { contactId: apporteur.id, role: 'Apporteur' }],
      prochaine: { action: 'Relancer la réponse à l\'offre', date: jour(-2) } });

    const S3 = sim('appt', { adresse: 'Résidence Exemple, T3', surf: 58, pieces: 3, achat: 98000, vente: 189000, abf: 'Non', preempt: 'Non', duree: 10 });
    const b3 = b({ etape: 'chantier', source: 'Agence', prixAffiche: 105000, sim: S3,
      comps: [{ adresse: 'Résidence A', surface: 60, prix: 192000 }, { adresse: 'Résidence B', surface: 55, prix: 178000 }, { adresse: 'Résidence C', surface: 62, prix: 199000 }],
      pieces: { diagnostics: { ok: true }, pv: { ok: true }, reglement: { ok: true }, tf: { ok: true }, titre: { ok: true }, urbanisme: { ok: true } },
      liens: [{ contactId: notaire.id, role: 'Notaire' }, { contactId: elec.id, role: 'Électricien' }, { contactId: plaquiste.id, role: 'Plaquiste' }],
      prochaine: { action: 'Réception du lot électricité', date: jour(3) } });
    const lignes = MDB.lignesChantier(S3).map(l => Object.assign(l, { artisanId: '', devis: 0, devisDate: '', facture: 0, paye: 0, avancement: 0, debut: '', fin: '', commentaire: '' }));
    lignes.forEach(l => {
      if (l.poste === 'elec') Object.assign(l, { artisanId: elec.id, devis: Math.round(l.budget * 1.22), devisDate: jour(-40), facture: Math.round(l.budget * .6), paye: Math.round(l.budget * .6), avancement: 70, debut: jour(-20) });
      if (l.poste === 'cloisons') Object.assign(l, { artisanId: plaquiste.id, devis: Math.round(l.budget * 1.3), devisDate: jour(-35), facture: Math.round(l.budget * .5), paye: 0, avancement: 50, debut: jour(-15) });
      if (l.poste === 'demo') Object.assign(l, { devis: l.budget, devisDate: jour(-45), facture: l.budget, paye: l.budget, avancement: 100, debut: jour(-30), fin: jour(-24) });
    });
    b3.travaux = { lignes, utiliserReel: true }; D.enregistrer('biens', b3);

    b({ etape: 'repere', source: 'Leboncoin', lien: '', prixAffiche: 62000, sim: sim('box', { adresse: 'Lot de 8 boxes, centre-ville' }), prochaine: { action: 'Demander le règlement de copropriété', date: jour(1) } });
    b({ etape: 'ecarte', motif: 'Prix vendeur trop élevé', source: 'Agence', prixAffiche: 145000, sim: sim('local', { adresse: 'Local commercial, rue principale', achat: 120000 }) });

    const r = o => D.enregistrer('relances', Object.assign({ fait: false }, o));
    r({ date: jour(0), objet: 'Procès-verbaux des trois dernières assemblées', bienId: b1.id, contactId: agent.id });
    r({ date: jour(-2), objet: 'Réponse à l\'offre', bienId: b2.id, contactId: agent.id });
    r({ date: jour(4), objet: 'Appel de fonds notaire', bienId: b3.id, contactId: notaire.id });

    const j = o => D.enregistrer('journal', o);
    j({ bienId: b1.id, date: jour(-12), type: 'visite', texte: 'Première visite. Humidité légère sous la fenêtre de la chambre.' });
    j({ bienId: b2.id, date: jour(-9), type: 'visite', texte: 'Visite avec l\'apporteur. Toiture à faire vérifier.' });
    j({ bienId: b2.id, date: jour(-4), type: 'offre', montant: 66000, texte: 'Offre écrite envoyée à l\'agence.' });
    j({ bienId: b3.id, date: jour(-60), type: 'offre', montant: 96000, texte: 'Offre initiale.' });
    j({ bienId: b3.id, date: jour(-58), type: 'contre', montant: 98000, texte: 'Contre-proposition acceptée.' });

    const an = (o, n) => D.enregistrer('annonces', Object.assign({ statutTri: 'nouvelle', alertes: 1, lien: '', recueLe: new Date(Date.now() - n * 86400000).toISOString() }, o));
    an({ source: 'SeLoger', titre: 'Appartement 2 pièces à rénover, succession', texte: 'Succession. 2 pièces 42 m² à rénover, 95100 Argenteuil', prix: 79000, surface: 42, cp: '95100', ville: 'Argenteuil' }, 0);
    an({ source: "Bien'ici", titre: 'Studio à rénover', texte: 'Studio 28 m², DPE G, 93600 Aulnay-sous-Bois', prix: 62000, prixPrecedent: 69000, surface: 28, cp: '93600', ville: 'Aulnay-sous-Bois', dpe: 'G' }, 1);
    an({ source: 'Leboncoin', titre: 'Appartement 3 pièces', texte: '3 pièces 58 m² bon état, 92230 Gennevilliers', prix: 149000, surface: 58, cp: '92230', ville: 'Gennevilliers' }, 1);
    an({ source: 'SeLoger', titre: 'Maison 3 pièces à rénover', texte: 'Maison 65 m² à rénover, jardin, 93390 Clichy-sous-Bois', prix: 128000, surface: 65, cp: '93390', ville: 'Clichy-sous-Bois' }, 2);
    an({ source: 'Leboncoin', titre: 'Appartement 2 pièces refait à neuf', texte: '2 pièces 45 m² refait à neuf, 78500 Sartrouville', prix: 128000, surface: 45, cp: '78500', ville: 'Sartrouville' }, 0);
    an({ source: "Bien'ici", titre: 'Appartement 2 pièces', texte: '93140 Bondy', prix: 95000, cp: '93140', ville: 'Bondy' }, 2);
    an({ source: "Bien'ici", titre: 'Bâtiment/immeuble', texte: 'Bâtiment/immeuble · 93500 Pantin · 742 000 €', prix: 742000, cp: '93500', ville: 'Pantin' }, 3);
    an({ source: 'SeLoger', titre: 'Studio à rafraîchir', texte: 'Studio 22 m² à rafraîchir, 92100 Boulogne-Billancourt', prix: 125000, surface: 22, cp: '92100', ville: 'Boulogne-Billancourt' }, 3);
    an({ source: 'Leboncoin', titre: 'Appartement en viager occupé', texte: 'Viager occupé, 50 m², 93270 Sevran', prix: 45000, surface: 50, cp: '93270', ville: 'Sevran' }, 4);
    D.enregistrer('reglages', { id: 'reglages', criteres: { negoMax: 15, exclus: MarcheoAnnonces.CRITERES_DEF.exclus, signaux: MarcheoAnnonces.CRITERES_DEF.signaux,
      prixAfficheMax: 130000, tresoMax: 140000, margeBruteMin: 10, zone: MarcheoAnnonces.CRITERES_DEF.zone, types: ['appt', 'maison', 'local', 'box'],
      secteurs: [{ cp: '95100', commune: 'Argenteuil', pm2: 3600 }, { cp: '93600', commune: 'Aulnay-sous-Bois', pm2: 3300 }, { cp: '92230', commune: 'Gennevilliers', pm2: 4800 }, { cp: '93390', commune: 'Clichy-sous-Bois', pm2: 2600 }, { cp: '78500', commune: 'Sartrouville', pm2: 4300 }, { cp: '93140', commune: 'Bondy', pm2: 3400 }, { cp: '93270', commune: 'Sevran', pm2: 2900 }] },
      enveloppe: 250000, taux: 4, obj: 10, part: 50, pfu: 31.4, dmax: 18, tvaT: 10, seuilTravaux: 15, ref: { w: {}, x: {} } });
  }
  global.MarcheoDemo = { remplir };
})(typeof window !== 'undefined' ? window : globalThis);
