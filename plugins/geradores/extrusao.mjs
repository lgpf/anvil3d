export default {
  api: 1, id: 'extrusao', nome: 'Extrusão de polígono', categoria: 'Geradores', icone: '⬟', cor: '#4f7cac',
  descricao: 'Polígono x,y extrudado em Z, com torção e escala do topo',
  parametros: [
    { chave: 'pontos', rotulo: 'Pontos (x, y por linha)', tipo: 'pontos', editor: 'plano', padrao: '-10,-10\n10,-10\n10,0\n0,10\n-10,10' },
    { chave: 'altura', rotulo: 'Altura', padrao: 10, min: 0.01 },
    { chave: 'torcao', rotulo: 'Torção (°)', padrao: 0, passo: 0.1 },
    { chave: 'escalaTopo', rotulo: 'Escala do topo', padrao: 1, min: 0, passo: 0.05 },
    { chave: 'divisoes', rotulo: 'Divisões', padrao: 0, min: 0, inteiro: true },
  ],
  gerar(p, { Manifold, CrossSection, pontos, segmentos }) {
    const cs = new CrossSection([pontos(p.pontos)], 'NonZero');
    // torção suave: fatias suficientes para a ponta mais distante do eixo andar pouco a cada fatia
    const pts = pontos(p.pontos), rMax = Math.max(1, ...pts.map(([x, y]) => Math.hypot(x, y)));
    const div = p.divisoes || (p.torcao ? Math.min(600, Math.ceil(segmentos(rMax) * Math.abs(p.torcao) / 360)) : 0);
    const r = Manifold.extrude(cs, p.altura, div, p.torcao, [p.escalaTopo, p.escalaTopo]);
    cs.delete();
    return r;
  },
};
