// Modela a bigorna do ícone com o próprio núcleo do Anvil3D (Manifold + chanfro de arestas).
import Module from 'manifold-3d';
import { writeFileSync } from 'node:fs';
import { extrairArestas, aplicarAcabamento } from '../../app/core/arestas.mjs';
const w = await Module(); w.setup();
const { Manifold, CrossSection } = w;
const caixa = (sx, sy, sz, x, y, z) => Manifold.cube([sx, sy, sz], true).translate([x, y, z + sz / 2]);
const chanfrar = (m, d) => {
  const f = extrairArestas(m).filter(e => e.tipo === 'reta' && e.convexa);
  return aplicarAcabamento(w, m, f, 'chanfro', d, () => 8).solido;
};
// base: placa chanfrada com arco nas pontas, formando os pés
let base = chanfrar(caixa(50, 40, 6, 8, 0, 0), 1.2);
const arco = Manifold.cylinder(90, 10, 10, 64, true).rotate([90, 0, 0]).scale([1.25, 1, 1]).translate([8, 0, -3]);
// cintura: alarga para os pés nos lados (Y) e afina sob a mesa
let cintura = Manifold.hull([caixa(40, 30, 1, 8, 0, 5), caixa(30, 18, 1, 8, 0, 22)]);
base = Manifold.union([base, cintura]).subtract(arco);
// mesa
let corpo = Manifold.hull([caixa(52, 22, 1, 12, 0, 22), caixa(58, 27, 17, 12, 0, 25)]);
corpo = chanfrar(corpo, 1.8);
// degrau entre a mesa e o chifre
let degrau = chanfrar(caixa(8, 22, 13, -21, 0, 26), 1.2);
// chifre: grosso junto ao degrau, ponta curva subindo, topo plano
let chifre = Manifold.hull([
  Manifold.cylinder(1, 10.5, 10.5, 48).rotate([0, -90, 0]).scale([1, 1, 0.75]).translate([-24, 0, 32]),
  Manifold.cylinder(1, 6.5, 6.5, 48).rotate([0, -90, 0]).scale([1, 1, 0.7]).translate([-44, 0, 35]),
  Manifold.sphere(2.6, 32).scale([1.1, 1, 0.75]).translate([-62, 0, 37]),
]).intersect(Manifold.cube([300, 300, 200], true).translate([0, 0, 38.5 - 100]));
const tudo = Manifold.union([base, corpo, degrau, chifre]);
const g = tudo.getMesh();
const pos = [], np = g.numProp;
for (let i = 0; i < g.vertProperties.length / np; i++) pos.push(g.vertProperties[i * np], g.vertProperties[i * np + 1], g.vertProperties[i * np + 2]);
writeFileSync(new URL('./bigorna.json', import.meta.url), JSON.stringify({ pos, idx: [...g.triVerts] }));
console.log('bigorna:', g.triVerts.length / 3, 'triângulos, caixa', JSON.stringify(tudo.boundingBox()));
