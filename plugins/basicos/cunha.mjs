export default {
  api: 1, id: 'cunha', nome: 'Cunha', categoria: 'Básicos', icone: '◢', cor: '#2bb3b1',
  parametros: [
    { chave: 'largura', rotulo: 'Largura (X)', padrao: 20, min: 0.01 },
    { chave: 'profundidade', rotulo: 'Profundidade (Y)', padrao: 20, min: 0.01 },
    { chave: 'altura', rotulo: 'Altura (Z)', padrao: 20, min: 0.01 },
  ],
  gerar(p, { Manifold, CrossSection }) {
    const { largura: w, profundidade: d, altura: h } = p;
    // perfil triangular no plano XZ, extrudado ao longo de Y
    const perfil = new CrossSection([[[-w / 2, 0], [w / 2, 0], [-w / 2, h]]]);
    const s = perfil.extrude(d); perfil.delete();
    const r = s.rotate([90, 0, 0]).translate([0, d / 2, 0]); s.delete();
    return r;
  },
};
