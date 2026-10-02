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
// worldHeight again, as before the atlas. heights-const is the upper bound on the distant-height atlas: every height read beyond the window (terrain
// vertices, main and mirror, and the light bake's march) returns the open-sea floor instead of calling worldHeight.
// Ablations named in heightSources re-run the window-move bakes (ground, light, shore, grass tables) in configure
// on both sides of every pair, outside timed draws. ABLATIONS=rebake is the baseline re-baked; it must match exactly.
// The wind ablation waits for the GPU after every draw, as a frame boundary does, and also times 60 steps alone
// (stepMs). Back to back, the scene's read of what the step just wrote stops one draw overlapping the next, which
// inflated the saving several-fold; under another process's GPU load each of the step's 21 dependent passes waits
// its turn and a step alone takes 3-5 ms (tools/wind-cost.mjs).
// Any ablation suffixed @drain (bloom@drain) waits for the GPU after every draw the same way; bloom and other chains of
// small passes the frame reads back lose overlap with the next draw when drawn back to back.
// QUIET=600 waits up to 600 s before each chapter until no other non-system process is above 50% CPU; rows record it.
// POLL=timeout polls fences with setTimeout(0), the pre-9b69229 behaviour, for A/B checks of the poll.
// grade replaces the final grade with a plain copy, keeping the resolve and bloom.
// RATIO and MSAA override the page's ratio=1.5&msaa=2. DRAIN=1 waits for the GPU after every draw in every ablation.
// Levers (look-changing, costed only): scale-<ratio>, msaa-<samples>, bloom-half; none pairs the baseline with itself.
// msaa-nodepth swaps in a scene target built to neither resolve nor store its multisampled depth. On Chrome/ANGLE Metal
// it renders without antialiasing (pixels match msaa-0) and is no faster, so it is not an exact skip.
// Breakdowns: grass-frag-flat, grass-nodiscard, grass-fog, grass-cloud, grass-shade (frost, morning, lamp, dawn), grass-life,
// grass-collapse (every blade discarded at its first instruction), grassLod0..2; birchesTrunks/Canopy/Litter/Scarf/Leaves/Other;
// water-frag-flat, water-vert-flat, water-bed, water-surf, water-glints, water-ripples, water-mirror, water-wind, water-paw,
// water-fog, water-sky, water-cloud, water-landskip (returns at its top over land, not exact), water-last (drawn after the other opaques); terrain-nodiscard. POST_PASSES=1 times each post stage alone (POST_REPS); REFLECTION_PASS=1 the sea's reflection pass alone;
// WATER_PASS=s3-off,none,... the sea alone against each listed variant (WATER_ROUNDS, POST_REPS).
// Exact skips, each restoring the old path: e5-off (grass always drawn with its discards), e6-off (glints everywhere).
// Fine noise terms, each replaced with a constant everywhere it is compiled: n-grain (terrain grain and sand
// ripples), n-moss (Wood floor moss and flecks), n-tuft (Sleeping floor tuft and fibre), n-frost (frostAt's pattern),
// n-frostline (the terrain's frost-edge pattern), n-woodtint (the Wood tint), n-bed (the shallow seabed), n-surfphase
// (the surf's static phase). Combine with +. noise-live computes every term the noise tile replaced procedurally again, as
// before the tile; live-tuft, live-frost and live-frostline each do so for one term.
// The sea: s1-off (the ordinary sea's reflection every frame), s3-off (roomHides at each use); seafog-fine restores
// the sea's fog per pixel. Draws alternate the reflection, so time s1-off with DRAWS even. water-caustics
// and water-weed remove those seabed terms: upper bounds for skipping them where they are exactly 0.
// sea-weed-off works the weed out at every depth again (the old path). landskip-off and landskip-on draw the sea
// without or with its return under land (LAND_SKIP) whatever prepareFrame chose; water-far-ub returns everywhere
// beyond the window's inner part, the upper bound for a return under land there (not exact).
// grass-bare-tiles leaves out the grass tiles in which no blade can stand at any density: the most skipping empty tiles could save.
// PATH_JS='<js>' PATH_STEPS=40 also compares each ablation's frames along a camera path: the code runs in main.ts's scope with
// the step in k and places rig.camera; the window follows and prepareFrame runs as in the loop. ROUNDS=0 skips the timing.
// PATH_ABLATIONS=e5-off,... limits the path to those ablations.
// The stairs: stairs:waiting|climb|loop|cloud|top|sail|fog play the chapter to that moment with real gestures (stairsFixture).
// Their parts: stairs (the whole room), stairsCloud (deck top and underside, towers, wake), stairsCloudTop,
// stairsCloudBelly, stairsTowers, stairsWake, stairsWisps, stairsBank, stairsHaze (the mist under the flights),
// stairsSteps (the flights, landings, the loop's trick and the gold ghosts). deck-out compiles the cloud deck out of every
// shader that includes ATMO_GLSL (exact outside the stairs); deck-out-water|terrain|grass|sky|rest only from one family.
// stairs-unindexed draws the flights and landings unindexed, as before they were indexed.
// cloudtop-frag-flat, cloudtop-veil: the deck top's shading and its streaming wisps; wisps-early: candidate exact skip.
// grid-cull-off works out every point of the cloud's top and underside again, those round which nothing is in view too.
// sky-deckfirst skips the sky's radiance where the deck covers it whole (a candidate exact skip).
// water-lantern-reach works the lantern's glint out only within its 9 m reach (candidate exact skip).
// water-lantern and water-hull remove the lantern's light and glint and the hull's wet collar from the sea (uniform-gated).
// LEVEL=ultra|high|medium|low|last applies that level's world settings after the fixture (render scale and
// multisampling stay as RATIO and MSAA lock them); GRASS_DENSITY and GRASS_REACH then override the grass.
// SIM_PASSES=1 times each per-frame simulation pass alone (wind, life, clouds, petals, waves) plus the light bake and a
// full grass-table rebuild (SIM_REPS each, drained).
// Every ablation reports its bite: programs patched, objects hidden (and how many were showing), draw calls and
// triangles against the baseline; one that changes nothing throws. No pixels changed with a bite is an exact skip here.
// BASE must be a dev server (npm run dev, or a worktree's): the tool patches src/main.ts, which a built bundle does not serve.
// FRAME=600 stops the run on that frame with a seeded Math.random and every readback delivered the frame after its
// request, so two loads draw the same picture; a stairs fixture is then played on frames (stairsFixtureOnFrames) and
// stops on the frame its moment arrives. It skips the CPU profile and census. COMPARE_BASE=<another dev server> loads
// the same fixture there first and reports the difference between the two frozen frames (changed channels, those over
// 1/255, the worst, its bounding box, and any drift in camera, boat, child, cygnet or counts); COMPARE_MAX=1 fails the
// run above that; CAPTURE=1 saves both frames. A build against itself must read 0. With PATH_JS, both builds then step
// their cameras along the path (PATH_STEPS) and every step is compared the same way.
// ALONG=10 under COMPARE_BASE plays both builds together from the fixture frame to the moment, held on every tenth frame
// until both have been read as their loops drew it; frames whose hashes differ are compared (CAPTURE=1 saves those over
// COMPARE_MAX). stairs:drowned plays the whole chapter on out into the village. STATE runs on BASE's page alone.
// Under FRAME three's UUIDs draw from a stream of their own, so a build that creates more or fewer objects at boot
// keeps the game's random stream (read the randoms drift field if a comparison still drifts).
// mirror-merge draws the sky mirror's pieces placed by translation alone as one mesh per material at the float32
// positions the GPU computed: not exact, touching pieces lose their front-to-back order and so exact depth ties along
// where they meet; mirror-dark leaves its unlit guide and opacity-0 lines undrawn (exact, about nothing saved);
// mirror-ordinary renders its reflection at the ordinary sea's size and cadence (a look change, costed only).
// boatsBath hides the little boats' static bath and plug: the most merging them could save (not exact).
// Every pair's baseline is reported. An ablation whose max/min pair baseline exceeds 1.4 straddles two GPU states:
// it is flagged straddle:true with a warning; repeat it.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { openBrowser } from './lib/browser.mjs';
import { stairsFixture, stairsFixtureOnFrames } from './lib/stairs-fixture.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';

const out = process.env.OUT ?? '/tmp/updraft-frame-profile';
const STRADDLE = 1.4;
const BASE=process.env.BASE??'http://127.0.0.1:5230/',COMPARE_BASE=process.env.COMPARE_BASE,FRAME=Number(process.env.FRAME??0);
const PATH_JS=process.env.PATH_JS,PATH_STEPS=Number(process.env.PATH_STEPS??40);
const ALONG=Number(process.env.ALONG??0);
assert(!ALONG||COMPARE_BASE,'ALONG compares against COMPARE_BASE');
assert(!FRAME||FRAME>=120,'FRAME must leave room for the fixture: 120 or more');
assert(!COMPARE_BASE||FRAME,'COMPARE_BASE needs FRAME: two builds draw the same picture only when both stop on the same frame');
// Fixtures are applied on this frame when FRAME is set, so the same story follows in every run.
const FIXTURE_FRAME=90;
// Other processes' load, recorded with every row: it inflates GPU numbers.
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
  paused: false, stopAt: 0, census: false, frames: [], passes: {}, objects: {}, cpu: {}, stack: [], skyOrder:sky.renderOrder,
  groups: {
    sky: [sky], water: [water.mesh], terrain: [terrain.mesh], grass: [grass.group], tree: [tree.group],
    pond: pond.objects, washing: [washing.group, washingBaskets, pinwheels.group, door.group],
    village: village.objects, wood: wood.objects, sleeping: sleeping.objects, birches: birches.objects,
    cottage: cottage.objects, jetty: [homeJetty], piano: [piano.group], mirror: [skyMirror.group],
    littleBoats: [littleBoats.group], boatsBath: ['dream-bathtub','bath-plug'].map(n=>littleBoats.group.getObjectByName(n)),
    islandCreatures: [creatures.group], meadowCreatures: [hillCreatures.group],
    child: child.objects, cygnet: cygnet.objects, glider: glider.objects, boat: boat.objects,
    flock: flock.objects, rocks: [islandRocks], shoreGrass: [shoreGrass], petals: [petals.mesh], windLines: [lines.batch.mesh],
    rain: [rain.mesh], fireflies: [fireflies.mesh],
    drawing: [drawing.mesh], embers: [embers.mesh], starlings: [starlings.mesh], seaLife: sealife.objects,
    kites: Object.values(departureKites.markers).map(m => m.group),
    birchesTrunks: birches.objects.filter(o => o.geometry?.attributes?.aIndex && !o.material?.alphaToCoverage),
    birchesCanopy: birches.objects.filter(o => o.material?.uniforms?.uCanopyMotion),
    birchesLitter: [birches.litterMesh], birchesScarf: [birches.scarf.mesh], birchesLeaves: [birches.leaves.mesh],
    grassLod0: [grass.group.children[0]], grassLod1: [grass.group.children[1]], grassLod2: [grass.group.children[2]],
    stairs: [cloudStairs.group], stairsCloud: [cloudStairs.cloud.group],
    stairsCloudTop: [cloudStairs.cloud.top], stairsCloudBelly: [cloudStairs.cloud.belly], stairsTowers: [cloudStairs.cloud.towers.group],
    stairsWake: [cloudStairs.cloud.wake.mesh], stairsWisps: [cloudStairs.wisps.mesh], stairsBank: [cloudStairs.bank.mesh],
    stairsHaze: [...cloudStairs.hazes],
    stairsSteps: [cloudStairs.group.getObjectByName('stairs-standing'), cloudStairs.trick, ...cloudStairs.pieces.flatMap(p=>[p.group.children[0],p.ghost])],
  },
  // Ablations that change a height source: both sides of each of their pairs re-run the window-move bakes.
  heightSources: ['rebake','heights-const','heights-direct'],
  changesHeights(omit) { return (omit||'').split('+').some(v=>this.heightSources.includes(v)); },
  rebake() {
    bakedSun.copy(atmo.uniforms.uSunDir.value);bakes.bake(bakeInputs);water.bakeShore(WINDOW.size);
    grass.tablesDirty=true;grass.bake(renderer);
  },
  record(cpuStart, realDt) { if (!this.paused) this.frames.push({ cpuMs: performance.now()-cpuStart, intervalMs: realDt*1000 }); },
  // ALONG: every Nth frame from the fixture frame on is read as the loop drew it, and the loop holds there until released.
  sample() {
    const along=window.__along;
    if (!along || frameIndex < along.from || frameIndex % along.every) return;
    const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    if (this.pixels?.length !== w*h*4) this.pixels=new Uint8Array(w*h*4);
    renderer.setRenderTarget(null);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,this.pixels);
    const words=new Uint32Array(this.pixels.buffer);let a=0x811c9dc5,b=0x9e3779b9;
    for(let i=0;i<words.length;i++){a=Math.imul(a^words[i],16777619);b=Math.imul(b+words[i]|0,0x85ebca6b)^(b>>>13);}
    const at=v=>v.toArray().map(x=>+x.toFixed(4));
    this.sampled={frame:frameIndex,width:w,height:h,hash:[a>>>0,b>>>0],state:{story:story.name,beat:story.current.beat,
      camera:[...at(rig.camera.position),...at(rig.camera.quaternion)],boat:at(boat.position),child:at(child.position),cygnet:at(cygnet.position),
      randoms:window.__randoms}};
    this.paused=true;
  },
  sampleData(capture) {
    let binary='';for(let i=0;i<this.pixels.length;i+=32768)binary+=String.fromCharCode.apply(null,this.pixels.subarray(i,i+32768));
    return {data:btoa(binary),png:capture?this.png(this.pixels):undefined};
  },
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
      ['stairs-update',cloudStairs,'update'], ['stairs-cloud',cloudStairs.cloud,'update'], ['story',story,'update'],
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
    this.gridCull ??= [cloudStairs.cloud.top,cloudStairs.cloud.belly].map(o=>[o,o.onBeforeRender]);
    for(const [o,before] of this.gridCull) o.onBeforeRender=skips.includes('grid-cull-off')?()=>{for(const p of o.material.uniforms.uView.value)p.set(0,0,0,1);}:before;
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
      const sky0=this.diagnosticMaterials[1][1],site=['vec3 col = skyRadiance(d);','? skyRadiance(d) :'].find(s=>sky0.includes(s));
      if(!site)throw Error('Missing patch site: sky radiance');
      m.fragmentShader=sky0.replace(site,site.replace('skyRadiance(d)','vec3(0.5,0.6,0.7)'));m.needsUpdate=true;
    }
    // The cloud deck's top: cloudtop-frag-flat keeps its discards and fog but not its shading; cloudtop-veil drops the
    // low wisps streaming over it; wisps-early discards a puff card's pixels outside the largest ball its noise can make
    // before working the noise out (a candidate exact skip).
    {
      const top=cloudStairs.cloud.top.material,puff=cloudStairs.wisps.mesh.material;
      this.topFrag??=top.fragmentShader;this.puffFrag??=puff.fragmentShader;
      let t=this.topFrag,f=this.puffFrag;
      const need=(src,from)=>{if(!src.includes(from))throw Error('Missing patch site: '+from);return src;};
      if(variants.includes('cloudtop-veil'))t=need(t,'if (uWisps > 0.0 && vWorld.y').replace('if (uWisps > 0.0 && vWorld.y','if (false && vWorld.y');
      if(variants.includes('cloudtop-frag-flat'))t=t.slice(0,t.lastIndexOf('void main() {'))+'void main() { if (vRing > uReach || gridHidden(vWorld.xz, vLevel)) discard; gl_FragColor = vec4(mix(vec3(0.8, 0.7, 0.75) + vHaze.rgb * 0.01 + vec3(vThin, vShade, vStature) * 0.01 + vCalm.xyz * 0.001 + (vFoot + vRise + vTower) * 0.001, vFog.rgb, vFog.a), uCloudDeck.w); }';
      if(variants.includes('wisps-early'))f=need(f,'  float d = length(vCorner);\\n').replace('  float d = length(vCorner);\\n','  float d = length(vCorner);\\n  if (d >= 1.25) discard;\\n');
      if(top.fragmentShader!==t){top.fragmentShader=t;top.needsUpdate=true;}
      if(puff.fragmentShader!==f){puff.fragmentShader=f;puff.needsUpdate=true;}
    }
    // stairs-unindexed: the flights and landings as the triangle list they were before indexing, the same triangles.
    {
      const meshes=[cloudStairs.group.getObjectByName('stairs-standing'),cloudStairs.trick,...cloudStairs.pieces.map(p=>p.group.children[0])];
      this.stairsIndexed??=new Map(meshes.map(m=>[m,m.geometry]));this.stairsSoup??=new Map();
      this.stairsUnindexed=variants.includes('stairs-unindexed');
      for(const m of meshes){const indexed=this.stairsIndexed.get(m);
        if(this.stairsUnindexed&&!indexed.index)throw Error('Missing patch site: the stairs mesh is not indexed');
        const g=this.stairsUnindexed?this.stairsSoup.get(m)??this.stairsSoup.set(m,indexed.toNonIndexed()).get(m):indexed;
        if(m.geometry!==g)m.geometry=g;}
    }
    // sky-deckfirst: the candidate exact skip, the deck worked out first and the sky's radiance only where it shows through.
    if(variants.includes('sky-deckfirst')) {
      const m=sky.material,sky0=this.diagnosticMaterials[1][1];
      const from='vec3 col = skyRadiance(d);\\n  if (uCloudDeck.w > 0.0) {\\n    vec4 deck = cloudDeck(cameraPosition, d, 4000.0);\\n    col = mix(col, deck.rgb, deck.a);\\n  }';
      if(!sky0.includes(from))throw Error('Missing patch site: sky deck');
      m.fragmentShader=sky0.replace(from,'vec4 deck = uCloudDeck.w > 0.0 ? cloudDeck(cameraPosition, d, 4000.0) : vec4(0.0);\\n  vec3 col = deck.a < 1.0 ? skyRadiance(d) : vec3(0.0);\\n  if (uCloudDeck.w > 0.0) col = mix(col, deck.rgb, deck.a);');m.needsUpdate=true;
    }
    if(variants.includes('grade')) {
      const m=post.gradeMat,original=this.diagnosticMaterials[2][1];
      m.fragmentShader=original.slice(0,original.lastIndexOf('void main() {'))+'void main() { gl_FragColor=vec4(texture2D(tDiffuse,vUv).rgb,1.0); }';m.needsUpdate=true;
    }
    const actors=['child','cygnet','boat','glider','flock','meadowCreatures','islandCreatures','kites','petals','windLines'];
    for (const key of variants.includes('actors')?actors:variants)for(const object of this.groups[key]||[]) {
      this.hidden.push([object,object.visible]);object.visible=false;
    }
    this.mirrorMerge(variants.includes('mirror-merge'));
    this.mirrorDark(variants.includes('mirror-dark'));
    this.levers(variants);
    this.patchShaders(variants);
    this.noiseTerms(variants);
    this.bareTiles(variants.includes('grass-bare-tiles'));
    this.deckOut(variants.includes('deck-out')?'all':(variants.find(v=>v.startsWith('deck-out-'))||'').slice(9)||null);
    if(this.pairRebake)this.rebake();
  },
  // mirror-merge: the sky mirror's pieces placed by translation alone drawn as one mesh per material, each vertex the
  // float32 sum the GPU would have made of it (a candidate exact merge; on a build that already merges them it throws).
  mirrorMerge(on) {
    if(!on)return;
    if(!this.mirrorMerged){
      const byMaterial=new Map();
      for(const o of skyMirror.group.children)if(o.isMesh&&!o.matrixAutoUpdate&&!o.material.transparent&&o.quaternion.equals(new THREE.Quaternion())&&o.scale.equals(new THREE.Vector3(1,1,1))&&o.geometry.index)
        (byMaterial.get(o.material)??byMaterial.set(o.material,[]).get(o.material)).push(o);
      this.mirrorMerged=[];
      for(const [material,meshes] of byMaterial){
        if(meshes.length<2)continue;
        const names=Object.keys(meshes[0].geometry.attributes),count=meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0);
        const arrays=Object.fromEntries(names.map(n=>[n,new Float32Array(count*meshes[0].geometry.attributes[n].itemSize)]));
        const index=[];let base=0;
        for(const m of meshes){const g=m.geometry,t=[m.position.x,m.position.y,m.position.z].map(Math.fround);
          for(const n of names){const a=g.attributes[n],out=arrays[n];for(let i=0;i<a.count;i++)for(let c=0;c<a.itemSize;c++){const v=a.array[i*a.itemSize+c];out[(base+i)*a.itemSize+c]=n==='position'?Math.fround(v+t[c]):v;}}
          for(const i of g.index.array)index.push(base+i);base+=g.attributes.position.count;}
        const geometry=new THREE.BufferGeometry();for(const n of names)geometry.setAttribute(n,new THREE.BufferAttribute(arrays[n],meshes[0].geometry.attributes[n].itemSize));
        geometry.setIndex(index);const merged=new THREE.Mesh(geometry,material);merged.layers.mask=meshes[0].layers.mask;merged.visible=false;
        skyMirror.group.add(merged);this.mirrorMerged.push({merged,meshes});
      }
      if(!this.mirrorMerged.length)throw Error('Missing patch site: nothing in the sky mirror to merge');
    }
    for(const {merged,meshes} of this.mirrorMerged){for(const m of meshes){this.hidden.push([m,m.visible]);m.visible=false;}this.hidden.push([merged,false]);merged.visible=true;}
  },
  // mirror-dark: the constellation's lines at opacity 0 and the approach's guide with no light in it left undrawn.
  mirrorDark(on) {
    if(!on)return;
    const dark=[];
    skyMirror.group.traverse(o=>{if(o.isMesh&&o.material.isMeshBasicMaterial&&o.material.transparent&&o.material.opacity===0)dark.push(o);
      if(o.isMesh&&o.material.uniforms?.uLit&&o.material.uniforms.uLit.value.toArray().every(v=>v===0))dark.push(o);});
    if(!dark.some(o=>o.visible))throw Error('Missing patch site: nothing dark in the sky mirror is drawn');
    for(const o of dark){this.hidden.push([o,o.visible]);o.visible=false;}
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
    // mirror-ordinary: the sky mirror's reflection at the ordinary sea's size and cadence (a look change, costed only).
    this.mirrorCadence??=[water.mirrorScale,water.mirrorEvery];
    [water.mirrorScale,water.mirrorEvery]=variants.includes('mirror-ordinary')?[0.25,2]:this.mirrorCadence;
    const w=post.sceneTarget.width,h=post.sceneTarget.height,half=variants.includes('bloom-half');
    const want=half?[Math.round(w/2),Math.round(h/2)]:[w,h];
    if(this.bloomSize?.[0]!==want[0]||this.bloomSize?.[1]!==want[1]){post.bloom.setSize(want[0],want[1]);this.bloomSize=want;}
  },
  // grass-bare-tiles: the upper bound on skipping empty tiles, tiles in which no blade can stand (every blade's keep is 0 in its table)
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
  // Diagnostic shader edits for the grass, water and terrain breakdowns. Each names what it removes.
  patchShaders(variants) {
    const main=(source,body)=>source.slice(0,source.lastIndexOf('void main() {'))+body;
    const sub=(source,from,to)=>{if(typeof from==='string'?!source.includes(from):!from.test(source))throw Error('Missing patch site: '+from);return source.replace(from,to);};
    const grassMats=grass.group.children.filter(o=>o.isMesh).map(o=>o.material),waterMat=water.mesh.material;
    this.patchOriginals??=new Map([...grassMats,waterMat].map(m=>[m,{vertexShader:m.vertexShader,fragmentShader:m.fragmentShader}]));
    const patches={
      'grass-frag-flat':[grassMats,'fragmentShader',s=>main(s,'void main() { gl_FragColor = vec4(vTint * 0.5 + vRoot * 0.1 + vFlower.rgb * vFlower.a * 0.01 + vec3(vT, vFlat, vSun) * 0.01 + vec3(vAo, 0.0) * 0.01 + vLocalLight * 0.01 + (vNormal + vSideDir + vGroundN) * 0.001 + vWorld * 1e-6 + vFog.rgb * vFog.a * 0.01, 1.0); }')],
      // The unclipped blade program has no discards to remove.
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
      'water-fog':[[waterMat],'fragmentShader',s=>sub(s,'vec4 fog = vFog.a > 0.9 ? fogOf(vWorld) : vFog;','vec4 fog = vec4(0.0);')],
      'water-sky':[[waterMat],'fragmentShader',s=>sub(s,'vec3 sky = skyColor(R);','vec3 sky = vec3(0.4, 0.5, 0.6);')],
      'water-cloud':[[waterMat],'fragmentShader',s=>sub(s,'float sh = cloudShadow(xz) *','float sh = 1.0 *')],
      // Water under land the terrain will cover: returns before any shading where the baked ground is a metre above the sea.
      'water-landskip':[[waterMat],'fragmentShader',s=>sub(s,'void main() {\\n  vec3 toCam','void main() {\\n  { vec2 u0 = domainUv(vWorld.xz); if (insideUv(u0) && texture(uHeightTex, u0).r > 1.0 && !roomHides(vWorld.xz)) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } }\\n  vec3 toCam')],
      'terrain-nodiscard':[[terrain.mesh.material],'fragmentShader',s=>sub(s,/discard;/g,'{}')],
      // Restores the old path: the glints worked out outside the glitter lobe too.
      'e6-off':[[waterMat],'fragmentShader',s=>sub(s,'if (glitter > 1e-9) sparkle','if (true) sparkle')],
      // Restores the old path: s3-off roomHides evaluated at each use (three times per pixel, twice per surface sample).
      's3-off':[[waterMat],'fragmentShader',s=>sub(sub(sub(s,'if (hides) inside','if (roomHides(xz)) inside'),'float poolLevel = hides ?','float poolLevel = roomHides(xz) ?'),'float glass = hides ? 0.0 : mirrorWater(xz)','float glass = roomHides(vWorld.xz) ? 0.0 : mirrorWater(vWorld.xz)')],
      'water-lantern':[[waterMat],'fragmentShader',s=>sub(sub(s,'if (uLantern.w > 0.001) {','if (false) {'),' + lanternLight(vWorld, vec3(0.0, 1.0, 0.0)) * 0.5;',';')],
      // Candidate exact skip: the lantern's glint only within its reach (tuning.lantern.reach, 9 m), where lanternLight is not 0.
      'water-lantern-reach':[[waterMat],'fragmentShader',s=>sub(s,'if (uLantern.w > 0.001) {','if (uLantern.w > 0.001 && dot(uLantern.xyz - vWorld, uLantern.xyz - vWorld) < 81.0) {')],
      'water-hull':[[waterMat],'fragmentShader',s=>sub(s,'if (uHullWet.x > 0.0) {','if (false) {')],
      'water-caustics':[[waterMat],'fragmentShader',s=>sub(s,'caustics(bedXZ + sunIn.xz / sunDown * bedDepth, slope * 0.6, fp)','0.0')],
      'water-weed':[[waterMat],'fragmentShader',s=>sub(s,/float weed = [^;]*;/,'float weed = 0.0;')],
      // Restore the old paths: sea-weed-off the seabed's weed worked out at every depth. landskip-off and landskip-on
      // pick the sea's program without or with the return under land, whatever prepareFrame chose.
      'sea-weed-off':[[waterMat],'fragmentShader',s=>sub(s,'    if (bedDepth > 0.9 && bedDepth < 4.0) {\\n','    {\\n')],
      // Upper bound for a return under land beyond the window: every sea pixel outside the window's inner part returns.
      'water-far-ub':[[waterMat],'fragmentShader',s=>sub(s,'  float surfBlur = fwidth(offshore) / BORE_SPACING * 1.5;\\n','  float surfBlur = fwidth(offshore) / BORE_SPACING * 1.5;\\n  if (inside < 1.0 && !hides) {\\n    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\\n    return;\\n  }\\n')],
      // Restores the old path: the sea's fog worked out per pixel.
      'seafog-fine':[[waterMat],'fragmentShader',s=>sub(s,'vec4 fog = vFog.a > 0.9 ? fogOf(vWorld) : vFog;','vec4 fog = fogOf(vWorld);')],
      's3-off-vert':[[waterMat],'vertexShader',s=>sub(sub(s,'(hides ? 0.0 : boatsWaterBase(p)','(roomHides(p) ? 0.0 : boatsWaterBase(p)'),'(1.0 - (hides ? 0.0 : mirrorWater(p)))','(1.0 - (roomHides(p) ? 0.0 : mirrorWater(p)))')],
    };
    if(variants.includes('s3-off'))variants=[...variants,'s3-off-vert'];
    const wanted=new Map();
    for(const [m,orig] of this.patchOriginals){wanted.set(m.uuid+'|vertexShader',[m,'vertexShader',orig.vertexShader]);if(m!==waterMat)wanted.set(m.uuid+'|fragmentShader',[m,'fragmentShader',orig.fragmentShader]);}
    // The water fragment and terrain fragment were already restored by the glass and tint handling above.
    for(const v of variants)if(patches[v]){const [mats,key,edit]=patches[v];for(const m of mats){const k=m.uuid+'|'+key;const cur=wanted.get(k)?.[2]??m[key];wanted.set(k,[m,key,edit(cur)]);}}
    for(const [,[m,key,source]] of wanted)if(m[key]!==source){m[key]=source;m.needsUpdate=true;}
    water.mesh.renderOrder=variants.includes('water-last')?1:0;
    // The blades always drawn with the program that discards, as before.
    grass.unclipped=!variants.includes('e5-off');
    // The ordinary sea's reflection every frame, as before.
    water.seaMirrorEvery=variants.includes('s1-off')?1:2;
    // A build before LAND_SKIP has no landSkip; it is the comparison page under COMPARE_BASE.
    if(water.landSkip)selectAll({LAND_SKIP:variants.includes('landskip-off')?false:variants.includes('landskip-on')?true:water.landSkip(rig.camera)});
  },
  // Each fine noise term replaced with a constant, wherever its shared chunk is compiled. The blades'
  // fragment programs are left alone (the unclipped swap replaces them by string, and none of them calls these terms).
  noiseTerms(variants) {
    // Each substitution lists the procedural call, then the noise tile's where it has one.
    const F=(p,d)=>'tiledFbm('+p+', fp.dx * '+d+', fp.dy * '+d+')';
    const terms={
      'n-grain':[[['vnoise(xz * 1.7) * 0.5 + vnoise(xz * 6.0) * 0.5'],'0.5'],[['vnoise(xz * 0.3) * 6.0'],'3.0']],
      'n-moss':[[['fbm(xz * 0.24 + 19.0)'],'0.5'],[['vnoise(xz * 9.0)'],'0.5']],
      'n-tuft':[[['fbm(xz * 0.17 + 13.0)',F('xz * 0.17 + 13.0','0.17')],'0.5'],[['vnoise(xz * vec2(12.0, 5.0))'],'0.5']],
      'n-frost':[[['fbm(xz * 0.12)','tiledFbmFixed(xz * 0.12)'],'0.5']],
      'n-frostline':[[['fbm(xz * 0.35)',F('xz * 0.35','0.35')],'0.5']],
      'n-woodtint':[[['fbm(xz * 0.32)'],'0.5']],
      'n-bed':[[['vnoise(bedXZ * 1.7) * 0.5 + vnoise(bedXZ * 6.0) * 0.5'],'0.5'],[['vnoise(bedXZ * 0.3) * 6.0'],'3.0'],
        [['vnoise(bedXZ * 0.08 + 3.1) * 0.75 + vnoise(bedXZ * 0.27) * 0.25'],'0.5']],
      'n-surfphase':[[['vnoise(xz * 0.016) * 1.8 + vnoise(xz * 0.057 + 7.3) * 0.3'],'0.5']],
      // One tiled term computed procedurally again, as before the tile: the pair is that term's own net saving.
      'live-tuft':[[[F('xz * 0.17 + 13.0','0.17')],'fbm(xz * 0.17 + 13.0)']],
      'live-frost':[[['tiledFbmFixed(xz * 0.12)'],'fbm(xz * 0.12)']],
      'live-frostline':[[[F('xz * 0.35','0.35')],'fbm(xz * 0.35)']],
    };
    // Every tiled term procedural again: the texture paired against what it replaced.
    terms['noise-live']=['live-tuft','live-frost','live-frostline'].flatMap(v=>terms[v]);
    const blades=new Set(grass.group.children.filter(o=>o.isMesh).map(o=>o.material));
    const mats=new Set([terrain.mesh.material,water.mesh.material,...grass.lods.map(l=>l.tableMat)]);
    scene.traverse(o=>{for(const m of [o.material].flat())if(m?.fragmentShader)mats.add(m);});
    const tagged=(v,i,k,to)=>'('+to+'/*nz:'+v+':'+i+':'+k+'*/)';
    let tables=false;const hits=new Set();
    for(const m of mats)for(const key of ['vertexShader','fragmentShader']) {
      if(key==='fragmentShader'&&blades.has(m))continue;
      let source=m[key];
      for(const [v,subs] of Object.entries(terms))subs.forEach(([froms,to],i)=>froms.forEach((from,k)=>{source=source.split(tagged(v,i,k,to)).join(from);}));
      for(const v of variants)(terms[v]||[]).forEach(([froms,to],i)=>froms.forEach((from,k)=>{if(source.includes(from))hits.add(v+':'+i);source=source.split(from).join(tagged(v,i,k,to));}));
      if(m[key]!==source){m[key]=source;m.needsUpdate=true;tables||=grass.lods.some(l=>l.tableMat===m);}
    }
    for(const v of variants)(terms[v]||[]).forEach((_,i)=>{if(!hits.has(v+':'+i))throw Error('Missing noise term: '+v+':'+i);});
    if(tables){grass.tablesDirty=true;grass.bake(renderer);}
  },
  // deck-out compiles the stairs' cloud deck out of every shader that includes ATMO_GLSL: each test of its amount
  // becomes a constant false, so the deck, the bank of mist and their helpers are dead code. Outside the stairs the
  // deck's amount is 0, so no pixel may change there; any saving is what its presence costs (registers, code size).
  // The blades' fragment programs are left alone (their fog comes from the vertex).
  // deck-out-water|terrain|grass|sky|rest limit it to one family of materials.
  deckOut(which) {
    const on=!!which,A='uCloudDeck.w > 0.0',B='false/*deck-out*/';
    const blades=new Set(grass.group.children.filter(o=>o.isMesh).map(o=>o.material));
    const mats=new Set([terrain.mesh.material,water.mesh.material,sky.material,...grass.lods.map(l=>l.tableMat),bakes.groundMat]);
    scene.traverse(o=>{for(const m of [o.material].flat())if(m?.fragmentShader)mats.add(m);});
    const family=m=>m===water.mesh.material?'water':m===terrain.mesh.material?'terrain':blades.has(m)||grass.lods.some(l=>l.tableMat===m)?'grass':m===sky.material?'sky':'rest';
    let hits=0,tables=false;
    for(const m of mats)for(const key of ['vertexShader','fragmentShader']){
      if(key==='fragmentShader'&&blades.has(m))continue;
      if(on&&which!=='all'&&family(m)!==which){const cur=m[key];if(typeof cur==='string'&&cur.includes(B)){m[key]=cur.split(B).join(A);m.needsUpdate=true;}continue;}
      const cur=m[key];if(typeof cur!=='string')continue;
      const next=on?cur.split(A).join(B):cur.split(B).join(A);
      if(on&&cur.includes(A))hits++;
      if(next!==cur){m[key]=next;m.needsUpdate=true;tables||=grass.lods.some(l=>l.tableMat===m);}
    }
    if(on&&!hits)throw Error('Missing patch site: '+A);
    if(tables){grass.tablesDirty=true;grass.bake(renderer);}
    this.deckHits=hits;
  },
  level(name,grassDensity,grassReach) { applyWorldQuality({...quality.level,name},true); if(grassDensity!=null||grassReach!=null)grass.setQuality(grassDensity??grass.quality.density,grassReach??grass.quality.reach,true); return {level:name,grass:{...grass.quality},terrain:terrain.detail,mirrorEvery:water.mirrorEvery,mirrorScale:water.mirrorScale}; },
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
  // SIM_PASSES=1: each per-frame simulation pass alone, many times over, then drained (median of 5 rounds), with an empty
  // stage for the floor. These run whatever the render scale: the costs a small screen does not shrink.
  async simPasses(reps, complete) {
    const stages={empty:()=>{},wind:()=>this.stepWind(),life:()=>life.update(1/60),clouds:()=>clouds.update(),
      petals:()=>petals.update(1/60,null,0),waves:()=>water.step(1/60),'light-bake':()=>bakes.bakeLight(bakeInputs),
      'grass-tables':()=>{grass.tablesDirty=true;grass.bake(renderer);}};
    const out={};
    for(const [name,stage] of Object.entries(stages)){const samples=[];
      for(let round=0;round<5;round++){stage();await complete();const start=performance.now();for(let i=0;i<reps;i++)stage();await complete();samples.push((performance.now()-start)/reps);}
      samples.sort((x,y)=>x-y);out[name]={ms:samples[2],min:samples[0],max:samples[4]};}
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
  // What an ablation changed against the baseline: programs patched, objects hidden (and how many of those were
  // showing), other switches. One that changes nothing is a typo or a patch site that moved, so it throws.
  bite(omit) {
    const mats=new Set([terrain.mesh.material,water.mesh.material,sky.material,post.gradeMat,bakes.groundMat,...grass.lods.map(l=>l.tableMat)]);
    scene.traverse(o=>{for(const m of [o.material].flat())if(m?.fragmentShader)mats.add(m);});
    const drawn=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    const snap=()=>({sources:[...mats].map(m=>[m.vertexShader,m.fragmentShader]),settings:JSON.stringify([pixelRatio,post.samples,post.sceneTarget.uuid,this.bloomSize,
      sky.renderOrder,water.mesh.renderOrder,grass.unclipped,water.seaMirrorEvery,water.mirrorScale,water.mirrorEvery,terrain.fields?.uniforms.uTerrainFieldsReady.value,
      terrain.heights?.uniforms.uTerrainHeightsReady.value,terrain.colour?.uniforms.uTerrainColourReady.value,sleeping.weather.fogMaterial.visible,
      this.culling.length,!!this.bare,!!this.stairsUnindexed,water.mesh.material.defines.LAND_SKIP])});
    this.configure(null);const a=snap(),showing=new Set();scene.traverse(o=>{if(drawn(o))showing.add(o);});
    this.configure(omit);const b=snap();
    const bite={shaders:a.sources.filter((s,i)=>s[0]!==b.sources[i][0]||s[1]!==b.sources[i][1]).length,hidden:this.hidden.length,
      showing:this.hidden.filter(([o])=>showing.has(o)).length,settings:a.settings!==b.settings,
      draw:['wind','reflection','bloom','post','grid-cull-off'].includes(omit)||omit==='grass-tables'&&!!this.forceGrassBakes||this.pairRebake};
    if(!bite.shaders&&!bite.hidden&&!bite.settings&&!bite.draw&&omit!=='none')throw Error('Ablation changes nothing: '+omit);
    return bite;
  },
  png(data) {
    const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),im=ctx.createImageData(w,h);
    for(let y=0;y<h;y++)im.data.set(data.subarray(y*w*4,(y+1)*w*4),(h-y-1)*w*4);
    ctx.putImageData(im,0,0);return canvas.toDataURL('image/png').split(',')[1];
  },
  // The frozen frame as drawn with nothing omitted, for comparing against another build stopped on the same frame.
  frozenFrame(capture) {
    const gl=renderer.getContext(),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
    this.configure(null);this.draw(false);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let binary='';for(let i=0;i<data.length;i+=32768)binary+=String.fromCharCode.apply(null,data.subarray(i,i+32768));
    const at=v=>v.toArray().map(x=>+x.toFixed(4));
    const state={time,story:story.name,beat:story.current.beat,camera:[...at(rig.camera.position),...at(rig.camera.quaternion)],boat:at(boat.position),
      child:at(child.position),cygnet:at(cygnet.position),randoms:window.__randoms,readbacks:readbackStats.delivered};
    return {width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,frame:frameIndex,state,data:btoa(binary),png:capture?this.png(data):undefined};
  },
  // While a stairs fixture is played to its moment, the page renders at a low scale so the story gets there sooner.
  fast(on) {
    if(on){this.fastRatio??=pixelRatio;pixelRatio=0.5;resize();}
    else if(this.fastRatio){pixelRatio=this.fastRatio;this.fastRatio=null;resize();}
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

const { browser, close } = await openBrowser();
async function open(base,chapter) {
  const [entry,fixture]=chapter.split(':');
  const page=await browser.newPage({viewport:{width:1376,height:1032},deviceScaleFactor:2});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
  await withoutHotReload(page);
  if(ALONG)await page.addInitScript(along=>{window.__along=along;},{every:ALONG,from:FIXTURE_FRAME});
  if(FRAME)await page.addInitScript(()=>{let seed=1234567;window.__randoms=0;Math.random=()=>{window.__randoms++;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
    let uuid=7654321;window.__uuidRandom=()=>{uuid=uuid+0x6D2B79F5|0;let t=Math.imul(uuid^uuid>>>15,1|uuid);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};});
  // three's UUIDs draw from their own stream, so a build that creates more or fewer objects keeps the game's random stream.
  if(FRAME)await page.route(/\/node_modules\/\.vite\/deps\/three\.module-[^/]*\.js/,async route=>{
    const response=await route.fetch(),source=await response.text(),from='Math.random() * 4294967295 | 0';
    assert.equal(source.split(from).length,5,'Missing or ambiguous UUID hook in three');
    await route.fulfill({response,body:source.split(from).join('window.__uuidRandom() * 4294967295 | 0')});
  });
  // Readbacks land when the GPU gets to them; mapping each without waiting on its fence delivers it on the frame after its request.
  if(FRAME)await page.route('**/src/gl/readback.ts*',async route=>{
    const response=await route.fetch(),source=await response.text();
    const body=source.replace('export function pollReadbacks() {','export function pollReadbacks() { for (const r of all) r.poll(); return;')
      .replace('const status = gl.clientWaitSync(next.sync, 0, 0);','const status = gl.ALREADY_SIGNALED;');
    assert(body.includes('r.poll(); return;')&&body.includes('const status = gl.ALREADY_SIGNALED;'),'Missing readback hook');
    await route.fulfill({response,body});
  });
  if(process.env.LEGACY_NORMALS==='1') await page.route('**/src/world/birch-scarf.ts*',async route=>{
    const response=await route.fetch(),source=await response.text();
    const body=source.replace('indexedNormals(this.positions, this.normals, this.geometry.index.array);','this.geometry.computeVertexNormals();');
    assert.notEqual(body,source,'Missing legacy normals hook');
    await route.fulfill({response,body});
  });
  await page.route('**/src/main.ts*',async route=>{
    const response=await route.fetch();let source=await response.text();
    source=source.replace('function frame(now) {','function frame(now) { if (window.__audit?.paused || window.__audit?.stopAt && frameIndex >= window.__audit.stopAt) { requestAnimationFrame(frame); return; }');
    assert(source.includes('window.__audit?.paused'),'Missing pause hook');
    assert.equal(source.split('frames++;').length, 2, 'Missing or ambiguous frame hook');
    source=source.replace('frames++;','window.__audit?.record(cpuStart,realDt); window.__audit?.sample(); frames++;');
    await route.fulfill({response,body:source+injection});
  });
  await page.goto(base+'?shot&start=1&ratio='+(process.env.RATIO??'1.5')+'&msaa='+(process.env.MSAA??'2')+'&analytics=0&progress=0'+(entry==='island'?'':'&chapter='+entry));
  await page.waitForSelector('#veil.ready',{timeout:300000});await page.locator('#begin').click();
  await page.waitForFunction(()=>window.__ready,null,{timeout:300000});
  assert(await page.evaluate(()=>!!window.__audit),base+' is not a dev server: this tool patches src/main.ts, which a built bundle does not serve');
  if(FRAME)await page.evaluate(stop=>{__audit.stopAt=stop;},entry==='stairs'&&fixture?1e9:FRAME);
  if(ALONG)return {page,errors,playing:entry==='stairs'&&fixture?stairsFixtureOnFrames(page,fixture,FIXTURE_FRAME,'__audit.stopAt=__stats.frame;'):null};
  if(entry==='stairs'&&fixture){
    if(FRAME)await stairsFixtureOnFrames(page,fixture,FIXTURE_FRAME,'__audit.stopAt=__stats.frame;');
    else await stairsFixture(page,fixture,on=>page.evaluate(on=>__audit.fast(on),on));
    console.log(JSON.stringify({chapter,fixture:await page.evaluate(()=>({beat:__game.story.current.beat,frame:__stats.frame,camera:__game.rig.camera.position.toArray().map(v=>+v.toFixed(1))}))}));}
  else if(fixture) await page.evaluate(([fixture,at])=>new Promise(done=>{
    const apply=()=>{
      if(__stats.frame<at){requestAnimationFrame(apply);return;}
      const g=__game,c=g.story.current;
      if(fixture==='piano') c.skipToPiano();
      else {
        c.skipToCrest();
        if(fixture!=='walk') c.reveal();
        if(fixture==='flock'||fixture==='pond') c.goDown();
        if(fixture==='pond'){g.child.place(c.edge.x,c.edge.z,Math.PI);c.setDown();}
      }
      done();
    };
    apply();
  }),[fixture,FRAME?FIXTURE_FRAME:0]);
  const detail=process.env.LEVEL?await page.evaluate(([d,g,r])=>__audit.level(d,g,r),[process.env.LEVEL,process.env.GRASS_DENSITY?Number(process.env.GRASS_DENSITY):null,process.env.GRASS_REACH?Number(process.env.GRASS_REACH):null]):undefined;
  if(detail)console.log(JSON.stringify({chapter,detail}));
  if(FRAME){await page.waitForFunction(()=>__stats.frame>=__audit.stopAt,null,{timeout:900000});await page.evaluate(()=>{__audit.paused=true;});}
  else await page.waitForTimeout(detail?2500:1500);
  return {page,errors,detail};
}

// Both builds play together, each held on every ALONGth frame until both are read; a frame whose hash differs is compared.
async function along(chapter) {
  const sides=[await open(COMPARE_BASE,chapter),await open(BASE,chapter)];
  if(process.env.STATE)await sides[1].page.evaluate(code=>__audit.state(code),process.env.STATE);
  const failed=Promise.all(sides.map(s=>s.playing)).then(()=>null,e=>e);
  const result={every:ALONG,samples:0,changed:0,over1:0,max:0,worst:null,first:null,last:null};
  for(;;){
    const reads=await Promise.race([failed.then(e=>{if(e)throw e;return new Promise(()=>{});}),
      Promise.all(sides.map(s=>s.page.waitForFunction(()=>__audit.sampled||__stats.frame>=__audit.stopAt,null,{timeout:1800000,polling:20})
        .then(()=>s.page.evaluate(()=>({sampled:__audit.sampled,done:__stats.frame>=__audit.stopAt,frame:__stats.frame})))))]);
    const [a,b]=reads.map(r=>r.sampled);
    if(!a&&!b&&reads.every(r=>r.done))break;
    assert(a&&b&&a.frame===b.frame&&a.width===b.width&&a.height===b.height,'The builds fell out of step: '+JSON.stringify(reads.map(r=>[r.frame,r.sampled?.frame,r.done])));
    result.samples++;result.first??=a.frame;result.last=a.frame;
    if(a.hash[0]!==b.hash[0]||a.hash[1]!==b.hash[1]){
      const capture=process.env.CAPTURE==='1';
      const [x,y]=await Promise.all(sides.map(s=>s.page.evaluate(capture=>__audit.sampleData(capture),capture)));
      const p=Buffer.from(x.data,'base64'),q=Buffer.from(y.data,'base64');let changed=0,over1=0,max=0;const box=[Infinity,Infinity,-1,-1];
      for(let i=0;i<p.length;i++){const d=Math.abs(p[i]-q[i]);if(d){changed++;if(d>1)over1++;if(d>max)max=d;
        const px=(i>>2)%a.width,py=a.height-1-Math.floor((i>>2)/a.width);box[0]=Math.min(box[0],px);box[1]=Math.min(box[1],py);box[2]=Math.max(box[2],px);box[3]=Math.max(box[3],py);}}
      const drift=Object.keys(a.state).filter(k=>JSON.stringify(a.state[k])!==JSON.stringify(b.state[k])).map(k=>[k,b.state[k],a.state[k]]);
      const row={frame:a.frame,beat:a.state.beat,changed,over1,max,box:changed?box:undefined,drift:drift.length?drift:undefined};
      console.log(JSON.stringify({chapter,along:row}));
      if(capture&&max>Number(process.env.COMPARE_MAX??0))for(const [side,frame] of [['against',x],['here',y]])await fs.writeFile(out+'-'+chapter+'-f'+a.frame+'-'+side+'.png',Buffer.from(frame.png,'base64'));
      result.changed++;if(over1)result.over1++;if(max>result.max){result.max=max;result.worst=row;}
    }
    if(result.samples%100===0)console.log(JSON.stringify({chapter,progress:{frame:a.frame,story:a.state.story,beat:a.state.beat,samples:result.samples,changed:result.changed,max:result.max}}));
    await Promise.all(sides.map(s=>s.page.evaluate(()=>{__audit.sampled=null;__audit.paused=false;})));
  }
  const error=await failed;
  for(const s of sides){assert.deepEqual(s.errors,[],'Browser errors');await s.page.close();}
  if(error)throw error;
  console.log(JSON.stringify({chapter,along:result}));
  if(result.max>Number(process.env.COMPARE_MAX??Infinity))differing.push({chapter,along:result});
  report.push({chapter,along:result});
}

const specks = omit => omit === 'glass-sky-always' || omit === 'e6-off';
const report=[],inexact=[],differing=[];
try {
  for(const chapter of process.argv.slice(2).length ? process.argv.slice(2) : ['island','washing','meadow:walk','birches','drowned','wood','sleeping','sea','mirror','boats','jetty']) {
    const gate=QUIET_S?await quiet():undefined;if(gate)console.log(JSON.stringify({chapter,gate:{waitedS:gate.waitedS,contended:gate.contended,hot:gate.hot}}));
    const busyAtStart=busy();
    if(ALONG){await along(chapter);continue;}
    let against,comparePage;
    if(COMPARE_BASE){
      const other=await open(COMPARE_BASE,chapter);
      if(process.env.STATE)await other.page.evaluate(code=>__audit.state(code),process.env.STATE);
      against=await other.page.evaluate(capture=>__audit.frozenFrame(capture),process.env.CAPTURE==='1');
      assert.deepEqual(other.errors,[],'Browser errors on COMPARE_BASE');
      if(PATH_JS)comparePage=other.page;else await other.page.close();
    }
    const {page,errors,detail}=await open(BASE,chapter);
    let cpu,frameTimes,census;
    // A run stopped on a frame is for comparing pictures: its loop is already still, and its readbacks are not the game's.
    if(FRAME)census={frames:0,passes:{},objects:{},cpu:{},scene:await page.evaluate(()=>{__audit.install();return __audit.inspect();})};
    else {
      const cdp=await page.context().newCDPSession(page);
      await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});
      await page.evaluate(()=>{__audit.frames=[];});await cdp.send('Profiler.start');
      await page.waitForTimeout(Number(process.env.CPU_MS??6000));
      const {profile}=await cdp.send('Profiler.stop');
      const frames=await page.evaluate(()=>__audit.frames);
      assert(frames.length > 0, 'No frame timings recorded');
      await fs.writeFile(out+'-'+chapter+'.cpuprofile',JSON.stringify(profile));
      cpu=cpuSummary(profile,frames.length);
      frameTimes={frames:frames.length,cpuMedian:median(frames.map(f=>f.cpuMs)),cpuP90:[...frames.map(f=>f.cpuMs)].sort((a,b)=>a-b)[Math.floor(frames.length*.9)],intervalMedian:median(frames.map(f=>f.intervalMs))};
      await page.evaluate(()=>{__audit.frames=[];__audit.install();__audit.census=true;});
      await page.waitForTimeout(Number(process.env.CENSUS_MS??2000));
      census=await page.evaluate(()=>{
        __audit.census=false;__audit.paused=true;
        return {frames:__audit.frames.length,passes:__audit.passes,objects:__audit.objects,cpu:__audit.cpu,scene:__audit.inspect()};
      });
      assert(census.frames > 0, 'No census frames recorded');
    }
    assert.deepEqual(errors, [], 'Browser errors invalidate the profile');
    if(process.env.FORCE_GRASS_BAKES==='1') await page.evaluate(()=>{__audit.forceGrassBakes=true;});
    const state=process.env.STATE?await page.evaluate(code=>__audit.state(code),process.env.STATE):undefined;
    if(state!==undefined)console.log(JSON.stringify({chapter,state}));
    if(against){
      const compare=async(other,name)=>{
        const here=await page.evaluate(capture=>__audit.frozenFrame(capture),process.env.CAPTURE==='1');
        assert.deepEqual([here.width,here.height,here.frame],[other.width,other.height,other.frame],'The two builds stopped on different frames or sizes');
        const a=Buffer.from(here.data,'base64'),b=Buffer.from(other.data,'base64');let changed=0,over1=0,max=0,total=0;
        const box=[Infinity,Infinity,-1,-1];
        for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d){changed++;total+=d;if(d>1)over1++;if(d>max)max=d;
          const x=(i>>2)%here.width,y=here.height-1-Math.floor((i>>2)/here.width);box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);}}
        for(const [side,frame]of [['here',here],['against',other]])if(frame.png)await fs.writeFile(out+'-'+chapter+'-'+name+'-'+side+'.png',Buffer.from(frame.png,'base64'));
        const drift=Object.keys(here.state).filter(k=>JSON.stringify(here.state[k])!==JSON.stringify(other.state[k])).map(k=>[k,here.state[k],other.state[k]]);
        return {base:COMPARE_BASE,frame:here.frame,changed,over1,max,mean:total/a.length,box:changed?box:undefined,drift:drift.length?drift:undefined};
      };
      against=await compare(against,'frame');
      console.log(JSON.stringify({chapter,against}));
      if(against.max>Number(process.env.COMPARE_MAX??Infinity))differing.push({chapter,...against});
      // PATH_JS under COMPARE_BASE steps both builds' cameras the same way and compares the frames at every step.
      if(comparePage){
        const steps=[];
        for(let k=0;k<PATH_STEPS;k++){
          const other=await comparePage.evaluate(([code,k,capture])=>{__audit.pathStep(code,k);return __audit.frozenFrame(capture);},[PATH_JS,k,process.env.CAPTURE==='1']);
          await page.evaluate(([code,k])=>__audit.pathStep(code,k),[PATH_JS,k]);
          const step=await compare(other,'path'+k);steps.push(step);
          console.log(JSON.stringify({chapter,path:k,changed:step.changed,over1:step.over1,max:step.max,box:step.box,drift:step.drift}));
          if(step.max>Number(process.env.COMPARE_MAX??Infinity))differing.push({chapter,path:k,...step});
        }
        against.path={steps:PATH_STEPS,max:Math.max(...steps.map(s=>s.max)),stepsChanged:steps.filter(s=>s.changed).length};
        console.log(JSON.stringify({chapter,againstPath:against.path}));
        await comparePage.close();
      }
    }
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
        const bite=probe.bite(omit);
        const a=read(null),b=read(omit);let changed=0,max=0,total=0;
        for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)changed++;max=Math.max(max,d);total+=d;}
        const pixels={changed,max,mean:total/a.length};
        const encode=data=>probe.png(data);
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
        // Two draws: the ordinary sea's reflection is drawn on alternate frames, so one draw of each side would differ by it.
        const counts=v=>{probe.configure(v);const sum={calls:0,triangles:0};for(let i=0;i<2;i++){probe.draw(false);sum.calls+=__game.renderer.info.render.calls;sum.triangles+=__game.renderer.info.render.triangles;}return {calls:sum.calls/2,triangles:sum.triangles/2};};
        const submitted={baseline:counts(null),omitted:counts(omit)};
        const stepMs=omit==='wind'?await stepAlone():undefined;
        // Moving-camera exactness: the same pair of frames at every step of PATH, worst pixel over the path.
        let path;
        if(pathCode){const saved=probe.pathSave();path={steps:pathSteps,changed:0,max:0,worst:-1,stepsChanged:0};
          try{for(let k=0;k<pathSteps;k++){probe.pathStep(pathCode,k);const a=read(null),b=read(omit);let changed=0,max=0;
            for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d){changed++;if(d>max)max=d;}}
            path.changed+=changed;if(changed)path.stepsChanged++;if(max>path.max){path.max=max;path.worst=k;if(capture)path.images={baseline:encode(a),variant:encode(b)};}}}
          finally{probe.configure(null);probe.pathRestore(saved);}}
        probe.configure(null);probe.pairRebake=false;bite.calls=submitted.omitted.calls-submitted.baseline.calls;bite.triangles=submitted.omitted.triangles-submitted.baseline.triangles;return {bite,pixels,runs,submitted,images,stepMs,drained:drain,path};
      },{name:omit,drainAll:process.env.DRAIN==='1',rounds:Number(process.env.ROUNDS??4),draws:Number(process.env.DRAWS??10),capture:process.env.CAPTURE==='1',poll:process.env.POLL,pathCode:(process.env.PATH_ABLATIONS??omit).split(',').includes(omit)?process.env.PATH_JS:undefined,pathSteps:Number(process.env.PATH_STEPS??40)});
      if(result.path?.images){for(const [name,data]of Object.entries(result.path.images))await fs.writeFile(out+'-'+chapter+'-'+omit+'-path-'+name+'.png',Buffer.from(data,'base64'));delete result.path.images;}
      if(result.images)for(const [name,data]of Object.entries(result.images))await fs.writeFile(out+'-'+chapter+'-'+omit+'-'+name+'.png',Buffer.from(data,'base64'));
      const baselines=result.runs.map(r=>r.baseline),straddle=Math.max(...baselines)/Math.min(...baselines)>STRADDLE;
      const row={omit,busy:busyBefore,drained:result.drained,stepMs:result.stepMs,bite:result.bite,pixels:result.pixels,path:result.path,submitted:result.submitted,savedMs:median(result.runs.map(r=>r.saved)),percent:median(result.runs.map(r=>r.percent)),rangeMs:[Math.min(...result.runs.map(r=>r.saved)),Math.max(...result.runs.map(r=>r.saved))],baselines,straddle,runs:result.runs};
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
      ablations.push(row);console.log(JSON.stringify({chapter,omit,savedMs:row.savedMs,percent:row.percent,rangeMs:row.rangeMs,baselines,straddle,stepMs:row.stepMs,bite:row.bite,pixels:row.pixels,path:row.path}));
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
    const simPasses=process.env.SIM_PASSES==='1'?await page.evaluate(async reps=>{
      const gl=__game.renderer.getContext(),channel=new MessageChannel();let wake=null;channel.port1.onmessage=()=>wake?.();
      async function complete(){const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
        try{for(;;){const s=gl.clientWaitSync(fence,0,0);if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED)return;await new Promise(r=>{wake=r;channel.port2.postMessage(0);});}}finally{gl.deleteSync(fence);}}
      __audit.configure(null);return __audit.simPasses(reps,complete);
    },Number(process.env.SIM_REPS??30)):undefined;
    if(simPasses)console.log(JSON.stringify({chapter,simPasses}));
    const cullingViews=process.env.CULLING_VIEWS==='1'?await page.evaluate(()=>__audit.cullingViews()):[];
    assert(cullingViews.every(v=>v.max<=1),'Culling changed pixels at a view edge');
    const row={chapter,gate,detail,against,busy:busyAtStart,frameTimes,cpu,census,ablations,postPasses,reflectionPass,simPasses,waterPass,cullingViews,errors};report.push(row);
    await fs.writeFile(out+'.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify({chapter,frameTimes,frames:census.frames,passes:census.passes,objects:census.objects,ablations:ablations.map(({runs,...r})=>r),errors}));
    assert.deepEqual(errors,[]);await page.close();
  }
  assert.deepEqual(inexact,[],'exact skips changed visible pixels');
  assert.deepEqual(differing,[],'frames differ from COMPARE_BASE by more than COMPARE_MAX');
} finally { await close(); }
