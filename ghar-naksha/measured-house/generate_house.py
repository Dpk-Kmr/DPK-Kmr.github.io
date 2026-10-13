#!/usr/bin/env python3
"""Offline parametric geometry. All model calculations are INCHES; adapter only uses metres."""
from pathlib import Path
import argparse, json, math, zipfile
from PIL import Image, ImageDraw, ImageFont, ImageColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

# FIXED / FROM SKETCH OR USER (inches)
FIXED = dict(site_width=300, site_depth=648, wall=9, service=60, bedrooms=144,
             living=180, front=168, bath_width=72, wc_width=48, kitchen_width=48,
             room3_width=144, wall_height=108, wc_height=78, temple_height=36)
# Latest user default: 48 in kitchen/temple width, 48 in temple length, single 24 in counter.
# PROPOSED: edit here, or --parameters file.json. Never silently fit invalid geometry.
PROPOSED = dict(temple_depth=24, wardrobe_height=60, floor_height=120, slab=6,
    stair_risers=20, stair_width=36, stair_gap=6, tread=10, landing=36,
    door_width=36, service_door=30, door_height=84, window_width=48,
    window_height=48, window_sill=36, counter_depth=24,  counter_height=36, counter_slab=2,
    front_court=True, kitchen_sink_x=13, kitchen_sink_offset=1,
    kitchen_sink_depth=22, kitchen_sink_thickness=3, door_leaf_thickness=2,
    wc_storage_shelf=3, wc_storage_height=27, wc_storage_opening_height=24,
    stair_waist=12, temple_panel=1, cooktop_x=43, cooktop_offset=2, cooktop_width=22, cooktop_depth=20, cooktop_thickness=2)
# Proposed opening offsets are measured from each wall start, in inches.
# "$name" references the common PROPOSED parameter above.
OPENING_PROPOSALS = {
 'D01': dict(start=24,width='$service_door',height=78),
 'D02': dict(start=24,width='$service_door',height=78),
 'D03': dict(start=96,width='$door_width',height='$door_height'),
 'D04': dict(start=150,width='$door_width',height='$door_height'),
 'D05': dict(start=96,width='$door_width',height='$door_height'),
 'D06': dict(start=150,width='$door_width',height='$door_height'),
 'D07': dict(start=100,width='$door_width',height='$door_height'),
 'D08': dict(start=111,width='$door_width',height='$door_height'),
 'D09': dict(start=174,width='$door_width',height='$door_height'),
 'A01': dict(start=0,width=48,height='$wardrobe_height',sill=36),
 'S01': dict(start=15,width=30,height='$wc_storage_opening_height',sill=81),
 'W01': dict(start=270,width=24,height=36,sill=42),
 'W02': dict(start=36,width='$window_width',height='$window_height',sill='$window_sill'),
}
# Proposed furniture and fixture cuboids: x, y, width, depth, height, base z.
# Temple, stacked wardrobe, U counter and stair are derived from PROPOSED above.
FURNITURE_PROPOSALS = {
 'r1-bed': (18,96,60,78,24,0), 'r2-bed': (216,96,60,78,24,0),
 'r3-bed': (18,390,60,78,24,0), 'r2-wardrobe': (267,180,24,36,84,0),
 'r3-wardrobe': (18,492,60,24,84,0), 'sofa': (201,261,72,30,30,0),
 'coffee': (216,309,36,18,18,0), 'dining': (96,285,36,36,30,0),
 'chair1': (105,263,18,18,32,0), 'chair2': (105,325,18,18,32,0),
 'shower': (12,12,30,30,3,0), 'basin': (48,12,24,18,32,0),
 'wc-fixture': (255,12,18,24,28,0),
 'refrigerator': (57,384,27,27,72,0), 'washing-machine': (99,9,24,24,34,0),
 'microwave': (10,340,20,16,12,36), 'chimney': (9,314,24,24,16,66),
 'water-purifier': (9,280,12,12,18,66), 'living-tv': (283,279,8,36,24,48),
 'bath-geyser': (12,12,18,14,22,78), 'r1-fan': (63,135,30,30,6,99),
 'r2-fan': (204,135,30,30,6,99), 'r3-fan': (93,426,30,30,6,99),
 'living-fan': (168,279,30,30,6,99), 'lobby-light': (165,27,12,12,3,102),
 'kitchen-light': (24,315,12,12,3,102),
 'r1-ac': (9,96,8,36,12,84), 'r2-ac': (283,96,8,36,12,84), 'r3-ac': (9,390,8,36,12,84),
 'water-main': (285,12,3,3,3,12), 'water-kitchen': (10,280,3,3,3,18),
 'water-shower': (12,12,3,3,3,42), 'water-basin': (57,12,3,3,3,18),
 'water-washer': (99,9,3,3,3,12), 'electrical-main': (162,396,4,18,24,48),


}
APPLIANCE_COLORS = {'refrigerator':'#e6e9e5','washing-machine':'#f0f1ec','microwave':'#b7c1c2','chimney':'#566365','water-purifier':'#eef2ee','living-tv':'#152c35','bath-geyser':'#eee8db','r1-ac':'#edf0eb','r2-ac':'#edf0eb','r3-ac':'#edf0eb'}
THEMES = [
 ('Warm Indian teak','#efe2cc','#ab6d37','#cfa168','#7c8c69'),
 ('Jaipur terracotta','#f3d7c7','#b65438','#e9b287','#bd7754'),
 ('Kerala timber','#e9e5d4','#604635','#ab8556','#506e59'),
 ('Coastal indigo','#e5edf0','#365a86','#d0bc97','#6096a1'),
 ('Modern monochrome','#e6e6e4','#41464b','#b5b6b4','#858a8e'),
 ('Sage courtyard','#e6eadd','#72815b','#bdac87','#9aab81'),
 ('Royal maroon brass','#efe0cf','#793d51','#cfa755','#967345'),
 ('Limewash minimal','#f5eee2','#b5a794','#d6c9b7','#a9b7ab'),
 ('Gujarati bright craft','#f7e6c4','#d39825','#c17745','#1c8f8e'),
 ('Deccan charcoal copper','#d9d9d2','#4e5556','#b77950','#8b6a58')]

def ft(v):
    feet=int(v//12); inches=v-feet*12
    return f"{feet}' {inches:g}\""

def build(p=None):
    f=FIXED; overrides=p or {}; unknown=set(overrides)-set(PROPOSED); assert not unknown, f'Unknown parameters: {unknown}'; p={**PROPOSED, **overrides}; t=f['wall']; W=f['site_width']; H=sum(f[k] for k in ('service','bedrooms','living','front'))+5*t
    assert H==597, 'Footprint closure mismatch'
    court=f['site_depth']-H; assert court==51, 'Site closure mismatch'
    assert p['front_court'] is True, 'This model places remaining site length at front'
    iw=W-2*t; rw=(iw-t)/2; right3=iw-f['room3_width']-t
    assert 2*rw+3*t==W and f['room3_width']+right3+3*t==W, 'Clear room widths plus walls do not close'
    front_y=231+f['living']; front_room_y=front_y+t; shift=f['living']-126
    walls=[]; holes=[]; boxes=[]; rooms=[]
    def wall(id,x,y,w,d,h=108):
        assert min(w,d)==9, f'{id}: wall must be 9 inches'
        walls.append(dict(id=id,x=x,y=y,w=w,d=d,h=h))
    def hole(id,wallid,start,width,height=84,sill=0,kind='door',direction='into room',basis='from sketch; exact offset and size proposed'):
        spec=OPENING_PROPOSALS.get(id,{})
        def value(k,fallback):
            v=spec.get(k,fallback);return p[v[1:]] if isinstance(v,str) and v.startswith('$') else v
        start,width,height,sill=[value(k,v) for k,v in zip(('start','width','height','sill'),(start,width,height,sill))]
        holes.append(dict(id=id,wall=wallid,start=start,width=width,height=height,sill=sill,kind=kind,direction=direction,basis=basis))
    def box(id,kind,x,y,w,d,h,z=0):
        x,y,w,d,h,z=FURNITURE_PROPOSALS.get(id,(x,y,w,d,h,z))
        if id.startswith('r3-') or id=='electrical-main': y+=shift
        boxes.append(dict(id=id,kind=kind,x=x,y=y,w=w,d=d,h=h,z=z))
    def room(id,name,x,y,w,d,basis='from sketch'):
        rooms.append(dict(id=id,name=name,x=x,y=y,w=w,d=d,basis=basis))
    wall('rear',0,0,W,t); wall('front',0,H-t,W,t)
    wall('left',0,t,t,H-2*t); wall('right',W-t,t,t,H-2*t)
    wall('service-cross',t,69,225,t); wall('wc-front',234,69,57,t,108); wall('room-cross',t,222,iw,t); wall('front-cross',t,front_y,153,t)
    wall('room-divider',t+rw,78,t,144); wall('r3-divider',153,front_room_y,t,168)
    wall('bath-divider',81,9,t,60); wall('wc-divider',234,9,t,60,108)
    # Bath/WC doors deliberately on lobby-facing partitions, per explicit user clarification.
    hole('D01','bath-divider',24,p['service_door'],min(78,p['door_height']),direction='into bath')
    hole('D02','wc-divider',24,p['service_door'],min(78,p['door_height']),direction='into WC')
    storage_base=78+p['wc_storage_shelf']
    assert p['wc_storage_shelf']>0 and p['wc_storage_height']>0 and storage_base+p['wc_storage_height']<=108, 'WC storage must fit above 78 in enclosure under 108 in walls'
    hole('S01','wc-divider',15,30,p['wc_storage_opening_height'],storage_base,'access','WC storage opens toward utility lobby','user-requested storage; shelf, height and hatch dimensions proposed')
    holes[-1]['sill']=storage_base
    assert p['wc_storage_opening_height']>0 and p['wc_storage_opening_height']<=p['wc_storage_height'], 'Storage hatch exceeds clear storage height'
    for id,w,start,direction in [('D03','service-cross',96,'into Room 1'),('D04','service-cross',150,'into Room 2'),('D05','room-cross',96,'into Room 1'),('D06','room-cross',150,'into Room 2'),('D07','front-cross',100,'into Room 3')]:
        hole(id,w,start,p['door_width'],p['door_height'],direction=direction)
    # User clarification: no wall, header or door between living and front-right stair.
    hole('D08','front',111,36,p['door_height'],direction='into Room 3')
    hole('D09','front',174,36,p['door_height'],direction='into entrance hall',basis='proposed main entry; sketch shows only Room 3 exterior door')
    hole('A01','room-cross',0,60,p['wardrobe_height'],36,'access','wardrobe doors face Room 1','proposed upper recess over temple, requires lintel/support design')
    hole('W01','left',270,24,36,42,'window','fixed glazing','from kitchen mark; exact placement and size proposed')
    hole('W02','front',36,48,p['window_height'],p['window_sill'],'window','sliding','from Room 3 front hatch; size/offset proposed')
    room('bath','Bath',9,9,72,60);room('wc','WC',243,9,48,60)
    room('lobby','Utility lobby',90,9,144,60,'calculated')
    room('r1','Room 1',9,78,rw,144,'calculated width; sketch depth')
    room('r2','Room 2',154.5,78,rw,144,'calculated width; sketch depth')
    room('kitchen','Kitchen',9,231,48,f['living'])
    room('living','Living / dining',57,231,234,f['living'],'calculated; kitchen open to living')
    room('r3','Room 3',9,front_room_y,144,168);room('hall','Entry / stair',162,front_room_y,right3,168,'calculated')
    td=p['temple_depth']; assert td==24, 'Temple depth must match the confirmed 24 in Room 1 return'
    box('temple','temple',33,231,24,td,36)
    box('temple-kitchen-storage','block',9,231,24,td,p['counter_height']-p['counter_slab'])
    box('r1-wardrobe','wardrobe',9,231,48,td,p['wardrobe_height'],36)
    assert 0<p['wardrobe_height']<=72, 'Wardrobe height must fit above 36 in temple under 108 in walls'
    kd=p['counter_depth'];ky=231+td
    assert p['counter_height']==36 and 1<=p['counter_slab']<=3, 'Rear slab must cap the 36 in temple; proposed slab is 1-3 in'
    assert kd==24, 'User-confirmed counter depth is 24 in'
    box('counter-single','kitchen-counter',9,ky,kd,f['living']-2*kd,p['counter_height'])
    box('counter-rear','block',9,231,48,kd,p['counter_slab'],p['counter_height']-p['counter_slab'])
    box('counter-front','kitchen-counter',9,front_y-kd,48,kd,p['counter_height'])
    box('kitchen-sink','sink',10,ky+1,22,22,3,p['counter_height'])
    box('cooktop','block',10,ky+36,22,20,2,p['counter_height'])
    assert f['living']-2*kd>=60, 'Sink and hob need at least 60 in counter length'
    for id,x,y in [('r1-bed',18,96),('r2-bed',216,96),('r3-bed',18,390)]: box(id,'bed',x,y,60,78,24)
    box('r2-wardrobe','wardrobe',267,180,24,36,84)
    box('r3-wardrobe','wardrobe',18,492,60,24,84)
    box('sofa','sofa',201,270,72,30,30);box('coffee','coffee-table',216,315,36,18,18)
    box('dining','dining-table',96,285,36,36,30)
    for id,x,y in [('chair1',105,263),('chair2',105,325)]:box(id,'chair',x,y,18,18,32)
    box('shower','shower',12,12,30,30,3);box('basin','sink',48,12,24,18,32)
    box('wc-fixture','toilet',255,12,18,24,28)
    for appliance in ('refrigerator','washing-machine','microwave','chimney','water-purifier','living-tv','bath-geyser','r1-fan','r2-fan','r3-fan','living-fan','lobby-light','kitchen-light','r1-ac','r2-ac','r3-ac'):
        box(appliance,'block',0,0,1,1,1)
    next(b for b in boxes if b['id']=='water-purifier')['y']=ky+1
    next(b for b in boxes if b['id']=='chimney')['y']=ky+34
    for port in ('water-main','water-kitchen','water-shower','water-basin','water-washer'):
        box(port,'water-port',0,0,1,1,1)
    box('electrical-main','electrical-panel',0,0,1,1,1)
    box('wc-storage-shelf','block',243,9,48,60,p['wc_storage_shelf'],78)
    n=p['stair_risers']; assert n%2==0 and n>=4, 'Stair needs even riser count'
    riser=p['floor_height']/n; assert 5<=riser<=7.75, 'Riser outside proposed usability limits'
    assert p['landing']>=p['stair_width'] and p['stair_width']>=36 and p['tread']>=10, 'Stair landing / flight / tread assumptions fail'
    run=(n//2-1)*p['tread']; sd=run+p['landing']; sw=2*p['stair_width']+p['stair_gap']; sx=W-t-sw; sy=front_room_y
    assert sw<=right3 and sd<=168 and 36<=f['living'], 'Stair footprint or living-side approach does not fit'
    assert sx+p['stair_width']+p['stair_gap']+p['stair_width']==291, 'First flight must abut right exterior wall'
    assert all(w['x']+w['w']<=162 for w in walls if w['id']=='front-cross'), 'Wall separates living from stair'
    # Two flights: 10 risers / 9 independent goings each; landing and upper floor complete flight.
    for i in range(n//2-1):
        box(f'stair-low-{i+1}','stair',sx+p['stair_width']+p['stair_gap'],sy+i*p['tread'],p['stair_width'],p['tread'],(i+1)*riser)
        box(f'stair-high-{i+1}','stair',sx,sy+run-(i+1)*p['tread'],p['stair_width'],p['tread'],(n//2+i+1)*riser)
    for step in boxes:
        if step['id'].startswith(('stair-low-','stair-high-')):
            top=step['h'];step['z']=max(0,top-p['stair_waist']-riser);step['h']=top-step['z']
            step['bottom_start']=max(0,top-p['stair_waist']-riser);step['bottom_end']=max(0,top-p['stair_waist'])
            if step['id'].startswith('stair-high-'):step['bottom_start'],step['bottom_end']=step['bottom_end'],step['bottom_start']
    assert p['stair_waist']==12, 'Proposed stair waist must be 12 in for this sloping-flight model'
    box('stair-landing','stair',sx,sy+run,sw,p['landing'],p['slab'],p['floor_height']/2-p['slab'])
    box('upper-arrival','stair',sx,sy-36,p['stair_width'],36,p['slab'],p['floor_height']-p['slab'])
    roof_underside=p['floor_height']+f['wall_height']
    headroom=min(roof_underside-(b.get('z',0)+b['h']) for b in boxes if b['kind']=='stair')
    assert headroom>=84 and p['floor_height']-p['slab']>=84, 'Stair headroom / approach clearance mismatch'
    stair=dict(x=sx,y=sy,w=sw,d=sd,risers=n,riser=riser,tread=p['tread'],flight_width=p['stair_width'],landing=p['landing'],headroom=headroom,shaft=[sx,sy,sw,sd],note=f"Full open shaft to roof underside {p['floor_height']+108:g} in; arrival underside {p['floor_height']-p['slab']:g} in.")
    for h in holes:
        w=next(w for w in walls if w['id']==h['wall']); L=max(w['w'],w['d'])
        assert h['start']>=0 and h['start']+h['width']<=L, f"{h['id']} exceeds wall"
        assert h['sill']+h['height']<=w['h'],f"{h['id']} exceeds wall height"
    for i,a in enumerate(holes):
        for b in holes[i+1:]:
            if a['wall']==b['wall']:
                assert not (max(a['start'],b['start'])<min(a['start']+a['width'],b['start']+b['width']) and max(a['sill'],b['sill'])<min(a['sill']+a['height'],b['sill']+b['height'])),f"Overlapping openings {a['id']}/{b['id']}"
    assert 48-kd==24, 'Kitchen clear internal aisle closure mismatch'
    assert 108<=p['floor_height']<=144, 'Floor height outside proposed range'
    for b in boxes:
        if b['kind']=='stair':continue
        assert any(r['x']<=b['x'] and r['y']<=b['y'] and b['x']+b['w']<=r['x']+r['w'] and b['y']+b['d']<=r['y']+r['d'] for r in rooms), f"{b['id']}: furniture outside clear rooms"
    # Ground-floor approach zones are clear; the upper arrival is above head level.
    accesses=[dict(id='living-to-stair',x=162,y=sy-36,w=129,d=36),dict(id='open-kitchen-aisle',x=33,y=ky,w=60,d=front_y-max(kd,27)-ky)]
    for access in accesses:
        for b in boxes:
            if b.get('z',0)>=84:continue
            intersects=max(access['x'],b['x'])<min(access['x']+access['w'],b['x']+b['w']) and max(access['y'],b['y'])<min(access['y']+access['d'],b['y']+b['d'])
            assert not intersects, f"{b['id']}: blocks {access['id']} approach"
    for h in holes:
        if h['kind']!='door':continue
        wa=next(w for w in walls if w['id']==h['wall']); along=wa['w']>wa['d']; high=h['id'] in ('D01','D02','D03','D05','D07','D08'); a=h['width']
        if along:
            hx=wa['x']+h['start']+(a if high else 0);hy=wa['y']+wa['d']/2
            dx=-1 if high else 1;dy=-1 if wa['id'] in ('room-cross','front') else 1
        else:
            hx=wa['x']+wa['w']/2;hy=wa['y']+h['start']+a;dx=-1 if h['id']=='D01' else 1;dy=-1
        x0,x1=sorted((hx,hx+dx*a));y0,y1=sorted((hy,hy+dy*a))
        for b in boxes:
            if b.get('z',0)>=h['height']:continue
            xx0=max(x0,b['x']);xx1=min(x1,b['x']+b['w']);yy0=max(y0,b['y']);yy1=min(y1,b['y']+b['d'])
            if xx1<=xx0 or yy1<=yy0:continue
            nearx=min(xx1,max(xx0,hx));neary=min(yy1,max(yy0,hy))
            assert math.hypot(nearx-hx,neary-hy)>=a, f"{b['id']}: blocks {h['id']} swing"
    # Corner clearance: room paired doors must not intersect center partition.
    for h in holes:
        if h['id'] in ('D03','D04','D05','D06'):
            a=9+h['start']; b=a+h['width']
            assert b<=145.5-4.5 or a>=154.5+4.5, f"{h['id']}: insufficient center-wall jamb"
    # Fixtures inside door sweeps: compact WC chosen to leave swing clear.
    wcbox=next(b for b in boxes if b['id']=='wc-fixture'); d2=next(h for h in holes if h['id']=='D02')
    hx=238.5;hy=9+d2['start']+d2['width']
    dx=max(wcbox['x']-hx,hx-wcbox['x']-wcbox['w'],0);dy=max(wcbox['y']-hy,hy-wcbox['y']-wcbox['d'],0)
    assert math.hypot(dx,dy)>=d2['width'], 'WC fixture blocks door sweep'
    return dict(fixed=f,proposed=p,width=W,depth=H,court=court,inside_width=iw,room_width=rw,walls=walls,openings=holes,boxes=boxes,rooms=rooms,stair=stair,kitchen=dict(width=48,counter_depth=kd,aisle=24,open_clearance=60,orientation='three-wall counter: full left run and 48 in rear/front returns, open right to living'),accesses=accesses,stair_entry=dict(x=sx+p['stair_width']+p['stair_gap'],y=sy,from_space='living',flight='right exterior wall'),storage=dict(x=243,y=9,w=48,d=60,z=storage_base,h=p['wc_storage_height'],opening='S01'))

def wall_blocks(m):
    result=[]
    for w in m['walls']:
        along=w['w']>w['d']; L=w['w'] if along else w['d']; hs=[h for h in m['openings'] if h['wall']==w['id']]
        xs=sorted(set([0,L]+[v for h in hs for v in (h['start'],h['start']+h['width'])])); zs=sorted(set([0,w['h']]+[v for h in hs for v in (h['sill'],h['sill']+h['height'])]))
        for a,b in zip(xs,xs[1:]):
            for c,d in zip(zs,zs[1:]):
                if any(h['start']<(a+b)/2<h['start']+h['width'] and h['sill']<(c+d)/2<h['sill']+h['height'] for h in hs):continue
                result.append(dict(id=w['id'],kind='wall',x=w['x']+(a if along else 0),y=w['y']+(0 if along else a),w=b-a if along else w['w'],d=w['d'] if along else b-a,z=c,h=d-c))
    return result

FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
def font(n): return ImageFont.truetype(FONT,n)
def plan(m,out):
    im=Image.new('RGB',(2400,3500),'#faf8f2'); d=ImageDraw.Draw(im); s=4; ox=470;oy=290
    def xy(x,y):return (ox+s*x,oy+s*y)
    def rect(x,y,w,h,fill,outline='#52615b'):d.rectangle([xy(x,y),xy(x+w,y+h)],fill=fill,outline=outline,width=3)
    def txt(x,y,text,size=27,fill='#253e34',anchor='mm'): d.multiline_text(xy(x,y),text,font=font(size),fill=fill,anchor=anchor,align='center',spacing=6)
    def dim(x1,y1,x2,y2,label,vertical=False):
        a=xy(x1,y1);b=xy(x2,y2);d.line([a,b],fill='#556761',width=2)
        for x,y in (a,b): d.line([(x-9,y-9),(x+9,y+9)],fill='#556761',width=2)
        px=(a[0]+b[0])/2;py=(a[1]+b[1])/2;f=font(28);bb=d.textbbox((px,py),label,font=f,anchor='mm');d.rectangle((bb[0]-7,bb[1]-4,bb[2]+7,bb[3]+4),fill='#faf8f2');d.text((px,py),label,font=f,fill='#253e34',anchor='mm')
    txt(150,-45,'GHAR NAKSHA | MEASURED PLAN',48);txt(150,-27,'Rear / top - no north direction supplied',27)
    rect(0,0,300,648,None,'#68928a')
    for r in m['rooms']:rect(r['x'],r['y'],r['w'],r['d'],'#eeeade',None)
    for b in wall_blocks(m):
        if b['z']==0:rect(b['x'],b['y'],b['w'],b['d'],'#53675d')
    for b in m['boxes']:
        if b['kind']=='stair' or b['id'] in ('r1-wardrobe','wc-storage-shelf') or b.get('z',0)>=48:continue
        rect(b['x'],b['y'],b['w'],b['d'],'#d6c4a5','#99896e')
    for h in m['openings']:
        w=next(w for w in m['walls'] if w['id']==h['wall']);along=w['w']>w['d']; x=w['x']+(h['start'] if along else w['w']/2);y=w['y']+(w['d']/2 if along else h['start']);size=h['width']
        if h['kind']=='window':
            if along:d.line([xy(x,y),xy(x+size,y)],fill='#408eac',width=6)
            else:d.line([xy(x,y),xy(x,y+size)],fill='#408eac',width=6)
        elif h['kind']=='door':
            # Hinge + quarter circle on inward room side; bath into left, WC into right.
            if along:
                sign=-1 if w['id'] in ('room-cross','front') else 1
                hinge=x+size if h['id'] in ('D01','D02','D03','D05','D07','D08') else x
                flip=-1 if hinge==x+size else 1
                d.line([xy(hinge,y),xy(hinge,y+sign*size)],fill='#8c663f',width=3)
                pts=[xy(hinge+flip*size*math.cos(a*math.pi/180),y+sign*size*math.sin(a*math.pi/180)) for a in range(91)]
            else:
                sign=-1 if h['id']=='D01' else 1
                d.line([xy(x,y+size),xy(x+sign*size,y+size)],fill='#8c663f',width=3)
                pts=[xy(x+sign*size*math.sin(a*math.pi/180),y+size-size*math.cos(a*math.pi/180)) for a in range(91)]
            d.line(pts,fill='#8c663f',width=2)
        if h['kind']!='access':txt(x+(size/2 if along else 0),y+(0 if along else size/2),h['id'],20,'#245e75')
    for r in m['rooms']:
        cy=r['y']+r['d']/2
        if r['id']=='kitchen':txt(45,327,'Kitchen\n4 ft wide\nOpen to living',18)
        elif r['id']=='hall':txt(185,r['y']+100,'Entry\n10\' 9\" clear',24)
        elif r['id']=='living':txt(172,250,'Living / dining\n19\' 6\" x 15\' 0\"',27)
        elif r['id'] in ('r1','r2','r3'):txt(106 if r['id']=='r3' else r['x']+r['w']/2,r['y']+111 if r['id']=='r3' else r['y']+r['d']-25,r['name']+'\n'+ft(r['w'])+' x '+ft(r['d'])+('\nCalculated width' if r['id']!='r3' else ''),24)
        else:txt(r['x']+r['w']/2,cy,r['name']+'\n'+ft(r['w'])+' x '+ft(r['d']),25)
    st=m['stair'];rect(st['x'],st['y'],st['w'],st['d'],None)
    for b in m['boxes']:
        if b['kind']=='stair':
            if b['id']=='upper-arrival':
                for yy in range(int(b['y']),int(b['y']+b['d']),4):
                    d.line([xy(b['x'],yy),xy(b['x'],min(yy+2,b['y']+b['d']))],fill='#997b53',width=2)
                    d.line([xy(b['x']+b['w'],yy),xy(b['x']+b['w'],min(yy+2,b['y']+b['d']))],fill='#997b53',width=2)
                txt(b['x']+b['w']/2,b['y']+b['d']/2,f"Upper arrival\n{ft(m['proposed']['floor_height'])} above",16)
            else:rect(b['x'],b['y'],b['w'],b['d'],None,'#997b53')
    run=(st['risers']//2-1)*st['tread']; low_y=st['y']+st['tread']/2; high_y=st['y']+run-st['tread']/2
    right_x=st['x']+st['flight_width']+m['proposed']['stair_gap']+st['flight_width']/2
    left_x=st['x']+st['flight_width']/2
    for xx,ya,yb in [(right_x,low_y,high_y),(left_x,high_y,low_y)]:
        d.line([xy(xx,ya),xy(xx,yb)],fill='#315c49',width=5);d.polygon([xy(xx,yb),xy(xx-4,yb+(6 if yb<ya else -6)),xy(xx+4,yb+(6 if yb<ya else -6))],fill='#315c49')
    txt(right_x,st['y']-21,'START UP\nfrom living',18)
    txt(st['x']+st['w']/2,st['y']+run+st['landing']/2,'U landing',22);txt(st['x']+st['w']/2,st['y']+st['d']+20,f"UP: {st['risers']} x {st['riser']:g} in\n{st['risers']//2-1} goings / flight @ {st['tread']:g} in",20)
    d.line([xy(33,231),xy(33,255)],fill='#315c49',width=4)
    txt(21,244,'Kitchen\nstorage',13)
    txt(45,241,'Temple\n2 x 2 ft',15)
    txt(21,267,'Sink',16)
    txt(21,301,'Hob',16)
    txt(70,397,'Fridge',16)
    txt(111,21,'Washer',17)
    txt(72,345,'Open aisle',16)
    txt(267,57,'Storage above\nS01 faces lobby',17)
    txt(150,m['depth']+m['court']/2,'OPEN FRONT COURT / SETBACK\n25 ft x '+ft(m['court'])+' | PROPOSED PLACEMENT',24)
    dim(0,-10,300,-10,"25' 0\" overall");dim(-70,0,-70,648,"54' 0\" site",True)
    dim(330,0,330,m["depth"],ft(m["depth"])+" house",True);dim(330,m["depth"],330,648,ft(m["court"])+" court",True)
    for y,depth,label in [(9,60,"5' clear"),(78,144,"12' clear"),(231,180,"15' clear"),(420,168,"14' clear")]:dim(-25,y,-25,y+depth,label,True)
    dim(9,680,153,680,"Room 3: 12' clear");dim(162,680,291,680,"Hall: 10' 9\" clear")
    txt(150,711,'Front / bottom | inches internally; dimensions in feet + inches',27)
    txt(150,727,f"Walls: 9 in cuboids | Kitchen aisle: 2 ft + open living | WC ceiling: 6 ft 6 in",27)
    txt(150,746,'Opening sizes / offsets and furniture are PROPOSED. See schedule.\nScale bar below: each segment = 5 ft. Print scale depends on page size.',24)
    for i in range(4):rect(30+i*60,768,60,5,'#253e34' if i%2==0 else '#ffffff')
    txt(150,784,"0                         10'                         20'",23)
    im.save(out)


def iso(m,index,out):
    title,wallcolor,accent,wood,floor=THEMES[index];im=Image.new('RGB',(2800,2500),'#f8f5ee');d=ImageDraw.Draw(im)
    # Fixed orthographic isometric projection. Full-height translucent walls show accurate solids.
    scale=2.7
    def proj(x,y,z):return (1806+scale*(x-y)*.866,581+scale*((x+y)*.5-z))
    def poly(points,fill,alpha=255):
        layer=Image.new('RGBA',im.size,(0,0,0,0));ld=ImageDraw.Draw(layer);col=ImageColor.getrgb(fill)+(alpha,);ld.polygon(points,fill=col,outline=(70,78,70,180),width=2);im.paste(layer,(0,0),layer)
    poly([proj(0,0,0),proj(300,0,0),proj(300,648,0),proj(0,648,0)],'#d9dfd4')
    for r in m['rooms']:poly([proj(r['x'],r['y'],0),proj(r['x']+r['w'],r['y'],0),proj(r['x']+r['w'],r['y']+r['d'],0),proj(r['x'],r['y']+r['d'],0)],floor)
    # Proposed finish treatment: teak planks, stone grids, alternate tiled bands.
    for r in m['rooms']:
        pitch=12 if index in (0,2,6) else 24 if index in (4,7,9) else 18
        for yy in range(int(r['y'])+pitch,int(r['y']+r['d']),pitch):
            d.line([proj(r['x'],yy,.2),proj(r['x']+r['w'],yy,.2)],fill=wood,width=1)
        if index not in (0,2,6):
            for xx in range(int(r['x'])+pitch,int(r['x']+r['w']),pitch):
                d.line([proj(xx,r['y'],.2),proj(xx,r['y']+r['d'],.2)],fill=wood,width=1)
    door_leaves=[]
    for h in m['openings']:
        if h['kind']!='door':continue
        wa=next(w for w in m['walls'] if w['id']==h['wall']); along=wa['w']>wa['d']; high=h['id'] in ('D01','D02','D03','D05','D07','D08')
        if along:
            hinge=wa['x']+h['start']+(h['width'] if high else 0); yy=wa['y']+wa['d']/2
            sign=-1 if wa['id'] in ('room-cross','front') else 1
            leaf=dict(x=hinge-m['proposed']['door_leaf_thickness']/2,y=min(yy,yy+sign*h['width']),w=m['proposed']['door_leaf_thickness'],d=h['width'])
        else:
            hinge=wa['y']+h['start']+h['width'];xx=wa['x']+wa['w']/2;sign=-1 if h['id']=='D01' else 1
            leaf=dict(x=min(xx,xx+sign*h['width']),y=hinge-m['proposed']['door_leaf_thickness']/2,w=h['width'],d=m['proposed']['door_leaf_thickness'])
        door_leaves.append(dict(**leaf,id=h['id'],kind='door',z=0,h=h['height']))
    visual_boxes=[]
    for b in m['boxes']:
        if b['id'].endswith('-fan'):
            x,y,w,dd,z=b['x'],b['y'],b['w'],b['d'],b['z']
            for px,py,pw,pd,hh in ((x,y+dd/2-2,w,4,1),(x+w/2-2,y,4,dd,1),(x+w/2-2,y+dd/2-2,4,4,6)):
                visual_boxes.append(dict(id=b['id'],kind='block',x=px,y=py,w=pw,d=pd,z=z,h=hh))
            continue
        if b['kind']!='temple':visual_boxes.append(b);continue
        # Proposed shrine opens to the living/right side; U end slab cannot block its access.
        q=m['proposed']['temple_panel'];x,y,w,dd,hh=b['x'],b['y'],b['w'],b['d'],b['h']
        for px,py,pw,pd,ph,pz in ((x,y,q,dd,hh-2,0),(x,y,w,q,hh-2,0),(x,y,w,dd,q,0)):
            visual_boxes.append(dict(id='temple-frame',kind='temple',x=px,y=py,w=pw,d=pd,h=ph,z=pz))
    bs=wall_blocks(m)+visual_boxes+door_leaves
    faces=[]
    for b in bs:
        x,y,z,w,dd,h=[b.get(k,0) for k in ('x','y','z','w','d','h')]; col=APPLIANCE_COLORS[b['id']] if b['id'] in APPLIANCE_COLORS else '#34443e' if b['id']=='cooktop' else wallcolor if b['kind']=='wall' else '#f5f1e4' if b['kind'] in ('sink','toilet','shower') else accent if b['kind'] in ('bed','sofa','chair') else wood
        vertices=[(x,y,z),(x+w,y,z),(x+w,y+dd,z),(x,y+dd,z),(x,y,z+h),(x+w,y,z+h),(x+w,y+dd,z+h),(x,y+dd,z+h)]
        if 'bottom_start' in b:
            vertices[:4]=[(x,y,b['bottom_start']),(x+w,y,b['bottom_start']),(x+w,y+dd,b['bottom_end']),(x,y+dd,b['bottom_end'])]
        for face_index,inds in enumerate(((3,2,6,7),(1,2,6,5),(4,5,6,7))):
            pts=[vertices[i] for i in inds];dist=sum(a+b for a,b,c in pts)/4
            # Theme-specific directional Lambert shading on the same geometric faces.
            light=[(.3,.5,.9),(.7,.2,.8),(.2,.8,.7)][index%3];norm=math.sqrt(sum(v*v for v in light));factor=.66+.34*light[(1,0,2)[face_index]]/norm
            rgb=ImageColor.getrgb(accent if b['id']=='front' else col);shade='#'+''.join(f'{min(255,round(v*factor)):02x}' for v in rgb)
            faces.append((dist,pts,shade,82 if b['kind']=='wall' else 255,b['id']=='front' and face_index==0))
    for _,pts,col,alpha,facade in sorted(faces,key=lambda f:f[0]):
        poly([proj(*p) for p in pts],col,alpha)
        if facade:
            # Decorative paint/cladding pattern has zero geometric thickness; apertures remain clear.
            x0,x1=min(p[0] for p in pts),max(p[0] for p in pts);z0,z1=min(p[2] for p in pts),max(p[2] for p in pts);yy=pts[0][1]
            pitch=12 if index in (0,2,6) else 24
            for xx in range(math.ceil(x0/pitch)*pitch,int(x1),pitch):d.line([proj(xx,yy,z0),proj(xx,yy,z1)],fill=wood,width=1)
            if index in (1,4,8,9):
                for zz in range(math.ceil(z0/pitch)*pitch,int(z1),pitch):d.line([proj(x0,yy,zz),proj(x1,yy,zz)],fill=wood,width=1)
    # Bedding, upholstery seams and cabinet fronts keep simple furniture legible.
    for b in m['boxes']:
        x,y,z=b['x'],b['y'],b.get('z',0)+b['h']+.2
        if b['kind']=='bed':
            for xx in (x+5,x+33):poly([proj(xx,y+5,z),proj(xx+22,y+5,z),proj(xx+22,y+20,z),proj(xx,y+20,z)],'#f5f1e4')
            d.line([proj(x,y+30,z),proj(x+b['w'],y+30,z)],fill=wallcolor,width=5)
            if index%3==1:
                for yy in range(int(y)+40,int(y+b['d']),8):d.line([proj(x,yy,z),proj(x+b['w'],yy,z)],fill=wallcolor,width=3)
            elif index%3==2:
                for xx in range(int(x)+12,int(x+b['w']),12):d.line([proj(xx,y+30,z),proj(xx,y+b['d'],z)],fill=wallcolor,width=3)
        if b['kind']=='sofa':
            for xx in (x+24,x+48):d.line([proj(xx,y,z),proj(xx,y+b['d'],z)],fill=wallcolor,width=3)
    # Real glazed apertures (wall geometry above has already removed the openings).
    for h in m['openings']:
        w=next(w for w in m['walls'] if w['id']==h['wall']);along=w['w']>w['d'];x=w['x']+(h['start'] if along else w['w']/2);y=w['y']+(w['d']/2 if along else h['start'])
        if h['kind']=='window':
            a=h['width'];z=h['sill'];hh=h['height'];poly([proj(x,y,z),proj(x+(a if along else 0),y+(0 if along else a),z),proj(x+(a if along else 0),y+(0 if along else a),z+hh),proj(x,y,z+hh)],'#75a9b5',100)
    x,y=proj(267,39,94);d.text((x,y),'Storage above WC',font=font(22),fill='#193b31',anchor='mm',stroke_width=2,stroke_fill='#faf8f2')
    for r in m['rooms']:
        x,y=proj(r['x']+r['w']/2,r['y']+r['d']/2,2);d.text((x,y),r['name'],font=font(27),fill='#193b31',anchor='mm',stroke_width=3,stroke_fill='#faf8f2')
    # Explicit cabinet face points rear toward Room 1.
    b=next(b for b in m['boxes'] if b['id']=='r1-wardrobe')
    d.line([proj(39,231,36),proj(39,231,96)],fill='#554536',width=3)
    d.text((1400,75),f'{index+1:02d} / {title.upper()}',font=font(52),fill='#243f35',anchor='mm')
    d.text((1400,145),'Same measured geometry | roofless transparent-wall cutaway',font=font(30),fill='#5b6c62',anchor='mm')
    d.text((1400,197),'Walls: 9 in thick, 9 ft high | WC ceiling: 6 ft 6 in; storage above',font=font(28),fill='#5b6c62',anchor='mm')
    d.text((2350,275),'REAR / TOP',font=font(26),fill='#253e34',anchor='mm')
    d.text(proj(150,665,0),'FRONT / BOTTOM - OPEN COURT',font=font(26),fill='#253e34',anchor='mm')
    d.text((1400,2140),"Site 25' x 54' | House 25' x 49' 9\" | Court 4' 3\"",font=font(34),fill='#253e34',anchor='mm')
    d.text((1400,2200),f"Stair: {m['stair']['risers']} risers @ {m['stair']['riser']:g} in; {m['stair']['risers']//2-1} goings/flight @ {m['stair']['tread']:g} in; {m['stair']['flight_width']:g} in clear",font=font(28),fill='#253e34',anchor='mm')
    d.text((1400,2250),f"Proposed open stair shaft: 9 ft headroom; floor-to-floor {ft(m['proposed']['floor_height'])}",font=font(28),fill='#253e34',anchor='mm')
    d.text((1400,2300),f"Return: 4 ft x 2 ft; temple niche: 2 ft x 2 ft x 3 ft; wardrobe above: full return x {ft(m['proposed']['wardrobe_height'])} high",font=font(27),fill='#253e34',anchor='mm')
    a=proj(0,648,0);b=proj(120,648,0);d.line([a,b],fill='#253e34',width=7);d.text(((a[0]+b[0])/2,a[1]+75),'10 ft scale',font=font(25),fill='#253e34',anchor='mm')
    im.save(out)


def app_project(m):
    # Adapter into legacy app metres; authoritative model remains in inches.
    u=.0254;W=m['width'];H=m['depth'];els=[]
    def elem(b):
        return dict(id=b['id'],name=b['id'].replace('-',' '),kind=b['kind'],roomId=next((r['id'] for r in m['rooms'] if r['x']<=b['x']+b['w']/2<=r['x']+r['w'] and r['y']<=b['y']+b['d']/2<=r['y']+r['d']), 'living'),position=[(b['x']+b['w']/2-W/2)*u,b.get('z',0)*u,(b['y']+b['d']/2-H/2)*u],rotation=0,dimensions=dict(width=b['w']*u,height=b['h']*u,depth=b['d']*u),color='#efe2cc' if b['kind']=='wall' else '#ab6d37' if b['kind'] in ('bed','chair','sofa') else APPLIANCE_COLORS.get(b['id'],'#cfa168'),material='plaster' if b['kind']=='wall' else 'wood',visible=True,locked=False)
    for w in m['walls']:
        e=elem({**w,'kind':'wall'});e['fullHeight']=True;els.append(e)
    for b in m['boxes']:
        # Stepped prisms use a straight sloping underside, not mass to ground.
        e=elem({**b,'kind':b['kind'] if b['kind']!='stair' else 'block'});
        if b['id']=='r1-wardrobe':e['roomId']='r1';e['rotation']=180
        if b['id']=='cooktop':e['color']='#34443e';e['material']='metal'
        if b['id']=='counter-single':e['rotation']=90;e['dimensions']['width'],e['dimensions']['depth']=e['dimensions']['depth'],e['dimensions']['width']
        if b['id']=='refrigerator':e['rotation']=270
        if b['id'] in ('microwave','chimney','water-purifier'):e['rotation']=90;e['dimensions']['width'],e['dimensions']['depth']=e['dimensions']['depth'],e['dimensions']['width']
        if b['id'].endswith('-ac'):e['rotation']=270 if b['id']=='r2-ac' else 90;e['dimensions']['width'],e['dimensions']['depth']=e['dimensions']['depth'],e['dimensions']['width']
        if b['id']=='living-tv':e['rotation']=270;e['dimensions']['width'],e['dimensions']['depth']=e['dimensions']['depth'],e['dimensions']['width']
        if b['id'] in APPLIANCE_COLORS:e['material']='metal'
        if b['id']=='counter-left':e['rotation']=90;e['dimensions']['width'],e['dimensions']['depth']=e['dimensions']['depth'],e['dimensions']['width']
        if b['id']=='counter-right':e['rotation']=270;e['dimensions']['width'],e['dimensions']['depth']=e['dimensions']['depth'],e['dimensions']['width']
        els.append(e)
    for h in m['openings']:
        w=next(w for w in m['walls'] if w['id']==h['wall']);along=w['w']>w['d'];L=max(w['w'],w['d']);a=h['start']+h['width']/2
        b=dict(id=h['id'],kind='window' if h['kind'] in ('window','access') else 'door',x=w['x']+(a-h['width']/2 if along else 0),y=w['y']+(0 if along else a-h['width']/2),w=h['width'] if along else w['w'],d=w['d'] if along else h['width'],h=h['height'],z=h['sill'])
        e=elem(b);e['dimensions']=dict(width=h['width']*u,height=h['height']*u,depth=9*u);e['rotation']=0 if along else 270;e['wallAttachment']=dict(wallId=w['id'],offset=(a-L/2)*u);e['doorSwing']=(-1 if h['id'] in ('D01','D02','D03','D05','D07','D08') else 1);e['doorSide']=(-1 if w['id'] in ('room-cross','front') or h['id']=='D02' else 1);e['name']=h['id']+' '+h['direction']+' (proposed size / offset)'
        # Open passage and wardrobe recess represented by unobtrusive transparent window inserts.
        if h['kind'] in ('passage','access'):e['kind']='window';e['material']='glass';e['apertureOnly']=True
        els.append(e)
    rooms=[dict(id=r['id'],name=r['name'],subtitle=r['basis'],center=[(r['x']+r['w']/2-W/2)*u,(r['y']+r['d']/2-H/2)*u],width=r['w']*u,depth=r['d']*u,color='#eeeade') for r in m['rooms']]
    # Court included in floor boundary, kept separate via room label and measured house perimeter.
    rooms.append(dict(id='court',name='Open front court',subtitle='Proposed placement; calculated '+ft(m['court']),center=[0,(H/2+m['court']/2)*u],width=W*u,depth=m['court']*u,color='#d9dfd4'))
    return dict(version=1,name='Measured family house - 25 ft x 54 ft site',elements=els,rooms=rooms,floorPlan=dict(outline=[[-W/2*u,-H/2*u],[W/2*u,-H/2*u],[W/2*u,(648-H/2)*u],[-W/2*u,(648-H/2)*u]],wallHeight=108*u,wallThickness=9*u))


def pdf(m,out,images):
    p=m['proposed'];st=m['stair']
    c=canvas.Canvas(str(out),pagesize=(842,1191));c.setTitle('Ghar Naksha - measured sketch house')
    def header(title):c.setFillColorRGB(.12,.25,.2);c.setFont('Helvetica-Bold',22);c.drawString(42,1140,title)
    def footer(n):c.setFont('Helvetica',10);c.drawString(42,30,f'Ghar Naksha | dimensions in feet + inches; model in inches | page {n}')
    header('Dimensioned floor plan');c.drawImage(ImageReader(str(images[0])),50,65,width=742,height=1050,preserveAspectRatio=True,anchor='c');footer(1);c.showPage()
    header('Dimension ledger and design assumptions');y=1080
    rows=[('FROM SKETCH / USER','Site: 25 ft x 54 ft. All walls: 9 in. Building wall height: 9 ft.'),('FROM SKETCH / USER','Clear bands: 5 ft; 12 ft; 15 ft; 14 ft.'),('FROM SKETCH / USER','Bath 6 ft x 5 ft; WC 4 ft x 5 ft; WC enclosure 6 ft 6 in high.'),('FROM SKETCH / USER','Kitchen 4 ft x 15 ft; Room 3 12 ft x 14 ft; temple 3 ft high.'),('CALCULATED','Inside width: 23 ft 6 in. Room 1 / 2: 11 ft 4.5 in each.'),('CALCULATED','Room clear bands 46 ft + five 9 in walls = 49 ft 9 in.'),('CALCULATED','54 ft site minus 49 ft 9 in footprint = 4 ft 3 in court.'),('CALCULATED','Utility lobby 12 ft x 5 ft; front right hall 10 ft 9 in x 14 ft.'),('PROPOSED','Court placed at front. Kitchen open to living; no extra partition.'),('FROM USER',f"Temple niche 2 ft wide x {ft(p['temple_depth'])} deep beneath 4 ft return; height 3 ft; wardrobe height proposed {ft(p['wardrobe_height'])}."),('PROPOSED',f"Wardrobe at z=3 ft on temple; full 4 ft x {ft(p['temple_depth'])} return footprint."),('PROPOSED','Wardrobe recess A01 faces Room 1; shrine opens toward living and kitchen; 1 in separator proposed.'),('FROM USER','2 ft counter along left wall with 4 ft returns at Room 1 and Room 3; sink toward temple.'),('CALCULATED','Kitchen aisle: 2 ft within kitchen + open living; protected open width 5 ft.'),('PROPOSED',f"WC loft: 4 ft x 5 ft x {ft(p['wc_storage_height'])}; base {ft(78+p['wc_storage_shelf'])}; hatch S01 to lobby."),('PROPOSED',f"Floor-to-floor {ft(p['floor_height'])}; slab {ft(p['slab'])}; upper roof underside {ft(p['floor_height']+108)}."),('CALCULATED',f"{st['risers']} risers @ {st['riser']:g} in; {st['risers']//2-1} independent goings per flight @ {st['tread']:g} in."),('PROPOSED',f"Flights {ft(st['flight_width'])} clear; landing {ft(st['landing'])}; stair {ft(st['w'])} x {ft(st['d'])}."),('PROPOSED','Straight sloping underside, proposed 1 ft vertical waist; full shaft void; headroom 9 ft.'),('FROM USER','Start from living on right-wall flight; return on left; no separating wall.'),('PROPOSED',f"Arrival platform {ft(p['floor_height'])}; approach underneath {ft(p['floor_height']-p['slab'])}."),('PROPOSED','Scaled appliances: fridge, washer, microwave, chimney, purifier, TV, geyser, AC, fans and lights.'),('LIMIT','No north direction supplied. Structural supports / lintels require design.'),('CHECKS','Dimensions, 9 in walls, openings, stair fit and aisle checks passed.')]
    for label,line in rows:
        c.setFont('Helvetica-Bold',10);c.drawString(42,y,label);c.setFont('Helvetica',12);c.drawString(42,y-20,line);y-=41
    footer(2);c.showPage();header('Opening schedule - exact sizes / offsets PROPOSED');y=1080
    c.setFont('Helvetica',11);c.drawString(42,y,'Coordinates: inches from rear-left site corner; offset from wall start.');y-=30
    for h in m['openings']:
        w=next(w for w in m['walls'] if w['id']==h['wall']);along=w['w']>w['d'];x=w['x']+(h['start'] if along else w['w']/2);yy=w['y']+(w['d']/2 if along else h['start'])
        swing=(' | hinge '+('high' if h['id'] in ('D01','D02','D03','D05','D07','D08') else 'low')+' offset; 90 deg') if h['kind']=='door' else ''
        c.setFont('Helvetica-Bold',12);c.drawString(42,y,f"{h['id']} | {h['wall']} | {h['kind']} | {h['direction']}{swing}");y-=18;c.setFont('Helvetica',11)
        c.drawString(42,y,f"Width {ft(h['width'])}; height {ft(h['height'])}; sill {ft(h['sill'])}; offset {ft(h['start'])}; start x={x:g}, y={yy:g} in");y-=18
        c.drawString(42,y,h['basis']);y-=29
    footer(3);c.showPage()
    for i,img in enumerate(images[1:]):
        header(f'{i+1:02d} - {THEMES[i][0]}');c.drawImage(ImageReader(str(img)),25,175,width=792,height=707,preserveAspectRatio=True)
        c.setFont('Helvetica',12);c.drawString(42,115,'Full-height translucent cuboids expose the layout; actual apertures removed from walls.')
        c.drawString(42,92,'Finish palette changes only; geometry and furniture positions are identical across options.')
        footer(i+4);c.showPage()
    c.save()


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'public/measured-house');ap.add_argument('--parameters',type=Path);args=ap.parse_args()
    p=json.loads(args.parameters.read_text()) if args.parameters else {};m=build(p);out=args.output;out.mkdir(parents=True,exist_ok=True)
    images=[out/'floor-plan.png']+[out/f'option-{i+1:02}.png' for i in range(10)]
    plan(m,images[0])
    for i,path in enumerate(images[1:]):iso(m,i,path)
    pdf(m,out/'house-design.pdf',images)
    (out/'geometry-inches.json').write_text(json.dumps(m,indent=2));(out/'project.json').write_text(json.dumps(app_project(m),indent=2))
    (out/'generate_house.py').write_text(Path(__file__).read_text())
    readme=Path(__file__).with_name('README.md')
    if readme.exists() and readme.resolve()!=(out/'README.md').resolve(): (out/'README.md').write_text(readme.read_text())
    with zipfile.ZipFile(out/'house-design-bundle.zip','w',zipfile.ZIP_DEFLATED) as z:
        for file in sorted(out.iterdir()):
            if file.suffix in ('.png','.pdf','.json','.py','.md'):z.write(file,file.name)
    print('PASS: footprint 300 x 597 in; site 300 x 648 in; court 51 in; room widths 136.5 in; all walls 9 in; apertures and stair close.')
if __name__=='__main__':main()
