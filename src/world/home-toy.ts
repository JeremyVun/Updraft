import * as THREE from 'three';
import { fixTreeInPlace } from '../gl/fixed';
import { tuning } from '../tuning';
import { atmo } from './atmosphere';
import { HOME_JETTY } from './home-layout';
import { heightAt } from './island';
import { hull, material, sail, SAIL_FRAG, SAIL_VERT, TOY_LINENS, TOY_PAINTS } from './little-boats';

/**
 * The child's own toy from the little boats, the orange one she set sailing out to sea, washed up on the home beach
 * beside the jetty. Nobody put it there and nothing is made of it: it lies on its side above the wash with its sail
 * fallen, for whoever walks in off the jetty to notice.
 */
export function createHomeToy(): THREE.Object3D {
  const k = tuning.homeToy;
  const g = new THREE.Group();
  g.name = 'home-toy';
  const wood = material('#76503a'), rim = material('#d4ad73');
  const shell = hull();
  g.add(new THREE.Mesh(shell, material(TOY_PAINTS[0])));
  const deck = new THREE.Mesh(shell, rim);
  deck.scale.set(0.89, 0.24, 0.91);
  deck.position.y = 0.13;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.59, 0.07, 0.13), wood);
  seat.position.set(0, 0.24, -0.2);
  const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.75, 7).translate(0, 0.85, 0.21), wood);
  const cloth = new THREE.Mesh(sail(), new THREE.ShaderMaterial({
    uniforms: {
      ...atmo.uniforms,
      uFill: { value: 0 }, uDroop: { value: 1 }, uLuff: { value: 0 }, uPhase: { value: 0 }, uSeed: { value: 0 },
      uColour: { value: new THREE.Color(TOY_LINENS[0]) },
    },
    vertexShader: SAIL_VERT,
    fragmentShader: SAIL_FRAG,
    side: THREE.DoubleSide,
  }));
  cloth.position.z = 0.21;
  g.add(deck, seat, spar, cloth);

  // On the sand just above the wash: walk up the beach from the jetty's shore end until it is that high.
  const x = HOME_JETTY.x + k.side;
  let z = HOME_JETTY.shoreZ + 6;
  while (z > HOME_JETTY.shoreZ - 6 && heightAt(x, z) < k.above) z -= 0.05;
  g.position.set(x, heightAt(x, z) - k.sink, z);
  g.rotation.set(0, k.yaw, k.heel, 'YXZ');
  fixTreeInPlace(g);
  return g;
}
