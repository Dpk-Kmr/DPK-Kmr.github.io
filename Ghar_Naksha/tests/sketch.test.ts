import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { adaptSketch } from '../src/components/SketchDesign';
import { getWallSegments } from '../src/lib/openings';
import type { Project } from '../src/types';
const preset=JSON.parse(readFileSync(new URL('../public/measured-house/project.json',import.meta.url),'utf8')) as Project;
describe('measured sketch preset',()=>{
 it('loads through validation with real wall apertures and exact solid steps',()=>{
   const p=adaptSketch(preset,24,60,24,120,0);
   const walls=p.elements.filter(e=>e.kind==='wall');
   expect(walls.every(e=>Math.abs(Math.min(e.dimensions.width,e.dimensions.depth)-9*.0254)<1e-9)).toBe(true);
   const front=walls.find(e=>e.id==='front')!;
   const solids=getWallSegments(front,p.elements);
   const volume=solids.reduce((v,b)=>v+b.dimensions.width*b.dimensions.height*b.dimensions.depth,0);
   expect(volume).toBeLessThan(front.dimensions.width*front.dimensions.height*front.dimensions.depth);
   expect(p.elements.filter(e=>e.id.startsWith('stair-low-'))).toHaveLength(9);
   expect(p.elements.find(e=>e.id==='P01')).toBeUndefined();
   expect(p.elements.find(e=>e.id==='front-cross')?.dimensions.width).toBe(153*.0254);
   const low=p.elements.find(e=>e.id==='stair-low-1')!;
   expect(low.position[0]).toBe((255+18-150)*.0254);
   expect(low.position[2]).toBe((420+5-597/2)*.0254);
   expect(p.elements.find(e=>e.id==='S01')?.apertureOnly).toBe(true);
   expect(p.elements.find(e=>e.id==='wc-storage-shelf')?.position[1]).toBe(78*.0254);
 });
 it('rejects blocked aisle, oversized wardrobe and invalid proposed inputs',()=>{
   expect(()=>adaptSketch(preset,24,60,25,120,0)).toThrow('counter');
   expect(()=>adaptSketch(preset,24,73,24,120,0)).toThrow('Wardrobe');
   expect(()=>adaptSketch(preset,NaN,60,24,120,0)).toThrow('finite');
 });
 it('keeps a three-wall open counter, temple-side sink and editable lobby storage aperture',()=>{
   const p=adaptSketch(preset,24,60,24,120,0,18);
   expect(p.elements.find(e=>e.id==='S01')?.dimensions.height).toBe(18*.0254);
   expect(p.elements.find(e=>e.id==='S01')?.position[1]).toBe(81*.0254);
   for(const id of ['counter-rear','counter-front'])expect(p.elements.find(e=>e.id===id)?.dimensions.width).toBe(48*.0254);
   expect(p.elements.find(e=>e.id==='counter-single')?.dimensions.depth).toBe(24*.0254);
   expect(p.elements.find(e=>e.id==='kitchen-sink')?.position[2]).toBe((255+12-597/2)*.0254);
   expect(()=>adaptSketch(preset,24,60,24,120,0,28)).toThrow('storage');
 });
 it('changes finishes without moving any geometry; edit parameters preserve shared footprint',()=>{
   const a=adaptSketch(preset,24,60,24,120,0),b=adaptSketch(preset,24,60,24,120,9);
   expect(a.elements.map(e=>[e.position,e.dimensions])).toEqual(b.elements.map(e=>[e.position,e.dimensions]));
   const p=adaptSketch(preset,24,54,24,132,2);
   const t=p.elements.find(e=>e.id==='temple')!,w=p.elements.find(e=>e.id==='r1-wardrobe')!;
   expect(t.position[2]).toBe(w.position[2]);expect(t.dimensions.depth).toBe(w.dimensions.depth);
   expect(p.elements.find(e=>e.id==='stair-low-1')?.dimensions.height).toBe(6.6*.0254);
 });
});
