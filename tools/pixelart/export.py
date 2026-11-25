import os, json
from pixgen import *
import items2  # adds the 32 extra items (12 per slot)
from props import PROPS
O=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','assets','pixel'); 
for d in ('layers/body','layers/head','layers/hat','layers/outfit','layers/held','layers/companion','props','preview'): os.makedirs(f'{O}/{d}',exist_ok=True)
def save(p,layers): open(p,'w').write(to_svg(layers))
for i,sk in enumerate(SKINS): save(f'{O}/layers/body/body_s{i}.svg',[body(sk)])
for i,sk in enumerate(SKINS):
    for bn,bc in BEARDS.items(): save(f'{O}/layers/head/head_s{i}_{bn}.svg',[head(sk,bc)])
for i,c in enumerate(CAPS): save(f'{O}/layers/hat/cap_{i}.svg',[hat_cap(c)])
for k,f in ITEMS.items():
    if f: save(f'{O}/layers/{SLOT[k[0]]}/{k}.svg',[f()])
for n,f in PROPS.items(): save(f'{O}/props/{n}.svg',[f()])
# previews
combos=[(1,'white',0),(0,'ginger',1),(2,'brown',2),(3,'black',4),(4,'grey',3),(5,'white',5),(6,'blond',6),(7,'grey',7)]
for j,(s,b,c) in enumerate(combos): save(f'{O}/preview/base_{j}.svg',compose(SKINS[s],BEARDS[b],CAPS[c]))
save(f'{O}/preview/bald.svg',[body(SKINS[1]),head(SKINS[1],BEARDS['white'])])
for k in ITEMS:
    if k!='cap': save(f'{O}/preview/item_{k}.svg',compose(eq={SLOT[k[0]]:k}))
save(f'{O}/preview/look_legend.svg',compose(SKINS[2],BEARDS['ginger'],eq={'hat':'h4','outfit':'o4','held':'i4','companion':'c4'}))
save(f'{O}/preview/look_mushroom.svg',compose(SKINS[5],BEARDS['white'],eq={'hat':'h2','outfit':'o2','held':'i1','companion':'c2'}))
save(f'{O}/preview/look_wizard.svg',compose(SKINS[0],BEARDS['grey'],eq={'hat':'h3','outfit':'o3','held':'i2','companion':'c3'}))
save(f'{O}/preview/look_barkeep.svg',compose(SKINS[3],BEARDS['brown'],CAPS[4],eq={'outfit':'o1','held':'i1'}))
man={'grid':[W,H],'anchor_feet':[24,47],'draw_order':['companion','body','outfit','head','hat','held'],
 'skins':SKINS,'beards':BEARDS,'caps':CAPS,
 'items':{k:{'slot':SLOT[k[0]] if k!='cap' else 'hat','file':f'layers/{SLOT[k[0]] if k!="cap" else "hat"}/{k}.svg'} for k in ITEMS if k!='cap'},
 'props':{n:f'props/{n}.svg' for n in PROPS}}
json.dump(man,open(f'{O}/manifest.json','w'),indent=1)
import glob
fs=glob.glob(f'{O}/**/*.svg',recursive=True); print(len(fs),'svgs, avg bytes',sum(os.path.getsize(f) for f in fs)//len(fs))
