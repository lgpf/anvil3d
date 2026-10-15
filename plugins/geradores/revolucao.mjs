// Revolução de Perfil (como o REVSURF do AutoCAD): gira um perfil 2D em torno do eixo Z do objeto.
// Cada linha do perfil é "r, z" (distância ao eixo, altura). O eixo do objeto pode
// depois ser girado/posicionado livremente, com o pivô que você escolher.
export default {
  api: 1, id: 'revolucao', nome: 'Revolução de Perfil', categoria: 'Geradores', icone: '↻', cor: '#c97b3c',
  descricao: 'Superfície de revolução a partir de um perfil r,z',
  parametros: [
    { chave: 'perfil', rotulo: 'Perfil (r, z por linha)', tipo: 'pontos', editor: 'revolucao', padrao: '0,0\n12,0\n12,2\n6,4\n5,20\n8,24\n0,24' },
    { chave: 'anguloInicial', rotulo: 'Ângulo inicial (°)', padrao: 0, passo: 0.1 },
    { chave: 'angulo', rotulo: 'Ângulo varrido (°)', padrao: 360, min: 0.1, max: 360, passo: 0.1 },
    { chave: 'segmentos', rotulo: 'Segmentos (0 = automático)', padrao: 0, min: 0, inteiro: true },
  ],
  gerar(p, { CrossSection, segmentos, pontos }) {
    const pts = pontos(p.perfil);
    if (pts.length < 3) throw new Error('o perfil precisa de pelo menos 3 pontos');
    if (pts.some(([r]) => r < 0)) throw new Error('r não pode ser negativo (o perfil fica de um lado do eixo)');
    const rmax = Math.max(...pts.map(q => q[0]));
    // 'NonZero': aceita o perfil desenhado em qualquer sentido (horário ou anti-horário) e com laços
    const cs = new CrossSection([pts], 'NonZero');
    const seg = p.segmentos >= 3 ? p.segmentos : segmentos(rmax);
    if (!(cs.area() > 1e-6)) { cs.delete(); throw new Error('o perfil não tem área (pontos alinhados ou sobre o eixo)'); }
    const s = cs.revolve(seg, Math.min(360, p.angulo)); cs.delete();
    if (!p.anguloInicial) return s;
    const r = s.rotate([0, 0, p.anguloInicial]); s.delete();
    return r;
  },
};
