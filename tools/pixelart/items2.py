from pixgen import *
def line(L,x0,y0,x1,y1,c,wd=1):
    n=int(max(abs(x1-x0),abs(y1-y0)))+1
    for i in range(n):
        t=i/max(n-1,1); x=round(x0+(x1-x0)*t); y=round(y0+(y1-y0)*t)
        for d in range(wd): L.put(x+d,y,c)
# ---------- hats ----------
def h5():
    L=Layer(); s='#d9b85c'
    L.ellipse(24,11.5,8,5,s,clip=lambda x,y:y<=15); L.ellipse(24,15.5,15,2.4,dark(s,.08),hi=False)
    for x in range(16,33):
        if L.get(x,13): L.put(x,13,'#b8402a'); L.put(x,14,'#8e2a20')
    for (x,y) in ((19,9),(23,8),(27,10),(13,15),(33,16)): L.put(x,y,dark(s,.2))
    return L.outline()
def h6():
    L=Layer(); c='#3d6fa8'
    L.ellipse(24,13.5,10.5,7.5,c,clip=lambda x,y:y<=16)
    for x in range(13,36):
        for y in (15,16):
            if L.get(x,y): L.put(x,y,dark(c,.25) if x%2 else dark(c,.1))
    for x in range(15,34,3):
        for y in range(9,14):
            if L.get(x,y): L.put(x,y,dark(c,.12))
    L.ellipse(24,5.5,3,3,'#f2ede3')
    return L.outline()
def h7():
    L=Layer(); c='#2a2420'
    L.poly([(9,16.5),(39,16.5),(35,9),(28,6.5),(24,8),(20,6.5),(13,9)],c)
    for x in range(10,39):
        if L.get(x,16): L.put(x,16,GOLD)
    for (x,y) in ((23,10),(24,10),(25,10),(23,11),(25,11),(24,12)): L.put(x,y,'#f2ede3')
    L.put(23,11,'#1b1410'); L.put(25,11,'#1b1410')
    return L.outline()
def h8():
    L=Layer()
    for x in range(14,35): 
        for y in (14,15): L.put(x,y,'#4f8a3a' if (x+y)%3 else '#3a6a2a')
    for i,(x,c) in enumerate(((15,'#f4a6c0'),(19,'#ffd27a'),(24,'#f6efe2'),(29,'#f4a6c0'),(33,'#ffd27a'))):
        L.ellipse(x,13,2.2,2.2,c,shade=False,hi=False); L.put(x,13,'#e08a24' if c!='#ffd27a' else '#c86a1a')
    return L.outline()
def h9():
    L=Layer(); st='#9aa3ad'
    L.ellipse(24,14.5,11,8,st,clip=lambda x,y:y<=16)
    for x in range(13,36):
        if L.get(x,15): L.put(x,15,'#6b7380'); L.put(x,16,'#5a6270')
    for x in (16,21,27,32): L.put(x,15,'#d8dee6')
    for y in range(7,15): L.put(24,y,'#7a838e')
    hl=Layer(); hl.poly([(14,13),(9,8),(7,2),(6,7),(9,12),(12,15)],'#efe0c0'); hl.poly([(34,13),(39,8),(41,2),(42,7),(39,12),(36,15)],'#efe0c0')
    return L.over(hl).outline()
def h10():
    L=Layer(); c='#3a2f4f'
    L.poly([(16,16),(32,16),(28,7),(31,0),(26,3),(22,8)],c)
    L.ellipse(24,16,15,2.4,dark(c,.15),hi=False)
    for x in range(17,32):
        if L.get(x,13): L.put(x,13,'#7b4fa8'); L.put(x,14,'#6a3f96')
    for (x,y) in ((23,12),(24,12),(25,12),(23,15),(24,15),(25,15)): pass
    for (x,y) in ((22,13),(23,13),(24,13),(22,14),(24,14)): L.put(x,y,GOLD)
    return L.outline()
def h11():
    L=Layer()
    cols=['#b8302a','#f2622a','#ffb04a','#f2622a','#b8302a']
    for i,(tx,ty) in enumerate(((13,4),(18,0),(24,-1),(30,0),(35,4))):
        L.poly([(21+i*1.5,15),(23+i*1.5,15),(tx+1,ty),(tx,ty)],cols[i],shade=False)
    L.ellipse(24,15,11,2.6,'#e8b83a')
    L.put(24,14,'#c2462e'); L.put(24,7,'#ffe9a8'); L.put(23,9,'#ffe9a8')
    return L.outline()
def h12():
    L=Layer(); g='#e8b83a'
    L.rect(14,12,34,16,g)
    for x in range(14,35): L.put(x,12,light(g,.25))
    for x0 in (16,23,30):
        L.rect(x0,4,x0+2,11,'#f1e6cc',shade=False); L.put(x0+1,3,'#3a2a22')
        L.put(x0+1,2,'#ffd27a'); L.put(x0+1,1,'#fff0b0'); L.put(x0,2,'#f2a93b'); L.put(x0+2,2,'#f2a93b')
    L.put(21,14,'#c2462e'); L.put(28,14,'#4fd1b5')
    return L.outline()
# ---------- outfits ----------
def o5():
    c='#4a6a9a'; L=Layer()
    L.poly([(17,31),(31,31),(32,45),(16,45)],c)
    line(L,19,27,19,31,c,2); line(L,28,27,28,31,c,2)
    L.put(19,31,GOLD); L.put(29,31,GOLD)
    L.rect(26,40,29,43,'#c8a050',shade=False); L.put(26,40,'#8a6a2a'); L.put(29,43,'#8a6a2a')
    for y in range(32,45): L.put(24,y,dark(c,.2))
    return L.outline()
def o6():
    c='#b8402a'; L=Layer()
    L.ellipse(24,28,12.5,2.6,c)
    L.poly([(14,28),(18,28),(17.5,42),(13.5,42)],c,shade=False)
    for y in range(29,43,3):
        for x in range(13,19):
            if L.get(x,y): L.put(x,y,'#f2ede3')
    for x in range(12,37,4):
        if L.get(x,28): L.put(x,28,'#f2ede3')
    for x in range(14,18): L.put(x,43,'#f2ede3' if x%2 else c)
    return L.outline()
def o7():
    c='#7a4a2a'; L=Layer()
    L.ellipse(24,35,11.6,8.6,c)
    for y in (37,38): 
        for x in range(13,36):
            if L.get(x,y): L.put(x,y,'#3a2414')
    L.rect(15,39,18,42,'#5e3a1e',shade=False); L.rect(30,39,33,42,'#5e3a1e',shade=False)
    L.put(16,39,GOLD); L.put(31,39,GOLD)
    for y in range(28,36,2): L.put(15,y,light(c,.3)); L.put(33,y,light(c,.3))
    return L.outline()
def o8():
    c='#6b3f8f'; y2='#e8c34a'; L=Layer()
    L.ellipse(24,35,11.4,8.6,c)
    L.ellipse(12.5,33,3.8,5.2,y2); L.ellipse(35.8,33,3.8,5.2,y2)
    for y in range(29,38,2):
        for x in (11,13,35,37): L.put(x,y,c)
    for y in (38,40,42): L.put(24,y,GOLD)
    return L.outline()
def o9():
    st='#9aa3ad'; L=Layer()
    L.ellipse(24,35,11.5,8.6,st); L.ellipse(12.5,34,3.4,5.6,st); L.ellipse(35.8,34,3.4,5.6,st)
    for y in range(28,44,2):
        for x in range(10,40,2):
            if L.get(x,y): L.put(x,y,dark(st,.15))
    t=Layer(); t.rect(19,29,29,46,'#2f5aa8',shade=False)
    for x in range(19,30): t.put(x,46,GOLD)
    for (x,y) in ((24,38),(24,39),(24,40),(24,41),(24,42),(22,40),(23,40),(25,40),(26,40)): t.put(x,y,GOLD)
    return L.over(t).outline()
def o10():
    c='#2f6b52'; L=Layer()
    L.ellipse(24,35,11.5,8.6,c); L.poly([(13,36),(35,36),(36,46),(12,46)],c)
    L.ellipse(12.5,34,3.4,5.6,c); L.ellipse(35.8,34,3.4,5.6,c)
    for x in range(12,37):
        if L.get(x,38): L.put(x,38,'#5a3a22')
    for (x,col) in ((15,'#d84a3a'),(18,'#4a8ad8'),(30,'#e8c34a'),(33,'#8ae07a')):
        L.rect(x,39,x+1,42,col,shade=False); L.put(x,38,'#c9c0b0')
    for y in range(39,46): L.put(24,y,dark(c,.25))
    return L.outline()
def o11():
    c='#7fb3d9'; L=Layer()
    L.poly([(10,30),(17,27),(31,27),(38,30),(40,46),(8,46)],c)
    for y in range(29,45):
        for x in range(20,29): L.px.pop((x,y),None)
    for x in range(9,40):
        for y in (27,28,29):
            if L.get(x,y): L.put(x,y,'#f4f8fb' if (x+y)%2 else '#dfe8f0')
        if L.get(x,45): L.put(x,45,'#f4f8fb')
    for (x,y) in ((13,36),(35,40),(12,42),(36,33)): L.put(x,y,'#e8f6ff')
    L.ellipse(24,29,1.8,1.6,'#c9e6ff',shade=False)
    return L.outline()
def o12():
    g='#e8b83a'; L=Layer()
    L.ellipse(24,35,11.6,8.6,g); L.ellipse(12.5,35,3.4,5.6,g); L.ellipse(35.8,35,3.4,5.6,g)
    L.ellipse(13,29.5,4.4,3.2,light(g,.1)); L.ellipse(35,29.5,4.4,3.2,light(g,.1))
    for x in range(13,36):
        if L.get(x,38): L.put(x,38,dark(g,.3))
        if L.get(x,41): L.put(x,41,dark(g,.2))
    for (x,y) in ((12,28),(34,28),(16,34),(31,33)): L.put(x,y,'#fff4c8')
    L.put(24,39,'#c2462e')
    return L.outline()
# ---------- held ----------
def i5():
    L=Layer(); c='#b8874a'
    line(L,37,42,44,31,c,2); L.ellipse(45.5,28.5,2.6,3.6,c)
    L.put(45,27,light(c,.4))
    return L.outline()
def i6():
    L=Layer(); c='#c88a3a'
    L.ellipse(39.5,39,6.5,3.8,c)
    for (x,y) in ((36,37),(39,36),(42,37)): L.put(x,y,'#f2d08a'); L.put(x+1,y+1,'#f2d08a')
    return L.outline()
def i7():
    L=Layer()
    line(L,37,43,46,19,'#7a4a2a',1); line(L,38,43,47,19,'#5e3a1e',1)
    for y in range(20,34): L.put(47,y,'#d8dee6')
    L.ellipse(47,35,1.8,1.8,'#d84a3a',shade=False,hi=False); L.put(47,36,'#f2ede3')
    return L.outline()
def i8():
    L=Layer(); c='#6b3f2a'
    L.rect(36,35,42,43,c); L.rect(35,34,43,35,light(c,.2),shade=False)
    for (x0,y0) in ((37,29),(40,30)):
        L.rect(x0,y0,x0+2,y0+2,'#f6efe2',shade=False); L.put(x0+1,y0+1,'#1b1410')
    return L.outline()
def i9():
    L=Layer()
    L.rect(40,15,41,46,'#7a4a2a',shade=False); L.put(41,15,'#5e3a1e')
    L.ellipse(40.5,11,3.8,3.8,'#7ad8f0'); L.put(39,9,'#f2fbff'); L.put(40,9,'#f2fbff')
    for (x,y) in ((35,8),(46,12),(37,15)): L.put(x,y,'#bff0ff')
    return L.outline()
def i10():
    L=Layer(); c='#5a2a6b'
    L.rect(35,33,43,43,c); L.rect(36,34,36,42,'#efe0c0',shade=False)
    for (x,y) in ((35,33),(43,33),(35,43),(43,43)): L.put(x,y,GOLD)
    for (x,y) in ((39,36),(40,37),(39,38),(40,39),(41,38)): L.put(x,y,'#9ff0ff')
    return L.outline()
def i11():
    L=Layer(); c='#5a3a8a'
    L.ellipse(40,37,4.6,6.2,c)
    for (x,y) in ((38,34),(41,36),(39,39),(42,40),(40,32)): L.put(x,y,'#8a6ac0')
    for (x,y) in ((34,31),(46,34),(35,44),(45,42)): L.put(x,y,'#ffd27a')
    return L.outline()
def i12():
    L=Layer()
    line(L,37,43,44,30,'#efe0c0',1); line(L,38,43,45,30,'#c9b79c',1)
    L.poly([(45.5,21),(47,25),(51,25.5),(48,28),(49,32),(45.5,30),(42,32),(43,28),(40,25.5),(44,25)],'#ffd27a',shade=False)
    L.put(45,26,'#fff6d0')
    for (x,y) in ((41,20),(50,22),(39,29)): L.put(x,y,'#fff0b0')
    return L.outline()
# ---------- companions ----------
def c5():
    L=Layer(); c='#a89a8a'
    L.ellipse(6,44,4.2,2.8,c); L.ellipse(8.5,41.5,1.7,1.7,'#e8b0a8',shade=False)
    L.put(9,43,'#1b1410'); L.put(11,44,'#e8a0a0')
    line(L,2,45,0,42,'#c9a0a0')
    return L.outline()
def c6():
    L=Layer()
    L.ellipse(6,45,4.2,2.6,'#d8362a'); L.ellipse(10.5,45,1.7,1.6,'#1b1410',shade=False,hi=False)
    for (x,y) in ((4,44),(7,45),(5,46),(8,43)): L.put(x,y,'#1b1410')
    for y in range(43,48): L.put(6,y,'#1b1410')
    return L.outline()
def c7():
    L=Layer(); c='#7a5a3a'
    L.ellipse(6,43,5.6,4,c)
    for x in range(1,11,2): L.put(x,39,dark(c,.35)); L.put(x+1,38,dark(c,.35))
    L.ellipse(11,44.5,2.2,1.8,'#d8b890',shade=False); L.put(13,44,'#1b1410'); L.put(11,43,'#1b1410')
    return L.outline()
def cat(body,stripe,eye,mark=None):
    L=Layer()
    L.ellipse(6,42.5,4.2,4.8,body); L.ellipse(7,35.5,3.6,3.1,body)
    L.poly([(4,34),(4.5,30.5),(6.5,33)],body,shade=False); L.poly([(8,33),(9.5,30.5),(10,34)],body,shade=False)
    L.put(6,35,eye); L.put(9,35,eye); L.put(7,37,'#e8a0a0')
    if stripe:
        for (x,y) in ((4,40),(5,42),(4,44),(8,41),(7,33)): L.put(x,y,stripe)
    line(L,2,46,0,41,body,2)
    if mark: L.put(7,33,mark); L.put(8,32,mark)
    return L.outline()
def c8(): return cat('#d8892b','#9a5418','#4f8a3a')
def c9():
    L=Layer(); c='#d86a2a'
    L.ellipse(2.5,45,3.4,2.2,c); L.put(0,45,'#f6efe2'); L.put(1,46,'#f6efe2')
    L.ellipse(7,42.5,4,4.8,c); L.ellipse(8,43.5,1.8,2.6,'#f6efe2',shade=False)
    L.ellipse(8,35.5,3.4,2.9,c); L.poly([(5,34),(5.5,30),(7.5,33)],c,shade=False); L.poly([(9,33),(10.5,30),(11,34)],c,shade=False)
    L.put(6,31,'#3a2414'); L.put(10,31,'#3a2414'); L.put(7,35,'#1b1410'); L.put(10,35,'#1b1410'); L.put(12,37,'#1b1410')
    L.ellipse(10.5,37,1.4,1,'#f6efe2',shade=False,hi=False)
    return L.outline()
def c10():
    L=Layer()
    L.poly([(6,26),(9,31),(10,36),(8,40),(4,40),(2,36),(3,31)],'#7ad8f0',shade=False)
    L.poly([(6,31),(8,35),(7,39),(5,39),(4,35)],'#e8f8ff',shade=False)
    L.put(5,36,'#1b5a7a'); L.put(7,36,'#1b5a7a')
    for (x,y) in ((11,30),(1,33),(10,42)): L.put(x,y,'#bff0ff')
    return L.outline()
def c11():
    L=Layer(); c='#f08a24'
    L.ellipse(6,42.5,4.4,4.4,c); L.ellipse(5,43,2.4,2.2,'#e8b83a',shade=False)
    for (x,y,col) in ((5,37,'#d8362a'),(6,36,'#ffb04a'),(7,37,'#d8362a'),(6,35,'#ffd27a'),(4,38,'#ffb04a')): L.put(x,y,col)
    L.put(8,41,'#1b1410'); L.put(10,42,'#e8b83a'); L.put(11,42,'#c86a1a')
    for (x,y) in ((1,38),(11,37)): L.put(x,y,'#ffd27a')
    return L.outline()
def c12():
    L=cat('#eef2f8',None,'#4a8ad8','#e8b83a')
    for (x,y) in ((0,32),(12,36),(1,46)): L.put(x,y,'#fff0b0')
    return L
NEW={'h5':h5,'h6':h6,'h7':h7,'h8':h8,'h9':h9,'h10':h10,'h11':h11,'h12':h12,
 'o5':o5,'o6':o6,'o7':o7,'o8':o8,'o9':o9,'o10':o10,'o11':o11,'o12':o12,
 'i5':i5,'i6':i6,'i7':i7,'i8':i8,'i9':i9,'i10':i10,'i11':i11,'i12':i12,
 'c5':c5,'c6':c6,'c7':c7,'c8':c8,'c9':c9,'c10':c10,'c11':c11,'c12':c12}
ITEMS.update(NEW)
TIERS=[('common',[1,5,6]),('rare',[2,7,8]),('epic',[3,9,10]),('legendary',[4,11,12])]
if __name__=='__main__':
    from PIL import Image,ImageDraw
    S=4
    rows=[]
    for p,slot in (('h','hat'),('o','outfit'),('i','held'),('c','companion')):
        rows.append([p+str(n) for t,ns in TIERS for n in ns])
    im=Image.new('RGBA',(12*W*S,4*(H*S+12)),(42,31,24,255)); d=ImageDraw.Draw(im)
    for r,ids in enumerate(rows):
        for c,i in enumerate(ids):
            eq={SLOT[i[0]]:i}
            p=to_png(compose(eq=eq),S); im.alpha_composite(p,(c*W*S,r*(H*S+12)+12)); d.text((c*W*S+3,r*(H*S+12)),i,fill=(240,200,140))
    im.save('items48.png'); print(im.size)
