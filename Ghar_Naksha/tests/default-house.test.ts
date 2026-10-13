import {describe,it,expect} from 'vitest';
import {initialProject,courtyardProject} from '../src/data';
import {matchesStarter,migrateMeasuredDefault,validateProject} from '../src/lib/project';
import {makeWalkWorld,moveWalker,spawnWalker,bodyBlocked} from '../src/lib/walkthrough';
describe('measured default house',()=>{
 it('upgrades the old named default once, backs it up and preserves current or renamed projects',()=>{
   const store=new Map<string,string>();
   const oldStorage=globalThis.localStorage;
   Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:(k:string,v:string)=>store.set(k,v)}});
   try {
     const old=structuredClone(initialProject);old.rooms.find(r=>r.id==='living')!.depth=126*.0254;
     expect(migrateMeasuredDefault(old,initialProject).rooms.find(r=>r.id==='living')!.depth).toBe(180*.0254);
     expect(JSON.parse(store.get('ghar-naksha-before-default-upgrade-v2')!).rooms.find((r:{id:string})=>r.id==='living').depth).toBe(126*.0254);
     expect(migrateMeasuredDefault(initialProject,initialProject)).toBe(initialProject);
     const empty=structuredClone(initialProject);empty.elements=[];empty.rooms=[];
     expect(migrateMeasuredDefault(empty,initialProject).elements.length).toBe(initialProject.elements.length);
     const hidden=structuredClone(initialProject);hidden.elements.forEach(e=>e.visible=false);
     expect(migrateMeasuredDefault(hidden,initialProject).elements.some(e=>e.visible)).toBe(true);
     old.name='My new home';expect(migrateMeasuredDefault(old,initialProject).name).toBe(initialProject.name);
     old.name='My edited house';expect(migrateMeasuredDefault(old,initialProject)).toBe(old);
   } finally {Object.defineProperty(globalThis,'localStorage',{configurable:true,value:oldStorage});}
 });
 it('uses the 4 ft temple and appliances as its default and detects only untouched starters',()=>{
   const p=validateProject(initialProject),t=p.elements.find(e=>e.id==='temple')!;
   expect(t.dimensions).toEqual({width:24*.0254,depth:24*.0254,height:36*.0254});
   for(const id of ['refrigerator','washing-machine','microwave','chimney','water-purifier','living-tv','r1-fan'])expect(p.elements.some(e=>e.id===id)).toBe(true);
   expect(matchesStarter(validateProject(courtyardProject),courtyardProject)).toBe(true);
   const changed=structuredClone(courtyardProject);changed.elements[0].color='#abcdef';expect(matchesStarter(changed,courtyardProject)).toBe(false);
   expect(matchesStarter(p,courtyardProject)).toBe(false);
   const f=p.elements.find(e=>e.id==='refrigerator')!;expect(f.position[2]).toBe((397.5-298.5)*.0254);
   expect(p.rooms.find(r=>r.id==='living')?.depth).toBe(180*.0254);
 });
 it('spawns safely, blocks appliances and climbs both exact cuboid flights',()=>{
   const p=validateProject(initialProject),world=makeWalkWorld(p);
   const spawn=spawnWalker(world,'ground-floor',1.75);expect(bodyBlocked(world,spawn.x,spawn.y,spawn.z,1.75)).toBe(false);
   const fridge=p.elements.find(e=>e.id==='refrigerator')!;expect(bodyBlocked(world,fridge.position[0],0,fridge.position[2],1.75)).toBe(true);
   const point=(x:number,y:number)=>({x:(x-150)*.0254,z:(y-298.5)*.0254});
   let pos={...point(273,404),y:0,levelId:'ground-floor'};
   const targets=[...Array.from({length:9},(_,i)=>[273,425+i*10]),[273,528],[231,528],...Array.from({length:9},(_,i)=>[231,505-i*10]),[231,402]];
   for(const [x,y] of targets){const target=point(x,y);pos=moveWalker(world,pos,target.x-pos.x,target.z-pos.z,1.75);expect(pos.x).toBeCloseTo(target.x,2);expect(pos.z).toBeCloseTo(target.z,2);}
   expect(pos.y).toBeCloseTo(120*.0254,5);
   const under=point(231,425);expect(bodyBlocked(world,under.x,0,under.z,1.75)).toBe(false);
   const lower=point(273,465);expect(bodyBlocked(world,lower.x,0,lower.z,1.75)).toBe(true);
 });
});
