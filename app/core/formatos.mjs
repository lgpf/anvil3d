// Formatos de malha além do STL: OBJ (texto) e 3MF (zip com XML).
// Leitura devolve malhas { v: Float32Array, t: Uint32Array } (soldadas); escrita recebe
// { posicoes, indices } (o mesmo formato que dadosMalha/stlBinario usam).
import { tr } from './i18n.mjs';
import { soldar } from './malha.mjs';

// ---------- OBJ ----------
export function lerObj(bytes) {
  const txt = new TextDecoder().decode(bytes);
  const v = [], t = [];
  let nv = 0;
  for (const linha of txt.split(/\r?\n/)) {
    if (linha.startsWith('v ')) {
      const p = linha.trim().split(/\s+/);
      v.push(+p[1], +p[2], +p[3]); nv++;
    } else if (linha.startsWith('f ')) {
      const ids = linha.trim().split(/\s+/).slice(1).map(s => { const i = parseInt(s, 10); return i < 0 ? nv + i : i - 1; });
      for (let k = 1; k + 1 < ids.length; k++) t.push(ids[0], ids[k], ids[k + 1]); // polígonos viram leque de triângulos
    }
  }
  if (!t.length) throw new Error(tr('arquivo OBJ vazio ou inválido'));
  // OBJ é indexado: desfaz os índices para soldar com a mesma tolerância do STL
  const solto = new Float32Array(t.length * 3);
  for (let i = 0; i < t.length; i++) { const o = t[i] * 3; solto[i * 3] = v[o]; solto[i * 3 + 1] = v[o + 1]; solto[i * 3 + 2] = v[o + 2]; }
  return soldar({ v: solto, t: Uint32Array.from({ length: t.length }, (_, i) => i) });
}

export function escreverObj({ posicoes: p, indices: ix }, nome = 'Anvil3D') {
  const partes = [`# Anvil3D\no ${nome.replace(/\s+/g, '_')}\n`];
  const fmt = n => (Math.round(n * 1e5) / 1e5).toString();
  let bloco = '';
  for (let i = 0; i < p.length; i += 3) {
    bloco += `v ${fmt(p[i])} ${fmt(p[i + 1])} ${fmt(p[i + 2])}\n`;
    if (bloco.length > 1 << 20) { partes.push(bloco); bloco = ''; }
  }
  for (let i = 0; i < ix.length; i += 3) {
    bloco += `f ${ix[i] + 1} ${ix[i + 1] + 1} ${ix[i + 2] + 1}\n`;
    if (bloco.length > 1 << 20) { partes.push(bloco); bloco = ''; }
  }
  partes.push(bloco);
  return new TextEncoder().encode(partes.join(''));
}

// ---------- zip mínimo (o 3MF é um zip) ----------
const TAB_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TAB_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

async function fluxo(bytes, transformador) {
  const s = new Blob([bytes]).stream().pipeThrough(transformador);
  return new Uint8Array(await new Response(s).arrayBuffer());
}

async function lerZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error(tr('arquivo 3MF inválido (não é um zip)'));
  let n = dv.getUint16(fim + 10, true), o = dv.getUint32(fim + 16, true);
  const arquivos = new Map(), dec = new TextDecoder();
  for (; n > 0; n--) {
    if (dv.getUint32(o, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(o + 10, true), tam = dv.getUint32(o + 20, true);
    const ln = dv.getUint16(o + 28, true), le = dv.getUint16(o + 30, true), lc = dv.getUint16(o + 32, true);
    const local = dv.getUint32(o + 42, true), nome = dec.decode(bytes.subarray(o + 46, o + 46 + ln));
    arquivos.set(nome.replace(/^\/+/, '').toLowerCase(), { metodo, tam, local });
    o += 46 + ln + le + lc;
  }
  const abrir = async nome => {
    const a = arquivos.get(nome.replace(/^\/+/, '').toLowerCase());
    if (!a) return null;
    const ini = a.local + 30 + dv.getUint16(a.local + 26, true) + dv.getUint16(a.local + 28, true);
    const dados = bytes.subarray(ini, ini + a.tam);
    if (a.metodo === 0) return dados;
    if (a.metodo === 8) return fluxo(dados, new DecompressionStream('deflate-raw'));
    throw new Error(tr('arquivo 3MF com compressão não suportada'));
  };
  return [abrir, { nomes: () => [...arquivos.keys()] }];
}

async function escreverZip(entradas) {
  const enc = new TextEncoder(), partes = [], central = [];
  let pos = 0;
  for (const { nome, dados } of entradas) {
    const n = enc.encode(nome), crc = crc32(dados), comp = await fluxo(dados, new CompressionStream('deflate-raw'));
    const cab = new DataView(new ArrayBuffer(30));
    cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(8, 8, true);
    cab.setUint32(14, crc, true); cab.setUint32(18, comp.length, true); cab.setUint32(22, dados.length, true); cab.setUint16(26, n.length, true);
    partes.push(new Uint8Array(cab.buffer), n, comp);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(10, 8, true);
    c.setUint32(16, crc, true); c.setUint32(20, comp.length, true); c.setUint32(24, dados.length, true); c.setUint16(28, n.length, true); c.setUint32(42, pos, true);
    central.push(new Uint8Array(c.buffer), n);
    pos += 30 + n.length + comp.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const f = new DataView(new ArrayBuffer(22));
  f.setUint32(0, 0x06054b50, true); f.setUint16(8, entradas.length, true); f.setUint16(10, entradas.length, true);
  f.setUint32(12, tamCentral, true); f.setUint32(16, pos, true);
  const todas = [...partes, ...central, new Uint8Array(f.buffer)], saida = new Uint8Array(todas.reduce((s, b) => s + b.length, 0));
  let o = 0; for (const b of todas) { saida.set(b, o); o += b.length; }
  return saida;
}

// ---------- 3MF ----------
const atributos = s => { const r = {}; for (const m of s.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) r[m[1]] = m[2]; return r; };
const ESCALA = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };
// matriz 3MF: 12 números "m00 m01 m02 m10 … m32", vetor linha: p' = p·M
const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const lerMatriz = s => { const m = (s ?? '').trim().split(/\s+/).map(Number); return m.length === 12 && m.every(Number.isFinite) ? m : IDENT; };
const comporM = (a, b) => { // aplica a, depois b
  const r = new Array(12);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j] + (i === 3 ? b[9 + j] : 0);
  return r;
};

// Lê um 3MF: cada item da montagem (build) vira uma malha, já com a posição dele.
export async function ler3mf(bytes) {
  const [abrir, info] = await lerZip(bytes);
  const dec = new TextDecoder();
  const texto = async n => { const b = await abrir(n); return b ? dec.decode(b) : null; };
  const rels = await texto('_rels/.rels');
  const raiz = (rels && /Target="([^"]+)"[^>]*Type="[^"]*3dmodel"/.exec(rels)?.[1]) ||
    (rels && /Type="[^"]*3dmodel"[^>]*Target="([^"]+)"/.exec(rels)?.[1]) || '3D/3dmodel.model';
  const modelos = new Map();
  async function modelo(caminho) {
    const k = caminho.replace(/^\/+/, '').toLowerCase();
    if (modelos.has(k)) return modelos.get(k);
    const xml = await texto(k);
    if (xml == null) { modelos.set(k, null); return null; }
    const esc = ESCALA[atributos(/<model\b([^>]*)>/.exec(xml)?.[1] ?? '').unit ?? 'millimeter'] ?? 1;
    const objetos = new Map();
    for (const m of xml.matchAll(/<object\b([^>]*?)(?:\/>|>([\s\S]*?)<\/object>)/g)) {
      const a = atributos(m[1]), corpo = m[2] ?? '';
      const ob = { nome: a.name, malha: null, componentes: [] };
      const vMatch = /<vertices>([\s\S]*?)<\/vertices>/.exec(corpo), tMatch = /<triangles>([\s\S]*?)<\/triangles>/.exec(corpo);
      if (vMatch && tMatch) {
        const v = [];
        for (const x of vMatch[1].matchAll(/<vertex\b([^>]*)\/?>/g)) { const p = atributos(x[1]); v.push(+p.x * esc, +p.y * esc, +p.z * esc); }
        const t = [];
        for (const x of tMatch[1].matchAll(/<triangle\b([^>]*)\/?>/g)) { const p = atributos(x[1]); t.push(+p.v1, +p.v2, +p.v3); }
        ob.malha = { v, t };
      }
      for (const c of corpo.matchAll(/<component\b([^>]*)\/?>/g)) {
        const p = atributos(c[1]);
        ob.componentes.push({ id: p.objectid, caminho: p['p:path'] ?? caminho, m: lerMatriz(p.transform) });
      }
      objetos.set(a.id, ob);
    }
    const itens = [];
    const build = /<build\b[^>]*>([\s\S]*?)<\/build>/.exec(xml)?.[1] ?? '';
    for (const it of build.matchAll(/<item\b([^>]*)\/?>/g)) { const p = atributos(it[1]); itens.push({ id: p.objectid, caminho: p['p:path'] ?? caminho, m: lerMatriz(p.transform) }); }
    const r = { objetos, itens, esc };
    modelos.set(k, r);
    return r;
  }
  const principal = await modelo(raiz) ?? await modelo(info.nomes().find(n => n.endsWith('.model')) ?? '');
  if (!principal) throw new Error(tr('arquivo 3MF sem modelo 3D'));
  const resultado = [];
  for (const item of principal.itens) {
    const v = [], t = [];
    let nome = null;
    const juntar = async (ref, m, prof) => {
      if (prof > 16) return;
      const md = await modelo(ref.caminho);
      const ob = md?.objetos.get(ref.id);
      if (!ob) return;
      nome ??= ob.nome;
      if (ob.malha) {
        const base = v.length / 3, mv = ob.malha.v;
        for (let i = 0; i < mv.length; i += 3) {
          const x = mv[i], y = mv[i + 1], z = mv[i + 2];
          // a translação também está na unidade do modelo
          v.push(x * m[0] + y * m[3] + z * m[6] + m[9] * md.esc, x * m[1] + y * m[4] + z * m[7] + m[10] * md.esc, x * m[2] + y * m[5] + z * m[8] + m[11] * md.esc);
        }
        for (const i of ob.malha.t) t.push(base + i);
      }
      for (const c of ob.componentes) await juntar(c, comporM(c.m, m), prof + 1);
    };
    await juntar(item, item.m, 0);
    if (!t.length) continue;
    const solto = new Float32Array(t.length * 3);
    for (let i = 0; i < t.length; i++) { const o = t[i] * 3; solto[i * 3] = v[o]; solto[i * 3 + 1] = v[o + 1]; solto[i * 3 + 2] = v[o + 2]; }
    resultado.push({ nome, d: soldar({ v: solto, t: Uint32Array.from({ length: t.length }, (_, i) => i) }) });
  }
  if (!resultado.length) throw new Error(tr('arquivo 3MF sem malhas'));
  return resultado;
}

// Escreve um 3MF com um objeto por peça, cada um com a sua cor (os fatiadores mostram as peças separadas).
export async function escrever3mf(pecas) {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const cores = [...new Set(pecas.map(p => (p.cor ?? '#9aa3a8').toUpperCase()))];
  const fmt = n => (Math.round(n * 1e5) / 1e5).toString();
  const partes = ['<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n',
    ' <metadata name="Application">Anvil3D</metadata>\n <resources>\n  <basematerials id="1">\n',
    ...cores.map(c => `   <base name="${c}" displaycolor="${c}FF"/>\n`), '  </basematerials>\n'];
  pecas.forEach((p, i) => {
    const { posicoes: v, indices: ix } = p.dados;
    let b = `  <object id="${i + 2}" type="model" name="${esc(p.nome)}" pid="1" pindex="${cores.indexOf((p.cor ?? '#9aa3a8').toUpperCase())}">\n   <mesh>\n    <vertices>\n`;
    for (let k = 0; k < v.length; k += 3) {
      b += `     <vertex x="${fmt(v[k])}" y="${fmt(v[k + 1])}" z="${fmt(v[k + 2])}"/>\n`;
      if (b.length > 1 << 20) { partes.push(b); b = ''; }
    }
    b += '    </vertices>\n    <triangles>\n';
    for (let k = 0; k < ix.length; k += 3) {
      b += `     <triangle v1="${ix[k]}" v2="${ix[k + 1]}" v3="${ix[k + 2]}"/>\n`;
      if (b.length > 1 << 20) { partes.push(b); b = ''; }
    }
    partes.push(b + '    </triangles>\n   </mesh>\n  </object>\n');
  });
  partes.push(' </resources>\n <build>\n', ...pecas.map((_, i) => `  <item objectid="${i + 2}"/>\n`), ' </build>\n</model>\n');
  const enc = new TextEncoder();
  return escreverZip([
    { nome: '[Content_Types].xml', dados: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>') },
    { nome: '_rels/.rels', dados: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>') },
    { nome: '3D/3dmodel.model', dados: enc.encode(partes.join('')) },
  ]);
}
