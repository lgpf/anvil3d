// Exemplo de plugin do usuário. Copiado para Documentos\Anvil3D\plugins na primeira execução.
// Edite, salve e clique em "Recarregar" na biblioteca. Veja LEIA-ME.md na mesma pasta.
export default {
  api: 1,
  id: 'meu.arruela',          // único; use um prefixo seu para não colidir
  nome: 'Arruela',
  categoria: 'Meus plugins',
  icone: '◌',
  cor: '#b8a03a',            // cor da miniatura e das peças novas
  en: { nome: 'Washer', categoria: 'My plugins', rotulos: { externo: 'Outer diameter', interno: 'Inner diameter', espessura: 'Thickness', chanfro: 'Edge chamfer' } },
  parametros: [
    { chave: 'externo', rotulo: 'Diâmetro externo', padrao: 16, min: 0.1 },
    { chave: 'interno', rotulo: 'Diâmetro interno', padrao: 8.4, min: 0 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 1.6, min: 0.1 },
    { chave: 'chanfro', rotulo: 'Chanfro na borda', tipo: 'booleano', padrao: false },
  ],
  gerar(p, { Manifold, segmentos }) {
    const re = p.externo / 2, ri = p.interno / 2, h = p.espessura;
    if (ri >= re) throw new Error('o furo é maior que a arruela');
    const c = p.chanfro ? Math.min(h / 3, (re - ri) / 3) : 0;
    const corpo = Manifold.union([
      Manifold.cylinder(h - c, re, re, segmentos(re)),
      Manifold.cylinder(c || 0.0001, re, re - c, segmentos(re)).translate([0, 0, h - c]),
    ]);
    const furo = Manifold.cylinder(h + 2, ri, ri, segmentos(re)).translate([0, 0, -1]);
    const r = corpo.subtract(furo);
    corpo.delete(); furo.delete();
    return r;
  },
};
