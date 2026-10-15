// Desenho SVG extrudado: os contornos vêm de Arquivo › Importar SVG… (ficam guardados no objeto,
// então a peça continua editável: altura, largura, espelhar, furos preenchidos ou não).
const PADRAO = JSON.stringify([[[0, 0.3], [0.25, 0], [0.5, 0.3], [0.5, 0.6], [0.25, 0.9], [0, 0.6]]]);
export default {
  api: 1, id: 'svg', nome: 'Desenho SVG', categoria: 'Geradores', icone: '✎', cor: '#457b9d', versao: '1.0.0', ordem: 4,
  descricao: 'Desenho vetorial (SVG) extrudado — use Arquivo › Importar SVG…',
  en: { nome: 'SVG drawing', categoria: 'Generators', descricao: 'Extruded vector drawing (SVG) — use File › Import SVG…',
    rotulos: { largura: 'Width (mm)', altura: 'Height (mm)', preencher: 'Fill the holes', espelhar: 'Mirror (flip horizontally)' } },
  parametros: [
    { chave: 'contornos', rotulo: 'Contornos', tipo: 'oculto', padrao: PADRAO },
    { chave: 'largura', rotulo: 'Largura (mm)', padrao: 40, min: 0.1 },
    { chave: 'altura', rotulo: 'Altura (mm)', padrao: 3, min: 0.01 },
    { chave: 'preencher', rotulo: 'Preencher os furos', tipo: 'booleano', padrao: false },
    { chave: 'espelhar', rotulo: 'Espelhar (inverter na horizontal)', tipo: 'booleano', padrao: false },
  ],
  gerar(p, { CrossSection }) {
    let cont;
    try { cont = JSON.parse(p.contornos || '[]'); } catch { throw new Error('dados do desenho inválidos'); }
    cont = cont.filter(c => Array.isArray(c) && c.length >= 3);
    if (!cont.length) throw new Error('o desenho não tem contornos fechados');
    // EvenOdd: as letras e formas com miolo (O, A, anéis) ficam vazadas como no desenho
    const s0 = new CrossSection(cont, p.preencher ? 'NonZero' : 'EvenOdd');
    const b = s0.bounds(), w = b.max[0] - b.min[0], h = b.max[1] - b.min[1];
    if (!(w > 0 && h > 0) || s0.isEmpty()) { s0.delete(); throw new Error('o desenho ficou vazio'); }
    const e = p.largura / w;
    const s1 = s0.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]); s0.delete();
    const s2 = s1.scale([p.espelhar ? -e : e, e]); s1.delete();
    const m = s2.extrude(p.altura); s2.delete();
    return m;
  },
};
