// Descending ramps execute as defined on Metal and software Vulkan; texture bytes also match in Chrome.
// BASE must be a Vite dev server, for source-module imports. This is not physical iPad validation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./lib/water-texture-hashes.json',import.meta.url),'utf8'));
const base=process.env.BASE??'http://127.0.0.1:5230/';
const report=[];
for(const angle of ['metal','swiftshader']){
 const {browser,close}=await openBrowser({angle});
 try{
  const page=await browser.newPage();
  await page.route('**/__shader_probe__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Shader checks</title>'}));
  await page.goto(base+'__shader_probe__');
  const result=await page.evaluate(async fixtures=>{
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=1;
   const gl=canvas.getContext('webgl2');if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw new Error('Float WebGL2 is unavailable');
   const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader};
   const vertex=compile(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}');
   const fragment=compile(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;
uniform vec2 edges;out vec4 result;
void main(){float x=mix(edges.x,edges.y,(gl_FragCoord.x/256.0)*3.0-1.0);
 float fixedRamp=1.0-smoothstep(edges.x,edges.y,x);
 float t=clamp((x-edges.y)/(edges.x-edges.y),0.0,1.0);
 float reference=t*t*(3.0-2.0*t);result=vec4(fixedRamp,reference,0,1);}`);
   const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,256,1);
   const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Incomplete framebuffer');
   const pixels=new Float32Array(256*4);let worst=0;
   for(const edges of [[-14,10],[0,.9],[-660,-600],[.55,1.05],[0,.001],[-.2,1.8]]){
    gl.uniform2fv(gl.getUniformLocation(program,'edges'),edges);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,256,1,gl.RGBA,gl.FLOAT,pixels);
    for(let i=0;i<pixels.length;i+=4){if(!Number.isFinite(pixels[i])||pixels[i]<0||pixels[i]>1)throw new Error('Invalid ramp result');worst=Math.max(worst,Math.abs(pixels[i]-pixels[i+1]));}
   }
   const debug=gl.getExtension('WEBGL_debug_renderer_info');const renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
   const error=gl.getError();gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);gl.deleteTexture(texture);gl.deleteFramebuffer(framebuffer);
   const generators=await import('/src/world/water/textures.ts');const textures=[];
   for(const fixture of fixtures){const start=performance.now(),texture=generators[fixture.name](fixture.res);const ms=performance.now()-start;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',texture.image.data))).map(b=>b.toString(16).padStart(2,'0')).join('');
    textures.push({...fixture,hash,ms});texture.dispose();}
   return {renderer,worst,error,textures};
  },fixtures);
  assert.equal(result.error,0);assert(result.worst<2e-6,`ramp error ${result.worst}`);
  for(let i=0;i<fixtures.length;i++)assert.equal(result.textures[i].hash,fixtures[i].hash,`${angle}/${fixtures[i].name}/${fixtures[i].res}`);
  report.push({angle,...result});console.log(JSON.stringify(report.at(-1)));
 }finally{await close()}
}
fs.writeFileSync('/tmp/updraft-shader-browser.json',JSON.stringify(report,null,2));
