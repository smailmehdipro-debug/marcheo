"""Prix au m² par code postal à partir des fichiers DVF (geo-dvf), 2024-2025.
Usage : python3 -I dvf_secteurs.py <dossier_dvf> <zone.json> <sortie.json>"""
import csv, gzip, json, os, statistics, sys
from collections import defaultdict

dossier, zone_f, sortie = sys.argv[1:4]
zone = json.load(open(zone_f))
depts_entiers = [z for z in zone if len(z) == 2]
cps_liste = {z.split()[0] for z in zone if len(z.split()[0]) == 5}

def dans_zone(cp):
    return cp[:2] in depts_entiers or cp in cps_liste

mutations = defaultdict(list)
date_max = ''
for f in sorted(os.listdir(dossier)):
    if not f.endswith('.csv.gz'):
        continue
    with gzip.open(os.path.join(dossier, f), 'rt', encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            if r['nature_mutation'] != 'Vente':
                continue
            mutations[r['id_mutation']].append(r)
            date_max = max(date_max, r['date_mutation'])

ventes = defaultdict(lambda: {'Appartement': [], 'Maison': []})
communes = defaultdict(set)
for mid, rows in mutations.items():
    logements = [r for r in rows if r['type_local'] in ('Appartement', 'Maison')]
    autres = [r for r in rows if r['type_local'] in ('Local industriel. commercial ou assimilé',)]
    # une seule habitation, pas de local d'activité, une seule valeur foncière
    if len({(r['id_parcelle'], r['lot1_numero'], r['type_local'], r['surface_reelle_bati']) for r in logements}) != 1 or autres:
        continue
    r = logements[0]
    cp = r['code_postal']
    if not cp or not dans_zone(cp):
        continue
    try:
        prix = float(r['valeur_fonciere']); surf = float(r['surface_reelle_bati'] or 0)
    except ValueError:
        continue
    if surf < 9 or surf > 250 or prix < 15000:
        continue
    pm2 = prix / surf
    if pm2 < 800 or pm2 > 30000:
        continue
    ventes[cp][r['type_local']].append((surf, pm2))
    communes[cp].add(r['nom_commune'])

def stats(valeurs):
    v = sorted(valeurs)
    if not v:
        return None
    q = statistics.quantiles(v, n=4) if len(v) >= 4 else [v[0], statistics.median(v), v[-1]]
    return {'n': len(v), 'p25': round(q[0]), 'mediane': round(q[1]), 'p75': round(q[2])}

out = []
for cp in sorted(ventes):
    a = ventes[cp]['Appartement']; m = ventes[cp]['Maison']
    petits = [p for s, p in a if 20 <= s <= 60]
    sa, sp, sm = stats([p for s, p in a]), stats(petits), stats([p for s, p in m])
    base = sp if sp and sp['n'] >= 15 else sa
    out.append({
        'cp': cp, 'commune': ' / '.join(sorted(communes[cp])),
        'pm2': base['p75'] if base and base['n'] >= 8 else None,
        'pm2Maison': sm['p75'] if sm and sm['n'] >= 8 else None,
        'base': 'appartements 20-60 m²' if base is sp else 'tous appartements',
        'appartements_20_60': sp, 'appartements': sa, 'maisons': sm
    })
json.dump({'source': 'DVF géolocalisées (data.gouv.fr), ventes 2024-01-01 au ' + date_max,
           'methode': '3e quartile du prix au m² (surface bâtie réelle), mutations à une seule habitation',
           'secteurs': out}, open(sortie, 'w'), ensure_ascii=False, indent=1)
print(date_max, len(out), 'codes postaux')
