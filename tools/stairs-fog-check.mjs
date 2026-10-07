// Fog must cover nearby surfaces continuously when the camera is inside the cloud-to-village bank.
// BASE must be a Vite dev server for the shared shader import. ANGLE selects the browser backend.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage();
  await page.route('**/__stairs_fog_probe__', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Stairs fog coverage</title>',
  }));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '__stairs_fog_probe__');
  const result = await page.evaluate(async () => {
    const { ATMO_GLSL } = await import('/src/world/atmosphere.ts');
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('Float WebGL2 unavailable');
    // One sample each centimetre along a sixteen-metre sightline, including both sides of eight metres.
    const width = 1601;
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, `#version 300 es
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0, 1); }`],
      [gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; precision highp int;
uniform vec3 cameraPosition;
${ATMO_GLSL}
uniform vec3 uRay;
out vec4 result;
void main() {
  float far = (gl_FragCoord.x - 0.5) * 0.01;
  result = vec4(fogBank(cameraPosition, normalize(uRay), far).a, 0, 0, 1);
}`],
    ]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, 1);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Incomplete framebuffer');
    gl.viewport(0, 0, width, 1);
    const set = (name, values) => gl[`uniform${values.length}fv`](gl.getUniformLocation(program, name), values);
    set('uFogBank', [0, 0, 0, 1]);
    const pixels = new Float32Array(width * 4);
    const cases = [];
    for (const floor of [0, 50]) for (const clear of [0, 0.3, 0.85]) {
      set('uFogBankShape', [floor, floor + 28, 1000, 1]);
      set('uCloudBubble', [0, floor + 1.8, 65, 10]);
      set('uFogBankEye', [clear, 1]);
      set('cameraPosition', [0, floor + 3.4, 60]);
      for (const [name, ray] of [['level', [0, 0, 1]], ['foreground', [0, -0.8, 1]], ['behind', [0, 0, -1]]]) {
        set('uRay', ray);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, width, 1, gl.RGBA, gl.FLOAT, pixels);
        let jump = 0, decrease = 0;
        for (let i = 0; i < width; i++) {
          const a = pixels[i * 4];
          if (!Number.isFinite(a) || a < 0 || a > 1) throw Error('Invalid fog coverage');
          if (i > 0) {
            jump = Math.max(jump, Math.abs(a - pixels[(i - 1) * 4]));
            decrease = Math.max(decrease, pixels[(i - 1) * 4] - a);
          }
        }
        cases.push({ floor, clear, name, near: pixels[400 * 4], atEight: pixels[800 * 4], jump, decrease });
      }
    }
    // Outside the bank, a surface before its front (or a ray pointing away) must remain clear.
    set('uFogBankShape', [0, 28, 1000, 1]);
    set('cameraPosition', [0, 3.4, -20]);
    set('uFogBankEye', [0, 0]);
    let outside = 0;
    for (const ray of [[0, 0, 1], [0, 0, -1]]) {
      set('uRay', ray);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, width, 1, gl.RGBA, gl.FLOAT, pixels);
      for (let i = 0; i < width; i++) outside = Math.max(outside, Math.abs(pixels[i * 4]));
    }
    const error = gl.getError();
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
    return { cases, outside, error };
  });
  console.log(JSON.stringify({
    cases: result.cases.length,
    leastNearCoverage: Math.min(...result.cases.map(c => c.near)),
    largestStep: Math.max(...result.cases.map(c => c.jump)),
    outside: result.outside,
    error: result.error,
  }));
  assert.equal(result.error, 0);
  assert.equal(result.outside, 0, 'surfaces outside the bank stay clear');
  for (const c of result.cases) {
    const name = `${c.name}, floor=${c.floor}, clearing=${c.clear}`;
    assert(c.near > 0.05, `${name}: nearby surfaces inside the bank must receive fog`);
    assert(c.jump < 0.01, `${name}: fog coverage must not jump at a distance cutoff`);
    assert(c.decrease < 1e-4, `${name}: a longer sightline must not lose fog`);
  }
  console.log('stairs-fog-check passed');
} finally {
  await close();
}
