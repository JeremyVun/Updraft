// Checks the static field cache over its whole domain, including boundaries and gates.
// Browser shader compilation, one-time bake cost, and dynamic colour-state comparisons.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1376,height:1032},deviceScaleFactor:2});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
  await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await page.route('**/src/main.ts*',async route=>{
    const response=await route.fetch();let source=await response.text();
    const hook='function frame(now) {';assert(source.includes(hook));
    source=source.replace(hook,hook+' if(window.__fieldsPaused){requestAnimationFrame(frame);return;}');
    source+=`\nwindow.__fieldsTest={THREE,atmo,draw:()=>post.render(time)};`;
    await route.fulfill({response,body:source});
  });
  await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+'?shot&chapter=meadow&ratio=1.5&msaa=2&analytics=0&progress=0');
  await page.waitForFunction(()=>window.__ready,null,{timeout:120000});
  await page.evaluate(()=>{__game.story.current.skipToCrest();__game.story.current.reveal();});
  await page.waitForTimeout(1500);
  const result=await page.evaluate(async()=>{
    window.__fieldsPaused=true;
    const {THREE,atmo,draw}=__fieldsTest,{renderer,terrain,grass}=__game;
    const {GpuRunner,simMaterial,simTarget}=await import('/src/gl/gpu.ts');
    const {HEIGHTFIELD_GLSL}=await import('/src/world/heightfield.ts');
    const {FIELDS_GLSL}=await import('/src/world/fields.ts');
    const {TERRAIN_FIELDS_GLSL}=await import('/src/world/terrain-fields.ts');
    const fields=terrain.fields,gpu=new GpuRunner(renderer),gl=renderer.getContext();
    async function complete(){const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();const end=performance.now()+20000;
      try{for(;;){const s=gl.clientWaitSync(fence,0,0);if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)return;
        if(s===gl.WAIT_FAILED||performance.now()>end)throw Error('GPU completion timeout');await new Promise(r=>setTimeout(r,0));}}
      finally{gl.deleteSync(fence);}}
    // Compare the actual field colour weights and wall mask, not categorical values outside their region.
    const material=simMaterial(HEIGHTFIELD_GLSL+FIELDS_GLSL+TERRAIN_FIELDS_GLSL+`
      uniform vec2 uOffset; uniform float uLineWidth; in vec2 vUv;
      vec3 palette(vec4 f) {
        vec3 c=vec3(0.2,0.3,0.1)*(0.92+0.16*fract(f.y*7.3)*f.w);
        c=mix(c,vec3(0.62,0.52,0.2),step(f.y,0.22)*f.w*0.55);
        return mix(c,vec3(0.13,0.24,0.1),step(0.86,f.y)*f.w*0.5);
      }
      float wall(vec4 f){return (1.0-smoothstep(uLineWidth*0.45,uLineWidth,f.x))*f.z*f.w;}
      void main(){vec2 p=uTerrainFieldDomain.xy+(vUv+uOffset)/uTerrainFieldDomain.zw;
        vec4 a=fieldAt(p),b=terrainFieldAt(p,uLineWidth);
        gl_FragColor=vec4(abs(palette(a)-palette(b)),abs(wall(a)-wall(b)));}
    `,{...fields.uniforms,uOffset:{value:new THREE.Vector2()},uLineWidth:{value:0.5}});
    const target=simTarget(1024,1024,THREE.FloatType,THREE.NearestFilter),data=new Float32Array(1024*1024*4),grids=[];
    for(const width of [.5,1,2]) {
      material.uniforms.uLineWidth.value=width;
      material.uniforms.uOffset.value.set(.217/1024,.731/1024);
      gpu.run(material,target);renderer.readRenderTargetPixels(target,0,0,1024,1024,data);
      let colourMax=0,wallMax=0,colourSum=0;
      for(let i=0;i<data.length;i+=4){colourMax=Math.max(colourMax,data[i],data[i+1],data[i+2]);wallMax=Math.max(wallMax,data[i+3]);colourSum+=data[i]+data[i+1]+data[i+2];}
      grids.push({width,colourMax,colourMean:colourSum/(1024*1024*3),wallMax});
    }
    target.dispose();material.dispose();
    // The same texture survives repeated calls; no per-frame work or camera-driven regeneration.
    const calls=renderer.info.render.calls;fields.bake(renderer);fields.bake(renderer);
    const repeatedBakeCalls=renderer.info.render.calls-calls;
    await complete();fields.uniforms.uTerrainFieldsReady.value=0;
    const started=performance.now();fields.bake(renderer);await complete();const rebakeMs=performance.now()-started;
    const u=atmo.uniforms,season=u.uSeason.value,life=u.uIslandLife.value.clone(),living=u.uLivingBeyond.value;
    const localLife=u.uLifeTex.value,waiting=u.uWaiting.value.clone(),wave=u.uLifeWave.value.clone();
    const black=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);black.needsUpdate=true;
    u.uLifeTex.value=black;u.uLivingBeyond.value=-1e6;u.uWaiting.value.set(0,0,0,0);u.uLifeWave.value.set(0,0,0,0);
    const variants=[],visibility=grass.group.visible;
    const read=cached=>{fields.uniforms.uTerrainFieldsReady.value=cached;draw();const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
    try {
      for(const blades of [true,false])for(const s of [0,.5,1])for(const l of [0,.5,1]) {
        grass.group.visible=blades;u.uSeason.value=s;u.uIslandLife.value.set(10,-780,1000,l);
        const a=read(0),b=read(1);let max=0,sum=0,changed=0;
        for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);sum+=d;if(d)changed++;}
        variants.push({blades,season:s,life:l,max,mean:sum/a.length,changed});
      }
    } finally {
      grass.group.visible=visibility;u.uSeason.value=season;u.uIslandLife.value.copy(life);u.uLivingBeyond.value=living;
      u.uLifeTex.value=localLife;u.uWaiting.value.copy(waiting);u.uLifeWave.value.copy(wave);black.dispose();fields.uniforms.uTerrainFieldsReady.value=1;
    }
    return {grids,repeatedBakeCalls,rebakeMs,textureBytes:fields.target.width*fields.target.height*8,variants};
  });
  await fs.writeFile(process.env.OUT??'/tmp/updraft-terrain-fields-check.json',JSON.stringify({...result,errors},null,2));
  console.log(JSON.stringify({...result,errors}));
  assert.deepEqual(errors,[]);assert.equal(result.repeatedBakeCalls,0);
  for(const g of result.grids){assert(g.colourMax<.006,JSON.stringify(g));assert(g.wallMax<1e-6,JSON.stringify(g));}
  for(const v of result.variants){assert(v.max<=3&&v.mean<.005,JSON.stringify(v));}
}finally{await close();}
