// Meio cilindro: "telhado redondo" deitado, ou meio disco (forma de D) deitado na mesa.
export default {
  api: 1, id: 'meio-cilindro', nome: 'Meio cilindro', categoria: 'Básicos', icone: '◠', cor: '#3fb5c9', versao: '1.0.0',
  descricao: 'Semicírculo extrudado: telhado redondo ou meio disco',
  en: { nome: 'Half cylinder', categoria: 'Basic', descricao: 'Extruded semicircle: round roof or half disc',
    rotulos: { diametro: 'Diameter', comprimento: 'Length / thickness', forma: 'Shape', lados: 'Sides (0 = automatic)' },
    opcoes: { telhado: 'Round roof (curve up)', disco: 'Half disc (lying, D shape)' } },
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro', padrao: 20, min: 0.1 },
    { chave: 'comprimento', rotulo: 'Comprimento / espessura', padrao: 20, min: 0.01 },
    { chave: 'forma', rotulo: 'Forma', tipo: 'opcao', opcoes: [['telhado', 'Telhado redondo (curva para cima)'], ['disco', 'Meio disco (deitado, forma de D)']], padrao: 'telhado' },
    { chave: 'lados', rotulo: 'Lados (0 = automático)', padrao: 0, min: 0, inteiro: true },
  ],
  gerar(p, { CrossSection, segmentos }) {
    const R = p.diametro / 2, n = Math.max(8, Math.round((p.lados || segmentos(R)) / 2));
    const pts = [[-R, 0]];
    for (let i = 0; i <= n; i++) { const a = Math.PI - Math.PI * i / n; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
    const s = new CrossSection([pts.slice(1)], 'NonZero');
    if (p.forma === 'disco') { const m = s.translate([0, -R / 2]); const r = m.extrude(p.comprimento); s.delete(); m.delete(); return r; }
    const e = s.extrude(p.comprimento); s.delete();
    const m = e.rotate([90, 0, 0]).translate([0, p.comprimento / 2, 0]); e.delete();
    return m;
  },
};
