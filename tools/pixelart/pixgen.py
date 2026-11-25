"""Taproom pixel-art generator: draws sprites on a pixel grid, exports SVG + PNG previews."""
import math, json, os
from PIL import Image

W = H = 48
OUT = '#1e120c'

def hexrgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def mix(a,b,t):
    a,b=hexrgb(a),hexrgb(b); return '#%02x%02x%02x'%tuple(round(a[i]+(b[i]-a[i])*t) for i in range(3))
def dark(c,t=.28): return mix(c,'#1e120c',t)
def light(c,t=.25): return mix(c,'#fff6e0',t)

class Layer:
    def __init__(s,w=None,h=None): s.px={}; s.w=w or W; s.h=h or H  # (x,y)->color
    def put(s,x,y,c):
        if 0<=x<s.w and 0<=y<s.h: s.px[(x,y)]=c
    def get(s,x,y): return s.px.get((x,y))
    # shaded shapes: light from top-left
    def ellipse(s,cx,cy,rx,ry,c,shade=True,hi=True,clip=None):
        for y in range(int(cy-ry-1),int(cy+ry+2)):
            for x in range(int(cx-rx-1),int(cx+rx+2)):
                dx,dy=(x+.5-cx)/rx,(y+.5-cy)/ry
                if dx*dx+dy*dy<=1 and (clip is None or clip(x,y)):
                    col=c
                    if shade and dx*.6+dy*.8>0.45: col=dark(c,.22)
                    if hi and dx*.6+dy*.8<-0.55: col=light(c,.22)
                    s.put(x,y,col)
    def rect(s,x0,y0,x1,y1,c,shade=True):
        for y in range(y0,y1+1):
            for x in range(x0,x1+1):
                col=c
                if shade and (x>=x1-1 if x1-x0>3 else False): col=dark(c,.2)
                s.put(x,y,col)
    def poly(s,pts,c,shade=True):
        xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
        cx=sum(xs)/len(xs); cy=sum(ys)/len(ys); sx=(max(xs)-min(xs))/2+.1; sy=(max(ys)-min(ys))/2+.1
        for y in range(int(min(ys)),int(max(ys))+1):
            for x in range(int(min(xs)),int(max(xs))+1):
                if inside(x+.5,y+.5,pts):
                    col=c
                    if shade and ((x+.5-cx)/sx*.7+(y+.5-cy)/sy*.5)>0.45: col=dark(c,.22)
                    s.put(x,y,col)
    def outline(s,col=OUT):
        add={}
        for (x,y) in s.px:
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                n=(x+dx,y+dy)
                if n not in s.px and 0<=n[0]<s.w and 0<=n[1]<s.h: add[n]=col
        s.px.update(add); return s
    def over(s,o):
        s.px.update(o.px); return s

def inside(x,y,pts):
    n=len(pts); c=False; j=n-1
    for i in range(n):
        xi,yi=pts[i]; xj,yj=pts[j]
        if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi)+xi: c=not c
        j=i
    return c

# ---------------- palettes ----------------
SKINS=['#f6d3b8','#eebd96','#e0a77d','#c98d63','#ad7350','#8e5a3c','#6f4530','#553424']
BEARDS={'white':'#f2ede3','grey':'#b9b4ab','ginger':'#d9773a','brown':'#7a4a2a','black':'#3a2a22','blond':'#e8c86a'}
CAPS=['#c8423b','#2f7d6d','#3d5a98','#8a4fa8','#d8892b','#5c8a3a','#b5446e','#2b6f8f']

TUNIC='#cdbb95'; PANTS='#6b4a2e'; BOOT='#4a3020'; BELT='#5a3a22'; GOLD='#e2b23c'

# ---------------- base: body ----------------
def body(skin):
    L=Layer()
    # boots
    L.ellipse(19,45.5,4,2.2,BOOT); L.ellipse(29,45.5,4.2,2.2,BOOT)
    # legs
    L.rect(17,38,22,44,PANTS); L.rect(25,38,30,44,PANTS)
    # torso
    L.ellipse(24,35,11,8.5,TUNIC)
    # belt
    for x in range(14,35):
        for y in (38,39):
            if L.get(x,y): L.put(x,y,BELT if y==38 else dark(BELT,.2))
    L.put(25,38,GOLD); L.put(26,38,GOLD); L.put(25,39,dark(GOLD)); L.put(26,39,dark(GOLD))
    # arms + hands
    L.ellipse(12.5,34,3.2,5.5,TUNIC); L.ellipse(35.8,34,3.2,5.5,TUNIC)
    L.ellipse(12.5,40,2.4,2.2,skin); L.ellipse(35.8,40,2.4,2.2,skin)
    return L.outline()

def head(skin,beard):
    L=Layer()
    L.ellipse(14,22,2.2,2.8,skin)            # ear
    L.ellipse(24,21,10,9,skin)               # head
    # beard: wide flowing shape down the chest
    bd=Layer()
    bd.poly([(13,22),(35,22),(34,28),(31,33),(24,37),(17,33),(14,28)],beard)
    bd.ellipse(24,30.5,9.5,6,beard)
    # mustache + brows
    mu=Layer(); mu.ellipse(22,26,4.5,2,beard); mu.ellipse(30,26,4.5,2,beard)
    L.over(bd)
    # carve a little mouth gap under the mustache
    L.over(mu)
    # nose
    L.ellipse(27,24,2.8,2.6,skin,hi=True); L.put(26,23,light(skin,.4))
    # eyes
    for (x,y) in ((21,20),(30,20)):
        L.put(x,y,'#1b1410'); L.put(x,y+1,'#1b1410')
    # brows
    for x in range(19,24): L.put(x,18,beard)
    for x in range(28,33): L.put(x,18,beard)
    # cheeks
    L.put(19,23,'#e58a7a'); L.put(20,23,'#e58a7a'); L.put(32,23,'#e58a7a'); L.put(33,22,'#e58a7a')
    # beard strands
    for (x,y) in ((20,31),(24,34),(28,31),(22,35),(26,35)):
        L.put(x,y,dark(beard,.18))
    # scalp highlight
    L.put(20,14,light(skin,.45)); L.put(21,13,light(skin,.45)); L.put(22,13,light(skin,.3))
    return L.outline()

# ---------------- hats ----------------
def hat_cap(c):
    L=Layer()
    L.poly([(13,17),(17,10),(22,5),(28,1.5),(35,0),(33,2.5),(31,6),(31.5,11),(35,17)],c)   # tall cone, tip curls right
    L.ellipse(24,15.5,11,2.6,dark(c,.12),hi=False)
    return L.outline()

def hat_h1():
    c='#7a5432'; L=Layer()
    L.ellipse(24,12,10,6,c,clip=lambda x,y:y<=15)
    L.ellipse(24,15,12.5,2.2,dark(c,.1),hi=False)
    for x in range(14,35):
        if L.get(x,13): L.put(x,13,'#3f2a1a')
    f=Layer(); f.poly([(31,13),(33,4),(36,0),(37,3),(34,9),(32,13)],'#4fb7a0')
    for (x,y) in ((34,4),(33,7),(32,10)): f.put(x,y,'#2a6e60')
    return L.over(f).outline()

def hat_h2():
    L=Layer(); c='#cf3f35'
    L.ellipse(24,13,15,9,c,clip=lambda x,y:y<=15)
    L.ellipse(24,15.6,13,1.6,'#f1e3c6',hi=False,shade=False)
    for (cx,cy,r) in ((18,9,2),(27,7,1.6),(31,11,2),(13,13,1.2),(23,12,1.3)):
        L.ellipse(cx,cy,r,r,'#f6efe2',shade=False,hi=False)
    return L.outline()

def hat_h3():
    c='#26315f'; L=Layer()
    L.poly([(13,17),(35,17),(30,6),(27,-1),(22,6)],c)
    L.ellipse(24,16,12,2.4,dark(c,.1),hi=False)
    for (x,y) in ((24,6),(21,11),(29,12),(26,3),(18,15)):
        L.put(x,y,'#ffd27a')
    for (x,y) in ((24,5),(23,6),(25,6),(24,7)): L.put(x,y,'#ffd27a')
    L.put(27,-1,'#ffd27a'); L.put(27,0,'#ffd27a'); L.put(28,0,'#fff0b0')
    return L.outline()

def hat_h4():
    g='#e8b83a'; L=Layer()
    L.poly([(15,15),(33,15),(34,6),(30,10),(27,3),(24,9),(21,3),(18,10),(14,6)],g)
    for x in range(15,34): L.put(x,14,dark(g,.15)); L.put(x,13,light(g,.2))
    L.ellipse(24,11,1.8,2.2,'#f08a24',shade=False,hi=False); L.put(24,10,'#ffe0a0')
    L.put(18,12,'#4fd1b5'); L.put(30,12,'#4fd1b5')
    return L.outline()

# ---------------- outfits ----------------
def out_o1():
    c='#efe0c0'; L=Layer()
    L.poly([(18,29),(31,29),(33,45),(16,45)],c)
    
    L.rect(21,40,28,42,dark(c,.12),shade=False)   # pocket
    L.put(20,29,dark(c,.25)); L.put(29,29,dark(c,.25))
    return L.outline()

def out_o2():
    c='#3f6d45'; L=Layer()
    L.poly([(13.5,30),(21,26.5),(23,41),(14.5,41)],c); L.poly([(34.5,30),(27,26.5),(25,41),(33.5,41)],c)
    for y in (36,39): L.put(26,y,GOLD); L.put(22,y,GOLD)
    return L.outline()

def out_o3():
    c='#2b3566'; L=Layer()
    L.ellipse(24,35,11.5,9,c); L.poly([(14,36),(34,36),(35,46),(13,46)],c)
    L.ellipse(12.5,34,3.4,5.6,c); L.ellipse(35.8,34,3.4,5.6,c)
    for y in range(28,46): L.put(24,y,'#c9d2ea')
    for (x,y) in ((18,33),(30,40),(17,43),(31,32)): L.put(x,y,'#c9d2ea')
    return L.outline()

def out_o4():
    c='#b83a28'; L=Layer()
    L.poly([(10,30),(17,27),(31,27),(38,30),(40,46),(8,46)],c)
    for x in range(9,40):
        if L.get(x,45): L.put(x,45,GOLD)
    for y in range(28,46):
        for x in (19,29):
            if L.get(x,y): L.put(x,y,GOLD)
    # opening in front shows the tunic
    for y in range(29,45):
        for x in range(20,29): L.px.pop((x,y),None)
    L.ellipse(24,28.5,2,1.6,GOLD,shade=False)
    return L.outline()

# ---------------- held items (right hand at 36,40) ----------------
def held_i1():
    L=Layer(); c='#b8743c'
    L.rect(36,35,41,43,c); L.ellipse(38.5,35,3.2,1.8,'#f5efe2',shade=False)
    L.ellipse(43,39,1.6,2.4,dark(c,.2),shade=False,hi=False)
    for y in range(37,42): L.px.pop((43,y),None)
    L.put(43,37,dark(c,.2)); L.put(43,41,dark(c,.2))
    return L.outline()

def held_i2():
    L=Layer(); b='#b8862f'
    L.rect(37,31,42,32,b,shade=False); L.rect(37,33,42,42,b,shade=False)
    L.rect(38,34,41,40,'#ffd27a',shade=False); L.put(39,36,'#fff4c8'); L.put(40,37,'#fff4c8')
    L.put(39,30,b); L.put(40,30,b); L.put(39,29,b)
    return L.outline()

def held_i3():
    L=Layer(); c='#b87a44'
    L.ellipse(37,40,5,4.2,c); L.ellipse(37,40,1.4,1.4,'#3a2414',shade=False,hi=False)
    for i in range(10): L.put(40+i,36-i,'#6b4428'); L.put(41+i,36-i,'#6b4428')
    L.rect(48-2,26,47,28,'#4a2e1a',shade=False)
    return L.outline()

def held_i4():
    L=Layer(); g='#e8b83a'
    L.poly([(35,33),(43,33),(42,37),(39,39),(36,37)],g)
    L.rect(38,39,40,42,g,shade=False); L.rect(36,43,42,44,g,shade=False)
    L.put(39,35,'#c2462e'); L.put(37,34,light(g,.4))
    return L.outline()

# ---------------- companions (ground, left) ----------------
def comp_c1():
    L=Layer()
    L.ellipse(6,45,6,1.8,'#a7b37c'); L.ellipse(6,40,4.2,4.2,'#c98b4b')
    for (x,y) in ((6,40),(7,39),(5,41),(7,41)): L.put(x,y,'#7a4a24')
    L.put(11,42,'#a7b37c'); L.put(12,41,'#a7b37c'); L.put(12,40,'#1b1410')
    return L.outline()

def comp_c2():
    L=Layer(); c='#6baf4f'
    L.ellipse(6,43,5.5,3.6,c); L.ellipse(3.5,39.5,1.8,1.8,'#f6efe2',shade=False); L.ellipse(8.5,39.5,1.8,1.8,'#f6efe2',shade=False)
    L.put(3,39,'#1b1410'); L.put(9,39,'#1b1410')
    for x in range(4,9): L.put(x,44,dark(c,.3))
    return L.outline()

def comp_c3():
    L=Layer(); c='#9a7350'
    L.ellipse(6,40,5,6.5,c); L.ellipse(6,42,3,3.5,'#e9d8b8',shade=False)
    L.ellipse(4,37,1.6,1.6,'#ffe7a8',shade=False,hi=False); L.ellipse(8,37,1.6,1.6,'#ffe7a8',shade=False,hi=False)
    L.put(4,37,'#1b1410'); L.put(8,37,'#1b1410'); L.put(6,39,GOLD)
    L.put(2,33,c); L.put(10,33,c)
    return L.outline()

def comp_c4():
    L=Layer(); c='#d24e34'
    L.ellipse(6,42,5.5,4,c); L.ellipse(9,37,3,2.6,c)
    L.poly([(3,40),(0,33),(5,37)],'#f2a93b')
    L.put(10,36,'#1b1410'); L.put(8,34,'#f2a93b'); L.put(10,34,'#f2a93b')
    L.put(12,35,'#c8c0b0'); L.put(13,34,'#d8d0c4'); L.put(13,33,'#e8e2d8')
    return L.outline()

ITEMS={'cap':None,'h1':hat_h1,'h2':hat_h2,'h3':hat_h3,'h4':hat_h4,'o1':out_o1,'o2':out_o2,'o3':out_o3,'o4':out_o4,
       'i1':held_i1,'i2':held_i2,'i3':held_i3,'i4':held_i4,'c1':comp_c1,'c2':comp_c2,'c3':comp_c3,'c4':comp_c4}
SLOT={'h':'hat','o':'outfit','i':'held','c':'companion'}

def compose(skin=SKINS[1],beard=BEARDS['white'],cap=CAPS[0],eq=None):
    eq=eq or {}
    order=[eq.get('companion'),'BODY',eq.get('outfit'),'HEAD',eq.get('hat') or 'cap',eq.get('held')]
    layers=[]
    for k in order:
        if not k: continue
        if k=='BODY': layers.append(body(skin))
        elif k=='HEAD': layers.append(head(skin,beard))
        elif k=='cap': layers.append(hat_cap(cap))
        else: layers.append(ITEMS[k]())
    return layers

def to_png(layers,scale=8,bg=None):
    w=layers[0].w if layers else W; h=layers[0].h if layers else H
    im=Image.new('RGBA',(w*scale,h*scale),bg or (0,0,0,0))
    px=im.load()
    for L in layers:
        for (x,y),c in L.px.items():
            r,g,b=hexrgb(c)
            for i in range(scale):
                for j in range(scale): px[x*scale+i,y*scale+j]=(r,g,b,255)
    return im

def to_svg_paths(L,dx=0):
    """One <path> per colour, merging horizontal runs."""
    by={}
    for (x,y),c in L.px.items(): by.setdefault(c,set()).add((x,y))
    out=[]
    for c,pts in sorted(by.items()):
        d=[]
        rows={}
        for (x,y) in pts: rows.setdefault(y,[]).append(x)
        for y in sorted(rows):
            xs=sorted(rows[y])
            i=0
            while i<len(xs):
                j=i
                while j+1<len(xs) and xs[j+1]==xs[j]+1: j+=1
                d.append(f'M{xs[i]+dx} {y}h{xs[j]-xs[i]+1}v1h-{xs[j]-xs[i]+1}z')
                i=j+1
        out.append(f'<path fill="{c}" d="{"".join(d)}"/>')
    return ''.join(out)

def to_svg(layers,w=None,h=None):
    w=w or layers[0].w; h=h or layers[0].h
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" shape-rendering="crispEdges">'+''.join(f'<g>{to_svg_paths(L)}</g>' for L in layers)+'</svg>'
def sheet_svg(frames,fw,fh):
    """frames: list of layer-lists; laid out horizontally"""
    n=len(frames); body=''
    for i,ls in enumerate(frames):
        body+=''.join(f'<g>{to_svg_paths(L,dx=i*fw)}</g>' for L in ls)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fw*n} {fh}" width="{fw*n}" height="{fh}" shape-rendering="crispEdges">'+body+'</svg>'

def blink_overlay(skin):
    """Closed eyelids, drawn over the head layer."""
    L=Layer()
    for x in (21,30): L.put(x,20,skin)
    for x in (20,21,22,29,30,31): L.put(x,21,'#1b1410')
    return L
