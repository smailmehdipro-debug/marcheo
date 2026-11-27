"""Génère icone.svg et icone-visite.svg (piste D3 / Visite D1) + variantes carrées pour les PNG."""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

OUT = sys.argv[1]      # dossier du dépôt
TMP = sys.argv[2]      # scratchpad

font = TTFont('C:/Windows/Fonts/BOD_BLAR.TTF')
gs = font.getGlyphSet()
gname = font.getBestCmap()[ord('M')]
bp = BoundsPen(gs); gs[gname].draw(bp)
xmin, ymin, xmax, ymax = bp.bounds
pp = SVGPathPen(gs); gs[gname].draw(pp)
MPATH = pp.getCommands()

def m_glyph(cx, base, h, attrs):
    s = h / (ymax - ymin)
    w = (xmax - xmin) * s
    tx = cx - w / 2 - xmin * s
    ty = base + ymin * s
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}")
    gs[gname].draw(TransformPen(pen, (s, 0, 0, -s, tx, ty)))
    return f'<path d="{pen.getCommands()}" {attrs}/>'

DEFS = '''<defs>
  <linearGradient id="or" gradientUnits="userSpaceOnUse" x1="150" y1="96" x2="330" y2="430">
    <stop offset="0" stop-color="#fff1c4"/><stop offset=".28" stop-color="#e2c486"/>
    <stop offset=".55" stop-color="#b8924f"/><stop offset=".75" stop-color="#e8cf95"/><stop offset="1" stop-color="#8a6630"/>
  </linearGradient>
  <linearGradient id="orCadre" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6e3b0"/><stop offset=".45" stop-color="#b8924f"/>
    <stop offset=".7" stop-color="#ecd49c"/><stop offset="1" stop-color="#7d5a28"/>
  </linearGradient>
  <radialGradient id="fond" cx=".5" cy=".28" r=".85">
    <stop offset="0" stop-color="#245a40"/><stop offset=".55" stop-color="#123a28"/><stop offset="1" stop-color="#071a11"/>
  </radialGradient>
  <filter id="relief" x="-10%" y="-10%" width="120%" height="125%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="b"/>
    <feSpecularLighting in="b" surfaceScale="5" specularConstant="1" specularExponent="24" lighting-color="#fff6dc" result="s"><feDistantLight azimuth="235" elevation="50"/></feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
    <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k2="1" k3=".55" result="lit"/>
    <feDropShadow in="lit" dx="0" dy="7" stdDeviation="6" flood-color="#000" flood-opacity=".55"/>
  </filter>
  <filter id="grave" x="-5%" y="-5%" width="110%" height="110%">
    <feOffset dy="3"/><feGaussianBlur stdDeviation="2" result="o"/>
    <feComposite in="SourceAlpha" in2="o" operator="out" result="in"/>
    <feFlood flood-color="#000" flood-opacity=".7"/><feComposite in2="in" operator="in" result="ombre"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="ombre"/></feMerge>
  </filter>
</defs>'''

def plaque(rx):
    return (f'<rect width="512" height="512" rx="{rx}" fill="url(#orCadre)"/>'
            '<rect x="20" y="20" width="472" height="472" rx="92" fill="url(#fond)"/>'
            '<rect x="34" y="34" width="444" height="444" rx="80" fill="none" stroke="#c9ab74" stroke-opacity=".45" stroke-width="2"/>')

def icone(rx):
    return (plaque(rx) +
        '<g filter="url(#relief)"><path d="M96 238 L256 98 L416 238 L416 418 L96 418 Z" fill="url(#or)" stroke="url(#or)" stroke-width="12" stroke-linejoin="round"/></g>' +
        m_glyph(256, 392, 150, 'fill="#0f2f20" filter="url(#grave)"'))

NOTES = '''<g transform="rotate(-6 398 388)"><g filter="url(#relief)"><rect x="318" y="290" width="160" height="196" rx="20" fill="url(#or)"/></g>
<rect x="352" y="276" width="92" height="30" rx="10" fill="#0b2318" stroke="url(#or)" stroke-width="8"/>
<g fill="#0f2f20"><circle cx="350" cy="346" r="9"/><circle cx="350" cy="394" r="9"/><circle cx="350" cy="442" r="9"/></g>
<g stroke="#0f2f20" stroke-width="12" stroke-linecap="round"><path d="M372 346 H450"/><path d="M372 394 H450"/><path d="M372 442 H428"/></g></g>'''

def visite(rx):
    return (plaque(rx) +
        '<g filter="url(#relief)"><path d="M100 236 L256 102 L412 236 L412 414 L100 414 Z" fill="none" stroke="url(#or)" stroke-width="30" stroke-linejoin="round"/>' +
        m_glyph(256, 386, 143, 'fill="url(#or)"') + '</g>' + NOTES)

def svg(body, titre):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n<title>{titre}</title>\n{DEFS}\n{body}\n</svg>\n'

open(os.path.join(OUT, 'icone.svg'), 'w', encoding='utf-8').write(svg(icone(112), 'Marchéo'))
open(os.path.join(OUT, 'icone-visite.svg'), 'w', encoding='utf-8').write(svg(visite(112), 'Marchéo · Visite'))
open(os.path.join(TMP, 'carre-icone.svg'), 'w', encoding='utf-8').write(svg(icone(0), 'Marchéo'))
open(os.path.join(TMP, 'carre-icone-visite.svg'), 'w', encoding='utf-8').write(svg(visite(0), 'Marchéo · Visite'))
print('ok', gname)
