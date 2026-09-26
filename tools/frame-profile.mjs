// CPU sampling + submitted-draw census + paired GPU-completion ablations.
// No production instrumentation. Excludes boot. GPU ablations are throughput,
// not timer-query milliseconds, energy measurements, or additive component costs.
// node tools/frame-profile.mjs [island washing meadow:walk birches drowned wood sleeping sea mirror boats jetty]
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
// heights-direct turns the distant-height atlas off (uTerrainHeightsReady 0): every lookup beyond the window calls
// worldHeight again, as before phase 3. heights-const is the upper bound on the distant-height atlas: every height read beyond the window (terrain
// vertices, main and mirror, and the light bake's march) returns the open-sea floor instead of calling worldHeight.
// Ablations named in heightSources re-run the window-move bakes (ground, light, shore, grass tables) in configure
// on both sides of every pair, outside timed draws. ABLATIONS=rebake is the baseline re-baked; it must match exactly.
// The wind ablation waits for the GPU after every draw, as a frame boundary does, and also times 60 steps alone
// (stepMs). Back to back, the scene's read of what the step just wrote stops one draw overlapping the next, which
// inflated the saving several-fold; under another process's GPU load each of the step's 21 dependent passes waits
// its turn and a step alone takes 3-5 ms (tools/wind-cost.mjs, perf-bakes design F).
// Any ablation suffixed @drain (bloom@drain) waits for the GPU after every draw the same way; bloom and other chains of
// small passes the frame reads back lose overlap with the next draw when drawn back to back.
// QUIET=600 waits up to 600 s before each chapter until no other non-system process is above 50% CPU; rows record it.
// POLL=timeout polls fences with setTimeout(0), the pre-9b69229 behaviour, for A/B checks of the poll.
// grade replaces the final grade with a plain copy, keeping the resolve and bloom.
// RATIO and MSAA override the page's ratio=1.5&msaa=2. DRAIN=1 waits for the GPU after every draw in every ablation.
// Levers (look-changing, costed only): scale-<ratio>, msaa-<samples>, bloom-half; none pairs the baseline with itself.
// msaa-nodepth swaps in a scene target built to neither resolve nor store its multisampled depth. On Chrome/ANGLE Metal
// it renders without antialiasing (pixels match msaa-0) and is no faster (perf-bakes round 2), so it is not an exact skip.
// Breakdowns: grass-frag-flat, grass-nodiscard, grass-fog, grass-cloud, grass-shade (frost, morning, lamp, dawn), grass-life,
// grass-collapse (every blade discarded at its first instruction), grassLod0..2; birchesTrunks/Canopy/Litter/Scarf/Leaves/Other;
// water-frag-flat, water-vert-flat, water-bed, water-surf, water-glints, water-ripples, water-mirror, water-wind, water-paw,
// water-fog, water-sky, water-cloud, water-landskip (returns early under land), water-last (drawn after the other opaques); terrain-nodiscard. POST_PASSES=1 times each post stage alone (POST_REPS); REFLECTION_PASS=1 the sea's reflection pass alone;
// WATER_PASS=s3-off,none,... the sea alone against each listed variant (WATER_ROUNDS, POST_REPS).
// Phase X2's exact skips, each restoring the old path: e5-off (grass always drawn with its discards), e6-off (glints everywhere).
// Phase S: s1-off (the ordinary sea's reflection every frame), s3-off (roomHides at each use); seafog-coarse is the S4
// look option, the sea's fog per vertex. Draws alternate the reflection, so time S1 with DRAWS even. water-caustics
// and water-weed remove those seabed terms: upper bounds for skipping them where they are exactly 0.
// grass-bare-tiles leaves out the grass tiles in which no blade can stand at any density: the most E3 could save.
// PATH_JS='<js>' PATH_STEPS=40 also compares each ablation's frames along a camera path: the code runs in main.ts's scope with
// the step in k and places rig.camera; the window follows and prepareFrame runs as in the loop. ROUNDS=0 skips the timing.
// PATH_ABLATIONS=e5-off,... limits the path to those ablations.
// Every pair's baseline is reported. An ablation whose max/min pair baseline exceeds 1.4 straddles two GPU states:
// it is flagged straddle:true with a warning; repeat it.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { openBrowser } from './lib/browser.mjs';

const out = process.env.OUT ?? '/tmp/updraft-frame-profile';
const STRADDLE = 1.4;
// Other processes' load, recorded with every row: it inflates GPU numbers (perf-bakes design F).
// This tool's own browser is flagged own:true so another Chrome stands out.
const busy = () => {
  const rows=execFileSync('ps',['-Ao','pid=,ppid=,pcpu=,comm='],{encoding:'utf8'}).split('\n').map(l=>l.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/))
    .filter(Boolean).map(m=>({pid:Number(m[1]),ppid:Number(m[2]),cpu:Number(m[3]),command:m[4].split('/').pop()}));
  const own=new Set([process.pid]);for(let grew=true;grew;){grew=false;for(const r of rows)if(!own.has(r.pid)&&own.has(r.ppid)){own.add(r.pid);grew=true;}}
  return rows.filter(r=>r.cpu>=15).sort((a,b)=>b.cpu-a.cpu).slice(0,8).map(r=>({cpu:r.cpu,command:r.command,...own.has(r.pid)&&{own:true}}));
};
// Holding the browser lock keeps other browser checks out; QUIET waits for anything else (ffmpeg, simulators, VMs).
const QUIET_S=Number(process.env.QUIET??0), SYSTEM=/^(secd|WindowServer|kernel_task|ctkd|launchd|logd|mds.*|coreaudiod|runningboardd|trustd|syspolicyd|.*intelligenceplatformd|\(proactiveeventtr\))$/;
// GPU_QUIET=1 waits only for other GPU users (another Chrome's GPU process, a simulator, ffmpeg) over 15% CPU:
// CPU-only background load (build watchers, servers) no longer holds every chapter for the whole QUIET window.
const GPU_QUIET=process.env.GPU_QUIET==='1',GPU_USER=/\(GPU\)|Simulator|ffmpeg|qemu/;
async function quiet() {
  const start=Date.now(),samples=[];
  for(;;) {
    let hot=[];
    for(let i=0;i<4;i++){const b=busy();samples.push(b);hot.push(...b.filter(r=>!r.own&&(GPU_QUIET?GPU_USER.test(r.command):r.cpu>50&&!SYSTEM.test(r.command))));await new Promise(r=>setTimeout(r,2500));}
    const waitedS=(Date.now()-start)/1000;
    if(!hot.length||waitedS>=QUIET_S)return {waitedS,contended:hot.length>0,hot,samples:samples.slice(-4)};
    console.warn('Waiting for quiet: '+[...new Set(hot.map(h=>h.command))].join(', '));
    await new Promise(r=>setTimeout(r,15000));
  }
}
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
    flock: flock.objects, rocks: [islandRocks], shoreGrass: [shoreGrass], petals: [petals.mesh], windLines: [lines.batch.mesh],
    rain: [rain.mesh], fireflies: [fireflies.mesh],
    drawing: [drawing.mesh], embers: [embers.mesh], starlings: [starlings.mesh], seaLife: sealife.objects,
    kites: Object.values(departureKites.markers).map(m => m.group),
    birchesTrunks: birches.objects.filter(o => o.geometry?.attributes?.aIndex && !o.material?.alphaToCoverage),
    birchesCanopy: birches.objects.filter(o => o.material?.uniforms?.uCanopyMotion),
    birchesLitter: [birches.litterMesh], birchesScarf: [birches.scarf.mesh], birchesLeaves: [birches.leaves.mesh],
    grassLod0: [grass.group.children[0]], grassLod1: [grass.group.children[1]], grassLod2: [grass.group.children[2]],
  },
  // Ablations that change a height source: both sides of each of their pairs re-run the window-move bakes.
  heightSources: ['rebake','heights-const','heights-direct'],
  changesHeights(omit) { return (omit||'').split('+').some(v=>this.heightSources.includes(v)); },
  rebake() {
    bakedSun.copy(atmo.uniforms.uSunDir.value);bakes.bake(bakeInputs);water.bakeShore(WINDOW.size);
    grass.tablesDirty=true;grass.bake(renderer);
  },
  record(cpuStart, realDt) { if (!this.paused) this.frames.push({ cpuMs: performance.now()-cpuStart, intervalMs: realDt*1000 }); },
  install() {
    const split=['birchesTrunks','birchesCanopy','birchesLitter','birchesScarf','birchesLeaves'].flatMap(k=>this.groups[k]);
    this.groups.birchesOther=birches.objects.filter(o=>!split.includes(o));
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
    if (terrain.heights) terrain.heights.uniforms.uTerrainHeightsReady.value = (omit||'').split('+').includes('heights-direct') ? 0 : 1;
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
    this.heightShaders??=[[terrain.mesh.material,'vertexShader','return worldHeight(q);'],[bakes.groundMat,'fragmentShader','return worldHeight(p);']].map(([m,key,from])=>[m,key,from,m[key]]);
    for(const [m,key,from,original]of this.heightShaders){
      const source=skips.includes('heights-const')?restore(original,from,'return -5.1198557;'):original;
      if(m[key]!==source){m[key]=source;m.needsUpdate=true;}
    }
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
    this.diagnosticMaterials ??= [terrain.mesh.material,sky.material,post.gradeMat].map(m=>[m,m.fragmentShader]);
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
    if(variants.includes('grade')) {
      const m=post.gradeMat,original=this.diagnosticMaterials[2][1];
      m.fragmentShader=original.slice(0,original.lastIndexOf('void main() {'))+'void main() { gl_FragColor=vec4(texture2D(tDiffuse,vUv).rgb,1.0); }';m.needsUpdate=true;
    }
    const actors=['child','cygnet','boat','glider','flock','meadowCreatures','islandCreatures','kites','petals','windLines'];
    for (const key of variants.includes('actors')?actors:variants)for(const object of this.groups[key]||[]) {
      this.hidden.push([object,object.visible]);object.visible=false;
    }
    this.levers(variants);
    this.patchShaders(variants);
    this.bareTiles(variants.includes('grass-bare-tiles'));
    if(this.pairRebake)this.rebake();
  },
  // Look-changing levers, costed only: render scale, MSAA samples, bloom resolution. scale-1.25, msaa-0, bloom-half.
  levers(variants) {
    this.baseRatio??=pixelRatio;this.baseSamples??=post.samples;
    const scale=variants.find(v=>v.startsWith('scale-')),samples=variants.find(v=>v.startsWith('msaa-'));
    const ratio=scale?Number(scale.slice(6)):this.baseRatio,count=samples?Number(samples.slice(5)):this.baseSamples;
    if(post.samples!==count)post.samples=count;
    // msaa-nodepth: the scene's depth is never read after the scene, so a target built to neither resolve nor store its
    // multisampled depth stands in for it. Built, not toggled: flipping resolveDepthBuffer on a live target lost the MSAA.
    const noDepth=variants.includes('msaa-nodepth');
    if(noDepth!==!!this.altOn){
      this.origTarget??=post.sceneTarget;const o=this.origTarget;
      if(noDepth){
        this.alt??=new THREE.WebGLRenderTarget(o.width,o.height,{type:THREE.HalfFloatType,samples:o.samples,depthBuffer:true,resolveDepthBuffer:false,storeMultisampledDepthBuffer:false});
        if(this.alt.width!==o.width||this.alt.height!==o.height)this.alt.setSize(o.width,o.height);
      }
      post.sceneTarget=noDepth?this.alt:o;post.resolveMat.uniforms.tDiffuse.value=post.sceneTarget.texture;this.altOn=noDepth;
    }
    if(pixelRatio!==ratio){pixelRatio=ratio;resize();}
    const w=post.sceneTarget.width,h=post.sceneTarget.height,half=variants.includes('bloom-half');
    const want=half?[Math.round(w/2),Math.round(h/2)]:[w,h];
    if(this.bloomSize?.[0]!==want[0]||this.bloomSize?.[1]!==want[1]){post.bloom.setSize(want[0],want[1]);this.bloomSize=want;}
  },
  // grass-bare-tiles: the upper bound on E3, tiles in which no blade can stand (every blade's keep is 0 in its table)
  // left out of the draw. Reads the tables back once; the tiles are restored for every other variant.
  bareTiles(on) {
    if(on===!!this.bare)return;
    if(on){
      this.bare=grass.lods.map(l=>{
        const per=l.spec.cols*l.spec.rows,rows=Math.ceil(l.count*per/1024),saved={count:l.count,tiles:l.tiles.array.slice(0,l.count*2)};
        if(!l.count)return saved;
        const buf=new Float32Array(1024*rows*4);renderer.readRenderTargetPixels(l.table,0,0,1024,rows,buf,undefined,1);
        let kept=0;
        for(let t=0;t<l.count;t++){let live=false;for(let b=t*per;b<(t+1)*per&&!live;b++)live=buf[b*4]>0;
          if(live){l.tiles.array[kept*2]=saved.tiles[t*2];l.tiles.array[kept*2+1]=saved.tiles[t*2+1];kept++;}}
        saved.bare=l.count-kept;l.count=kept;return saved;
      });
    } else {
      grass.lods.forEach((l,i)=>{const saved=this.bare[i];l.tiles.array.set(saved.tiles);l.count=saved.count;});
      this.bare=null;
    }
    for(const l of grass.lods){l.tiles.clearUpdateRanges();l.tiles.addUpdateRange(0,Math.max(1,l.count)*2);l.tiles.needsUpdate=true;l.tileTex.needsUpdate=true;l.dirty=true;l.previousCount=l.count;l.geo.instanceCount=l.count*l.spec.cols*l.spec.rows;}
    grass.tileVersion++;grass.bake(renderer);
  },
  // Diagnostic shader edits for the grass, water and terrain breakdowns (perf-bakes round 2). Each names what it removes.
  patchShaders(variants) {
    const main=(source,body)=>source.slice(0,source.lastIndexOf('void main() {'))+body;
    const sub=(source,from,to)=>{if(typeof from==='string'?!source.includes(from):!from.test(source))throw Error('Missing patch site: '+from);return source.replace(from,to);};
    const grassMats=grass.group.children.filter(o=>o.isMesh).map(o=>o.material),waterMat=water.mesh.material;
    this.patchOriginals??=new Map([...grassMats,waterMat].map(m=>[m,{vertexShader:m.vertexShader,fragmentShader:m.fragmentShader}]));
    const patches={
      'grass-frag-flat':[grassMats,'fragmentShader',s=>main(s,'void main() { gl_FragColor = vec4(vTint * 0.5 + vRoot * 0.1 + vFlower.rgb * vFlower.a * 0.01 + vec3(vT, vFlat, vSun) * 0.01 + vec3(vAo, 0.0) * 0.01 + vLocalLight * 0.01 + (vNormal + vSideDir + vGroundN) * 0.001 + vWorld * 1e-6 + vFog.rgb * vFog.a * 0.01, 1.0); }')],
      // The unclipped blade program (E5) has no discards to remove.
      'grass-nodiscard':[grassMats,'fragmentShader',s=>s.replace(/discard;/g,'{}')],
      'grass-fog':[grassMats,'vertexShader',s=>sub(s,'vFog = fogOf(world, 1.0);','vFog = vec4(0.0);')],
      'grass-cloud':[grassMats,'vertexShader',s=>sub(s,'* cloudShadow(root2);',';')],
      'grass-shade':[grassMats,'vertexShader',s=>sub(sub(sub(s,'float rime = frostAt(root2);','float rime = 0.0;'),'float green = morningAt(root2);','float green = 0.0;'),/vec3 warm = lampLight[^;]*;/,'vec3 warm = vec3(0.0);')],
      'grass-life':[grassMats,'vertexShader',s=>sub(s,'float life = lifeAt(root2);','float life = 1.0;')],
      'grass-collapse':[grassMats,'vertexShader',s=>sub(s,'void main() {\\n  ivec2 at','void main() { collapse(); return;\\n  ivec2 at')],
      'water-frag-flat':[[waterMat],'fragmentShader',s=>main(s,'void main() { gl_FragColor = vec4(vWorld * 1e-4 + vSwell * 0.1 + vec3(0.1, 0.2, 0.3), 1.0); }')],
      'water-vert-flat':[[waterMat],'vertexShader',s=>main(s,'void main() { vec3 w = (modelMatrix * vec4(position, 1.0)).xyz; vSwell = vec3(0.0); vWorld = w; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }')],
      'water-bed':[[waterMat],'fragmentShader',s=>sub(s,'if (depth < 9.0) {','if (false) {')],
      'water-surf':[[waterMat],'fragmentShader',s=>sub(s,'if (offshore < 40.0 && pool < 0.99) {','if (false) {')],
      'water-glints':[[waterMat],'fragmentShader',s=>sub(s,'glints(xz, footprint, glitter)','0.0')],
      'water-ripples':[[waterMat],'fragmentShader',s=>['r0 = driftingRipples(xz * 0.041','r1 = driftingRipples(xz * 0.113','r2 = driftingRipples(xz * 0.31'].reduce((t,f)=>sub(t,f,f.slice(0,5)+'vec3(0.0); // '),s)],
      'water-mirror':[[waterMat],'fragmentShader',s=>sub(s,'vec3 refl = mix(sky, min(mirror, sky * 1.25 + 0.1), seen * (1.0 - pool));','vec3 refl = sky;')],
      'water-wind':[[waterMat],'fragmentShader',s=>sub(sub(s,'slope += windWaveSlope(xz, footprint);',''),'float stroke = clamp(dot(waterWindAt(xz), vec4(1.0)), 0.0, 1.0);','float stroke = 0.0;')],
      'water-paw':[[waterMat],'fragmentShader',s=>sub(s,'float paw = catsPaw(xz, along);','float paw = 1.0;')],
      'water-fog':[[waterMat],'fragmentShader',s=>sub(s,'vec4 fog = fogOf(vWorld);','vec4 fog = vec4(0.0);')],
      'water-sky':[[waterMat],'fragmentShader',s=>sub(s,'vec3 sky = skyColor(R);','vec3 sky = vec3(0.4, 0.5, 0.6);')],
      'water-cloud':[[waterMat],'fragmentShader',s=>sub(s,'float sh = cloudShadow(xz) *','float sh = 1.0 *')],
      // Water under land the terrain will cover: returns before any shading where the baked ground is a metre above the sea.
      'water-landskip':[[waterMat],'fragmentShader',s=>sub(s,'void main() {\\n  vec3 toCam','void main() {\\n  { vec2 u0 = domainUv(vWorld.xz); if (insideUv(u0) && texture(uHeightTex, u0).r > 1.0 && !roomHides(vWorld.xz)) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } }\\n  vec3 toCam')],
      'terrain-nodiscard':[[terrain.mesh.material],'fragmentShader',s=>sub(s,/discard;/g,'{}')],
      // Phase X2's exact skip, restoring the old path: E6 the glints outside the glitter lobe.
      'e6-off':[[waterMat],'fragmentShader',s=>sub(s,'if (glitter > 1e-9) sparkle','if (true) sparkle')],
      // Phase S, restoring the old path: s3-off roomHides evaluated at each use (three times per pixel, twice per surface sample).
      's3-off':[[waterMat],'fragmentShader',s=>sub(sub(sub(s,'if (hides) inside','if (roomHides(xz)) inside'),'float poolLevel = hides ?','float poolLevel = roomHides(xz) ?'),'float glass = hides ? 0.0 : mirrorWater(xz)','float glass = roomHides(vWorld.xz) ? 0.0 : mirrorWater(vWorld.xz)')],
      'water-caustics':[[waterMat],'fragmentShader',s=>sub(s,'caustics(bedXZ + sunIn.xz / sunDown * bedDepth, slope * 0.6, fp)','0.0')],
      'water-weed':[[waterMat],'fragmentShader',s=>sub(s,/float weed = [^;]*;/,'float weed = 0.0;')],
      // S4, a look change costed only: the sea's fog worked out per vertex and interpolated.
      'seafog-coarse':[[waterMat],'fragmentShader',s=>sub(sub(s,'in vec3 vSwell;','in vec3 vSwell;\nin vec4 vFog;'),'vec4 fog = fogOf(vWorld);','vec4 fog = vFog;')],
      'seafog-coarse-vert':[[waterMat],'vertexShader',s=>sub(sub(s,'out vec3 vSwell;','out vec3 vSwell;\nout vec4 vFog;'),'vWorld = w + at;','vWorld = w + at;\n  vFog = fogOf(vWorld);')],
      's3-off-vert':[[waterMat],'vertexShader',s=>sub(sub(s,'(hides ? 0.0 : boatsWaterBase(p)','(roomHides(p) ? 0.0 : boatsWaterBase(p)'),'(1.0 - (hides ? 0.0 : mirrorWater(p)))','(1.0 - (roomHides(p) ? 0.0 : mirrorWater(p)))')],
    };
    for(const v of ['s3-off','seafog-coarse'])if(variants.includes(v))variants=[...variants,v+'-vert'];
    const wanted=new Map();
    for(const [m,orig] of this.patchOriginals){wanted.set(m.uuid+'|vertexShader',[m,'vertexShader',orig.vertexShader]);if(m!==waterMat)wanted.set(m.uuid+'|fragmentShader',[m,'fragmentShader',orig.fragmentShader]);}
    // The water fragment and terrain fragment were already restored by the glass and tint handling above.
    for(const v of variants)if(patches[v]){const [mats,key,edit]=patches[v];for(const m of mats){const k=m.uuid+'|'+key;const cur=wanted.get(k)?.[2]??m[key];wanted.set(k,[m,key,edit(cur)]);}}
    for(const [,[m,key,source]] of wanted)if(m[key]!==source){m[key]=source;m.needsUpdate=true;}
    water.mesh.renderOrder=variants.includes('water-last')?1:0;
    // E5: the blades always drawn with the program that discards, as before.
    grass.unclipped=!variants.includes('e5-off');
    // S1: the ordinary sea's reflection every frame, as before.
    water.seaMirrorEvery=variants.includes('s1-off')?1:2;
  },
  // Each post stage drawn alone, many times over, then drained: its share of the chain, not a frame-boundary cost.
  async postPasses(reps, complete) {
    const b=post.bloom,q=b._fsQuad,r=renderer,out={};
    const quad=(material,target,clear)=>{q.material=material;r.setRenderTarget(target);if(clear)r.clear();q.render(r);};
    const oldAuto=r.autoClear;r.autoClear=false;
    const stages={
      scene:()=>{r.setRenderTarget(post.sceneTarget);r.clear();r.render(scene,rig.camera);},
      'msaa-clear-resolve':()=>{r.setRenderTarget(post.sceneTarget);r.clear();r.render(new THREE.Scene(),rig.camera);},
      clamp:()=>{post.quad.material=post.resolveMat;r.setRenderTarget(post.clean);post.quad.render(r);},
      'bloom-bright':()=>{b.highPassUniforms.tDiffuse.value=post.clean.texture;quad(b.materialHighPassFilter,b.renderTargetBright,true);},
    };
    for(let i=0;i<b.nMips;i++){
      const m=b.separableBlurMaterials[i],input=i?b.renderTargetsVertical[i-1]:b.renderTargetBright;
      stages['bloom-blur'+i+'-h']=()=>{m.uniforms.colorTexture.value=input.texture;m.uniforms.direction.value=b.constructor.BlurDirectionX;quad(m,b.renderTargetsHorizontal[i],true);};
      stages['bloom-blur'+i+'-v']=()=>{m.uniforms.colorTexture.value=b.renderTargetsHorizontal[i].texture;m.uniforms.direction.value=b.constructor.BlurDirectionY;quad(m,b.renderTargetsVertical[i],true);};
    }
    stages['bloom-composite']=()=>quad(b.compositeMaterial,b.renderTargetsHorizontal[0],true);
    stages['bloom-blend']=()=>{b.copyUniforms.tDiffuse.value=b.renderTargetsHorizontal[0].texture;quad(b.blendMaterial,post.clean,false);};
    stages.grade=()=>{post.quad.material=post.gradeMat;r.setRenderTarget(null);post.quad.render(r);};
    try {
      for(const [name,stage] of Object.entries(stages)){
        const n=name==='scene'?Math.max(4,reps>>3):reps,samples=[];
        for(let round=0;round<5;round++){stage();await complete();const start=performance.now();for(let i=0;i<n;i++)stage();await complete();samples.push((performance.now()-start)/n);}
        samples.sort((x,y)=>x-y);out[name]={ms:samples[2],min:samples[0],max:samples[4]};
      }
    } finally {r.autoClear=oldAuto;r.setRenderTarget(null);}
    out.sizes={scene:[post.sceneTarget.width,post.sceneTarget.height,post.sceneTarget.samples],bright:[b.renderTargetBright.width,b.renderTargetBright.height]};
    return out;
  },
  // REFLECTION_PASS=1: the sea's reflection pass drawn alone, many times over, then drained, in this chapter's rooms.
  async reflectionPass(reps, complete) {
    const refl=water.reflection,u=atmo.uniforms,samples=[];
    const pass=()=>{u.uMirrorPass.value=1;refl.render(rig.camera,c=>terrain.beginMirror(c),()=>terrain.endMirror());u.uMirrorPass.value=0;};
    const run=()=>{const rooms=visibleRooms(story.name,boat.position.z);setJourneyRooms(rooms);drawJourneyRooms(rooms,roomObjects,pass);};
    for(let round=0;round<7;round++){run();await complete();const start=performance.now();for(let i=0;i<reps;i++)run();await complete();samples.push((performance.now()-start)/reps);}
    samples.sort((x,y)=>x-y);
    return {ms:samples[3],min:samples[0],max:samples[6],scale:refl.scale,size:[refl.target.width,refl.target.height],mirrored:water.mesh.material.uniforms.uMirrorOn.value};
  },
  // WATER_PASS=1: the sea alone drawn into the scene target many times over, then drained, for each variant in turn
  // (ABBA order over the rounds): the shader's own cost with the rest of the frame out of the way.
  async waterPass(variants, reps, rounds, complete) {
    const shown=[];for(const o of scene.children)if(o.visible&&o!==water.mesh){shown.push(o);o.visible=false;}
    const out=Object.fromEntries(variants.map(v=>[v,[]]));
    try {
      const run=()=>{renderer.setRenderTarget(post.sceneTarget);renderer.clear();renderer.render(scene,rig.camera);};
      for(let round=0;round<rounds;round++)for(const v of round%2?[...variants].reverse():variants){
        this.configure(v==='new'?null:v);run();await complete();
        const start=performance.now();for(let i=0;i<reps;i++)run();await complete();out[v].push((performance.now()-start)/reps);
      }
    } finally {this.configure(null);for(const o of shown)o.visible=true;renderer.setRenderTarget(null);}
    return out;
  },
  stepWind() {
    wind.step(1/60,time,false);
    // The ping-pong targets swap every step, so rebind them as the real loop does.
    const u=atmo.uniforms;u.uWindTex.value=wind.texture;u.uBendTex.value=wind.bendTexture;u.uSwayTex.value=wind.swayTexture;
  },
  draw(sim=true) {
    renderer.info.reset();
    if (sim && this.omit !== 'wind') this.stepWind();
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
  // PATH moves the camera for step k (0..PATH_STEPS-1); the window then follows it and the frame is prepared as the loop does.
  pathStep(code,k) { eval(code); rig.camera.updateMatrixWorld(); followWindow(...windowAim()); prepareFrame(0); },
  pathSave() { return {position:rig.camera.position.clone(),quaternion:rig.camera.quaternion.clone()}; },
  pathRestore(saved) { rig.camera.position.copy(saved.position); rig.camera.quaternion.copy(saved.quaternion); rig.camera.updateMatrixWorld(); followWindow(...windowAim()); prepareFrame(0); },
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

const specks = omit => omit === 'glass-sky-always' || omit === 'e6-off';
const { browser, close } = await openBrowser();
const report=[],inexact=[];
try {
  for(const chapter of process.argv.slice(2).length ? process.argv.slice(2) : ['island','washing','meadow:walk','birches','drowned','wood','sleeping','sea','mirror','boats','jetty']) {
    const gate=QUIET_S?await quiet():undefined;if(gate)console.log(JSON.stringify({chapter,gate:{waitedS:gate.waitedS,contended:gate.contended,hot:gate.hot}}));
    const [entry,fixture]=chapter.split(':'),busyAtStart=busy();
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
      await route.fulfill({response,body:source+injection});
    });
    await page.goto((process.env.BASE??'http://127.0.0.1:5230/')+'?shot&start=1&ratio='+(process.env.RATIO??'1.5')+'&msaa='+(process.env.MSAA??'2')+'&analytics=0&progress=0'+(entry==='island'?'':'&chapter='+entry));
    await page.waitForSelector('#veil.ready',{timeout:300000});await page.locator('#begin').click();
    await page.waitForFunction(()=>window.__ready,null,{timeout:300000});
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
      // With GPU_QUIET, each ablation also waits (up to GATE_S, default 20 s) for other GPU users to go quiet, not just each chapter.
      for(const start=Date.now();GPU_QUIET&&Date.now()-start<Number(process.env.GATE_S??20)*1000&&busy().some(r=>!r.own&&GPU_USER.test(r.command));)await new Promise(r=>setTimeout(r,3000));
      const busyBefore=busy();
      const result=await page.evaluate(async ({name,rounds,draws,capture,poll,drainAll,pathCode,pathSteps})=>{
        const [omit,mode]=name.split('@');
        const gl=__game.renderer.getContext(), probe=__audit;probe.pairRebake=probe.changesHeights(omit);
        // setTimeout(0) polls in ~4.5 ms steps once nested; a message round trip is far finer.
        const channel=new MessageChannel();let wake=null;channel.port1.onmessage=()=>wake?.();
        async function complete(){const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();const end=performance.now()+20000;
          try{for(;;){const s=gl.clientWaitSync(fence,0,0);if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)return;
            if(s===gl.WAIT_FAILED||performance.now()>end)throw Error('GPU completion timeout');
            await new Promise(r=>{if(poll==='timeout')setTimeout(r,0);else{wake=r;channel.port2.postMessage(0);}});}}
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
        const drain=omit==='wind'||mode==='drain'||drainAll;
        async function measure(v){probe.configure(v);for(let i=0;i<3;i++)probe.draw();await complete();
          const start=performance.now();for(let i=0;i<draws;i++){probe.draw();if(drain)await complete();}await complete();return (performance.now()-start)/draws;}
        async function stepAlone(){probe.configure(null);for(let i=0;i<3;i++)probe.stepWind();await complete();
          const start=performance.now();for(let i=0;i<60;i++)probe.stepWind();await complete();return (performance.now()-start)/60;}
        const runs=[];
        for(let round=0;round<rounds;round++) {const order=round%2?[omit,null,null,omit]:[null,omit,omit,null];const values={baseline:[],omitted:[]};
          for(const v of order)values[v?'omitted':'baseline'].push(await measure(v));
          const baseline=(values.baseline[0]+values.baseline[1])/2,omitted=(values.omitted[0]+values.omitted[1])/2;
          runs.push({baseline,omitted,saved:baseline-omitted,percent:(1-omitted/baseline)*100});}
        const counts=v=>{probe.configure(v);probe.draw(false);return {...__game.renderer.info.render};};
        const submitted={baseline:counts(null),omitted:counts(omit)};
        const stepMs=omit==='wind'?await stepAlone():undefined;
        // Moving-camera exactness: the same pair of frames at every step of PATH, worst pixel over the path.
        let path;
        if(pathCode){const saved=probe.pathSave();path={steps:pathSteps,changed:0,max:0,worst:-1,stepsChanged:0};
          try{for(let k=0;k<pathSteps;k++){probe.pathStep(pathCode,k);const a=read(null),b=read(omit);let changed=0,max=0;
            for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d){changed++;if(d>max)max=d;}}
            path.changed+=changed;if(changed)path.stepsChanged++;if(max>path.max){path.max=max;path.worst=k;if(capture)path.images={baseline:encode(a),variant:encode(b)};}}}
          finally{probe.configure(null);probe.pathRestore(saved);}}
        probe.configure(null);probe.pairRebake=false;return {pixels,runs,submitted,images,stepMs,drained:drain,path};
      },{name:omit,drainAll:process.env.DRAIN==='1',rounds:Number(process.env.ROUNDS??4),draws:Number(process.env.DRAWS??10),capture:process.env.CAPTURE==='1',poll:process.env.POLL,pathCode:(process.env.PATH_ABLATIONS??omit).split(',').includes(omit)?process.env.PATH_JS:undefined,pathSteps:Number(process.env.PATH_STEPS??40)});
      if(result.path?.images){for(const [name,data]of Object.entries(result.path.images))await fs.writeFile(out+'-'+chapter+'-'+omit+'-path-'+name+'.png',Buffer.from(data,'base64'));delete result.path.images;}
      if(result.images)for(const [name,data]of Object.entries(result.images))await fs.writeFile(out+'-'+chapter+'-'+omit+'-'+name+'.png',Buffer.from(data,'base64'));
      const baselines=result.runs.map(r=>r.baseline),straddle=Math.max(...baselines)/Math.min(...baselines)>STRADDLE;
      const row={omit,busy:busyBefore,drained:result.drained,stepMs:result.stepMs,pixels:result.pixels,path:result.path,submitted:result.submitted,savedMs:median(result.runs.map(r=>r.saved)),percent:median(result.runs.map(r=>r.percent)),rangeMs:[Math.min(...result.runs.map(r=>r.saved)),Math.max(...result.runs.map(r=>r.saved))],baselines,straddle,runs:result.runs};
      if (omit === 'rebake') assert.equal(result.pixels.max, 0, 'Re-baking the window changed pixels');
      if (['culling-off','sky-last','full-tint'].includes(omit)) assert(result.pixels.max <= 1, omit+' changed visible pixels');
      // Exact skips are checked after every chapter has been measured, so one failure keeps the other rows.
      if (['terrain-skips-off','a1-off','a2-off','a3-off','veil-always','glass-sky-always','e5-off','e6-off','s3-off'].includes(omit) && result.pixels.max) {
        console.warn(`WARNING ${chapter} ${omit}: exact skip differs by ${result.pixels.max}/255 in ${result.pixels.changed} channels`);
        // The old glass path and the old glints (not the new ones) drop channels to 0 in scattered half-float samples on ANGLE/Metal.
        if (result.pixels.max > 1 && !(specks(omit) && result.pixels.changed < 2000)) inexact.push({chapter,omit,...result.pixels});
      }
      if (result.path?.max) {
        console.warn(`WARNING ${chapter} ${omit}: along PATH, ${result.path.max}/255 at step ${result.path.worst}, ${result.path.changed} channels over ${result.path.stepsChanged} steps`);
        if (result.path.max > 1 && !(specks(omit) && result.path.changed / result.path.stepsChanged < 2000)) inexact.push({chapter,omit,path:result.path});
      }
      if (omit === 'fields-direct') assert(result.pixels.max <= 3 && result.pixels.mean < .005, JSON.stringify(result.pixels));
      if (omit === 'colour-direct') assert(result.pixels.max <= 3 && result.pixels.mean < .01, JSON.stringify(result.pixels));
      ablations.push(row);console.log(JSON.stringify({chapter,omit,savedMs:row.savedMs,percent:row.percent,rangeMs:row.rangeMs,baselines,straddle,stepMs:row.stepMs,pixels:row.pixels,path:row.path}));
      if(row.stepMs>1)console.warn(`WARNING ${chapter} wind: one step alone took ${row.stepMs.toFixed(2)} ms (0.3-0.6 uncontended on the M4 Pro); another process is using the GPU and the saving is inflated; repeat it`);
      if(straddle)console.warn(`WARNING ${chapter} ${omit}: pair baselines straddle GPU states (${baselines.map(b=>b.toFixed(1)).join(', ')} ms); repeat it`);
    }
    const postPasses=process.env.POST_PASSES==='1'?await page.evaluate(async reps=>{
      const gl=__game.renderer.getContext(),channel=new MessageChannel();let wake=null;channel.port1.onmessage=()=>wake?.();
      async function complete(){const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
        try{for(;;){const s=gl.clientWaitSync(fence,0,0);if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)return;await new Promise(r=>{wake=r;channel.port2.postMessage(0);});}}finally{gl.deleteSync(fence);}}
      __audit.configure(null);return __audit.postPasses(reps,complete);
    },Number(process.env.POST_REPS??40)):undefined;
    if(postPasses)console.log(JSON.stringify({chapter,postPasses}));
    const reflectionPass=process.env.REFLECTION_PASS==='1'?await page.evaluate(async reps=>{
      const gl=__game.renderer.getContext(),channel=new MessageChannel();let wake=null;channel.port1.onmessage=()=>wake?.();
      async function complete(){const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
        try{for(;;){const s=gl.clientWaitSync(fence,0,0);if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)return;await new Promise(r=>{wake=r;channel.port2.postMessage(0);});}}finally{gl.deleteSync(fence);}}
      __audit.configure(null);return __audit.reflectionPass(reps,complete);
    },Number(process.env.POST_REPS??40)):undefined;
    if(reflectionPass)console.log(JSON.stringify({chapter,reflectionPass}));
    const waterPass=process.env.WATER_PASS?await page.evaluate(async ({variants,reps,rounds})=>{
      const gl=__game.renderer.getContext(),channel=new MessageChannel();let wake=null;channel.port1.onmessage=()=>wake?.();
      async function complete(){const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
        try{for(;;){const s=gl.clientWaitSync(fence,0,0);if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)return;await new Promise(r=>{wake=r;channel.port2.postMessage(0);});}}finally{gl.deleteSync(fence);}}
      return __audit.waterPass(variants,reps,rounds,complete);
    },{variants:['new',...process.env.WATER_PASS.split(',')],reps:Number(process.env.POST_REPS??40),rounds:Number(process.env.WATER_ROUNDS??12)}):undefined;
    if(waterPass){const med=a=>[...a].sort((x,y)=>x-y)[a.length>>1];console.log(JSON.stringify({chapter,waterPass:Object.fromEntries(Object.entries(waterPass).map(([k,v])=>[k,{median:med(v),min:Math.min(...v),max:Math.max(...v)}]))}));}
    const cullingViews=process.env.CULLING_VIEWS==='1'?await page.evaluate(()=>__audit.cullingViews()):[];
    assert(cullingViews.every(v=>v.max<=1),'Culling changed pixels at a view edge');
    const row={chapter,gate,busy:busyAtStart,frameTimes,cpu,census,ablations,postPasses,reflectionPass,waterPass,cullingViews,errors};report.push(row);
    await fs.writeFile(out+'.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify({chapter,frameTimes,frames:census.frames,passes:census.passes,objects:census.objects,ablations:ablations.map(({runs,...r})=>r),errors}));
    assert.deepEqual(errors,[]);await page.close();
  }
  assert.deepEqual(inexact,[],'exact skips changed visible pixels');
} finally { await close(); }
