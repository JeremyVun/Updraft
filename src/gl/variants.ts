import type * as THREE from 'three';

/**
 * Effects compiled into or out of a material's programs. Each is a define of the same name, 1 or 0, that its GLSL
 * tests with `#if`: on these GPUs code a uniform switches off still costs registers, so an effect that is off is
 * compiled out rather than branched round.
 */
export type Switch = 'CLOUD_DECK' | 'LAND_SKIP' | 'HULL_COLLAR' | 'LANTERN_GLINT' | 'SEABED_DETAIL' | 'SEA_REFLECTION' | 'SUN_GLOW' | 'STORM_BANK' | 'DEPTH_BLUR';
export type Choice = Partial<Record<Switch, boolean>>;

type Axis = readonly Choice[];

/** The stairs' cloud deck and bank of mist (`ATMO_GLSL`), drawn only while `uCloudDeck.w` is above 0. */
export const CLOUD_DECK: Axis = [{ CLOUD_DECK: true }, { CLOUD_DECK: false }];

/** The sea returning early where land covers it, drawn only while there is land in the window to cover it. */
export const LAND_SKIP: Axis = [{ LAND_SKIP: false }, { LAND_SKIP: true }];

/** The grade's glow round the sun, standing in for bloom while bloom is off. */
export const SUN_GLOW: Axis = [{ SUN_GLOW: false }, { SUN_GLOW: true }];

/** The grade's depth blur, drawn while bloom is: it reads the frame bloom has finished with. */
export const DEPTH_BLUR: Axis = [{ DEPTH_BLUR: true }, { DEPTH_BLUR: false }];

/** The sky's storm bank (`skyRadiance`), drawn only while there is a storm or lightning. */
export const STORM_BANK: Axis = [{ STORM_BANK: true }, { STORM_BANK: false }];

const registered = new Map<THREE.ShaderMaterial, Axis[]>();

const define = (on: boolean | undefined): number => (on ? 1 : 0);

function matches(defines: Record<string, unknown>, choice: Choice): boolean {
  for (const name in choice) if (defines[name] !== define(choice[name as Switch])) return false;
  return true;
}

/**
 * Registers the variants a material can be drawn with. Each axis lists the alternatives for its switches, and a
 * variant takes one alternative from every axis; every variant is compiled and warmed before Begin, and `select`
 * accepts no other. The material is drawn with the first alternative of each axis until something selects another.
 */
export function register(material: THREE.ShaderMaterial, ...axes: Axis[]): void {
  const known = registered.get(material) ?? [];
  for (const axis of axes) {
    const switches = Object.keys(axis[0]).sort();
    if (axis.some((choice) => Object.keys(choice).sort().join() !== switches.join())) {
      throw new Error(`Every alternative must set ${switches.join(', ')}`);
    }
    if (known.some((other) => switches.some((name) => name in other[0]))) throw new Error(`${switches.join(', ')} already registered`);
    known.push(axis);
    for (const name of switches) material.defines[name] = define(axis[0][name as Switch]);
  }
  registered.set(material, known);
  material.needsUpdate = true;
}

/**
 * Draws the material with these switches from its next draw. The program was built before Begin; switching only
 * rebinds it, for every mesh, view and pass that uses the material.
 */
export function select(material: THREE.ShaderMaterial, choice: Choice): void {
  if (matches(material.defines, choice)) return;
  const axes = registered.get(material);
  if (!axes) throw new Error(`${material.type} has no variants`);
  const next: Record<string, unknown> = { ...material.defines };
  for (const name in choice) {
    if (!(name in next)) throw new Error(`${material.type} has no ${name} variant`);
    next[name] = define(choice[name as Switch]);
  }
  if (!axes.every((axis) => axis.some((alternative) => matches(next, alternative)))) {
    throw new Error(`${JSON.stringify(choice)} is not a registered variant`);
  }
  Object.assign(material.defines, next);
  material.needsUpdate = true;
}

/** Selects these switches on every registered material that has them. */
export function selectAll(choice: Choice): void {
  for (const [material, axes] of registered) {
    let mine: Choice | null = null;
    for (const name in choice) {
      const on = choice[name as Switch];
      if (material.defines[name] === define(on) || !axes.some((axis) => name in axis[0])) continue;
      (mine ??= {})[name as Switch] = on;
    }
    if (mine) select(material, mine);
  }
}

/** Whether an object draws with a registered material. */
export function hasVariants(object: THREE.Object3D): boolean {
  const material = (object as Partial<THREE.Mesh>).material;
  return !!material && !Array.isArray(material) && registered.has(material as THREE.ShaderMaterial);
}

/**
 * Every registered material's other variants as steps, for compiling and warming them behind the veil: at step k a
 * material takes the variant k after its current one, wrapping round, so the steps cover every variant of the
 * material with the most. Each step selects its variants and returns the undo, which restores the selection.
 */
export function variantSteps(): (() => () => void)[] {
  const plans = [...registered].map(([material, axes]) => {
    const variants = axes.reduce<Choice[]>((all, axis) => all.flatMap((c) => axis.map((a) => ({ ...c, ...a }))), [{}]);
    const current = variants.findIndex((v) => matches(material.defines, v));
    return { material, variants, current, restore: variants[current] };
  });
  const steps = Math.max(0, ...plans.map((p) => p.variants.length));
  return Array.from({ length: Math.max(0, steps - 1) }, (_, i) => () => {
    for (const p of plans) select(p.material, p.variants[(p.current + i + 1) % p.variants.length]);
    return () => { for (const p of plans) select(p.material, p.restore); };
  });
}

/** Steps through `variantSteps`, restoring the selection after each. */
export function* otherVariants(): Generator<number> {
  for (const [i, step] of variantSteps().entries()) {
    const undo = step();
    try {
      yield i + 1;
    } finally {
      undo();
    }
  }
}
