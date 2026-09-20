import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import {transformSync} from 'rolldown/utils';
registerHooks({resolve(s,c,n){return n(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c)},load(u,c,n){return u.endsWith('.ts')?{format:'module',shortCircuit:true,source:transformSync(new URL(u).pathname,fs.readFileSync(new URL(u),'utf8')).code}:n(u,c)}});
const {WindClock}=await import('../src/wind/clock.ts');
for (const fps of [10,15,20,30,60,90,120,144,240]) {
 const clock=new WindClock();let ticks=0,weight=0,impulses=0,last=0;
 for(let f=0;f<fps*3;f++) clock.advance(1/fps,(f+1)/fps,[{energy:1},...(f===0?[{impulse:true}]:[])],(time,inputs)=>{
  ticks++;assert(Math.abs(time-ticks/60)<1e-8);last=time;
  for(const s of inputs) s.splat.impulse?impulses+=s.weight:weight+=s.weight;
 });
 assert.equal(ticks,180);assert(Math.abs(weight-180)<1e-8);assert.equal(impulses,1);assert(Math.abs(last-3)<1e-8);
}
const clock=new WindClock();let retained=[];
assert.equal(clock.advance(1/120,1/120,[{energy:7}],()=>assert.fail()),0);
clock.advance(1/120,1/60,[],(_,inputs)=>retained=inputs);
assert.equal(retained[0].splat.energy,7);assert.equal(retained[0].weight,.5);
assert.equal(new WindClock().advance(10,10,[],()=>{}),6,'stall catch-up is bounded');
console.log('Wind clock: 10–240 Hz, elapsed time, sustained exposure, single impulses, retained input and bounded stalls passed.');
const splat={source:'stroke',trail:true,ax:0,az:0,bx:2,bz:4,vx:3,vz:1,radius:2,energy:.5,lift:1,swirl:0};
let samples=[];
new WindClock().advance(1/30,1/30,[splat],(t,s)=>samples.push(s));
assert.deepEqual(samples.map(s=>[s[0].splat.ax,s[0].splat.bx,s[0].weight]),[[0,1,1],[1,2,1]]);
const fast=new WindClock();samples=[];
fast.advance(1/120,1/120,[{...splat,bx:1,bz:2}],()=>assert.fail());
fast.advance(1/120,1/60,[{...splat,ax:1,az:2}],(_,s)=>samples=s);
assert.equal(samples.length,1);assert.deepEqual(samples[0],{splat,weight:1});
const crowded=Array.from({length:13},(_,i)=>({...splat,source:`source-${i}`}));
new WindClock().advance(1/60,1/60,crowded,(_,s)=>assert.equal(s.length,13));
const mixed=new WindClock();let elapsed=0,mixedTicks=0;
for(let i=0;i<600;i++){const dt=[1/30,1/144,1/90,1/60][i%4];elapsed+=dt;mixed.advance(dt,elapsed,[],()=>mixedTicks++)}
assert.equal(mixedTicks,Math.floor(elapsed*60+1e-8));
console.log('Stroke resampling, independent sources beyond eight, and changing frame rates passed.');
