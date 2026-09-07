import { BufferGeometry, Float32BufferAttribute, Uint8BufferAttribute, Color, Vector3 } from 'three';

/** Indexed, palette-colored geometry. Omit normals for glTF's flat-shading path. */
export function compactMesh(boneNames, transform = point => point) {
  const positions = [], colors = [], joints = [], weights = [], indices = [], cache = new Map();
  const boneIds = new Map(boneNames.map((name, i) => [name, i]));
  function vertex(point, color, influences) {
    const links = typeof influences === 'function' ? influences(point) : [[influences, 1]];
    const packed = links.map(([name, weight]) => [boneIds.get(name), Math.round(weight * 255)]);
    if (packed.some(([id]) => id === undefined) || packed.length > 4) throw new Error('Invalid compact mesh bone weights');
    packed[0][1] += 255 - packed.reduce((sum, [, weight]) => sum + weight, 0);
    const skin = [0, 0, 0, 0], blend = [0, 0, 0, 0];
    packed.forEach(([id, weight], i) => { skin[i] = weight ? id : 0; blend[i] = weight; });
    const rgb = new Color(color).toArray().map(v => Math.round(v * 255));
    const xyz = transform(point).map(v => Math.round(v * 1e6) / 1e6);
    const key = [...xyz, ...rgb, ...skin, ...blend].join(',');
    if (!cache.has(key)) {
      cache.set(key, positions.length / 3); positions.push(...xyz); colors.push(...rgb); joints.push(...skin); weights.push(...blend);
    }
    return cache.get(key);
  }
  function surface(points, faces, color, influences) {
    for (const face of faces) {
      const center = [0, 1, 2].map(axis => face.reduce((sum, i) => sum + points[i][axis], 0) / 3);
      const tint = typeof color === 'function' ? color(center) : color;
      indices.push(...face.map(i => vertex(points[i], tint, influences)));
    }
  }
  function loft(rows, sides, color, influences, phase = 0) {
    const points = [], faces = [];
    rows.forEach((row, j) => {
      const before = rows[Math.max(0, j - 1)], after = rows[Math.min(rows.length - 1, j + 1)];
      const tangent = new Vector3(...after.slice(0, 3)).sub(new Vector3(...before.slice(0, 3))).normalize();
      const u = new Vector3(...(Math.abs(tangent.x) < .85 ? [1, 0, 0] : [0, 0, 1]));
      u.addScaledVector(tangent, -u.dot(tangent)).normalize(); const v = tangent.clone().cross(u);
      for (let k = 0; k < sides; k++) {
        const angle = phase + k / sides * Math.PI * 2;
        points.push(new Vector3(...row.slice(0, 3)).addScaledVector(u, Math.cos(angle) * row[3]).addScaledVector(v, Math.sin(angle) * row[4]).toArray());
        if (j) {
          const a = (j - 1) * sides + k, b = j * sides + k, c = (j - 1) * sides + (k + 1) % sides, d = j * sides + (k + 1) % sides;
          faces.push([a, c, b], [c, d, b]);
        }
      }
    });
    for (const end of [0, rows.length - 1]) {
      const center = points.length; points.push(rows[end].slice(0, 3));
      for (let k = 0; k < sides; k++) {
        const a = end * sides + k, b = end * sides + (k + 1) % sides;
        faces.push(end ? [center, a, b] : [center, b, a]);
      }
    }
    // Give each quad one palette color; triangle-by-triangle thresholds make
    // accidental sawtooth patches instead of a deliberate coat boundary.
    const sideFaces = (rows.length - 1) * sides * 2;
    for (let i = 0; i < faces.length;) {
      const batch = faces.slice(i, i + (i < sideFaces ? 2 : 1));
      const vertices = [...new Set(batch.flat())];
      const center = [0, 1, 2].map(axis => vertices.reduce((sum, index) => sum + points[index][axis], 0) / vertices.length);
      surface(points, batch, typeof color === 'function' ? color(center) : color, influences);
      i += batch.length;
    }
  }
  function convex(points, faces, color, influences) {
    const center = points.reduce((v, p) => v.add(new Vector3(...p)), new Vector3()).divideScalar(points.length);
    surface(points, faces.map(face => {
      const [a, b, c] = face.map(i => new Vector3(...points[i]));
      return b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().sub(center)) < 0 ? face.toReversed() : face;
    }), color, influences);
  }
  function polygon(points, normal, color, influences) {
    const a = new Vector3(...points[0]), b = new Vector3(...points[1]), c = new Vector3(...points[2]);
    const flip = b.sub(a).cross(c.sub(a)).dot(new Vector3(...normal)) < 0;
    surface(points, Array.from({ length: points.length - 2 }, (_, i) => flip ? [0, i + 2, i + 1] : [0, i + 1, i + 2]), color, influences);
  }
  function finish() {
    const geometry = new BufferGeometry(); geometry.setIndex(indices);
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Uint8BufferAttribute(colors, 3, true));
    geometry.setAttribute('skinIndex', new Uint8BufferAttribute(joints, 4));
    geometry.setAttribute('skinWeight', new Uint8BufferAttribute(weights, 4, true));
    return geometry;
  }
  return { loft, surface, convex, polygon, finish };
}
