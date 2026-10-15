// Cremalheira: barra dentada reta que engrena com a Engrenagem simples de mesmo módulo.
export default {
  api: 1, id: 'cremalheira', nome: 'Cremalheira', categoria: 'Mecânica', icone: '⩩', cor: '#6c757d', versao: '1.0.0',
  descricao: 'Barra dentada que engrena com a engrenagem de mesmo módulo',
  en: { nome: 'Rack', categoria: 'Mechanics', descricao: 'Toothed bar that meshes with a gear of the same module',
    rotulos: { modulo: 'Module', dentes: 'Teeth', espessura: 'Thickness', base: 'Base height (under the teeth)' } },
  parametros: [
    { chave: 'modulo', rotulo: 'Módulo', padrao: 1.5, min: 0.2, casas: 2 },
    { chave: 'dentes', rotulo: 'Dentes', padrao: 12, min: 1, inteiro: true },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 6, min: 0.1 },
    { chave: 'base', rotulo: 'Altura da base (abaixo dos dentes)', padrao: 4, min: 0.5 },
  ],
  gerar(p, { CrossSection }) {
    const m = p.modulo, P = Math.PI * m, n = Math.round(p.dentes), ha = m, hf = 1.25 * m, tg = Math.tan(20 * Math.PI / 180);
    const yb = p.base, yp = yb + hf;
    const pts = [[0, 0], [n * P, 0]];
    for (let i = n - 1; i >= 0; i--) {
      const x0 = i * P; // dente trapezoidal com flancos de 20°, meio passo de largura na linha primitiva
      pts.push([x0 + P, yb], [x0 + P * 0.75 + hf * tg, yb], [x0 + P * 0.75 - ha * tg, yp + ha], [x0 + P * 0.25 + ha * tg, yp + ha], [x0 + P * 0.25 - hf * tg, yb], [x0, yb]);
    }
    const s0 = new CrossSection([pts], 'NonZero'), s = s0.translate([-n * P / 2, 0]); s0.delete();
    const e = s.extrude(p.espessura); s.delete();
    const r = e.rotate([90, 0, 0]).translate([0, p.espessura / 2, 0]); e.delete(); return r;
  },
};
