// Compare the terrain's actual vertex height/normal calculations with three separate samples.
// BASE must be a dev server. Uses floating-point point draws over every height patch and the moving window.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage();
  await page.route('**/__terrain_samples__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Terrain samples</title>' }));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '__terrain_samples__');
  const report = await page.evaluate(async perturb => {
    const source = await (await fetch('/src/world/atmosphere.ts')).text();
    const THREE = await import(source.match(/from ["']([^"']*three[^"']*)["']/)[1]);
    const { Terrain } = await import('/src/world/terrain.ts');
    const { TerrainHeights, TERRAIN_HEIGHT_PATCHES, HEIGHT_TEXEL } = await import('/src/world/terrain-heights.ts');
    const r = new THREE.WebGLRenderer(), gl = r.getContext();
    const heights = new TerrainHeights(); await heights.bake(r);
    const terrain = new Terrain(new THREE.Vector2(), true, heights), material = terrain.mesh.material;
    const n = 64, count = n*n, textureData = new Float32Array(count);
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) textureData[y*n+x] = Math.sin(x*.19)*3 + Math.cos(y*.13)*4;
    const height = new THREE.DataTexture(textureData,n,n,THREE.RedFormat,THREE.FloatType);
    height.minFilter=height.magFilter=THREE.LinearFilter; height.needsUpdate=true;
    const uniforms={...material.uniforms,uHeightTex:{value:height},uDomain:{value:new THREE.Vector4(-32,-32,1/64,1/64)},uMirrorPass:{value:0}};
    const block=/  float heights\[3\];[\s\S]*?  float hz = heights\[2\];/;
    if(!block.test(material.vertexShader))throw Error('Missing shared sample loop');
    const point = vertex => vertex.replace('  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);',
      `  vec2 pixel = vec2(gl_VertexID % ${n}, gl_VertexID / ${n}) + 0.5;
  gl_Position = vec4(pixel / ${n}.0 * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = 1.0;`);
    const reference = material.vertexShader.replace(block,`  float h = groundHeight(p);
  float hx = groundHeight(p + vec2(e${perturb?' * 1.1':''}, 0.0));
  float hz = groundHeight(p + vec2(0.0, e));`);
    const make = vertex => new THREE.ShaderMaterial({vertexShader:point(vertex),
      fragmentShader:'in vec3 vWorld; in vec3 vNormal; void main(){gl_FragColor=vec4(vNormal,vWorld.y);}',
      uniforms,defines:{HEIGHT_FILTERABLE:''},depthTest:false,depthWrite:false});
    const materials=[make(reference),make(material.vertexShader)];
    const geometry=new THREE.BufferGeometry(),nodes=new Float32Array(count*3),positions=new Float32Array(count*3);
    for(let i=0;i<count;i++)positions[i*3+1]=i%3===0?-1:0;
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aNode',new THREE.BufferAttribute(nodes,3));
    const points=new THREE.Points(geometry,materials[0]);points.frustumCulled=false;
    const scene=new THREE.Scene();scene.add(points);const camera=new THREE.Camera();
    const target=new THREE.WebGLRenderTarget(n,n,{type:THREE.FloatType,depthBuffer:false});
    const arrays=[new Float32Array(count*4),new Float32Array(count*4)];
    const patches=[{minX:-40,minZ:-40,width:80,height:80},...TERRAIN_HEIGHT_PATCHES.map(p=>({...p,width:p.width*HEIGHT_TEXEL,height:p.height*HEIGHT_TEXEL}))];
    const worst=[0,0,0,0];let samples=0,signal=0;
    for(const filterable of [true,false]) {
      for(const m of materials){m.defines=filterable?{HEIGHT_FILTERABLE:''}:{};m.needsUpdate=true;points.material=m;r.setRenderTarget(target);await r.compileAsync(scene,camera);}
      for(const ready of [1,0])for(const mirror of [0,1])for(const e of [1,2,16,64])for(const patch of patches){
        uniforms.uTerrainHeightsReady.value=ready;uniforms.uMirrorPass.value=mirror;
        for(let y=0;y<n;y++)for(let x=0;x<n;x++){
          const i=(y*n+x)*3;nodes[i]=patch.minX-2+(x+.37)/(n-1)*(patch.width+4);
          nodes[i+1]=patch.minZ-2+(y+.61)/(n-1)*(patch.height+4);nodes[i+2]=e*32;
        }
        geometry.attributes.aNode.needsUpdate=true;
        for(let side=0;side<2;side++){points.material=materials[side];r.setRenderTarget(target);r.render(scene,camera);r.readRenderTargetPixels(target,0,0,n,n,arrays[side]);}
        for(let i=0;i<arrays[0].length;i++){
          if(!Number.isFinite(arrays[0][i])||!Number.isFinite(arrays[1][i]))throw Error('Non-finite terrain output');
          worst[i%4]=Math.max(worst[i%4],Math.abs(arrays[0][i]-arrays[1][i]));
          signal=Math.max(signal,Math.abs(arrays[1][i]));
        }
        samples+=count;
      }
    }
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer:debug&&gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),patches:patches.length,samples,worst,signal,error:gl.getError()};
  },process.env.PERTURB==='1');
  console.log(JSON.stringify(report));
  fs.writeFileSync(process.env.OUT??'/tmp/updraft-terrain-samples.json',JSON.stringify(report,null,2));
  assert.equal(report.error,0);assert(report.signal>1,'draws must contain real height data');
  assert(report.worst.slice(0,3).every(v=>v<1e-5)&&report.worst[3]<1e-4,`terrain height/normal changed: ${report.worst}`);
} finally { await close(); }
