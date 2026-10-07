// GPU parity against the original unrolled noise, including negative coordinates and every height octave count.
// BASE must be a Vite dev server. ANGLE selects an additional backend; the default is the platform's normal one.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage();
  await page.route('**/__noise_probe__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Noise parity</title>' }));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '__noise_probe__');
  const result = await page.evaluate(async () => {
    const { ROLLED_NOISE_GLSL } = await import('/src/world/atmosphere.ts');
    const { HEIGHTFIELD_GLSL } = await import('/src/world/heightfield.ts');
    const { noiseLoopUniforms } = await import('/src/gl/loops.ts');
    const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2');
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('Float WebGL2 unavailable');
    const reference = `
float referenceNoise(vec2 p) {
  vec2 fl = floor(p); ivec2 i = ivec2(fl); vec2 t = p - fl;
  vec2 u = t*t*t*(t*(t*6.0-15.0)+10.0);
  float a = hf_gradDot(hf_hash2(i), t);
  float b = hf_gradDot(hf_hash2(i+ivec2(1,0)), t-vec2(1.0,0.0));
  float c = hf_gradDot(hf_hash2(i+ivec2(0,1)), t-vec2(0.0,1.0));
  float d = hf_gradDot(hf_hash2(i+ivec2(1,1)), t-vec2(1.0,1.0));
  float ab = a+(b-a)*u.x, cd = c+(d-c)*u.x;
  return (ab+(cd-ab)*u.y)*1.4;
}
float referenceHeight(vec2 p, int octaves, float seed) {
  p += vec2(seed*37.13,-seed*71.37); float sum=0.0, amp=0.5, norm=0.0;
  for(int o=0;o<6;o++){if(o>=octaves)break;sum+=amp*referenceNoise(p);norm+=amp;
    p=vec2(1.6*p.x-1.2*p.y,1.2*p.x+1.6*p.y);amp*=0.5;}
  return sum/norm;
}
float referenceFbm(vec2 p) {
  float s=0.0,a=0.5;
  for(int i=0;i<4;i++){s+=a*vnoise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=0.5;}
  return s/0.9375;
}`;
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}'],
      [gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; precision highp int;
${ROLLED_NOISE_GLSL}\n${HEIGHTFIELD_GLSL}\n${reference}
uniform vec3 uProbe; out vec4 result;
void main(){vec2 p=(gl_FragCoord.xy-32.0)*uProbe.x+uProbe.y;
 result=vec4(gnoise(p)-referenceNoise(p),gfbm(p,int(uProbe.z),17.0)-referenceHeight(p,int(uProbe.z),17.0),fbm(p)-referenceFbm(p),gnoise(p));}`],
    ]) {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    const parallel = gl.getExtension('KHR_parallel_shader_compile'), started = performance.now();
    if (parallel) while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
      if (performance.now()-started>30000) throw Error('Noise compile timeout');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    for (const [name, uniform] of Object.entries(noiseLoopUniforms)) gl.uniform1i(gl.getUniformLocation(program, name), uniform.value);
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 64, 64);
    const frame = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, frame); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw Error('Noise framebuffer incomplete');
    gl.viewport(0,0,64,64);
    const pixels = new Float32Array(64*64*4), worst = [0,0,0]; let samples=0, signal=0;
    for (const scale of [.007,.31,3.7,17.1]) for (const offset of [-103.37,0,247.91]) for (let octaves=1;octaves<=6;octaves++) {
      gl.uniform3f(gl.getUniformLocation(program,'uProbe'),scale,offset,octaves); gl.drawArrays(gl.TRIANGLES,0,3); gl.readPixels(0,0,64,64,gl.RGBA,gl.FLOAT,pixels);
      for(let i=0;i<pixels.length;i+=4){for(let c=0;c<3;c++)worst[c]=Math.max(worst[c],Math.abs(pixels[i+c]));signal=Math.max(signal,Math.abs(pixels[i+3]));samples++;}
    }
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer:debug&&gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),samples,worst,signal,error:gl.getError()};
  });
  console.log(JSON.stringify(result));
  fs.writeFileSync(process.env.OUT ?? '/tmp/updraft-noise-loop-check.json', JSON.stringify(result,null,2));
  assert.equal(result.error,0); assert(result.signal>.1,'noise must run rather than return zero');
  assert(result.worst.every(n=>Number.isFinite(n)&&n<1e-5),`noise changed: ${result.worst}`);
} finally { await close(); }
