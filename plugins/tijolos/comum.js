// Peças comuns dos "Tijolos" (blocos de montar compatíveis com o padrão de 8 mm). Este arquivo não é um
// plugin (extensão .js): os plugins da pasta importam daqui.
//
// Medidas do padrão (mm): distância entre pinos 8,0 · tijolo 9,6 de altura · placa 3,2 · pino Ø 4,8 × 1,8 ·
// parede 1,2 · teto 1,0 · folga de 0,1 em cada lado (um tijolo 2×4 mede 15,8 × 31,8) · tubo de baixo
// Ø 6,51 por fora e 4,8 por dentro · pino de baixo (peças 1×N) Ø 3,0.
export const P = 8, ALT_TIJOLO = 9.6, ALT_PLACA = 3.2, PINO_D = 4.8, PINO_H = 1.8, PAREDE = 1.2, TETO = 1.0, FOLGA = 0.1;
export const TUBO_FORA = 6.51, TUBO_DENTRO = 4.8, PINO_BAIXO = 3.2;
// Como o pino de cima é preso por baixo:
// · peças 2×2 ou maiores: o tubo de Ø 6,51 encosta nos quatro pinos em volta (4√2 − 3,255 = 2,40 = raio do pino);
// · peças 1×N: o pino de baixo de Ø 3,2 encosta nos dois pinos vizinhos (4 − 1,6 = 2,4);
// · casas 1×1 sozinhas (tijolo 1×1, pilares do arco): quatro nervuras nas paredes, que encostam no pino —
//   as paredes sozinhas ficam a 2,7 mm do centro, 0,3 mm de folga, e a peça ficaria solta.

// Parâmetros que (quase) todas as peças usam
export const paramAjuste = { chave: 'ajuste', rotulo: 'Ajuste do encaixe (mm)', padrao: 0, min: -0.4, max: 0.4, casas: 2 };
export const rotulosEn = { largura: 'Width (studs)', comprimento: 'Length (studs)', altura: 'Height (plates; 3 = brick)', pinos: 'Studs on top',
  ajuste: 'Fit adjustment (mm)', diametro: 'Diameter (studs)', furos: 'Side holes', vazado: 'Hollow underside' };

// Centro (x, y) do pino (i, j) numa peça de nx × ny, com a peça centrada na origem
export const centroPino = (i, j, nx, ny) => [(i + 0.5) * P - nx * P / 2, (j + 0.5) * P - ny * P / 2];

// Os pinos de cima (cilindros) em z = h, para as posições que "usar(i, j)" aceitar
export function pinosDeCima({ Manifold }, nx, ny, h, ajuste, segmentos, usar = () => true) {
  const r = (PINO_D + ajuste) / 2, lista = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (usar(i, j)) {
    const [x, y] = centroPino(i, j, nx, ny);
    // pequeno chanfro no topo do pino: entra mais fácil e imprime melhor
    const c = 0.25, base = Manifold.cylinder(PINO_H - c, r, r, segmentos(r)), topo = Manifold.cylinder(c, r, r - c, segmentos(r)).translate([0, 0, PINO_H - c]);
    const pino = Manifold.union([base, topo]); base.delete(); topo.delete();
    lista.push(pino.translate([x, y, h])); pino.delete();
  }
  return lista;
}

// Embaixo: tubos (peças 2×2 ou maiores) ou pinos finos (peças 1×N), na altura da cavidade
export function apoiosDeBaixo({ Manifold }, nx, ny, hCav, ajuste, segmentos) {
  const lista = [];
  if (hCav <= 0.2) return lista;
  if (nx >= 2 && ny >= 2) {
    const rf = TUBO_FORA / 2 + ajuste / 2, rd = TUBO_DENTRO / 2;
    for (let i = 1; i < nx; i++) for (let j = 1; j < ny; j++) {
      const x = i * P - nx * P / 2, y = j * P - ny * P / 2;
      const fora = Manifold.cylinder(hCav, rf, rf, segmentos(rf)), dentro = Manifold.cylinder(hCav + 0.02, rd, rd, segmentos(rd)).translate([0, 0, -0.01]);
      const t = fora.subtract(dentro); fora.delete(); dentro.delete();
      lista.push(t.translate([x, y, 0])); t.delete();
    }
  } else if (nx * ny > 1) {
    const r = PINO_BAIXO / 2 + ajuste / 2, longoX = nx > ny, n = Math.max(nx, ny);
    for (let k = 1; k < n; k++) {
      const c = k * P - n * P / 2, pino = Manifold.cylinder(hCav, r, r, segmentos(r));
      lista.push(pino.translate(longoX ? [c, 0, 0] : [0, c, 0])); pino.delete();
    }
  }
  return lista;
}

// Nervuras de uma casa 1×1 (centro cx, cy): uma no meio de cada parede, encostando no pino de cima
export function nervuras({ Manifold }, cx, cy, hCav, ajuste = 0) {
  const ate = PINO_D / 2 - ajuste / 2;                       // até onde a nervura vem (do centro)
  const parede = P / 2 - FOLGA - PAREDE, prof = parede - ate; // quanto ela sai da parede
  if (prof <= 0.02 || hCav <= 0.2) return [];
  const larg = 1.0, lista = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = ate + prof / 2 + 0.05;
    const n = Manifold.cube(dx ? [prof + 0.1, larg, hCav] : [larg, prof + 0.1, hCav], true).translate([cx + dx * c, cy + dy * c, hCav / 2]);
    lista.push(n);
  }
  return lista;
}

// Corpo retangular de nx × ny com altura h: casca (paredes + teto), aberta embaixo se "vazado"
export function corpo({ Manifold }, nx, ny, h, vazado = true) {
  const W = nx * P - 2 * FOLGA, D = ny * P - 2 * FOLGA;
  const fora = Manifold.cube([W, D, h], true).translate([0, 0, h / 2]);
  const hCav = h - TETO;
  if (!vazado || hCav <= 0.4) return { solido: fora, hCav: 0 };
  const cav = Manifold.cube([W - 2 * PAREDE, D - 2 * PAREDE, hCav + 0.02], true).translate([0, 0, hCav / 2 - 0.01]);
  const s = fora.subtract(cav); fora.delete(); cav.delete();
  return { solido: s, hCav };
}

// Tijolo / placa / liso completo
export function tijolo(ctx, { nx, ny, h, pinos = true, ajuste = 0, vazado = true }) {
  const { Manifold, segmentos } = ctx;
  const { solido, hCav } = corpo(ctx, nx, ny, h, vazado);
  const partes = [solido, ...(vazado ? apoiosDeBaixo(ctx, nx, ny, hCav, ajuste, segmentos) : []), ...(vazado && nx === 1 && ny === 1 ? nervuras(ctx, 0, 0, hCav, ajuste) : []), ...(pinos ? pinosDeCima(ctx, nx, ny, h, ajuste, segmentos) : [])];
  const u = Manifold.union(partes); partes.forEach(x => x.delete());
  return u;
}

export const inteiro = (v, min = 1, max = 32) => Math.max(min, Math.min(max, Math.round(Number(v) || min)));

// ---- sistema de barras e bolas (conectores): barra Ø 3,18 · bola Ø 5,9 ----
export const BARRA_D = 3.18, BOLA_D = 5.9;
// Barra deitada ao longo de X, centrada na origem, com pontas arredondadas de leve
export function barra({ Manifold }, L, segmentos, d = BARRA_D) {
  const r = d / 2, c = Math.min(0.3, L / 4);
  const meio = Manifold.cylinder(L - 2 * c, r, r, segmentos(r)).translate([0, 0, c]);
  const p1 = Manifold.cylinder(c, r - c, r, segmentos(r)), p2 = Manifold.cylinder(c, r, r - c, segmentos(r)).translate([0, 0, L - c]);
  const u = Manifold.union([meio, p1, p2]); meio.delete(); p1.delete(); p2.delete();
  const m = u.rotate([0, 90, 0]).translate([-L / 2, 0, 0]); u.delete(); return m;
}
// Furo sextavado em cruz (eixo técnico): seção em "+" de 4,8 × 1,8 mm, ao longo de Z
export function secaoCruz({ CrossSection }, ajuste = 0) {
  const a = 4.8 / 2 + ajuste / 2, b = 1.8 / 2 + ajuste / 2;
  return new CrossSection([[[-a, -b], [-b, -b], [-b, -a], [b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b]]], 'NonZero');
}
