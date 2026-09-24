// CPU sampling + submitted-draw census + paired GPU-completion ablations.
// No production instrumentation. Excludes boot. GPU ablations are throughput,
// not timer-query milliseconds, energy measurements, or additive component costs.
// node tools/frame-profile.mjs [island washing meadow birches drowned wood sleeping sea mirror]
// CPU_MS=6000 CENSUS_MS=2000 ROUNDS=4 DRAWS=10 ABLATIONS=wind,reflection,... OUT=/tmp/updraft-frame-profile
// ABLATIONS=culling-off CULLING_VIEWS=1 checks culling parity; LEGACY_NORMALS=1 profiles the old scarf normals.
// terrain-flat retains terrain positions, normals, fog and room discard but removes surface shading.
// sky-flat removes sky radiance; post keeps the HDR/MSAA scene target and copies it directly to screen.
// actors hides characters, animals and small flying effects. Combine object omissions with +, e.g. grass+terrain-flat.
// These destructive diagnostics expose costs; they are not proposed production visuals.
// ABLATIONS=fields-direct compares the baked field pattern with its original shader; CAPTURE=1 saves both images.
// ABLATIONS=colour-direct compares the all-island colour-pattern atlas with direct noise calculations.
// terrain-skips-off restores the terrain's dead distant-field (a1-off), frost (a2-off) and outside-atlas field
// (a3-off) work; veil-always draws the sleeping veil at zero; glass-sky-always computes the sky under a full mirror.
// STATE='<js>' runs in main.ts's scope after the census, before the ablations, to force a state for both sides.
// FORCE_GRASS_BAKES=1 ABLATIONS=grass-tables measures the cost of rebuilding all three tables each draw.
// Ablations named in heightSources re-run the window-move bakes (ground, light, shore, grass tables) in configure
// on both sides of every pair, outside timed draws. ABLATIONS=rebake is the baseline re-baked; it must match exactly.
// Every pair's baseline is reported. An ablation whose max/min pair baseline exceeds 1.4 straddles two GPU states:
// it is flagged straddle:true with a warning; repeat it.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';

const out = process.env.OUT ?? '/tmp/updraft-frame-profile';
const STRADDLE = 1.4;
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
function cpuSummary(profile, frames) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), parents = new Map(), self = new Map(), total = new Map();
  for (const n of profile.nodes) for (const id of n.children ?? []) parents.set(id, n.id);
  profile.samples.forEach((id, i) => {
    const ms = profile.timeDeltas[i] / 1000; self.set(id, (self.get(id) ?? 0) + ms);
    for (let p = id; p; p = parents.get(p)) total.set(p, (total.get(p) ?? 0) + ms);
  });
  const rows = map => [...map].map(([id, ms]) => {
    const f = nodes.get(id).callFrame;
    return { name: f.functionName || '(anonymous)', url: f.url, line: f.lineNumber + 1, ms, msPerFrame: ms / frames };
  }).sort((a, b) => b.ms - a.ms).slice(0, 35);
  return { frames, durationMs: (profile.endTime - profile.startTime) / 1000, self: rows(self), inclusive: rows(total) };
}

const injection = `
window.__audit = {
  paused: false, census: false, frames: [], passes: {}, objects: {}, cpu: {}, stack: [], skyOrder:sky.renderOrder,
  groups: {
    sky: [sky], water: [water.mesh], terrain: [terrain.mesh], grass: [grass.group], tree: [tree.group],
    pond: pond.objects, washing: [washing.group, washingBaskets, pinwheels.group, door.group],
    village: village.objects, wood: wood.objects, sleeping: sleeping.objects, birches: birches.objects,
    cottage: cottage.objects, jetty: [homeJetty], piano: [piano.group], mirror: [skyMirror.group],
    littleBoats: [littleBoats.group], islandCreatures: [creatures.group], meadowCreatures: [hillCreatures.group],
    child: child.objects, cygnet: cygnet.objects, glider: glider.objects, boat: boat.objects,
    flock: [flock.mesh], petals: [petals.mesh], windLines: [lines.batch.mesh],
    rain: [rain.mesh], fireflies: [fireflies.mesh],
    drawing: [drawing.mesh], embers: [embers.mesh], starlings: [starlings.mesh], seaLife: sealife.objects,
    kites: Object.values(departureKites.markers).map(m => m.group),
  },
  // Ablations that change a height source: both sides of each of their pairs re-run the window-move bakes.
  heightSources: ['rebake'],
  changesHeights(omit) { return (omit||'').split('+').some(v=>this.heightSources.includes(v)); },
  rebake() {
    bakedSun.copy(atmo.uniforms.uSunDir.value);bakes.bake(bakeInputs);water.bakeShore(WINDOW.size);
    grass.tablesDirty=true;grass.bake(renderer);
  },
  record(cpuStart, realDt) { if (!this.paused) this.frames.push({ cpuMs: performance.now()-cpuStart, intervalMs: realDt*1000 }); },
  install() {
    const owners = new Map();
    for (const [name, roots] of Object.entries(this.groups)) for (const root of roots) root?.traverse(o => owners.set(o, name));
    for (const root of scene.children) root.traverse(o => { if (!owners.has(o)) owners.set(o, root.name || 'unlabelled-'+root.id); });
    const wrap = (obj, key, name) => {
      const original = obj[key]; if (typeof original !== 'function') return;
      obj[key] = (...args) => {
        if (!this.census) return original.apply(obj,args);
        this.stack.push(name); const start = performance.now();
        try { return original.apply(obj,args); }
        finally { const row = this.cpu[name] ??= { calls:0, ms:0 }; row.calls++; row.ms += performance.now()-start; this.stack.pop(); }
      };
    };
    for (const [name, obj, method] of [
      ['wind',wind,'step'], ['life',life,'update'], ['petals',petals,'update'], ['clouds',clouds,'update'],
      ['ground-bake',bakes,'bake'], ['light-bake',bakes,'bakeLight'], ['grass-tables',grass,'bake'],
      ['grass-select',grass,'update'], ['terrain-select',terrain,'update'], ['terrain-mirror-select',terrain,'beginMirror'],
      ['child',child,'update'], ['cygnet',cygnet,'update'], ['boat',boat,'update'], ['creatures',creatures,'update'],
      ['meadow-creatures',hillCreatures,'update'], ['village-update',village,'update'], ['birches-update',birches,'update'],
      ['wood-update',wood,'update'], ['sleeping-update',sleeping,'update'], ['audio',sound,'update'],
      ['mirror-ripples',skyMirror,'update'], ['bloom',post.bloom,'render'],
      ['water-waves',water,'step'], ['ground-readback',bakes,'tick'],
    ]) wrap(obj,method,name);
    const render = renderer.render.bind(renderer);
    renderer.render = (s,c) => {
      if (!this.census) return render(s,c);
      const target = renderer.getRenderTarget();
      const pass = target === post.sceneTarget ? 'main' : target === water.reflection.target ? 'reflection'
        : target === doorwayView.target ? 'doorway' : !target ? 'grade' : target === post.clean ? 'resolve/bloom-blend'
        : this.stack.at(-1) || 'unclassified';
      this.currentPass = pass;
      const beforeCalls = renderer.info.render.calls, beforeTriangles = renderer.info.render.triangles, start = performance.now();
      render(s,c);
      const row = this.passes[pass] ??= { submissions:0, calls:0, triangles:0, cpuMs:0, targetSizes:{} };
      row.submissions++; row.calls += renderer.info.render.calls-beforeCalls; row.triangles += renderer.info.render.triangles-beforeTriangles;
      row.cpuMs += performance.now()-start;
      const size = target ? target.width+'x'+target.height : 'screen'; row.targetSizes[size] = (row.targetSizes[size] ?? 0)+1;
    };
    const direct = renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect = (camera,s,geometry,material,object,group) => {
      if (!this.census) return direct(camera,s,geometry,material,object,group);
      const beforeCalls=renderer.info.render.calls, beforeTriangles=renderer.info.render.triangles;
      direct(camera,s,geometry,material,object,group);
      const calls=renderer.info.render.calls-beforeCalls; if (!calls) return;
      const owner = owners.get(object) || this.stack.at(-1) || 'fullscreen';
      const key = this.currentPass+'/'+owner;
      const row = this.objects[key] ??= { calls:0, triangles:0, automaticCulling:object.frustumCulled, meshIds:[] };
      row.calls += calls; row.triangles += renderer.info.render.triangles-beforeTriangles;
      if (!row.meshIds.includes(object.id)) row.meshIds.push(object.id);
    };
  },
  configure(omit) {
    if (terrain.fields) terrain.fields.uniforms.uTerrainFieldsReady.value = omit === 'fields-direct' ? 0 : 1;
    if (terrain.colour) terrain.colour.uniforms.uTerrainColourReady.value = omit === 'colour-direct' || ${JSON.stringify((process.env.ABLATIONS ?? '').split(',').includes('full-tint'))} ? 0 : 1;
    if (this.hidden) for (const [object,visible] of this.hidden) object.visible=visible;
    if (this.culling) for (const [object,culled] of this.culling) object.frustumCulled=culled;
    this.hidden=[];this.omit=omit;
    if(this.diagnosticMaterials)for(const [m,fragment]of this.diagnosticMaterials){if(m.fragmentShader!==fragment){m.fragmentShader=fragment;m.needsUpdate=true;}}
    sky.renderOrder=omit==='sky-last'?10:this.skyOrder;
    this.tintMaterials ??= [terrain.mesh.material,...grass.lods.map(l=>l.tableMat)].map(m=>[m,m.fragmentShader]);
    const skips=(omit||'').split('+'),skipsOff=name=>skips.includes(name)||skips.includes('terrain-skips-off');
    const restore=(fragment,from,to)=>{if(!fragment.includes(from))throw Error('Missing skip: '+from);return fragment.replace(from,to);};
    let tintChanged=false;
    for(const [material,original] of this.tintMaterials) {
      let fragment=omit==='full-tint'?original
        .replace('pasture < 1.0 ?', 'true ?')
        .replace('pasture > 0.0 ?', 'true ?')
        .replace('if (pasture < 1.0)', 'if (true)')
        .replace('if (pasture > 0.0)', 'if (true)')
        .replace('if (wood > 0.0)', 'if (true)'):original;
      if(material===terrain.mesh.material) {
        if(skipsOff('a1-off'))fragment=restore(fragment,'if (far > 0.0) {','if (true) {');
        if(skipsOff('a2-off'))fragment=restore(fragment,'if (frost > 0.0) alb','if (true) alb');
        if(skipsOff('a3-off'))fragment=restore(fragment,'any(greaterThan(uv, vec2(0.999)))) return vec4(99.0, 0.0, 0.0, 0.0);','any(greaterThan(uv, vec2(0.999)))) return fieldAt(p);');
      }
      if(material.fragmentShader!==fragment){material.fragmentShader=fragment;material.needsUpdate=true;tintChanged||=material!==terrain.mesh.material;}
    }
    if(tintChanged){grass.tablesDirty=true;grass.bake(renderer);}
    const veil=sleeping.weather.fogMaterial;this.veilVisible??=veil.visible;
    veil.visible=skips.includes('veil-always')||this.veilVisible;
    const glass=water.mesh.material;this.glassFragment??=glass.fragmentShader;
    const glassFragment=skips.includes('glass-sky-always')?restore(this.glassFragment,'if (on < 1.0) reflected','if (true) reflected'):this.glassFragment;
    if(glass.fragmentShader!==glassFragment){glass.fragmentShader=glassFragment;glass.needsUpdate=true;}
    this.culling=[];
    if (omit==='culling-off') {
      const roots=[...this.groups.tree,...this.groups.pond];
      for (const root of this.groups.washing) root.traverse(o=>{
        if(o.geometry?.attributes.aAnchor) roots.push(o);
      });
      for (const root of roots) root.traverse(o=>{if(o.isMesh){this.culling.push([o,o.frustumCulled]);o.frustumCulled=false;}});
    }
    this.diagnosticMaterials ??= [terrain.mesh.material,sky.material].map(m=>[m,m.fragmentShader]);
    const variants=(omit||'').split('+');
    if(variants.includes('terrain-flat')) {
      const m=terrain.mesh.material,original=this.diagnosticMaterials[0][1];
      m.fragmentShader=original.slice(0,original.lastIndexOf('void main() {'))+
        'void main() { if(roomHides(vWorld.xz)) discard; vec4 fog=fogOf(vWorld); vec3 c=vec3(0.25,0.3,0.15)*(0.6+0.4*normalize(vNormal).y); gl_FragColor=vec4(mix(c,fog.rgb,fog.a),1.0); }';
      m.needsUpdate=true;
    }
    if(variants.includes('sky-flat')) {
      const m=sky.material;
      m.fragmentShader=this.diagnosticMaterials[1][1].replace('skyRadiance(normalize(vDir))','vec3(0.5,0.6,0.7)');m.needsUpdate=true;
    }
    const actors=['child','cygnet','boat','glider','flock','meadowCreatures','islandCreatures','kites','petals','windLines'];
    for (const key of variants.includes('actors')?actors:variants)for(const object of this.groups[key]||[]) {
      this.hidden.push([object,object.visible]);object.visible=false;
    }
    if(this.pairRebake)this.rebake();
  },
  draw(sim=true) {
    renderer.info.reset();
    if (sim && this.omit !== 'wind') {
      wind.step(1/60,time,false);
      // The ping-pong targets swap every step, so rebind them as the real loop does.
      const u=atmo.uniforms;u.uWindTex.value=wind.texture;u.uBendTex.value=wind.bendTexture;u.uSwayTex.value=wind.swayTexture;
    }
    if (sim && this.forceGrassBakes && this.omit !== 'grass-tables') {grass.tablesDirty=true;grass.bake(renderer);}
    const draw=()=>doorwayView.render(rig.camera,story.name==='lines',story.name!=='toBoats',()=>{
      if (this.omit !== 'reflection') water.update(rig.camera,c=>terrain.beginMirror(c),()=>terrain.endMirror());
      const bloom=post.bloom.render;
      if(this.omit==='bloom')post.bloom.render=()=>{};
      try {
        if(this.omit==='post') {
          renderer.setRenderTarget(post.sceneTarget);renderer.render(scene,rig.camera);
          post.quad.material=post.resolveMat;renderer.setRenderTarget(null);post.quad.render(renderer);
        } else post.render(time);
      } finally { post.bloom.render=bloom; }
    });
    if(typeof drawJourneyRooms==='function') {
      const rooms=visibleRooms(story.name,boat.position.z);setJourneyRooms(rooms);drawJourneyRooms(rooms,roomObjects,draw);
    } else draw();
  },
  // STATE forces a condition for every ablation after the census; it runs in this module's scope.
  state(code) { return eval(code); },
  inspect() {
    let count=0, hidden=0, drawables=0, uncullable=0;
    scene.traverse(o=>{count++;if(!o.visible)hidden++;if(o.material){drawables++;if(!o.frustumCulled)uncullable++;}});
    return {count,hidden,drawables,uncullable,camera:rig.camera.position.toArray(),story:story.name,beat:story.current.beat,stats:window.__stats};
  },
  cullingViews() {
    const camera=rig.camera,position=camera.position.clone(),quaternion=camera.quaternion.clone(),life=tree.life.value;
    const gl=renderer.getContext(),rows=[];
    const read=omit=>{this.configure(omit);this.draw(false);const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
    try {
      tree.life.value=1;
      const targets=[tree.canopy[0].centre,pond.centre,new THREE.Vector3(11,5,-390)];
      for(let target=0;target<targets.length;target++)for(const yaw of [-0.8,-0.4,0,0.4,0.8]) {
        camera.position.copy(targets[target]).add(new THREE.Vector3(0,3,24));
        camera.lookAt(targets[target]);camera.rotateY(yaw);camera.updateMatrixWorld();
        const a=read(null),b=read('culling-off');let changed=0,max=0;
        for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)changed++;max=Math.max(max,d);}
        rows.push({target,yaw,changed,max});
      }
    } finally {camera.position.copy(position);camera.quaternion.copy(quaternion);camera.updateMatrixWorld();tree.life.value=life;this.configure(null);}
    return rows;
  }
};
`;

const { browser, close } = await openBrowser();
const report=[],inexact=[];
try {
  for(const chapter of process.argv.slice(2).length ? process.argv.slice(2) : ['island','washing','meadow','birches','drowned','wood','sleeping','sea','mirror']) {
    const [entry,fixture]=chapter.split(':');
    const page=await browser.newPage({viewport:{width:1376,height:1032},deviceScaleFactor:2});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
    await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
    if(process.env.LEGACY_NORMALS==='1') await page.route('**/src/world/birch-scarf.ts*',async route=>{
      const response=await route.fetch(),source=await response.text();
      const body=source.replace('indexedNormals(this.positions, this.normals, this.geometry.index.array);','this.geometry.computeVertexNormals();');
      assert.notEqual(body,source,'Missing legacy normals hook');
      await route.fulfill({response,body});
    });
    await page.route('**/src/main.ts*',async route=>{
      const response=await route.fetch();let source=await response.text();
      source=source.replace('function frame(now) {','function frame(now) { if (window.__audit?.paused) { requestAnimationFrame(frame); return; }');
      assert(source.includes('window.__audit?.paused'),'Missing pause hook');
      assert.equal(source.split('frames++;').length, 2, 'Missing or ambiguous frame hook');
      source=source.replace('frames++;','window.__audit?.record(cpuStart,realDt); frames++;');
      source=source.replace('scene.add(createRocks());','scene.add(Object.assign(createRocks(), {name:"rocks"}));');
      source=source.replace('scene.add(createDistantIslands());','scene.add(Object.assign(createDistantIslands(), {name:"distant-islands"}));');
      await route.fulfill({response,body:source+injection});
    });
    await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+'?shot&start=1&ratio=1.5&msaa=2&analytics=0&progress=0'+(entry==='island'?'':'&chapter='+entry));
    await page.waitForSelector('#veil.ready',{timeout:120000});await page.locator('#begin').click();
    await page.waitForFunction(()=>window.__ready,null,{timeout:120000});
    if(fixture) await page.evaluate(fixture=>{
      const g=__game,c=g.story.current;
      if(fixture==='piano') c.skipToPiano();
      else {
        c.skipToCrest();
        if(fixture!=='walk') c.reveal();
        if(fixture==='flock'||fixture==='pond') c.goDown();
        if(fixture==='pond'){g.child.place(c.edge.x,c.edge.z,Math.PI);c.setDown();}
      }
    },fixture);
    await page.waitForTimeout(1500);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});
    await page.evaluate(()=>{__audit.frames=[];});await cdp.send('Profiler.start');
    await page.waitForTimeout(Number(process.env.CPU_MS??6000));
    const {profile}=await cdp.send('Profiler.stop');
    const frames=await page.evaluate(()=>__audit.frames);
    assert(frames.length > 0, 'No frame timings recorded');
    await fs.writeFile(out+'-'+chapter+'.cpuprofile',JSON.stringify(profile));
    const cpu=cpuSummary(profile,frames.length);
    const frameTimes={frames:frames.length,cpuMedian:median(frames.map(f=>f.cpuMs)),cpuP90:[...frames.map(f=>f.cpuMs)].sort((a,b)=>a-b)[Math.floor(frames.length*.9)],intervalMedian:median(frames.map(f=>f.intervalMs))};
    await page.evaluate(()=>{__audit.frames=[];__audit.install();__audit.census=true;});
    await page.waitForTimeout(Number(process.env.CENSUS_MS??2000));
    const census=await page.evaluate(()=>{
      __audit.census=false;__audit.paused=true;
      return {frames:__audit.frames.length,passes:__audit.passes,objects:__audit.objects,cpu:__audit.cpu,scene:__audit.inspect()};
    });
    assert(census.frames > 0, 'No census frames recorded');
    assert.deepEqual(errors, [], 'Browser errors invalidate the profile');
    if(process.env.FORCE_GRASS_BAKES==='1') await page.evaluate(()=>{__audit.forceGrassBakes=true;});
    const state=process.env.STATE?await page.evaluate(code=>__audit.state(code),process.env.STATE):undefined;
    if(state!==undefined)console.log(JSON.stringify({chapter,state}));
    const ablations=[];
    for(const omit of (process.env.ABLATIONS??'wind,reflection,grass,water,bloom,village,tree,pond').split(',').filter(Boolean)) {
      const result=await page.evaluate(async ({omit,rounds,draws,capture})=>{
        const gl=__game.renderer.getContext(), probe=__audit;probe.pairRebake=probe.changesHeights(omit);
        async function complete(){const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();const end=performance.now()+20000;
          try{for(;;){const s=gl.clientWaitSync(fence,0,0);if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)return;
            if(s===gl.WAIT_FAILED||performance.now()>end)throw Error('GPU completion timeout');await new Promise(r=>setTimeout(r,0));}}
          finally{gl.deleteSync(fence);}}
        const read=v=>{probe.configure(v);probe.draw(false);const data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
          gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
        const a=read(null),b=read(omit);let changed=0,max=0,total=0;
        for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)changed++;max=Math.max(max,d);total+=d;}
        const pixels={changed,max,mean:total/a.length};
        const encode=data=>{
          const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,canvas=document.createElement('canvas');
          canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),im=ctx.createImageData(w,h);
          for(let y=0;y<h;y++)im.data.set(data.subarray(y*w*4,(y+1)*w*4),(h-y-1)*w*4);
          ctx.putImageData(im,0,0);return canvas.toDataURL('image/png').split(',')[1];
        };
        const images=capture?{baseline:encode(a),variant:encode(b)}:undefined;
        async function measure(v){probe.configure(v);for(let i=0;i<3;i++)probe.draw();await complete();
          const start=performance.now();for(let i=0;i<draws;i++)probe.draw();await complete();return (performance.now()-start)/draws;}
        const runs=[];
        for(let round=0;round<rounds;round++) {const order=round%2?[omit,null,null,omit]:[null,omit,omit,null];const values={baseline:[],omitted:[]};
          for(const v of order)values[v?'omitted':'baseline'].push(await measure(v));
          const baseline=(values.baseline[0]+values.baseline[1])/2,omitted=(values.omitted[0]+values.omitted[1])/2;
          runs.push({baseline,omitted,saved:baseline-omitted,percent:(1-omitted/baseline)*100});}
        const counts=v=>{probe.configure(v);probe.draw(false);return {...__game.renderer.info.render};};
        const submitted={baseline:counts(null),omitted:counts(omit)};
        probe.configure(null);probe.pairRebake=false;return {pixels,runs,submitted,images};
      },{omit,rounds:Number(process.env.ROUNDS??4),draws:Number(process.env.DRAWS??10),capture:process.env.CAPTURE==='1'});
      if(result.images)for(const [name,data]of Object.entries(result.images))await fs.writeFile(out+'-'+chapter+'-'+omit+'-'+name+'.png',Buffer.from(data,'base64'));
      const baselines=result.runs.map(r=>r.baseline),straddle=Math.max(...baselines)/Math.min(...baselines)>STRADDLE;
      const row={omit,pixels:result.pixels,submitted:result.submitted,savedMs:median(result.runs.map(r=>r.saved)),percent:median(result.runs.map(r=>r.percent)),rangeMs:[Math.min(...result.runs.map(r=>r.saved)),Math.max(...result.runs.map(r=>r.saved))],baselines,straddle,runs:result.runs};
      if (omit === 'rebake') assert.equal(result.pixels.max, 0, 'Re-baking the window changed pixels');
      if (['culling-off','sky-last','full-tint'].includes(omit)) assert(result.pixels.max <= 1, omit+' changed visible pixels');
      // Exact skips are checked after every chapter has been measured, so one failure keeps the other rows.
      if (['terrain-skips-off','a1-off','a2-off','a3-off','veil-always','glass-sky-always'].includes(omit) && result.pixels.max) {
        console.warn(`WARNING ${chapter} ${omit}: exact skip differs by ${result.pixels.max}/255 in ${result.pixels.changed} channels`);
        if (result.pixels.max > 1) inexact.push({chapter,omit,...result.pixels});
      }
      if (omit === 'fields-direct') assert(result.pixels.max <= 3 && result.pixels.mean < .005, JSON.stringify(result.pixels));
      if (omit === 'colour-direct') assert(result.pixels.max <= 3 && result.pixels.mean < .01, JSON.stringify(result.pixels));
      ablations.push(row);console.log(JSON.stringify({chapter,omit,savedMs:row.savedMs,percent:row.percent,rangeMs:row.rangeMs,baselines,straddle}));
      if(straddle)console.warn(`WARNING ${chapter} ${omit}: pair baselines straddle GPU states (${baselines.map(b=>b.toFixed(1)).join(', ')} ms); repeat it`);
    }
    const cullingViews=process.env.CULLING_VIEWS==='1'?await page.evaluate(()=>__audit.cullingViews()):[];
    assert(cullingViews.every(v=>v.max<=1),'Culling changed pixels at a view edge');
    const row={chapter,frameTimes,cpu,census,ablations,cullingViews,errors};report.push(row);
    await fs.writeFile(out+'.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify({chapter,frameTimes,frames:census.frames,passes:census.passes,objects:census.objects,ablations:ablations.map(({runs,...r})=>r),errors}));
    assert.deepEqual(errors,[]);await page.close();
  }
  assert.deepEqual(inexact,[],'exact skips changed visible pixels');
} finally { await close(); }
