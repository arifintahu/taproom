import os
from pixgen import *
import items2  # adds the 32 extra items (12 per slot)
from room import *
O=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','assets','pixel','scene'); os.makedirs(O,exist_ok=True)
def w(name,svg): open(f'{O}/{name}.svg','w').write(svg); return os.path.getsize(f'{O}/{name}.svg')
sz={}
sz['room_back']=w('room_back',to_svg([room_back()]))
sz['room_front']=w('room_front',to_svg([room_front()]))
sz['closeup']=w('closeup',to_svg([closeup_wall()]))
SK={'oak':('#9a6236','#5e3a1e',None),'moon':('#34466e','#1e2a44','#b8c8e8'),'gold':('#7a3a22','#4a2414','#e2b23c')}
for k,(t,e,tr) in SK.items():
    sz['tr_'+k]=w('table_room_'+k,to_svg([table_long(64,36,t,e,tr)]))
    sz['tl_'+k]=w('table_long_'+k,to_svg([table_long(300,40,t,e,tr)]))
sz['fire']=w('fire',sheet_svg(fire_frames()+ember_frames(),32,28))
I=icons(); order=['pouch','star','flame','gear','help','seal']
sz['icons']=w('icons',sheet_svg([[I[k]] for k in order],16,16))
combos=[(1,'white',0),(0,'ginger',1),(2,'brown',2),(3,'black',4),(4,'grey',3),(5,'white',5),(6,'blond',6),(7,'grey',7)]
sz['g_body']=w('g_body',sheet_svg([[body(SKINS[s])] for s,b,c in combos],48,48))
sz['g_head']=w('g_head',sheet_svg([[head(SKINS[s],BEARDS[b])] for s,b,c in combos],48,48))
sz['g_cap']=w('g_cap',sheet_svg([[hat_cap(CAPS[c])] for s,b,c in combos],48,48))
for slot,p in (('hat','h'),('outfit','o'),('held','i'),('comp','c')):
    ids=' '.join(f'{p}{n}' for n in range(1,13))
    sz['g_'+slot]=w('g_'+slot,sheet_svg([[ITEMS[i]()] for i in ids.split()],48,48))
print(sz, sum(sz.values()))
sz['g_blink']=w('g_blink',sheet_svg([[blink_overlay(SKINS[s])] for s,b,c in combos],48,48))
