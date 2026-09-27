import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { MAT } from './mesh';
import { FACE } from './garments';

const f = (x: number) => x.toFixed(4);
const v3 = (v: THREE.Vector3) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;

export const PALETTE = {
  /** The yellow of the jumper on the family's washing line (`world/lines.ts`), which is this child's. */
  coat: new THREE.Color('#d29134'),
  lining: new THREE.Color('#77511f'),
  scarf: new THREE.Color('#7c261b'),
  skin: new THREE.Color('#f4c8ad'),
  cheek: new THREE.Color('#ea8f7e'),
  hair: new THREE.Color('#3d2a1b'),
  brow: new THREE.Color('#5a3521'),
  eye: new THREE.Color('#1b0f0a'),
  white: new THREE.Color('#f3eee6'),
  lip: new THREE.Color('#b5645a'),
  trousers: new THREE.Color('#2c2823'),
  boot: new THREE.Color('#453427'),
  leather: new THREE.Color('#8e6440'),
  strap: new THREE.Color('#6c4a2e'),
  button: new THREE.Color('#5a3e2b'),
};

export const KNIT_GLSL = /* glsl */ `
/** Knitted wool: ribs of stitches along its length, only as close as they can be seen without shimmering. */
float knit(vec2 s, float scale) {
  vec2 k = vec2(s.x * 90.0 * scale, s.y * 12.0);
  float column = abs(fract(k.y) - 0.5) * 2.0;
  float vee = fract(k.x + column * 0.9);
  float st = smoothstep(0.0, 0.35, vee) * smoothstep(1.0, 0.65, vee);
  float groove = smoothstep(0.75, 1.0, column);
  float detail = 1.0 - clamp(length(fwidth(k)) * 0.9 - 0.3, 0.0, 1.0);
  return mix(0.5, st * (1.0 - groove * 0.6), detail);
}
`;

const VERT = /* glsl */ `
#include <skinning_pars_vertex>
in vec4 aLook;
in vec2 aSurf;
uniform float uFlutter;
uniform vec3 uFlow;
uniform float uTime;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vRest;
out vec4 vLook;
out vec2 vSurf;
void main() {
  vec3 transformed = position;
  vec3 objectNormal = normal;
  int mat = int(aLook.x + 0.5);
  /** A fine ripple running round the hem in the wind, strongest where the air leaves the coat. */
  if (mat == ${MAT.coat} && position.y < 1.05 && uFlutter > 0.0) {
    float a = atan(position.x, position.z);
    float lee = max(0.0, dot(normalize(vec3(position.x, 0.0, position.z)), uFlow));
    float low = smoothstep(1.07, 0.6, position.y);
    float wave = sin(uTime * 9.0 + a * 7.0 - position.y * 9.0) + 0.5 * sin(uTime * 13.0 - a * 11.0);
    transformed += normal * wave * low * low * uFlutter * (0.006 + 0.016 * lee);
  }
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 w = modelMatrix * vec4(transformed, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * objectNormal);
  vRest = position;
  vLook = aLook;
  vSurf = aSurf;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uGroundPos;
uniform vec3 uCoat;
uniform vec3 uLining;
uniform vec3 uScarf;
uniform vec3 uSkin;
uniform vec3 uCheek;
uniform vec3 uHair;
uniform vec3 uBrow;
uniform vec3 uEye;
uniform vec3 uWhite;
uniform vec3 uLip;
uniform vec3 uTrousers;
uniform vec3 uBoot;
uniform vec3 uLeather;
uniform vec3 uStrap;
uniform vec3 uButton;
/** 0 open to 1 shut. */
uniform float uBlink;
/** 0 closed to 1 wide open. */
uniform float uYawn;
uniform float uMouth;
uniform float uWhites;
uniform float uNoseTip;
/** Which way the hood's opening faces in the world, to keep the sun off a face it cannot reach. */
uniform vec3 uHoodForward;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vRest;
in vec4 vLook;
in vec2 vSurf;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

/** A soft-edged shape: 1 inside a distance field, 0 outside, antialiased over a pixel. */
float fill(float d) {
  float w = max(fwidth(d), 1e-4);
  return 1.0 - smoothstep(-w, w, d);
}

float ellipse(vec2 p, vec2 r) {
  return (length(p / r) - 1.0) * min(r.x, r.y);
}

/**
 * The face is painted, the way it would be remembered: two big dark eyes, small brows, warm cheeks.
 * Drawn in the rest frame of the head, so every blink and turn carries it.
 */
vec3 paintFace(vec3 alb, vec3 rest, vec3 N, vec3 V, inout float gloss) {
  vec3 q = rest - ${v3(FACE.c)};
  if (q.z < 0.05) return alb;
  vec2 p = q.xy;
  vec2 e = vec2(abs(p.x) - 0.122, p.y + 0.048);
  /** Cheeks: warmth, not a painted disc. */
  vec2 c = vec2(abs(p.x) - 0.148, p.y + 0.122);
  float cheek = exp(-dot(c, c) / 0.0034);
  alb = mix(alb, uCheek, cheek * 0.55);
  /** A tiny warm tip where the nose would catch the light. */
  alb = mix(alb, uCheek, (0.2 + 0.32 * uNoseTip) * exp(-dot(p - vec2(0.0, -0.104), p - vec2(0.0, -0.104)) / 0.0007));
  /** And the soft shade under it, which is what lets a small nose read from straight in front. */
  alb *= 1.0 - 0.2 * uNoseTip * exp(-(p.x * p.x) / 0.0009 - (p.y + 0.134) * (p.y + 0.134) / 0.00012);
  /** Brows: short soft arcs close over the eyes, fuller toward the nose, the only thing that carries a mood. */
  vec2 b = vec2(abs(p.x) - 0.122, p.y - 0.068 + 7.0 * (abs(p.x) - 0.122) * (abs(p.x) - 0.122));
  float brow = fill(ellipse(b, vec2(0.031, 0.0105 - 0.1 * clamp(b.x, 0.0, 0.031))));
  alb = mix(alb, uBrow, brow * 0.85);
  float open = 1.0 - clamp(uBlink, 0.0, 1.0);
  if (uWhites > 0.5) {
    /** A sliver of white at the outer corner of a dark eye, never a ring round it. */
    float white = fill(ellipse(e - vec2(0.008, -0.0046), vec2(0.0495, 0.0483 * open + 0.001)));
    alb = mix(alb, uWhite, white * 0.9 * smoothstep(0.1, 0.4, open));
  }
  /** The eye: a big dark upright oval, a young child's; shut, it is a soft curved lash line. */
  float eye = fill(ellipse(e, vec2(0.0495, 0.061 * open + 0.001))) * smoothstep(0.05, 0.3, open);
  float lid = fill(abs(e.y + 0.0207 - 3.04 * e.x * e.x) - 0.0052) * step(abs(e.x), 0.053) * (1.0 - open);
  /** Warm brown low in the eye, where the light comes through, so it is an eye and not a bead. */
  vec3 iris = mix(uEye, uBrow * 1.25, 0.8 * smoothstep(0.0, -0.053, e.y) * smoothstep(0.046, 0.023, length(e * vec2(1.0, 0.8))));
  alb = mix(alb, mix(uEye, iris, open), max(eye, lid));
  /** One soft glint, high on the outer side, which is what keeps a big dark eye from reading as a hole. */
  vec2 g = vec2(e.x * sign(p.x), e.y);
  alb = mix(alb, vec3(1.0), 0.85 * fill(length(g - vec2(0.0161, 0.023)) - 0.0092) * eye * open);
  /** The mouth: a small relaxed line; a yawn opens it into a soft dark oval. */
  vec2 m = vec2(p.x, p.y + 0.176);
  float line = fill(abs(m.y - 4.0 * m.x * m.x) - 0.0034 * (1.0 - 0.5 * abs(m.x) / 0.032)) * step(abs(m.x), 0.032) * uMouth;
  /** The soft fullness of the lower lip, only a warmth. */
  alb = mix(alb, uCheek, 0.3 * uMouth * exp(-(m.x * m.x) / 0.0005 - (m.y + 0.014) * (m.y + 0.014) / 0.00006));
  float yawn = fill(ellipse(m + vec2(0.0, 0.006), vec2(0.018 + 0.006 * uYawn, 0.004 + 0.03 * uYawn))) * step(0.02, uYawn);
  alb = mix(alb, uLip, line * 0.8);
  alb = mix(alb, uEye * 1.6, yawn);
  return alb;
}

${KNIT_GLSL}

void main() {
  int m = int(vLook.x + 0.5);
  float k = vLook.y;
  float bakedAo = vLook.z;
  bool front = gl_FrontFacing;
  vec3 N = normalize(vNormal) * (front ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float grain = vnoise3(vRest * 38.0) * 0.6 + vnoise3(vRest * 110.0) * 0.4;
  float blotch = vnoise3(vRest * 7.0);
  vec3 alb = uCoat;
  float fuzz = 0.5;
  float gloss = 0.0;
  float sheen = 0.0;
  float inside = front ? 0.0 : 1.0;
  if (m == ${MAT.coat} || m == ${MAT.mitten}) {
    /** Felted wool: soft mottling, and a shade darker in the turned cuffs, the hood's rolled edge and the hem. */
    alb = uCoat * (0.9 + 0.14 * grain + 0.06 * (blotch - 0.5));
    alb *= 1.0 - 0.1 * k;
    if (m == ${MAT.coat}) {
      /** The placket's edge, the hood's centre seam and the hem's stitching. */
      float placket = fill(abs(vRest.x - 0.034) - 0.0022) * step(0.0, vRest.z) * step(vRest.y, 1.6) * step(0.5, vRest.y);
      float seam = fill(abs(vRest.x) - 0.0026) * step(1.74, vRest.y) * step(vRest.z, 0.3);
      float stitch = fill(abs(fract(vSurf.x * 60.0) - 0.5) - 0.2) * fill(abs(vRest.y - 0.625) - 0.0018) * step(vRest.y, 0.66) * (1.0 - k);
      alb *= 1.0 - 0.32 * max(placket, seam) - 0.12 * stitch;
    }
    fuzz = 0.75;
  } else if (m == ${MAT.skin}) {
    alb = uSkin * (0.97 + 0.05 * grain);
    alb = paintFace(alb, vRest, N, V, gloss);
    /** The throat, down in the shadow between the chin and the scarf; the neck itself (k) all of it. */
    alb *= 1.0 - 0.6 * k;
    alb *= 1.0 - 0.72 * (1.0 - smoothstep(${f(FACE.c.y - FACE.down - 0.015)}, ${f(FACE.c.y - FACE.down + 0.035)}, vRest.y));
    fuzz = 0.3;
  } else if (m == ${MAT.hair}) {
    alb = uHair * (0.85 + 0.25 * vnoise3(vec3(vSurf.y * 9.0, vRest.y * 60.0, vSurf.x * 3.0)));
    alb *= 1.0 + 0.15 * k;
    fuzz = 0.35;
    sheen = 0.12;
  } else if (m == ${MAT.trousers}) {
    alb = uTrousers * (0.92 + 0.14 * grain);
    fuzz = 0.45;
  } else if (m == ${MAT.boot}) {
    /** Worn matte leather: scuffed paler over the toe and heel and along the creases at the ankle, dark at the sole. */
    float scuff = smoothstep(0.55, 0.85, vnoise3(vRest * 16.0)) * (0.5 + 0.5 * smoothstep(0.1, 0.02, vRest.y));
    float crease = smoothstep(0.35, 0.5, vSurf.x) * smoothstep(0.62, 0.5, vSurf.x) * smoothstep(0.4, 0.8, vnoise3(vRest * vec3(40.0, 8.0, 40.0)));
    alb = uBoot * (0.88 + 0.16 * blotch + 0.3 * scuff - 0.15 * crease) * mix(1.0, 0.5, k);
    gloss = 0.04 * (1.0 - k);
    fuzz = 0.3;
  } else if (m == ${MAT.leather}) {
    /** Worn soft leather, paler where it rubs, dark inside the mouth. */
    alb = uLeather * (0.85 + 0.22 * blotch + 0.05 * grain) * mix(1.0, 0.45, k);
    /** Stitched seams down the box's four corners. */
    alb *= 1.0 - 0.22 * smoothstep(0.975, 0.998, abs(sin(2.0 * vSurf.x))) * (1.0 - k);
    gloss = 0.14;
    fuzz = 0.12;
  } else if (m == ${MAT.strap}) {
    alb = uStrap * (0.9 + 0.12 * blotch) * (1.0 + 0.25 * k);
    gloss = 0.12;
    fuzz = 0.1;
  } else if (m == ${MAT.knit}) {
    float st = knit(vSurf, 1.0);
    alb = uScarf * (0.8 + 0.3 * st) * (0.94 + 0.1 * blotch);
    fuzz = 0.9;
  } else if (m == ${MAT.button}) {
    alb = uButton * mix(1.0, 0.7, k);
    gloss = 0.5;
    fuzz = 0.05;
  }
  if (!front) {
    /** The inside of the coat, the hood and the bag. */
    alb = m == ${MAT.leather} ? uLeather * 0.4 : uLining;
    bakedAo *= 0.55;
  }
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.55 + 0.45, 0.0, 1.0);
  float sun = groundAt(uGroundPos.xz).w * cloudShadow(uGroundPos.xz);
  /** Inside the hood the face only takes the sun that comes in through the opening. */
  if (m == ${MAT.skin} || m == ${MAT.hair}) {
    float into = dot(uSunDir, uHoodForward);
    /** Skin takes the sun softly: a bare forehead square to a low sun would otherwise flare white. */
    sun *= mix(0.25, 1.0, smoothstep(-0.1, 0.6, into)) * (m == ${MAT.skin} ? 0.7 : 1.0);
    vec3 q = vRest - ${v3(FACE.c)};
    bakedAo *= 1.0 - 0.3 * smoothstep(0.0, 0.2, q.y) - 0.25 * smoothstep(0.12, 0.26, abs(q.x));
  }
  /** Light the hood's lining throws back onto the face: warm, and why a face in a yellow hood is never grey. */
  vec3 lining = vec3(0.0);
  if (m == ${MAT.skin} || m == ${MAT.hair}) lining = uCoat * (hemiLight(vec3(0.0, 1.0, 0.0)) * 0.22 + uSunColor * groundAt(uGroundPos.xz).w * 0.07);
  float ground = mix(0.55, 1.0, smoothstep(0.0, 1.2, vWorld.y - uGroundPos.y));
  float ao = ground * mix(0.45, 1.0, bakedAo);
  float facing = clamp(dot(N, V), 0.0, 1.0);
  float back = max(dot(-V, uSunDir), 0.0);
  float rim = pow(1.0 - facing, 3.0) * (0.35 + 0.65 * back);
  vec3 col = alb * (hemiLight(N) * 1.05 * ao + uSunColor * wrap * wrap * sun * 0.95 * mix(0.6, 1.0, ao) + lining);
  /** A face turning away from the eye darkens a little toward its edge, so it reads round in the hood's shade. */
  if (m == ${MAT.skin}) col *= mix(0.78, 1.04, pow(facing, 0.6));
  /** Wool catches the low sun along its edge: the soft halo that makes the coat read as cloth. */
  col += uSunColor * alb * rim * (0.35 + 0.45 * fuzz) * sun * (1.0 - inside);
  if (gloss > 0.0) {
    vec3 H = normalize(uSunDir + V);
    col += uSunColor * gloss * pow(max(dot(N, H), 0.0), 40.0) * sun * (1.0 - inside);
    col += uSkyAmbient * gloss * 0.25 * pow(1.0 - facing, 4.0);
  }
  if (sheen > 0.0) {
    vec3 H = normalize(uSunDir + V);
    col += uSunColor * alb * sheen * pow(max(dot(N, H), 0.0), 12.0) * sun * 2.0;
  }
  /**
   * The light a room makes for itself: the coals the child walks toward, the bedside lamp, the first morning.
   * The lamp stands a stride from the pillow, so it is taken square on the side turned to it and nearly let go
   * on the other. Spread evenly it paints the whole child the colour of the bulb and loses the blue they lie in.
   */
  col += alb * (emberLight(vWorld, N) + dawnLight(vWorld, N)) * mix(0.5, 1.0, ao);
  if (uLamp.w > 0.0) {
    vec3 toLamp = uLamp.xyz - vWorld;
    float lampSide = clamp(dot(N, toLamp) * inversesqrt(max(dot(toLamp, toLamp), 1e-4)) * 0.5 + 0.5, 0.0, 1.0);
    col += alb * lampLight(vWorld, N) * (0.28 + 0.72 * lampSide) * mix(0.5, 1.0, ao);
  }
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

export function childMaterial(): THREE.ShaderMaterial {
  const c = (color: THREE.Color) => ({ value: color });
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...atmo.uniforms,
      uGroundPos: { value: new THREE.Vector3() },
      uCoat: c(PALETTE.coat),
      uLining: c(PALETTE.lining),
      uScarf: c(PALETTE.scarf),
      uSkin: c(PALETTE.skin),
      uCheek: c(PALETTE.cheek),
      uHair: c(PALETTE.hair),
      uBrow: c(PALETTE.brow),
      uEye: c(PALETTE.eye),
      uWhite: c(PALETTE.white),
      uLip: c(PALETTE.lip),
      uTrousers: c(PALETTE.trousers),
      uBoot: c(PALETTE.boot),
      uLeather: c(PALETTE.leather),
      uStrap: c(PALETTE.strap),
      uButton: c(PALETTE.button),
      uBlink: { value: 0 },
      uYawn: { value: 0 },
      uMouth: { value: 1 },
      uWhites: { value: 1 },
      uNoseTip: { value: 1 },
      uFlutter: { value: 0 },
      uFlow: { value: new THREE.Vector3() },
      uHoodForward: { value: new THREE.Vector3(0, 0, 1) },
    },
    side: THREE.DoubleSide,
  });
}
