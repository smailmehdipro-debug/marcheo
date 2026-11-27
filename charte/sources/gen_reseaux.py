"""Réseaux sociaux Marchéo : écrit les pages HTML des visuels (charte/sources/supports-html/reseaux)
et la liste des rendus (manifeste.json), puis rendu_reseaux.js les photographie en PNG dans charte/reseaux.

Usage : python gen_reseaux.py <dossier charte>   puis   node rendu_reseaux.js <dossier charte>
Les logos SVG de charte/logos sont insérés tels quels (seul le fond ivoire des versions « clair » est retiré
pour qu'ils se posent sur n'importe quel ivoire). Les extraits d'écran viennent de charte/captures (mode démonstration).
Aucun chiffre inventé : les seuls nombres visibles sont ceux des captures, signalées « mode démonstration »
(la référence DVF de la fiche d'annonce est réelle : code postal 95100, ventes 2024-2025, js/secteurs-dvf.js).
"""
import os, re, sys, json

CHARTE = sys.argv[1]
OUT = os.path.join(CHARTE, 'sources', 'supports-html', 'reseaux')
os.makedirs(OUT, exist_ok=True)
CAP = '../../../captures/'

NUIT, IVOIRE, IVOIRE2 = '#0e2a1d', '#f1ece1', '#faf6ee'
OR, OR_FONCE = '#c9ab74', '#7a5c2c'
VCLAIR, VFILET = '#e2ebe3', '#2f6b4c'
METAL = ('linear-gradient(100deg, transparent 28%, rgba(190,235,205,.10) 42%, rgba(255,255,255,.15) 46%, rgba(190,235,205,.08) 50%, transparent 64%),'
         'linear-gradient(118deg, #07190f 0%, #0d2f1f 20%, #17503a 36%, #2f7553 43%, #164a31 50%, #0c2c1c 66%, #103826 84%, #081c12 100%)')
DEMO = 'https://smailmehdipro-debug.github.io/marcheo/'
DEMO_COURT = 'smailmehdipro-debug.github.io/marcheo'


def logo(nom, hauteur):
    s = open(os.path.join(CHARTE, 'logos', nom), encoding='utf-8').read().strip()
    s = re.sub(r'<rect [^>]*/>', '', s, count=1)
    s = re.sub(r' width="[\d.]+" height="[\d.]+"', f' style="height:{hauteur}px;width:auto;display:block"', s, count=1)
    return s


# ---------- thèmes : fond × accent ----------
THEMES = {
    # fond vert métallisé, accent or
    'metal-or': dict(fond=METAL, texte=IVOIRE, doux='#cfd8cc', acc=OR, filet='rgba(201,171,116,.42)',
                     pan='rgba(5,20,12,.30)', pan_bord='rgba(201,171,116,.40)', pan_txt=IVOIRE, pan_acc=OR, sombre=True),
    # fond vert métallisé, accent vert clair
    'metal-vert': dict(fond=METAL, texte=IVOIRE, doux='#cfd8cc', acc='#b9d8c2', filet='rgba(226,235,227,.40)',
                       pan=VCLAIR, pan_bord=VFILET, pan_txt=NUIT, pan_acc=VFILET, sombre=True),
    # fond ivoire, accent or
    'ivoire-or': dict(fond=IVOIRE2, texte=NUIT, doux='#4d5a52', acc=OR_FONCE, filet='rgba(122,92,44,.45)',
                      pan='#f1ece1', pan_bord=OR, pan_txt=NUIT, pan_acc=OR_FONCE, sombre=False),
    # fond ivoire, accent vert clair
    'ivoire-vert': dict(fond=IVOIRE2, texte=NUIT, doux='#4d5a52', acc=VFILET, filet='rgba(47,107,76,.45)',
                        pan=VCLAIR, pan_bord=VFILET, pan_txt=NUIT, pan_acc=VFILET, sombre=False),
}

TETE = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Inter:wght@400;500;600&display=swap">'
        '<style>*{box-sizing:border-box}html,body{margin:0}body{font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}'
        '.serif,.titre{font-family:"Cormorant Garamond",Georgia,serif;font-variant-numeric:lining-nums}'
        '.caps{text-transform:uppercase;letter-spacing:.22em;font-weight:600}'
        '.page [style*="flex-direction:column"]>*{flex-shrink:0}.page{position:relative;overflow:hidden;display:flex;flex-direction:column;background:var(--fond);color:var(--texte)}'
        '.cadre{position:absolute;border:1.5px solid var(--filet);border-radius:10px;pointer-events:none}'
        '.titre{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;line-height:1;margin:0;letter-spacing:-.005em}'
        '.titre i{font-style:italic;font-weight:500;color:var(--acc)}'
        '.phrase{margin:0;color:var(--doux);line-height:1.45}'
        '.kicker{color:var(--acc);display:flex;align-items:center;gap:18px}'
        '.kicker:before{content:"";width:46px;height:2px;background:var(--acc)}'
        '.ecran{border-radius:14px;background-repeat:no-repeat;box-shadow:0 26px 60px rgba(0,0,0,.30),0 0 0 1px rgba(0,0,0,.10)}'
        '.ivoire .ecran{box-shadow:0 22px 50px rgba(14,42,29,.16),0 0 0 1px #d9cfbb}'
        '.note{font-size:17px;letter-spacing:.04em;color:var(--doux);opacity:.85}'
        '.pan{background:var(--pan);border:1px solid var(--pan_bord);border-left:5px solid var(--pan_bord);color:var(--pan_txt);border-radius:10px}'
        '.tel{background:#0b0f0d;border-radius:54px;padding:13px;box-shadow:0 34px 80px rgba(0,0,0,.45),0 0 0 2px #2a3a31}'
        '.tel div{border-radius:42px;background-repeat:no-repeat;background-color:#f1ece1}'
        '</style></head><body>')

MANIFESTE = []


def page(nom, w, h, theme, corps):
    t = THEMES[theme]
    vars_ = ';'.join(f'--{k}:{v}' for k, v in t.items() if k != 'sombre')
    cls = 'page ' + ('metal' if t['sombre'] else 'ivoire')
    html = (TETE + f'<div class="{cls}" style="width:{w}px;height:{h}px;{vars_}">' + corps + '</div></body></html>')
    open(os.path.join(OUT, nom + '.html'), 'w', encoding='utf-8').write(html)
    MANIFESTE.append({'html': nom + '.html', 'png': nom + '.png', 'w': w, 'h': h})


def signature(theme, h):
    return logo('marcheo-signature-transparent.svg' if THEMES[theme]['sombre'] else 'marcheo-signature-clair.svg', h)


def monogramme(theme, h):
    return logo('marcheo-monogramme-transparent.svg' if THEMES[theme]['sombre'] else 'marcheo-monogramme-clair.svg', h)


# ---------- extraits d'écran ----------
BUREAU = ('bureau-tableau.png', 2880, 1800)
MOBILE = ('mobile-visite.png', 780, 1688)
# zones en pixels de la capture d'origine
Z_ANNONCES = (BUREAU, 640, 596, 1736, 1168)      # panneau « Annonces à examiner »
Z_KPI_PROSP = (BUREAU, 640, 446, 1736, 580)      # indicateurs : annonces à examiner, relances du jour
Z_AFAIRE = (BUREAU, 1744, 596, 2840, 966)        # panneau « À faire »
Z_KPI_CHANTIER = (BUREAU, 1742, 1259, 2840, 1394)  # chantiers en dépassement, marge nette moyenne
Z_TOUT = (BUREAU, 0, 0, 2880, 1800)
# fiche d'une annonce : revente estimée à partir de la référence DVF du code postal (95100, ventes 2024-2025)
DVF = ('bureau-annonce-dvf.png', 2880, 1800)
Z_DVF = (DVF, 900, 585, 1980, 1172)              # prix affiché → marge brute
Z_DVF_COURT = (DVF, 900, 690, 1980, 1172)        # revente estimée → marge brute
# onglet Simulation du même bien, une fois retenu
SIM = ('bureau-simulation.png', 2880, 2200)
Z_SIM = (SIM, 1740, 930, 2840, 1850)             # indicateurs + « Où va le prix de revente »
Z_SIM_REPART = (SIM, 1740, 1270, 2840, 1850)     # « Où va le prix de revente »


def ecran(zone, largeur, style=''):
    (img, W, H), x0, y0, x1, y1 = zone
    s = largeur / (x1 - x0); h = round((y1 - y0) * s)
    return (f'<div class="ecran" style="width:{largeur}px;height:{h}px;background-image:url({CAP}{img});'
            f'background-size:{W*s:.1f}px {H*s:.1f}px;background-position:{-x0*s:.1f}px {-y0*s:.1f}px;{style}"></div>')


def telephone(largeur, style='', r=42):
    img, W, H = MOBILE
    l_int = largeur - 26; h_int = round(H * l_int / W)
    return (f'<div class="tel" style="width:{largeur}px;{style}"><div style="width:{l_int}px;height:{h_int}px;border-radius:{r}px;'
            f'background-image:url({CAP}{img});background-size:{l_int}px {h_int}px"></div></div>')


def note_demo(extra=''):
    return f'<div class="note" style="{extra}">Écran du mode démonstration · données fictives</div>'


def etapes_tri(taille=24):
    items = ['Prix affiché', 'Budget maximum', 'Marge brute']
    out = ''
    for i, t in enumerate(items, 1):
        out += (f'<div class="pan" style="flex:1;padding:16px 20px;display:flex;align-items:center;gap:14px;font-size:{taille}px;font-weight:500">'
                f'<span class="serif" style="font-size:{taille*1.6:.0f}px;font-weight:600;color:var(--pan_acc);line-height:1">{i}</span>{t}</div>')
    return f'<div style="display:flex;gap:14px">{out}</div>'


def liste(items, taille=27, gap=14):
    return ('<div style="display:grid;gap:%dpx">' % gap + ''.join(
        f'<div style="display:flex;gap:18px;align-items:baseline;font-size:{taille}px;line-height:1.3">'
        f'<span style="color:var(--acc);flex:none">—</span><span>{t}</span></div>' for t in items) + '</div>')


# =====================================================================
# 1. Six publications carrées 1080 × 1080
# =====================================================================
def carre(n, theme, kicker, titre, phrase, visuel, titre_px=92):
    return page(f'carre-{n}', 1080, 1080, theme,
                '<div class="cadre" style="inset:34px"></div>'
                '<div style="position:absolute;inset:34px;padding:58px 62px 46px;display:flex;flex-direction:column">'
                f'<div class="kicker caps" style="font-size:18px">{kicker}</div>'
                f'<h1 class="titre" style="font-size:{titre_px}px;margin-top:26px">{titre}</h1>'
                f'<p class="phrase" style="font-size:28px;margin-top:22px;max-width:850px">{phrase}</p>'
                f'<div class="zone" style="flex:1;min-height:0;margin-top:34px;display:flex;flex-direction:column;justify-content:center">{visuel}</div>'
                '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:28px">'
                f'{signature(theme, 66)}<div class="caps" style="font-size:16px;color:var(--acc);padding-bottom:8px">{n:02d} / 06</div></div>'
                '</div>')


carre(1, 'metal-or', 'Annonces', 'Les annonces,<br><i>triées à la marge.</i>',
      'Vos alertes SeLoger, Bien\'ici, Leboncoin, PAP… lues chaque heure, puis passées en trois étapes.',
      etapes_tri() + '<div style="height:24px"></div>' + ecran(Z_ANNONCES, 616, 'align-self:center') + note_demo('margin-top:12px;text-align:center'), titre_px=86)

def carre_visite():
    theme = 'ivoire-vert'
    return page('carre-2', 1080, 1080, theme,
                '<div class="cadre" style="inset:34px"></div>'
                '<div style="position:absolute;inset:34px;padding:58px 62px 46px;display:flex;gap:40px">'
                '<div style="flex:1;display:flex;flex-direction:column">'
                '<div class="kicker caps" style="font-size:18px">Visite</div>'
                '<h1 class="titre" style="font-size:88px;margin-top:26px">La visite,<br><i>point par point.</i></h1>'
                '<p class="phrase" style="font-size:27px;margin-top:22px">Sur téléphone, l\'audit de la visite de prospection, même sans réseau.</p>'
                '<div style="margin-top:34px">' + liste(['Guide point par point', 'Sommaire', 'Chronomètre', 'Photos', 'Hors connexion'], 27, 14) + '</div>'
                f'<div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end">{signature(theme, 66)}<div class="caps" style="font-size:16px;color:var(--acc);padding-bottom:8px">02 / 06</div></div></div>'
                '<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:14px">'
                + telephone(352) + '<div class="note" style="font-size:15px">Mode démonstration</div></div>'
                '</div>'
                '')


carre_visite()

carre(3, 'metal-vert', 'Prix DVF', 'Le vrai prix <i>du secteur.</i>',
      'La référence DVF par code postal, tirée des ventes réelles 2024-2025, et les ventes comparables du bien.',
      ecran(Z_DVF_COURT, 892) + '<div class="note" style="margin-top:12px">Mode démonstration : annonce fictive, référence DVF réelle du 95100 (ventes 2024-2025)</div>')

carre(4, 'ivoire-or', 'Simulation', 'Chiffrer <i>avant d\'offrir.</i>',
      'Simulation complète, travaux chiffrés, comparateur de 2 à 4 biens et dossier PDF prêt à transmettre.',
      ecran(Z_SIM_REPART, 760, 'align-self:center') + note_demo('margin-top:12px;text-align:center'))

carre(5, 'metal-or', 'Chantier et bilan', 'Le chantier <i>sous contrôle.</i>',
      'Chaque dépense suivie, une alerte dès qu\'un poste dépasse, et le bilan de l\'opération à la revente.',
      liste(['Suivi des dépenses par poste', 'Alertes de dépassement', 'Bilan de l\'opération'], 27, 12)
      + '<div style="height:30px"></div>' + ecran(Z_KPI_CHANTIER, 892) + note_demo('margin-top:12px'))

carre(6, 'ivoire-vert', 'Tableau de bord', 'Rien ne vous <i>échappe.</i>',
      'Annonces à examiner, relances du jour, offres en cours : chaque matin, ce qui demande votre attention.',
      ecran(Z_KPI_PROSP, 892) + '<div style="height:18px"></div>' + ecran(Z_AFAIRE, 892) + note_demo('margin-top:12px'))

# =====================================================================
# 2. Carrousel LinkedIn 1080 × 1350 : le parcours d'un bien
# =====================================================================
ETAPES = ['Repérage', 'Visite', 'Prix', 'Décision', 'Chantier', 'Revente']


def frise(actif):
    out = ''
    for i, e in enumerate(ETAPES, 1):
        on = i == actif; fait = i < actif
        coul = 'var(--acc)' if (on or fait) else 'var(--filet)'
        out += (f'<div style="flex:1;display:grid;gap:10px">'
                f'<div style="height:{4 if on else 2}px;background:{coul};border-radius:2px"></div>'
                f'<div class="caps" style="font-size:13px;letter-spacing:.16em;color:{"var(--acc)" if on else "var(--doux)"};opacity:{1 if on else .7}">{e}</div></div>')
    return f'<div style="display:flex;gap:10px">{out}</div>'


def diapo(n, theme, kicker, titre, phrase, visuel, titre_px=100, avec_frise=True):
    haut = frise(n - 1) if avec_frise else ''
    return page(f'carrousel-{n}', 1080, 1350, theme,
                '<div class="cadre" style="inset:34px"></div>'
                '<div style="position:absolute;inset:34px;padding:56px 62px 46px;display:flex;flex-direction:column">'
                + haut +
                f'<div class="kicker caps" style="font-size:18px;margin-top:{50 if avec_frise else 0}px">{kicker}</div>'
                f'<h1 class="titre" style="font-size:{titre_px}px;margin-top:26px">{titre}</h1>'
                f'<p class="phrase" style="font-size:30px;margin-top:24px;max-width:880px">{phrase}</p>'
                f'<div class="zone" style="flex:1;min-height:0;margin-top:38px;display:flex;flex-direction:column;justify-content:center">{visuel}</div>'
                '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:28px">'
                f'{signature(theme, 62)}<div class="caps" style="font-size:16px;color:var(--acc);padding-bottom:8px">{n:02d} / 08 {"→" if n < 8 else ""}</div></div>'
                '</div>')


def parcours(taille=30, theme_pan=False):
    out = ''
    for i, e in enumerate(ETAPES, 1):
        out += (f'<div style="display:flex;align-items:baseline;gap:26px;padding:14px 0;border-bottom:1px solid var(--filet)">'
                f'<span class="serif" style="font-size:{taille*1.25:.0f}px;font-weight:600;color:var(--acc);width:52px">{i:02d}</span>'
                f'<span style="font-size:{taille}px;font-weight:500">{e}</span></div>')
    return f'<div style="border-top:1px solid var(--filet)">{out}</div>'


diapo(1, 'metal-or', 'Le parcours d\'un bien', 'Du repérage<br><i>à la revente.</i>',
      'Six étapes, un seul outil. Voici comment Marchéo suit un bien de bout en bout.',
      parcours(30) + '<div class="caps" style="font-size:18px;color:var(--acc);margin-top:34px">Faites défiler →</div>',
      titre_px=112, avec_frise=False)

diapo(2, 'ivoire-vert', '01 · Repérage', 'L\'annonce arrive<br><i>déjà triée.</i>',
      'Marchéo lit vos alertes e-mail chaque heure et les passe au crible : prix affiché, budget maximum, marge brute.',
      ecran(Z_ANNONCES, 892) + note_demo('margin-top:12px'))

diapo(3, 'metal-vert', '02 · Visite', 'Sur place,<br><i>rien n\'est oublié.</i>',
      'L\'application mobile guide l\'audit point par point : sommaire, chronomètre, photos. Même hors connexion.',
      '<div style="display:flex;justify-content:center">' + telephone(270) + '</div>')

diapo(4, 'ivoire-or', '03 · Prix', 'Le prix réel,<br><i>pas l\'affiché.</i>',
      'La référence DVF du code postal et les ventes comparables situent le bien face aux ventes réelles 2024-2025.',
      ecran(Z_DVF, 892) + '<div class="note" style="margin-top:12px">Mode démonstration : annonce fictive, référence DVF réelle du 95100 (ventes 2024-2025)</div>')

diapo(5, 'metal-or', '04 · Décision', 'L\'offre,<br><i>chiffres en main.</i>',
      'Simulation complète, travaux chiffrés, comparateur de 2 à 4 biens, dossier PDF pour la banque ou l\'associé.',
      ecran(Z_SIM, 640, 'align-self:center') + note_demo('margin-top:12px;text-align:center'))

diapo(6, 'ivoire-vert', '05 · Chantier', 'Le chantier,<br><i>sans dérive.</i>',
      'Chaque dépense est saisie. Un poste dépasse son budget : l\'alerte remonte au tableau de bord.',
      liste(['Dépenses suivies poste par poste', 'Alertes de dépassement', 'Retards et relances au même endroit'], 29, 14)
      + '<div style="height:36px"></div>' + ecran(Z_KPI_CHANTIER, 892) + note_demo('margin-top:12px'))

diapo(7, 'metal-vert', '06 · Revente', 'La revente,<br><i>et le bilan.</i>',
      'Le bilan de l\'opération se fait au fil de l\'eau. Vos données restent dans le Google Sheets de votre propre compte.',
      ecran(Z_TOUT, 892) + note_demo('margin-top:12px'))

# diapo d'appel
theme = 'ivoire-or'
page('carrousel-8', 1080, 1350, theme,
     '<div class="cadre" style="inset:34px"></div>'
     '<div style="position:absolute;inset:34px;padding:70px 62px 46px;display:flex;flex-direction:column;align-items:center;text-align:center">'
     f'{logo("marcheo-vertical-clair.svg", 210)}'
     '<div class="kicker caps" style="font-size:18px;margin-top:64px">Essai gratuit</div>'
     '<h1 class="titre" style="font-size:112px;margin-top:24px">Essayez Marchéo <i>pendant 7 jours.</i></h1>'
     '<p class="phrase" style="font-size:30px;margin-top:26px;max-width:800px">Parcourez la démo en ligne, puis demandez votre accès d\'essai.</p>'
     '<div style="display:grid;gap:22px;width:100%;margin-top:64px;text-align:left">'
     '<div class="pan" style="padding:24px 30px"><div class="caps" style="font-size:15px;color:var(--pan_acc)">Démo en ligne</div>'
     f'<div style="font-size:34px;font-weight:600;margin-top:10px">{DEMO_COURT}</div></div>'
     '<div class="pan" style="padding:24px 30px"><div class="caps" style="font-size:15px;color:var(--pan_acc)">Demander l\'essai</div>'
     '<div style="font-size:34px;font-weight:600;margin-top:10px">[adresse e-mail]</div></div></div>'
     '<div style="margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end">'
     '<div class="caps" style="font-size:16px;color:var(--acc)">Le CRM du marchand de biens</div>'
     '<div class="caps" style="font-size:16px;color:var(--acc)">08 / 08</div></div>'
     '</div>')

# =====================================================================
# 3. Visuel de lancement 1200 × 628
# =====================================================================
theme = 'metal-or'
page('lancement-1200x628', 1200, 628, theme,
     '<div class="cadre" style="inset:22px"></div>'
     '<div style="position:absolute;left:66px;top:66px;width:530px">'
     f'{signature(theme, 74)}'
     '<h1 class="titre" style="font-size:62px;margin-top:40px">Du repérage à la revente,<br><i>un seul outil.</i></h1>'
     '<p class="phrase" style="font-size:20px;margin-top:20px;max-width:480px">Annonces triées à la marge, visite sur téléphone, prix DVF, simulation, chantier et bilan.</p>'
     '<div class="caps" style="font-size:14px;color:var(--acc);margin-top:28px;display:inline-block;border:1.5px solid var(--acc);border-radius:6px;padding:12px 18px">Essai gratuit 7 jours · démo en ligne</div>'
     '</div>'
     '<div style="position:absolute;left:660px;top:96px;width:500px;padding:10px;border-radius:16px;background:#0b0f0d;box-shadow:0 30px 70px rgba(0,0,0,.55),0 0 0 2px #2a3a31">'
     + ecran(Z_TOUT, 480, 'border-radius:7px;box-shadow:none') + '</div>'
     + telephone(168, 'position:absolute;left:616px;top:232px;border-radius:32px;padding:9px;', 24)
     )

# =====================================================================
# 4. Deux stories 1080 × 1920 (zones sûres : 250 px en haut, 340 px en bas)
# =====================================================================
theme = 'metal-or'
page('story-1-visite', 1080, 1920, theme,
     '<div class="cadre" style="inset:40px"></div>'
     '<div style="position:absolute;left:0;right:0;top:250px;bottom:300px;padding:0 96px;display:flex;flex-direction:column;align-items:center;text-align:center">'
     f'{monogramme(theme, 110)}'
     '<div class="kicker caps" style="font-size:20px;margin-top:40px">Application de visite</div>'
     '<h1 class="titre" style="font-size:112px;margin-top:24px">La visite,<br><i>dans votre poche.</i></h1>'
     '<p class="phrase" style="font-size:32px;margin-top:26px">Guide point par point, chronomètre, photos. Même sans réseau.</p>'
     '<div style="margin-top:56px">' + telephone(360) + '</div>'
     '</div>'
     '<div style="position:absolute;left:0;right:0;bottom:180px;text-align:center">'
     '<div class="caps" style="font-size:18px;color:var(--acc)">Le CRM du marchand de biens · essai gratuit 7 jours</div></div>')

theme = 'ivoire-vert'
page('story-2-parcours', 1080, 1920, theme,
     '<div class="cadre" style="inset:40px"></div>'
     '<div style="position:absolute;left:0;right:0;top:250px;bottom:300px;padding:0 100px;display:flex;flex-direction:column">'
     f'<div style="align-self:flex-start">{signature(theme, 92)}</div>'
     '<div class="kicker caps" style="font-size:20px;margin-top:70px">Le parcours d\'un bien</div>'
     '<h1 class="titre" style="font-size:124px;margin-top:26px">Du repérage<br><i>à la revente.</i></h1>'
     '<div style="margin-top:56px">' + parcours(38) + '</div>'
     '<div class="pan" style="margin-top:auto;padding:30px 34px">'
     '<div class="serif" style="font-size:52px;font-weight:600;line-height:1.05">Essai gratuit, <i style="font-weight:500;color:var(--pan_acc)">7 jours.</i></div>'
     f'<div style="font-size:26px;margin-top:14px">Démo : <b style="font-weight:600">{DEMO_COURT}</b></div></div>'
     '</div>')

json.dump(MANIFESTE, open(os.path.join(OUT, 'manifeste.json'), 'w'), indent=1)
print(len(MANIFESTE), 'pages')
