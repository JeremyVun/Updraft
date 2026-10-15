import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';

/**
 * One look of a prop sharing the prop program: its vertex and fragment bodies and what they read. `vWorld` and
 * `vNormal` are shared; everything else it declares, once whichever looks declare it too.
 */
export interface PropLook {
  /** What its vertex body hands its fragment body beyond those two, e.g. `vec3 vLocal; float vKind;`. */
  varyings?: string;
  /** The attributes and uniforms its vertex body reads beyond the atmosphere's, e.g. `in float aKind; uniform float uFlap;`. */
  vertexInputs?: string;
  /** The uniforms its fragment body reads beyond the atmosphere's. */
  fragmentInputs?: string;
  /** Shared GLSL its fragment body calls, included after `ATMO_GLSL`, once whichever looks use it. */
  fragmentGlsl?: string[];
  /** The body of its vertex `main`: sets `gl_Position`, `vWorld`, `vNormal` and its varyings. */
  vertex: string;
  /** The body of its fragment `main`, returning its colour before the fog. */
  fragment: string;
  /** Its fogged colour is held at 0 or above. */
  floored?: boolean;
  /**
   * Which prop program it joins, when not the common one. A look can cost more to draw on Windows beside heavy looks
   * than it did apart, so the heavy looks share their own: the weathered timber's, and the bell's with the straw's.
   * (The belfry keeps a program of its own: beside the straw's look it cost about 2.5% of the scene behind the swing.)
   */
  program?: 'bell' | 'timber';
}

/** A registered look: its program and its number there. */
export interface PropLookId { program: string; n: number }

type Sources = { vertexShader: string; fragmentShader: string };
const programs = new Map<string, { looks: PropLook[]; built: Sources | null }>();

/**
 * Adds a look to its prop program and returns what `propMaterial` needs. Looks register as their modules load, before
 * any material of their program is made: every material of a program has to carry the same source to share it.
 */
export function propLook(look: PropLook): PropLookId {
  const program: string = look.program ?? 'props';
  let entry = programs.get(program);
  if (!entry) programs.set(program, entry = { looks: [], built: null });
  if (entry.built) throw new Error(`A prop look registered after the ${program} program was built`);
  return { program, n: entry.looks.push(look) - 1 };
}

/**
 * A material drawing with prop look `look`. Each prop keeps its own material and uniforms; three builds one program
 * for all the looks of a program, since their sources, defines and side are the same. Every program costs a full
 * compile (about a second on Windows, most of it the atmosphere and fog every one of them includes) and a first draw
 * per target format, so the props share three: `uLook` picks the bodies, and one `applyFog` follows them all.
 */
export function propMaterial(look: PropLookId, uniforms: Record<string, THREE.IUniform> = {}): THREE.ShaderMaterial {
  const entry = programs.get(look.program)!;
  entry.built ??= build(entry.looks);
  return new THREE.ShaderMaterial({
    ...entry.built, uniforms: { ...atmo.uniforms, ...uniforms, uLook: { value: look.n } }, side: THREE.DoubleSide,
  });
}

/** Each declaration once; one name declared two ways is a mistake in a look. */
function declare(into: Map<string, string>, text: string | undefined, prefix = ''): void {
  for (const part of (text ?? '').split(';')) {
    const decl = part.trim().replace(/\s+/g, ' ');
    if (!decl) continue;
    const line = `${prefix}${decl};`;
    const name = decl.split(' ').pop() as string;
    const had = into.get(name);
    if (had && had !== line) throw new Error(`Prop looks declare ${name} two ways: ${had} ${line}`);
    into.set(name, line);
  }
}

function dispatch(looks: PropLook[], call: (n: number) => string): string {
  return looks.map((_, n) => `  ${n === 0 ? '' : 'else '}${n < looks.length - 1 ? `if (uLook == ${n}) ` : ''}${call(n)}`).join('\n');
}

function build(looks: PropLook[]): Sources {
  const vertexIn = new Map<string, string>(), fragmentIn = new Map<string, string>();
  const outs = new Map<string, string>([['vWorld', 'out vec3 vWorld;'], ['vNormal', 'out vec3 vNormal;']]);
  const ins = new Map<string, string>([['vWorld', 'in vec3 vWorld;'], ['vNormal', 'in vec3 vNormal;']]);
  const glsl = new Set<string>();
  for (const look of looks) {
    declare(vertexIn, look.vertexInputs);
    declare(fragmentIn, look.fragmentInputs);
    declare(outs, look.varyings, 'out ');
    declare(ins, look.varyings, 'in ');
    for (const chunk of look.fragmentGlsl ?? []) glsl.add(chunk);
  }
  const floored = looks.flatMap((look, n) => look.floored ? [`  if (uLook == ${n}) col = max(col, 0.0);`] : []);
  const vertexShader = /* glsl */ `
${ATMO_GLSL}
uniform int uLook;
${[...vertexIn.values(), ...outs.values()].join('\n')}
${looks.map((look, n) => `void propVertex${n}() {${look.vertex}}`).join('\n')}
void main() {
${dispatch(looks, (n) => `propVertex${n}();`)}
}`;
  const fragmentShader = /* glsl */ `
${ATMO_GLSL}
${[...glsl].join('\n')}
uniform int uLook;
${[...fragmentIn.values(), ...ins.values()].join('\n')}
${looks.map((look, n) => `vec3 propLook${n}() {${look.fragment}}`).join('\n')}
void main() {
  vec3 col;
${dispatch(looks, (n) => `col = propLook${n}();`)}
  col = applyFog(col, vWorld);
${floored.join('\n')}
  gl_FragColor = vec4(col, 1.0);
}`;
  return { vertexShader, fragmentShader };
}
