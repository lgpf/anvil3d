// Junta esférica — parte fêmea: copo com cavidade esférica, boca mais estreita que a bola (trava) e
// cortes que deixam as paredes flexionar para a bola entrar com pressão.
export default {
  api: 1, id: 'junta-soquete', nome: 'Junta: soquete', categoria: 'Encaixes', icone: '◒', cor: '#7b2cbf', versao: '1.0.0',
  descricao: 'Soquete de pressão para a bola de junta esférica',
  en: { nome: 'Joint: socket', categoria: 'Joints', descricao: 'Snap-fit socket for the ball joint',
    rotulos: { bola: 'Ball diameter', folga: 'Clearance', parede: 'Wall', trava: 'Grip (how much the mouth closes, %)', cortes: 'Flex slots', base: 'Base height' } },
  parametros: [
    { chave: 'bola', rotulo: 'Diâmetro da bola', padrao: 10, min: 1 },
    { chave: 'folga', rotulo: 'Folga', padrao: 0.2, min: 0, casas: 2 },
    { chave: 'parede', rotulo: 'Parede', padrao: 2, min: 0.4 },
    { chave: 'trava', rotulo: 'Trava (quanto a boca fecha, %)', padrao: 12, min: 0, max: 40 },
    { chave: 'cortes', rotulo: 'Cortes para flexionar', padrao: 4, min: 0, max: 12, inteiro: true },
    { chave: 'base', rotulo: 'Altura da base', padrao: 3, min: 0 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const Rc = p.bola / 2 + p.folga, Re = Rc + p.parede, b = p.base;
    // a boca fica acima do equador: altura em que o raio da cavidade cai para (1 − trava)·Rc
    const rBoca = Rc * (1 - p.trava / 100), hBoca = Math.sqrt(Math.max(0, Rc * Rc - rBoca * rBoca));
    const centro = b + Rc, topo = centro + hBoca;
    const corpo = Manifold.cylinder(topo, Re, Re, segmentos(Re));
    const cav = Manifold.sphere(Rc, segmentos(Rc)).translate([0, 0, centro]);
    let m = corpo.subtract(cav); corpo.delete(); cav.delete();
    if (p.cortes > 0) {
      const larg = Math.max(0.6, Rc * 0.18), alt = topo - centro + Rc * 0.45, cs = [];
      for (let i = 0; i < p.cortes; i++) { const c = Manifold.cube([Re * 2 + 2, larg, alt], false).translate([0, -larg / 2, topo - alt + 0.01]).rotate([0, 0, 180 * i / p.cortes]); cs.push(c); }
      const u = Manifold.union(cs); cs.forEach(x => x.delete());
      const n = m.subtract(u); m.delete(); u.delete(); m = n;
    }
    return m;
  },
};
