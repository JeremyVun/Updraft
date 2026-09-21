/** Area-weighted normals for packed, dynamic Float32 geometry. Same accumulation
 * order and rounding as BufferGeometry.computeVertexNormals, without attribute dispatch. */
export function indexedNormals(position: Float32Array, normal: Float32Array, index: ArrayLike<number>): void {
  normal.fill(0);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const cbx = position[c] - position[b], cby = position[c + 1] - position[b + 1], cbz = position[c + 2] - position[b + 2];
    const abx = position[a] - position[b], aby = position[a + 1] - position[b + 1], abz = position[a + 2] - position[b + 2];
    const x = cby * abz - cbz * aby, y = cbz * abx - cbx * abz, z = cbx * aby - cby * abx;
    normal[a] += x; normal[a + 1] += y; normal[a + 2] += z;
    normal[b] += x; normal[b + 1] += y; normal[b + 2] += z;
    normal[c] += x; normal[c + 1] += y; normal[c + 2] += z;
  }
  for (let i = 0; i < normal.length; i += 3) {
    const x = normal[i], y = normal[i + 1], z = normal[i + 2];
    const inverse = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    normal[i] = x * inverse; normal[i + 1] = y * inverse; normal[i + 2] = z * inverse;
  }
}
