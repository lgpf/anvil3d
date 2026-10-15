export default {
  api: 1, id: 'piramide', nome: 'Pirâmide', categoria: 'Básicos', icone: '△', cor: '#f2c14e',
  parametros: [
    { chave: 'base', rotulo: 'Lado da base', padrao: 20, min: 0.01 },
    { chave: 'altura', rotulo: 'Altura', padrao: 20, min: 0.01 },
    { chave: 'lados', rotulo: 'Lados da base', padrao: 4, min: 3, inteiro: true },
  ],
  gerar(p, { Manifold, CrossSection }) {
    const n = Math.max(3, Math.round(p.lados));
    const raio = p.base / (2 * Math.sin(Math.PI / n)); // circunraio para o lado pedido
    const pts = [];
    for (let i = 0; i < n; i++) { const a = Math.PI / n + (2 * Math.PI * i) / n - (n === 4 ? 0 : Math.PI / 2); pts.push([raio * Math.cos(a), raio * Math.sin(a)]); }
    const cs = new CrossSection([pts]);
    const r = Manifold.extrude(cs, p.altura, 0, 0, [0, 0]); cs.delete();
    return r;
  },
};
