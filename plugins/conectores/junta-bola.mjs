// Junta esférica — parte macho: bola presa num pescoço, com base para colar/apoiar. Combina com o Soquete.
export default {
  api: 1, id: 'junta-bola', nome: 'Bola (tamanho livre)', categoria: 'Conectores', ordem: 7, icone: '●', cor: '#2ec4b6', versao: '1.1.0',
  descricao: 'Bola de junta esférica com pescoço e base (encaixa no Soquete)',
  en: { nome: 'Ball (any size)', categoria: 'Connectors', descricao: 'Ball joint stud with neck and base (fits the Socket)',
    rotulos: { bola: 'Ball diameter', pescoco: 'Neck diameter', comprimento: 'Neck length', base: 'Base', baseD: 'Base diameter', baseH: 'Base height' },
    opcoes: { disco: 'Disc', nenhuma: 'None', bola: 'Another ball (double ball)' } },
  parametros: [
    { chave: 'bola', rotulo: 'Diâmetro da bola', padrao: 10, min: 1 },
    { chave: 'pescoco', rotulo: 'Diâmetro do pescoço', padrao: 5, min: 0.5 },
    { chave: 'comprimento', rotulo: 'Comprimento do pescoço', padrao: 6, min: 0 },
    { chave: 'base', rotulo: 'Base', tipo: 'opcao', opcoes: [['disco', 'Disco'], ['nenhuma', 'Nenhuma'], ['bola', 'Outra bola (bola dupla)']], padrao: 'disco' },
    { chave: 'baseD', rotulo: 'Diâmetro da base', padrao: 14, min: 1 },
    { chave: 'baseH', rotulo: 'Altura da base', padrao: 3, min: 0.2 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const R = p.bola / 2, rp = Math.min(p.pescoco / 2, R * 0.9);
    const partes = []; let z = 0;
    if (p.base === 'disco') { partes.push(Manifold.cylinder(p.baseH, p.baseD / 2, p.baseD / 2, segmentos(p.baseD / 2))); z = p.baseH; }
    else if (p.base === 'bola') { partes.push(Manifold.sphere(R, segmentos(R)).translate([0, 0, R])); z = R * 2 - (R - Math.sqrt(R * R - rp * rp)); }
    // o pescoço entra um pouco na bola para unir sem fresta
    const fundoBola = R - Math.sqrt(R * R - rp * rp);
    partes.push(Manifold.cylinder(p.comprimento + fundoBola + 0.01, rp, rp, segmentos(rp)).translate([0, 0, z - 0.005]));
    partes.push(Manifold.sphere(R, segmentos(R)).translate([0, 0, z + p.comprimento + R]));
    const m = Manifold.union(partes); partes.forEach(x => x.delete());
    const z0 = m.boundingBox().min[2], r = m.translate([0, 0, -z0]); m.delete(); return r;
  },
};
