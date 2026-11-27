"""Charte Marchéo : régénère les logos (charte/logos) et les pages HTML des supports (charte/sources/supports-html).

Usage : python gen_charte.py <dossier charte>
Le monogramme reprend l'icône d'appli : maison à pignon, M Bodoni Black.
Le mot « Marchéo » et la mention « MARCHAND DE BIENS » sont repris tels quels des anciens logos (tracés Cormorant Garamond).
"""
import os, re, sys, math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

CHARTE = sys.argv[1]
LOGOS = os.path.join(CHARTE, 'logos')
HTML = os.path.join(CHARTE, 'sources', 'supports-html')
os.makedirs(HTML, exist_ok=True)

NUIT, LAITON, LAITON_FONCE, IVOIRE = '#0e2a1d', '#c9ab74', '#a8864f', '#f6f0e2'

# ---------- Monogramme dans un repère 512 (comme l'icône) ----------
font = TTFont('C:/Windows/Fonts/BOD_BLAR.TTF')
gs = font.getGlyphSet(); gname = font.getBestCmap()[ord('M')]
bp = BoundsPen(gs); gs[gname].draw(bp); gx0, gy0, gx1, gy1 = bp.bounds

def m_path(cx, base, h, k=1.0, ox=0, oy=0):
    s = h / (gy1 - gy0); w = (gx1 - gx0) * s
    tx = cx - w / 2 - gx0 * s; ty = base + gy0 * s
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}")
    gs[gname].draw(TransformPen(pen, (s * k, 0, 0, -s * k, tx * k + ox, ty * k + oy)))
    return pen.getCommands()

def maison(k=1.0, ox=0, oy=0, r=10):
    pts = [(256, 92), (422, 236), (422, 424), (90, 424), (90, 236)]
    n = len(pts); d = []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        def toward(a, b):
            dx, dy = a[0] - b[0], a[1] - b[1]; L = math.hypot(dx, dy)
            return (b[0] + dx / L * r, b[1] + dy / L * r)
        a, b = toward(p0, p1), toward(p2, p1)
        f = lambda p: f"{p[0]*k+ox:.2f} {p[1]*k+oy:.2f}"
        d.append(('M' if i == 0 else 'L') + f(a) + ' Q' + f(p1) + ' ' + f(b))
    return ' '.join(d) + ' Z'

BOITE = (90, 92, 422, 424)  # emprise de la maison dans le repère 512

def monogramme(cx, cy, taille, fond_clair):
    """Maison de `taille` px de haut centrée sur (cx, cy).
    fond_clair : maison vert nuit + M laiton ; sinon maison laiton, M évidé."""
    k = taille / (BOITE[3] - BOITE[1])
    ox = cx - (BOITE[0] + BOITE[2]) / 2 * k; oy = cy - (BOITE[1] + BOITE[3]) / 2 * k
    h, m = maison(k, ox, oy), m_path(256, 392, 150, k, ox, oy)
    if fond_clair:
        return f'<path d="{h}" fill="{NUIT}"/><path d="{m}" fill="{LAITON}"/>'
    return f'<path d="{h} {m}" fill="{LAITON}" fill-rule="evenodd"/>'

# ---------- Mot « Marchéo » repris des anciens logos ----------
def chemins_mot(nom):
    s = open(os.path.join(LOGOS, nom), encoding='utf-8').read()
    return re.findall(r'<path d="([^"]+)" fill="[^"]+"/>', s)[-3:]  # mot, accent, mention

def ecrire(nom, w, h, corps, fond=None):
    rect = f'<rect width="{w}" height="{h}" fill="{fond}"/>' if fond else ''
    open(os.path.join(LOGOS, nom), 'w', encoding='utf-8').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{rect}{corps}</svg>\n')

if not os.path.exists(os.path.join(HTML, '.mots')):
    # première exécution : on fige les tracés du mot avant d'écraser les anciens logos
    import json
    json.dump({'h': chemins_mot('marcheo-signature-clair.svg'), 'v': chemins_mot('marcheo-vertical-clair.svg')},
              open(os.path.join(HTML, '.mots'), 'w'))
import json
MOTS = json.load(open(os.path.join(HTML, '.mots')))
mot, acc, _ = MOTS['h']; vmot, vacc, _ = MOTS['v']

MENTION = 'LE CRM DU MARCHAND DE BIENS'
sego = TTFont('C:/Windows/Fonts/seguisb.ttf'); sgs = sego.getGlyphSet(); scmap = sego.getBestCmap()
CAP = sego['OS/2'].sCapHeight

def mention(x0, base, cap, largeur):
    """Mention en capitales Segoe UI Semibold, espacée pour occuper `largeur` px à partir de x0."""
    k = cap / CAP
    glyphes = [scmap[ord(c)] for c in MENTION]
    nat = sum(sgs[g].width for g in glyphes) * k
    track = (largeur - nat) / (len(glyphes) - 1)
    pen = SVGPathPen(sgs, ntos=lambda v: f"{v:.2f}"); x = x0
    for g in glyphes:
        sgs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, base)))
        x += sgs[g].width * k + track
    return pen.getCommands()

# emprises mesurées des anciens tracés du mot : (x, largeur, ligne de base de la mention, hauteur de capitale)
ment = mention(195.2, 146.2, 11.5, 352)
vment = mention(36.0, 282.1, 10.5, 325)

ecrire('marcheo-signature-clair.svg', 583, 192,
       monogramme(96, 94, 124, True) + f'<path d="{mot}" fill="{NUIT}"/><path d="{acc}" fill="{LAITON_FONCE}"/><path d="{ment}" fill="{LAITON_FONCE}"/>', IVOIRE)
ecrire('marcheo-signature-transparent.svg', 583, 192,
       monogramme(96, 94, 124, False) + f'<path d="{mot}" fill="{IVOIRE}"/><path d="{acc}" fill="{LAITON}"/><path d="{ment}" fill="{LAITON}"/>')
ecrire('marcheo-vertical-clair.svg', 397, 314,
       monogramme(198.5, 88, 116, True) + f'<path d="{vmot}" fill="{NUIT}"/><path d="{vacc}" fill="{LAITON_FONCE}"/><path d="{vment}" fill="{LAITON_FONCE}"/>', IVOIRE)
ecrire('marcheo-vertical-transparent.svg', 397, 314,
       monogramme(198.5, 88, 116, False) + f'<path d="{vmot}" fill="{IVOIRE}"/><path d="{vacc}" fill="{LAITON}"/><path d="{vment}" fill="{LAITON}"/>')
ecrire('marcheo-monogramme-transparent.svg', 128, 128, monogramme(64, 64, 120, False))
ecrire('marcheo-monogramme-clair.svg', 128, 128, monogramme(64, 64, 120, True))

# ---------- Supports (pages HTML rendues ensuite par Chrome) ----------
TEL, MAIL, SITE = '06 00 00 00 00', 'contact@marcheo.fr', 'marcheo.fr'
METAL = ('linear-gradient(100deg, transparent 28%, rgba(190,235,205,.10) 42%, rgba(255,255,255,.15) 46%, rgba(190,235,205,.08) 50%, transparent 64%),'
         'linear-gradient(118deg, #07190f 0%, #0d2f1f 20%, #17503a 36%, #2f7553 43%, #164a31 50%, #0c2c1c 66%, #103826 84%, #081c12 100%)')
TETE = ('<!doctype html><html><head><meta charset="utf-8">'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap">'
        '<style>*{box-sizing:border-box}body{margin:0;font-family:Inter,sans-serif}'
        f'.metal{{background:{METAL}}}.serif{{font-family:"Cormorant Garamond",Georgia,serif}}'
        '.caps{text-transform:uppercase;letter-spacing:.22em;font-weight:600}</style></head><body>')
L = '../../logos/'

def page(nom, w, h, corps):
    open(os.path.join(HTML, nom), 'w', encoding='utf-8').write(
        TETE.replace('<body>', f'<body style="width:{w}px;height:{h}px;overflow:hidden">') + corps + '</body></html>')

page('avatar.html', 1080, 1080,
     f'<div class="metal" style="width:1080px;height:1080px;display:grid;place-items:center">'
     f'<img src="{L}marcheo-monogramme-transparent.svg" style="width:560px;height:560px"></div>')

page('banniere.html', 1584, 396,
     f'<div class="metal" style="width:1584px;height:396px;position:relative;color:{IVOIRE}">'
     '<div style="position:absolute;inset:22px;border:1px solid rgba(201,171,116,.35);border-radius:8px"></div>'
     '<div style="position:absolute;left:108px;top:104px">'
     '<div class="serif" style="font-size:58px;font-weight:600;line-height:1.1">Du repérage à la revente,</div>'
     f'<div class="serif" style="font-size:58px;font-style:italic;font-weight:500;line-height:1.1;color:{LAITON}">tout votre métier au même endroit.</div>'
     '<div class="caps" style="margin-top:22px;font-size:17px;color:#cfd8cc">Annonces · Visite · DVF · Simulation · Chantier · Bilan</div></div>'
     f'<img src="{L}marcheo-vertical-transparent.svg" style="position:absolute;right:96px;top:118px;height:160px"></div>')
print('ok')
