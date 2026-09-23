import * as THREE from 'three';

export interface GraphicsCapability {
  supported: boolean;
  maxSamples: number;
  reason: string;
}

/**
 * Every render target the engine allocates needs EXT_color_buffer_float: the grass table's four-attachment
 * mixed float/half-float MRT (world/grass.ts), the multisampled half-float scene target (post/post.ts) and
 * the wind field's float targets (wind/field.ts). A device missing it, or reporting GL limits below what
 * those fixed-size targets need (the widest is the grass table at 1024px), cannot run the game regardless
 * of retrying; the quality governor's ladder only ever handles the viewport-sized targets, not this floor.
 */
export function checkGraphicsCapability(renderer: THREE.WebGLRenderer): GraphicsCapability {
  // Three.js only ever creates a WebGL2 context (it throws during WebGLRenderer construction otherwise).
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const maxSamples = gl.getParameter(gl.MAX_SAMPLES) as number;
  if (!renderer.extensions.get('EXT_color_buffer_float')) {
    return { supported: false, maxSamples, reason: 'EXT_color_buffer_float unavailable' };
  }
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
  // The WebGL2 spec's own mandatory minimum. Every fixed-size target the engine allocates fits inside it
  // with wide margin, so falling short means a broken driver, not a device the governor could still serve.
  const minRequired = 2048;
  if (maxTextureSize < minRequired || maxRenderbufferSize < minRequired) {
    return { supported: false, maxSamples, reason: `GL limits too small (texture ${maxTextureSize}, renderbuffer ${maxRenderbufferSize})` };
  }
  return { supported: true, maxSamples, reason: '' };
}
