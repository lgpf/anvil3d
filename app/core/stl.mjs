// Exporta STL binário a partir de posições + índices.
export function stlBinario({ posicoes: p, indices: ix }, nome = 'Anvil3D') {
  const nt = ix.length / 3;
  const buf = new ArrayBuffer(84 + nt * 50);
  const dv = new DataView(buf);
  const cab = `Anvil3D STL - ${nome}`.slice(0, 80);
  for (let i = 0; i < cab.length; i++) dv.setUint8(i, cab.charCodeAt(i) & 0x7f);
  dv.setUint32(80, nt, true);
  let o = 84;
  for (let t = 0; t < nt; t++) {
    const a = ix[t * 3] * 3, b = ix[t * 3 + 1] * 3, c = ix[t * 3 + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const v of [nx, ny, nz]) { dv.setFloat32(o, v, true); o += 4; }
    for (const k of [a, b, c]) for (let j = 0; j < 3; j++) { dv.setFloat32(o, p[k + j], true); o += 4; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Uint8Array(buf);
}
