// Matrizes de transformação (coluna-maior, igual three.js e Manifold).
// Ordem: M = T * R * S, com rotação Euler XYZ em graus (mesma convenção do three.js).
const D = Math.PI / 180;

export const transformacaoPadrao = () => ({ posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: [1, 1, 1] });

export function compor(t) {
  const [px, py, pz] = t.posicao;
  const [sx, sy, sz] = t.escala;
  const rx = t.rotacao[0] * D, ry = t.rotacao[1] * D, rz = t.rotacao[2] * D;
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  const m11 = c * e, m12 = -c * f, m13 = d;
  const m21 = af + be * d, m22 = ae - bf * d, m23 = -b * c;
  const m31 = bf - ae * d, m32 = be + af * d, m33 = a * c;
  return [m11 * sx, m21 * sx, m31 * sx, 0, m12 * sy, m22 * sy, m32 * sy, 0, m13 * sz, m23 * sz, m33 * sz, 0, px, py, pz, 1];
}

export function ehIdentidade(t) {
  return t.posicao.every(v => v === 0) && t.rotacao.every(v => v === 0) && t.escala.every(v => v === 1);
}
