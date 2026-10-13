import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../types';
import { validateProject } from '../lib/project';
import './SketchDesign.css';

const themes = [
 ['Warm Indian teak','#efe2cc','#ab6d37','#cfa168'], ['Jaipur terracotta','#f3d7c7','#b65438','#e9b287'],
 ['Kerala timber','#e9e5d4','#604635','#ab8556'], ['Coastal indigo','#e5edf0','#365a86','#d0bc97'],
 ['Modern monochrome','#e6e6e4','#41464b','#b5b6b4'], ['Sage courtyard','#e6eadd','#72815b','#bdac87'],
 ['Royal maroon brass','#efe0cf','#793d51','#cfa755'], ['Limewash minimal','#f5eee2','#b5a794','#d6c9b7'],
 ['Gujarati bright craft','#f7e6c4','#d39825','#c17745'], ['Deccan charcoal copper','#d9d9d2','#4e5556','#b77950'],
];
export function adaptSketch(base: Project, depth: number, wardrobe: number, counter: number, floorHeight: number, theme: number, storageOpening = 24): Project {
 if (![depth,wardrobe,counter,floorHeight,storageOpening].every(Number.isFinite)) throw new Error('Enter finite dimensions.');
 if (depth!==24) throw new Error('Temple length must remain 24 in to match the Room 1 counter return.');
 if (wardrobe<=0 || wardrobe>72) throw new Error('Wardrobe must fit above the 36 in temple under 108 in walls.');
 if (counter!==24) throw new Error('Slab counter depth must remain 24 in.');
 if (floorHeight<108 || floorHeight>144) throw new Error('Floor-to-floor must be 108–144 in (20 consistent risers).');
 if (storageOpening<12 || storageOpening>27) throw new Error('WC storage opening height must be 12–27 in.');
 const p=structuredClone(base); const u=.0254; const palette=themes[theme] ?? themes[0];
 p.elements=p.elements.map(e=>{
   const originalColor=e.color;
   if(e.kind==='wall')e.color=palette[1];
   else if(['bed','sofa','chair'].includes(e.kind))e.color=palette[2];
   else e.color=palette[3];
   if(e.id.endsWith('-ac')||e.id.endsWith('-fan')||e.id.endsWith('-light')||['refrigerator','washing-machine','microwave','chimney','water-purifier','living-tv','bath-geyser'].includes(e.id))e.color=originalColor;
   if(e.id==='temple'||e.id==='r1-wardrobe') {
     e.dimensions.depth=depth*u; e.position[2]=(231+depth/2-597/2)*u;
     if(e.id==='r1-wardrobe')e.dimensions.height=wardrobe*u;
   }
   if(e.id==='A01')e.dimensions.height=wardrobe*u;
   if(e.id==='S01')e.dimensions.height=storageOpening*u;
   const ky=231+depth;
   if(e.id==='counter-single') {
     e.dimensions.width=(180-2*counter)*u;e.dimensions.depth=24*u;
     e.position[0]=(21-150)*u;e.position[2]=(ky+(180-2*counter)/2-597/2)*u;e.rotation=90;
   }
   if(e.id==='kitchen-sink') {e.position[0]=(21-150)*u;e.position[2]=(ky+12-597/2)*u;}
   if(e.id==='cooktop') {e.position[2]=(ky+46-597/2)*u;e.color='#34443e';e.material='metal';}
   if(e.id==='chimney')e.position[2]=(ky+46-597/2)*u;
   if(e.id==='water-purifier')e.position[2]=(ky+7-597/2)*u;
   if(/^stair-(low|high)-[0-9]+$/.test(e.id)) {
     const n=Number(e.id.split('-').at(-1))+(e.id.startsWith('stair-high-')?10:0);
     const top=n*floorHeight/20, bottom=Math.max(0,top-12-floorHeight/20);
     e.position[1]=bottom*u;e.dimensions.height=(top-bottom)*u;
   }
   if(e.id==='stair-landing')e.position[1]=(floorHeight/2-6)*u;
   if(e.id==='upper-arrival')e.position[1]=(floorHeight-6)*u;
   return e;
 });
 p.name=`Sketch house · ${palette[0]}`;
 return validateProject(p);
}

export default function SketchDesign({onApply}: {onApply:(p:Project)=>void}) {
 const [open,setOpen]=useState(false);const [theme,setTheme]=useState(0);
 const [depth,setDepth]=useState(24);const [wardrobe,setWardrobe]=useState(60);
 const counter=24;const [floorHeight,setFloorHeight]=useState(120);
 const [storageOpening,setStorageOpening]=useState(24);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const url=(f:string)=>`${import.meta.env.BASE_URL}measured-house/${f}`;
 async function apply() {
   setBusy(true);setError('');
   try {const response=await fetch(url('project.json'));if(!response.ok)throw new Error('Could not load measured preset.');const p=adaptSketch(await response.json(),depth,wardrobe,counter,floorHeight,theme,storageOpening);onApply(p);setOpen(false);}
   catch(e){setError(e instanceof Error?e.message:'Could not load measured design.');}finally{setBusy(false);}
 }
 function parameters() {
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({temple_depth:depth,wardrobe_height:wardrobe,counter_depth:counter,floor_height:floorHeight,wc_storage_opening_height:storageOpening},null,2)],{type:'application/json'}));a.download='house-parameters.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }
 return <>
 <button className="button button-outline" onClick={()=>setOpen(true)}>Sketch house</button>
 {open && createPortal(<div className="sketch-overlay" onClick={()=>setOpen(false)}><section role="dialog" aria-modal="true" aria-label="Measured sketch house" className="sketch-panel" onClick={e=>e.stopPropagation()}>
   <div className="sketch-heading"><div><small>25 FT × 54 FT SITE</small><h2>Your sketch, measured.</h2></div><button aria-label="Close sketch house" onClick={()=>setOpen(false)}>×</button></div>
   <p>Rear service → Room 1 / 2 → kitchen / living → Room 3 / stair. All walls are editable 9-inch cuboids with real opening gaps.</p>
   <div className="sketch-ledger"><span><b>49′ 9″</b>enclosed depth</span><span><b>4′ 3″</b>front court · proposed</span><span><b>11′ 4½″</b>Room 1 / 2 width · calculated</span></div>
   <div className="sketch-body"><a href={url('floor-plan.png')} target="_blank" rel="noreferrer"><img src={url('floor-plan.png')} alt="Dimensioned sketch house floor plan"/></a><div>
     <h3>Editable dimensions <small>inches</small></h3><p className="sketch-note">Temple niche: 2 ft × 2 ft beneath the 4 ft return; overall height 3 ft. Kitchen: 4 ft wide, 15 ft deep, with a 2 ft counter on three walls and 4 ft returns.</p>
     {([['Temple length',depth,setDepth],['Wardrobe height',wardrobe,setWardrobe],['Floor-to-floor height',floorHeight,setFloorHeight],['WC storage opening height',storageOpening,setStorageOpening]] as const).map(([label,value,set])=><label className="sketch-field" key={label}>{label}<input type="number" value={value} onChange={e=>set(Number(e.target.value))}/></label>)}
     <p className="sketch-note">Temple occupies the living-side 2 ft beneath the 4 ft Room 1 return, with kitchen storage on the wall side and a proposed 1-inch separator. It opens toward living and kitchen; wardrobe spans the full return and faces Room 1. Kitchen has 24 in clear width beside the side-wall counter, extended into open living for circulation. Sink is closest to the temple. Stair starts from living beside the right exterior wall, with no separating wall. Stair: 20 risers × {floorHeight/20} in, 9 goings per flight × 10 in. Full open shaft; proposed upper roof remains 108 in above arrival. WC storage above the 6 ft 6 in enclosure: proposed 4 ft × 5 ft × 2 ft 3 in, accessed from the utility lobby.</p>
     <label className="sketch-field">Finish theme<select value={theme} onChange={e=>setTheme(Number(e.target.value))}>{themes.map(([name],i)=><option key={name} value={i}>{String(i+1).padStart(2,'0')} · {name}</option>)}</select></label>
     <a href={url(`option-${String(theme+1).padStart(2,'0')}.png`)} target="_blank" rel="noreferrer"><img className="sketch-theme" src={url(`option-${String(theme+1).padStart(2,'0')}.png`)} alt={`${themes[theme][0]} measured isometric option`}/></a>
   </div></div>
   <p className="sketch-note">Apply loads this preset into the editor; Undo restores your previous project. Select any wall or block to edit length, thickness, height and position. Freeform edits can depart from the fixed sketch. Downloads show the default measured design; export parameters and rerun Python for revised PNGs / PDF.</p>
   {error&&<p role="alert" className="sketch-error">{error}</p>}
   <div className="sketch-actions"><a href={url('house-design-bundle.zip')} download>All files · ZIP</a><a href={url('floor-plan.png')} download>Plan PNG</a><a href={url(`option-${String(theme+1).padStart(2,'0')}.png`)} download>Selected 3D PNG</a><a href={url('house-design.pdf')} download>PDF · plan + schedule + 10 views</a><a href={url('generate_house.py')} download>Python source</a><a href={url('README.md')} download>Assumptions / regenerate</a><button onClick={parameters}>Export parameters</button><button className="button button-primary" disabled={busy} onClick={apply}>{busy?'Loading…':'Apply measured design'}</button></div>
 </section></div>, document.body)}
 </>;
}
