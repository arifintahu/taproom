from pixgen import *
from PIL import Image, ImageDraw
S=5
cells=[('base',{}),('cap',{})]
for k in ITEMS:
    if k=='cap':continue
    cells.append((k,{SLOT[k[0]]:k}))
cells.append(('full',{'hat':'h4','outfit':'o4','held':'i4','companion':'c4'}))
cells.append(('mix',{'hat':'h2','outfit':'o2','held':'i1','companion':'c2'}))
cols=7; rows=(len(cells)+cols-1)//cols
im=Image.new('RGBA',(cols*W*S,rows*(H*S+14)),(42,31,24,255)); d=ImageDraw.Draw(im)
for i,(name,eq) in enumerate(cells):
    layers=compose(eq=eq) if name!='base' else [body(SKINS[1]),head(SKINS[1],BEARDS['white'])]
    p=to_png(layers,S); x=(i%cols)*W*S; y=(i//cols)*(H*S+14)
    im.alpha_composite(p,(x,y+14)); d.text((x+4,y+1),name,fill=(240,200,140))
im.save('sheet.png'); print(im.size)
