// Capture every fixed berth and representative landing, checking the mesh against CPU and rendered terrain.
// BASE selects a dev server. Captures and report go to /tmp/updraft-boat-shores-*.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const lock = '/tmp/updraft-chromium.lock';
for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let holder = 0;
    try { holder = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    let alive = true;
    if (holder) { try { process.kill(holder, 0); } catch { alive = false; } }
    if (holder && !alive) fs.rmSync(lock, { recursive: true, force: true });
    else await new Promise(resolve => setTimeout(resolve, 400));
  }
}

let browser;
const report = [], errors = [];
try {
  browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
    args:['--enable-gpu','--use-angle=metal','--ignore-gpu-blocklist']});
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  page.on('pageerror', e=>errors.push(e.message));
  const cases = [
    ['opening',8.5,21.5,0.95,false], ['lines-departure',240,-483.5,0.1,false],
    ['meadow-departure',-2/3,-974-2/3,0.2,false], ['birches-departure',-4,-1197,0.15,false],
    ['wood-departure',-34,-1908,0.2,false], ['sleeping-departure',-214.5,-1926,-1.76,false],
    ['home',-45.3,-1926.25,Math.PI/2,true],
    ['lines-arrival',14.08,-304.83,Math.PI,true], ['meadow-arrival',10,-583.98,Math.PI,true],
    ['birches-arrival',3.1,-1050.5,Math.PI,true], ['wood-arrival',-26,-1692.1,Math.PI,true],
    ['sleeping-arrival',-132,-1916.4,-Math.PI/2,true],
  ];
  for(const [name,x,z,yaw,afloat] of cases) {
    const fx=Math.sin(yaw),fz=Math.cos(yaw);
    const cam=[x+Math.cos(yaw)*9-fx*6,5.5,z-Math.sin(yaw)*9-fz*6,x,1.4,z];
    await page.goto(`${process.env.BASE??'http://127.0.0.1:5230/'}?shot&chapter=stage&dusk=0&cam=${cam}`);
    await page.waitForFunction(()=>window.__ready,null,{timeout:60000});
    await page.evaluate(({x,z,yaw,afloat})=>{
      const g=__game;g.child.visible=false;g.cygnet.visible=false;g.glider.visible=false;
      g.boat.beach(x,z,yaw);g.boat.afloat=afloat;g.boat.grounded=true;g.boat.steerFor=null;
    },{x,z,yaw,afloat});
    await page.waitForTimeout(800);
    const result=await page.evaluate(async()=>{
      const {heightAt}=await import('/src/world/island.ts');
      const g=__game,b=g.boat,q=b.position.clone(),a=b.group.children[0].geometry.attributes.position;
      const nodes=g.terrain.mesh.geometry.attributes.aNode,n=g.terrain.mesh.geometry.instanceCount;
      function rendered(x,z){
        for(let i=0;i<n;i++){
          const nx=nodes.getX(i),nz=nodes.getY(i),size=nodes.getZ(i);
          if(x<nx||x>nx+size||z<nz||z>nz+size)continue;
          const step=size/32,ox=Math.floor(x/step)*step,oz=Math.floor(z/step)*step;
          const u=(x-ox)/step,v=(z-oz)/step;
          const h00=heightAt(ox,oz),h10=heightAt(ox+step,oz),h01=heightAt(ox,oz+step),h11=heightAt(ox+step,oz+step);
          // Terrain uses the diagonal from (0,1) to (1,0).
          return u+v<1?h00+(h10-h00)*u+(h01-h00)*v:h11+(h01-h11)*(1-u)+(h10-h11)*(1-v);
        }
        return heightAt(x,z);
      }
      let cpu=Infinity,mesh=Infinity;
      for(let i=0;i<a.count;i++){
        q.fromBufferAttribute(a,i).applyMatrix4(b.group.matrixWorld);
        cpu=Math.min(cpu,q.y-heightAt(q.x,q.z));mesh=Math.min(mesh,q.y-rendered(q.x,q.z));
      }
      const start=performance.now();for(let i=0;i<200;i++)b.update(1/60,i/60);
      return {cpu,mesh,position:b.position.toArray(),pitch:b.pitch,roll:b.roll,updateMs:(performance.now()-start)/200};
    });
    await page.screenshot({path:`/tmp/updraft-boat-shores-${name}.png`});
    report.push({name,...result});console.log(JSON.stringify(report.at(-1)));
  }
  fs.writeFileSync('/tmp/updraft-boat-shores-report.json',JSON.stringify({report,errors},null,2));
  assert.deepEqual(errors,[]);
  assert(report.every(r=>r.cpu>=-0.015&&r.mesh>=-0.03),'hull must clear both sampled and rendered ground');
} finally { await browser?.close();fs.rmSync(lock,{recursive:true,force:true}); }
