// Cilindro com fillet ou chanfro opcional nas bordas de cima e de baixo (perfil girado, exato).
const ACAB = [['nenhum', 'Nenhum'], ['fillet', 'Fillet'], ['chanfro', 'Chanfro']];
export default {
  api: 1, id: 'cilindro', nome: 'Cilindro', categoria: 'Básicos', icone: '●', cor: '#f2a03d', versao: '1.1.0',
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro', padrao: 20, min: 0.01 },
    { chave: 'altura', rotulo: 'Altura', padrao: 20, min: 0.01 },
    { chave: 'lados', rotulo: 'Lados (0 = automático)', padrao: 0, min: 0, inteiro: true },
    { chave: 'bordaTopo', rotulo: 'Borda de cima', tipo: 'opcao', opcoes: ACAB, padrao: 'nenhum' },
    { chave: 'medidaTopo', rotulo: 'Medida em cima', padrao: 2, min: 0 },
    { chave: 'bordaBase', rotulo: 'Borda de baixo', tipo: 'opcao', opcoes: ACAB, padrao: 'nenhum' },
    { chave: 'medidaBase', rotulo: 'Medida em baixo', padrao: 2, min: 0 },
  ],
  gerar(p, { Manifold, CrossSection, segmentos }) {
    const R = p.diametro / 2, h = p.altura, lados = p.lados >= 3 ? p.lados : segmentos(R);
    const topo = p.bordaTopo ?? 'nenhum', base = p.bordaBase ?? 'nenhum';
    const mt = topo === 'nenhum' ? 0 : p.medidaTopo, mb = base === 'nenhum' ? 0 : p.medidaBase;
    if (!(mt > 0) && !(mb > 0)) return Manifold.cylinder(h, R, R, lados);
    if (mt > R || mb > R) throw new Error('a medida da borda é maior que o raio');
    if (mt + mb > h) throw new Error('as bordas somadas passam da altura');
    // perfil (r, z) no sentido anti-horário
    const pts = [[0, 0]];
    if (mb > 0 && base === 'chanfro') pts.push([R - mb, 0], [R, mb]);
    else if (mb > 0) for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 + (Math.PI / 2) * k / 12; pts.push([R - mb + mb * Math.cos(a), mb + mb * Math.sin(a)]); }
    else pts.push([R, 0]);
    if (mt > 0 && topo === 'chanfro') pts.push([R, h - mt], [R - mt, h]);
    else if (mt > 0) for (let k = 0; k <= 12; k++) { const a = (Math.PI / 2) * k / 12; pts.push([R - mt + mt * Math.cos(a), h - mt + mt * Math.sin(a)]); }
    else pts.push([R, h]);
    pts.push([0, h]);
    const cs = new CrossSection([pts]);
    const r = cs.revolve(lados); cs.delete();
    return r;
  },
};
