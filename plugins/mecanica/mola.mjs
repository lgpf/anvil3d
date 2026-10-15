// Mola helicoidal de arame redondo, com pontas aplanadas opcionais para apoiar.
export default {
  api: 1, id: 'mola', nome: 'Mola', categoria: 'Mecânica', icone: '§', cor: '#adb5bd', versao: '1.0.0',
  descricao: 'Mola helicoidal de arame redondo',
  en: { nome: 'Spring', categoria: 'Mechanics', descricao: 'Helical spring of round wire',
    rotulos: { diametro: 'Outer diameter', arame: 'Wire thickness', voltas: 'Turns', altura: 'Height', planas: 'Flat ends' } },
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro externo', padrao: 20, min: 1 },
    { chave: 'arame', rotulo: 'Grossura do arame', padrao: 2, min: 0.2 },
    { chave: 'voltas', rotulo: 'Voltas', padrao: 6, min: 0.5 },
    { chave: 'altura', rotulo: 'Altura', padrao: 30, min: 1 },
    { chave: 'planas', rotulo: 'Pontas planas', tipo: 'booleano', padrao: true },
  ],
  gerar(p, { Manifold, Mesh, segmentos }) {
    const r = p.arame / 2, Rc = p.diametro / 2 - r, passo = p.altura / p.voltas;
    if (Rc <= r) throw new Error('o arame é grosso demais para esse diâmetro');
    if (passo <= p.arame * 1.05) throw new Error('as voltas ficam encostadas: aumente a altura ou diminua as voltas');
    // tubo varrido ao longo da hélice: anéis perpendiculares ao arame, ligados em sequência
    const k = passo / (2 * Math.PI), nA = Math.max(10, Math.min(24, segmentos(r))), porVolta = 48;
    const nR = Math.ceil(p.voltas * porVolta) + 1, tFim = 2 * Math.PI * p.voltas, vert = [], tri = [];
    for (let i = 0; i < nR; i++) {
      const t = tFim * i / (nR - 1), C = [Rc * Math.cos(t), Rc * Math.sin(t), r + k * t];
      const T0 = [-Rc * Math.sin(t), Rc * Math.cos(t), k], lt = Math.hypot(...T0), T = T0.map(x => x / lt);
      const N = [-Math.cos(t), -Math.sin(t), 0], B = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
      for (let j = 0; j < nA; j++) { const a2 = 2 * Math.PI * j / nA, c = Math.cos(a2) * r, sn = Math.sin(a2) * r; vert.push(C[0] + c * N[0] + sn * B[0], C[1] + c * N[1] + sn * B[1], C[2] + c * N[2] + sn * B[2]); }
    }
    const id = (i, j) => i * nA + ((j + nA) % nA);
    for (let i = 0; i < nR - 1; i++) for (let j = 0; j < nA; j++) tri.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
    for (let j = 1; j < nA - 1; j++) { tri.push(id(0, 0), id(0, j), id(0, j + 1)); tri.push(id(nR - 1, 0), id(nR - 1, j + 1), id(nR - 1, j)); }
    const montar = t => { const g = new Mesh({ numProp: 3, vertProperties: new Float32Array(vert), triVerts: new Uint32Array(t) }); g.merge(); return new Manifold(g); };
    let m0 = montar(tri);
    if (!(m0.volume() > 0)) { m0.delete(); const inv = []; for (let i = 0; i < tri.length; i += 3) inv.push(tri[i], tri[i + 2], tri[i + 1]); m0 = montar(inv); }
    if (!p.planas) return m0;
    // pontas planas: corta um pouco embaixo e em cima e reapoia em z = 0
    const H = p.altura + p.arame, corte = Manifold.cube([p.diametro * 3, p.diametro * 3, H - p.arame * 1.2], true).translate([0, 0, H / 2]);
    const m1 = m0.intersect(corte); m0.delete(); corte.delete();
    const m = m1.translate([0, 0, -m1.boundingBox().min[2]]); m1.delete(); return m;
  },
};
