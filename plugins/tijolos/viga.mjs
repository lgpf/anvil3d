import { P, paramAjuste, rotulosEn, secaoCruz, inteiro } from './comum.js';
// Viga técnica (liftarm): lisa, pontas redondas, furos redondos (Ø 4,8) ou em cruz a cada 8 mm.
export default {
  api: 1, id: 'viga-tijolo', nome: 'Viga técnica', categoria: 'Tijolos', icone: '⊶', cor: '#6c757d', versao: '1.1.0', ordem: 10,
  descricao: 'Viga técnica com furos a cada 8 mm (redondos ou em cruz nas pontas)',
  en: { nome: 'Technic beam', categoria: 'Bricks', descricao: 'Technic beam with holes every 8 mm (round, or cross at the ends)', rotulos: { ...rotulosEn, furos: 'Holes', pontasCruz: 'Cross holes at the ends', espessura: 'Thickness' },
    opcoes: { cheia: 'Full (7.2 mm)', meia: 'Thin (3.6 mm)' } },
  parametros: [
    { chave: 'furos', rotulo: 'Furos', padrao: 7, min: 2, max: 21, casas: 0 },
    { chave: 'espessura', rotulo: 'Espessura', tipo: 'opcao', opcoes: [['cheia', 'Cheia (7,2 mm)'], ['meia', 'Fina (3,6 mm)']], padrao: 'cheia' },
    { chave: 'pontasCruz', rotulo: 'Furos em cruz nas pontas', tipo: 'booleano', padrao: false },
    paramAjuste,
  ],
  gerar(p, ctx) {
    const { Manifold, CrossSection, segmentos } = ctx, n = inteiro(p.furos, 2, 21), e = p.espessura === 'meia' ? 3.6 : 7.2, R = 7.2 / 2;
    // contorno: retângulo com semicírculos nas pontas (deitado, furos ao longo de Z)
    const L = (n - 1) * P, pts = [];
    for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + Math.PI * i / 24; pts.push([L / 2 + R * Math.cos(a), R * Math.sin(a)]); }
    for (let i = 0; i <= 24; i++) { const a = Math.PI / 2 + Math.PI * i / 24; pts.push([-L / 2 + R * Math.cos(a), R * Math.sin(a)]); }
    const cs = new CrossSection([pts], 'NonZero'); let v = cs.extrude(e); cs.delete();
    const cortes = [];
    for (let k = 0; k < n; k++) {
      const x = -L / 2 + k * P, cruz = p.pontasCruz && (k === 0 || k === n - 1);
      if (cruz) { const s = secaoCruz(ctx, p.ajuste); const c = s.extrude(e + 2).translate([x, 0, -1]); s.delete(); cortes.push(c); }
      else {
        const r = 4.8 / 2 + 0.05 + p.ajuste / 2;
        cortes.push(Manifold.cylinder(e + 2, r, r, segmentos(r)).translate([x, 0, -1]));
        if (e > 5) { // rebaixo de 0,8 mm nas duas faces, como nas vigas originais
          cortes.push(Manifold.cylinder(0.8 + 1, 3.1, 3.1, segmentos(3.1)).translate([x, 0, -1]), Manifold.cylinder(0.8 + 1, 3.1, 3.1, segmentos(3.1)).translate([x, 0, e - 0.8]));
        }
      }
    }
    const tudo = Manifold.union(cortes); cortes.forEach(c => c.delete());
    const r = v.subtract(tudo); v.delete(); tudo.delete(); return r;
  },
};
