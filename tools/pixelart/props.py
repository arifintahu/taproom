from pixgen import *
WOOD='#8a5a32'
def table(top='#9a6236',edge='#5e3a1e',trim=None):
    L=Layer()
    L.rect(9,30,12,46,edge,shade=False); L.rect(36,30,39,46,edge,shade=False)
    L.rect(22,30,26,46,dark(edge,.15),shade=False)
    L.ellipse(24,27,23,6.5,top)
    for x in range(2,47):
        for y in (31,32):
            if L.get(x,y): L.put(x,y,trim or edge)
    for (x,y) in ((12,25),(20,27),(31,26),(37,28)): L.put(x,y,dark(top,.18))
    return L.outline()
def stool():
    L=Layer(); L.ellipse(24,33,9,3,'#9a6236'); L.rect(17,35,19,46,'#5e3a1e',shade=False); L.rect(29,35,31,46,'#5e3a1e',shade=False); L.rect(19,41,29,42,'#5e3a1e',shade=False); return L.outline()
def slip(broken=False):
    L=Layer(); p='#efe0c0'
    if not broken:
        L.ellipse(24,26,14,5,p); L.rect(10,24,38,28,p)
        for x in range(12,37,6): L.put(x,26,dark(p,.15))
        L.ellipse(24,26,4.5,4.5,'#b8302a'); L.put(23,25,'#e8665a'); L.put(24,27,'#7a1c18'); L.put(25,26,'#7a1c18')
    else:
        L.rect(10,16,38,36,p)
        for y in (16,36):
            for x in range(10,39,3): L.put(x,y,dark(p,.1))
        L.ellipse(15,21,3,3,'#b8302a',clip=lambda x,y:x<15); L.ellipse(33,21,3,3,'#b8302a',clip=lambda x,y:x>33)
    return L.outline()
def coins(n):
    L=Layer(); g='#e8b83a'
    rows={'s':[(24,40,3)],'m':[(24,42,5),(24,38,3)],'l':[(24,43,7),(24,39,5),(24,35,3)]}[n]
    for (cx,cy,k) in rows:
        for i in range(k):
            x=cx+(i-(k-1)/2)*5.2
            L.ellipse(x,cy,3,1.8,g); L.put(int(x)-1,int(cy)-1,light(g,.5))
    if n=='l':
        pot=Layer(); pot.ellipse(24,44,11,4,'#3a3430'); pot.rect(13,42,35,45,'#3a3430'); L=pot.over(L)
    return L.outline()
def slate():
    L=Layer(); L.rect(8,12,40,40,'#8a5a32',shade=False); L.rect(11,15,37,37,'#2e3634',shade=False)
    for x in range(13,36): L.put(x,30,'#c9cfcc')
    for x in (15,25,35): L.put(x,29,'#c9cfcc'); L.put(x,31,'#c9cfcc')
    L.put(24,24,'#7ad8c2'); L.put(23,25,'#7ad8c2'); L.put(25,25,'#7ad8c2'); L.put(24,26,'#7ad8c2')
    L.rect(22,40,26,44,'#6b4428',shade=False)
    return L.outline()
def hourglass(level=1.0):
    L=Layer(); w='#8a5a32'; gl='#d9eef0'; sand='#e8c06a'
    L.rect(14,8,34,10,w,shade=False); L.rect(14,40,34,42,w,shade=False)
    L.rect(15,11,16,39,dark(w,.1),shade=False); L.rect(32,11,33,39,dark(w,.1),shade=False)
    top=[(18,11),(30,11),(25,25),(23,25)]; bot=[(23,25),(25,25),(30,39),(18,39)]
    L.poly(top,gl,shade=False); L.poly(bot,gl,shade=False)
    h=int(13*level)
    for y in range(25-h,25):
        for x in range(17,32):
            if inside(x+.5,y+.5,top): L.put(x,y,sand)
    for y in range(39-int(13*(1-level)),40):
        for x in range(17,32):
            if inside(x+.5,y+.5,bot): L.put(x,y,dark(sand,.1))
    L.put(24,26,sand); L.put(24,28,sand)
    return L.outline()
def jar(kind):
    L=Layer(); g='#bfd8d4'
    L.ellipse(24,32,9,11,g,hi=False); L.rect(18,18,30,21,'#8a5a32',shade=False)
    if kind=='ember':
        L.ellipse(24,36,7,6,'#e2622a',shade=False)
        for (x,y,c) in ((21,35,'#ffd27a'),(26,37,'#ffb04a'),(24,33,'#ffe9a8'),(28,34,'#ffd27a')): L.put(x,y,c)
    else:
        for (x,y) in ((22,38),(27,39),(24,40)): L.ellipse(x,y,2.4,1.2,'#e8b83a',shade=False,hi=False)
        L.rect(18,27,30,31,'#efe0c0',shade=False)
        for x in range(19,30,2): L.put(x,29,'#5e3a1e')
    L.put(20,26,'#f2fbfa'); L.put(20,27,'#f2fbfa')
    return L.outline()
PROPS={'table_oak':lambda:table(),'table_moon':lambda:table('#34466e','#1e2a44','#b8c8e8'),'table_gold':lambda:table('#7a3a22','#4a2414','#e2b23c'),
 'stool':stool,'slip_sealed':slip,'slip_open':lambda:slip(True),'coins_s':lambda:coins('s'),'coins_m':lambda:coins('m'),'coins_l':lambda:coins('l'),
 'slate':slate,'hourglass_full':lambda:hourglass(1),'hourglass_half':lambda:hourglass(.5),'jar_ember':lambda:jar('ember'),'jar_lampoil':lambda:jar('oil')}
if __name__=='__main__':
    from PIL import Image,ImageDraw
    S=5;cols=7;names=list(PROPS)
    im=Image.new('RGBA',(cols*W*S,2*(H*S+14)),(42,31,24,255));d=ImageDraw.Draw(im)
    for i,n in enumerate(names):
        x=(i%cols)*W*S;y=(i//cols)*(H*S+14);im.alpha_composite(to_png([PROPS[n]()],S),(x,y+14));d.text((x+4,y+1),n,fill=(240,200,140))
    im.save('props.png')
