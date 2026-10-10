// Inspect the posed hood, face and hair, including their edges rather than only the face socket.
import { BONE } from '../../src/traveller/child/skeleton.ts';
export function childHead(child) {
  const mesh = child.rig.mesh, { skinIndex, skinWeight } = mesh.geometry.attributes, indices = [];
  for (let i = 0; i < skinIndex.count; i++) {
    let weight = 0;
    for (let j = 0; j < 4; j++) {
      const bone = skinIndex.getComponent(i, j);
      if (bone === BONE.head || bone === BONE.hood) weight += skinWeight.getComponent(i, j);
    }
    if (weight >= 0.5) indices.push(i);
  }
  if (!indices.length) throw new Error('No head vertices found');
  const v = child.position.clone();
  return camera => {
    child.rig.root.updateMatrixWorld(true); mesh.skeleton.update();
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    for (const i of indices) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).project(camera);
      if (v.z >= 1) return [-Infinity, -Infinity, Infinity, Infinity];
      const x = (v.x + 1) / 2, y = (1 - v.y) / 2;
      bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
    }
    return bounds;
  };
}
