// Checks the shared terrain colour cache, including the original tint formula and live life/season states.
// Browser shader compilation, one-time bake cost, and dynamic colour-state comparisons.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';
const legacyTint = 'vec3 legacyGrassTint(vec2 xz) {\n  float pasture = pastureAt(xz);\n  float dry = smoothstep(0.58, 0.76, fbm(xz * 0.022 + vec2(3.1, 7.7)));\n  float cool = 0.0;\n  // Region weights are exactly zero/one away from their borders. Skip noise\n  // whose colour would be multiplied by zero; keep both sides at every blend.\n  if (pasture < 1.0) cool = smoothstep(0.5, 0.68, fbm(xz * 0.041 - vec2(5.3, 1.9))) * (1.0 - dry);\n  /** The year turning: more of the hillside goes over to seed, and the green that is left goes colder. */\n  dry = clamp(dry + uSeason * 0.3, 0.0, 1.0);\n  vec3 meadow = mix(mix(uTipLush, uTipDry, dry * 0.85), uTipCool, cool * 0.5);\n  vec3 emerald = vec3(0.0);\n  if (pasture > 0.0) {\n    emerald = mix(vec3(0.16, 0.36, 0.07), vec3(0.3, 0.46, 0.09), fbm(xz * 0.03 + 11.0));\n    emerald = mix(emerald, uTipDry * 0.9, dry * 0.35);\n  }\n  vec3 tint = mix(meadow, emerald, pasture);\n  tint = mix(tint, vec3(0.44, 0.31, 0.11), birchFloorAt(xz) * 0.72);\n  float wood = woodFloorAt(xz);\n  if (wood > 0.0) tint = mix(tint, mix(vec3(0.14, 0.19, 0.085), vec3(0.29, 0.27, 0.12), fbm(xz * 0.32)), wood * 0.9);\n  return mix(tint, mix(tint, vec3(0.4, 0.41, 0.31), 0.28) * 0.93, uSeason);\n}';
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
  await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+'?shot&chapter='+(process.env.CHAPTER??'meadow')+'&ratio=1.5&msaa=2&analytics=0&progress=0');
  await page.waitForFunction(()=>window.__ready,null,{timeout:120000});
  if(!process.env.CHAPTER||process.env.CHAPTER==='meadow') await page.evaluate(()=>{__game.story.current.skipToCrest();__game.story.current.reveal();});
  await page.waitForTimeout(1500);
  const result=await page.evaluate(async ({legacyTint,capture,groundView})=>{
    window.__fieldsPaused=true;
    const {THREE,atmo,draw}=__fieldsTest,{renderer,terrain,grass}=__game;
    const {GpuRunner,simMaterial,simTarget}=await import('/src/gl/gpu.ts');
    const {HEIGHTFIELD_GLSL,ISLES}=await import('/src/world/heightfield.ts');
    const {GRASS_GLSL,grassUniforms}=await import('/src/world/grass.ts');
    const {ATMO_GLSL}=await import('/src/world/atmosphere.ts');
    const {TERRAIN_COLOUR_GLSL,TERRAIN_COLOUR_PATCHES}=await import('/src/world/terrain-colour.ts');
    const fields=terrain.colour,gpu=new GpuRunner(renderer),gl=renderer.getContext();
    async function complete(){const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();const end=performance.now()+20000;
      try{for(;;){const s=gl.clientWaitSync(fence,0,0);if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)return;
        if(s===gl.WAIT_FAILED||performance.now()>end)throw Error('GPU completion timeout');await new Promise(r=>setTimeout(r,0));}}
      finally{gl.deleteSync(fence);}}
    // Compare the shared formula against the pre-cache shader, then the atlas against the direct pattern.
    const material=simMaterial(ATMO_GLSL+HEIGHTFIELD_GLSL+GRASS_GLSL+TERRAIN_COLOUR_GLSL+legacyTint+`
      uniform vec4 uCheckDomain; in vec2 vUv;
      void main(){vec2 p=uCheckDomain.xy+(vUv+vec2(0.217,0.731)/128.0)*uCheckDomain.zw;
        vec3 a=legacyGrassTint(p),b=grassTint(p),c=grassTintWithPattern(p,terrainColourPattern(p).xyz);
        vec3 d=abs(a-b); gl_FragColor=vec4(max(d.x,max(d.y,d.z)),abs(b-c));}
    `,{...atmo.uniforms,...grassUniforms,...fields.uniforms,uCheckDomain:{value:new THREE.Vector4()}});
    const target=simTarget(128,128,THREE.FloatType,THREE.NearestFilter),data=new Float32Array(128*128*4),grids=[];
    const savedSeason=atmo.uniforms.uSeason.value;
    for(const season of [0,.5,1])for(const p of TERRAIN_COLOUR_PATCHES) {
      atmo.uniforms.uSeason.value=season;
      material.uniforms.uCheckDomain.value.set(p.minX,p.minZ,p.width,p.height);
      gpu.run(material,target);renderer.readRenderTargetPixels(target,0,0,128,128,data);
      let formulaMax=0,colourMax=0,colourSum=0;
      for(let i=0;i<data.length;i+=4){formulaMax=Math.max(formulaMax,data[i]);colourMax=Math.max(colourMax,data[i+1],data[i+2],data[i+3]);colourSum+=data[i+1]+data[i+2]+data[i+3];}
      grids.push({season,minX:p.minX,minZ:p.minZ,formulaMax,colourMax,colourMean:colourSum/(128*128*3)});
    }
    atmo.uniforms.uSeason.value=savedSeason;target.dispose();material.dispose();
    // The same texture survives repeated calls; no per-frame work or camera-driven regeneration.
    const calls=renderer.info.render.calls;fields.bake(renderer);fields.bake(renderer);
    const repeatedBakeCalls=renderer.info.render.calls-calls;
    await complete();fields.uniforms.uTerrainColourReady.value=0;
    const started=performance.now();fields.bake(renderer);await complete();const rebakeMs=performance.now()-started;
    const u=atmo.uniforms,season=u.uSeason.value,life=u.uIslandLife.value.clone(),living=u.uLivingBeyond.value;
    const localLife=u.uLifeTex.value,waiting=u.uWaiting.value.clone(),wave=u.uLifeWave.value.clone();
    const black=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);black.needsUpdate=true;
    u.uLifeTex.value=black;u.uLivingBeyond.value=-1e6;u.uWaiting.value.set(0,0,0,0);u.uLifeWave.value.set(0,0,0,0);
    const variants=[],visibility=grass.group.visible,images={};
    if(groundView){
      const isle=ISLES[__game.story.name]??{x:-6,z:-14,rx:80,rz:65},camera=__game.rig.camera;
      camera.position.set(isle.x+isle.rx*.2,100,isle.z+Math.max(190,isle.rz));camera.lookAt(isle.x,10,isle.z);camera.updateMatrixWorld();
      terrain.update(camera);grass.update(camera);grass.bake(renderer);
    }
    const encode=data=>{const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),im=ctx.createImageData(w,h);
      for(let y=0;y<h;y++)im.data.set(data.subarray(y*w*4,(y+1)*w*4),(h-y-1)*w*4);
      ctx.putImageData(im,0,0);return canvas.toDataURL('image/png').split(',')[1];};
    const read=cached=>{fields.uniforms.uTerrainColourReady.value=cached;draw();const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
    try {
      for(const blades of [true,false])for(const s of [0,.5,1])for(const l of [0,.5,1]) {
        grass.group.visible=blades;u.uSeason.value=s;u.uIslandLife.value.set(__game.rig.camera.position.x,__game.rig.camera.position.z,10000,l);
        const a=read(0),b=read(1);let max=0,sum=0,changed=0;
        if(capture&&!blades&&s===0&&l===1){images.direct=encode(a);images.cached=encode(b);}
        for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);sum+=d;if(d)changed++;}
        variants.push({blades,season:s,life:l,max,mean:sum/a.length,changed});
      }
    } finally {
      grass.group.visible=visibility;u.uSeason.value=season;u.uIslandLife.value.copy(life);u.uLivingBeyond.value=living;
      u.uLifeTex.value=localLife;u.uWaiting.value.copy(waiting);u.uLifeWave.value.copy(wave);black.dispose();fields.uniforms.uTerrainColourReady.value=1;
    }
    return {grids,repeatedBakeCalls,rebakeMs,textureBytes:fields.target.width*fields.target.height*8,variants,images};
  },{legacyTint,capture:process.env.CAPTURE==='1',groundView:process.env.GROUND_VIEW==='1'});
  for(const [name,data]of Object.entries(result.images))await fs.writeFile((process.env.OUT??'/tmp/updraft-terrain-colour-check.json')+'-'+name+'.png',Buffer.from(data,'base64'));
  delete result.images;
  await fs.writeFile(process.env.OUT??'/tmp/updraft-terrain-colour-check.json',JSON.stringify({...result,errors},null,2));
  console.log(JSON.stringify({...result,errors}));
  assert.deepEqual(errors,[]);assert.equal(result.repeatedBakeCalls,0);
  for(const g of result.grids){assert(g.formulaMax<1e-5,JSON.stringify(g));assert(g.colourMax<.025,JSON.stringify(g));}
  for(const v of result.variants){assert(v.max<=8&&v.mean<.05,JSON.stringify(v));}
}finally{await close();}
