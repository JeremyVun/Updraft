// Exact numerical parity with the pre-refactor camera. BASELINE_REF can select a different baseline commit.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import { importBaseline, baselineRevision } from './lib/baseline.mjs';
import { Vector3 } from 'three';
globalThis.location={search:'?shot'};
const {CameraRig}=await import('../src/camera.ts');
const {CameraRig:Before}=await importBaseline('src/camera.ts');
let frames=0;
for(const [width,height] of [[1600,900],[390,844],[320,900]])for(const fps of [10,30,60,120]){
 const a=new CameraRig(),b=new Before();a.resize(width,height);b.resize(width,height);
 const primary=new Vector3(-20,5,-20),secondary=new Vector3(2,6,-23),tertiary=new Vector3(-8,10,-25);
 const shot={target:primary,distance:18,height:5,carry:true,subjects:{primary,secondary,margin:.75,extra:12}};
 a.cut(shot);b.cut(shot);
 for(let i=0;i<600;i++){
  primary.x=-20+Math.sin(i*.013)*4;secondary.x=primary.x+Math.cos(i*.019)*35;tertiary.z=-25-Math.sin(i*.021)*15;
  shot.subjects=i%110<90?{primary,secondary,tertiary:i%70<35?tertiary:undefined,margin:.75,extra:12}:undefined;
  shot.smoothFit=i%160<80?3:undefined;
  if(i===300){a.resize(height,width);b.resize(height,width);}
  a.update(1/fps,i/fps,shot,.6);b.update(1/fps,i/fps,shot,.6);
  assert.deepEqual(a.camera.position.toArray(),b.camera.position.toArray());
  assert.deepEqual(a.camera.matrixWorld.elements,b.camera.matrixWorld.elements);
  frames++;
 }
}
console.log(`Camera parity: ${frames} frames match ${baselineRevision} exactly across subjects, fit easing, portrait, rotation and 10–120 Hz.`);
