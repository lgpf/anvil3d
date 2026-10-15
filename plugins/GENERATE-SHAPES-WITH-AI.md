# How to ask an AI for a new Anvil3D shape

Copy everything from the "START OF REQUEST" line and paste it into any AI (Claude, ChatGPT, Gemini…).
At the end, replace the text in brackets with a description of the shape you want. Save the answer
as a `.mjs` file in `Documents\Anvil3D\plugins` and click **Reload** in Anvil3D.

---------------------------------------------------------------------- START OF REQUEST

You will write a parametric shape plugin for Anvil3D, a local CAD that uses the Manifold geometry
library (manifold-3d, in JavaScript). Follow ALL the rules below.

## Answer format
- Reply with ONE single JavaScript code block (ES module), with no explanation before or after.
- On the first line, a comment with the suggested file name, e.g. `// l-bracket.mjs`.
- The plugin object MUST be exported exactly like this: `export default { ... };` (do not use `export const`, `module.exports` or `exports.`).
- Do not use `import`, `require`, `fetch`, the DOM, files or external libraries: only what comes in `ctx`.

## Plugin contract (field names are in Portuguese and required)
```js
export default {
  api: 1,                         // always 1
  id: 'my.shape-name',            // unique, lowercase, no spaces; use a "my." prefix
  nome: 'Nome em português',      // Portuguese name (the default language)
  categoria: 'Meus plugins',
  icone: '◆',                     // one character
  cor: '#3a86c8',                 // thumbnail color and color of new parts
  versao: '1.0.0',
  descricao: 'Uma frase em português',
  en: {                           // English texts
    nome: 'Name in English', categoria: 'My plugins', descricao: '...',
    rotulos: { /* key: 'Label' for each parameter */ },
    opcoes: { /* value: 'Label' for each option of choice parameters */ },
  },
  parametros: [ /* see below */ ],
  gerar(p, ctx) { /* returns ONE Manifold */ },
};
```
(nome = name, categoria = category, parametros = parameters, gerar = generate.)

## Parameters
Each item of `parametros` is an object with `chave` (key), `rotulo` (label, in Portuguese) and `padrao`
(default value that already builds a nice, valid part). Types:
- number (default): `{ chave: 'largura', rotulo: 'Largura (mm)', padrao: 30, min: 1, max: 500 }`;
  use `inteiro: true` for counts and `casas: 1` to show a single decimal place.
- `{ tipo: 'booleano', ... padrao: false }` — checkbox.
- `{ tipo: 'opcao', opcoes: [['a', 'Leve'], ['b', 'Reforçado']], padrao: 'a' }` — choice.
- `{ tipo: 'texto', ... padrao: '' }` — text.
- `{ tipo: 'pontos', ... padrao: '0,0\n10,0\n0,10' }` — "x, y" list, one per line; convert with `ctx.pontos(p.key)`.
  Add `editor: 'plano'` (free polygon) or `editor: 'revolucao'` (r, z profile beside an axis) so the user
  can draw the list in a 2D editor.
Prefer parameters with physical meaning (sizes in mm, angles in degrees, counts) over generic scales.

## gerar(p, ctx)
- `p` holds the parameter values. `ctx` provides `Manifold`, `CrossSection`, `segmentos(radius)` (a good
  number of sides for a circle of that radius) and `pontos(text)` (turns a 'pontos' value into [[x, y], ...]).
- Units are millimeters. The part must be CENTERED in X and Y and RESTING on Z = 0 (nothing below zero).
- Return a single closed solid (Manifold). Never return an empty one: if the values are impossible,
  throw a short error explaining it, e.g. `throw new Error('o furo é maior que a peça')`.
- Validate parameter combinations (hole larger than the diameter, thickness larger than the part, etc.).
- Call `.delete()` on intermediate solids and sections that are not returned (frees memory).
- Use `ctx.segmentos(r)` for cylinders, spheres and circles instead of fixed numbers.

## Manifold API (use only these)
Solids (`Manifold`):
- `Manifold.cube([x, y, z], centered)`; `Manifold.cylinder(height, radiusLow, radiusHigh, sides)` (base at z=0);
  `Manifold.sphere(radius, sides)` (centered at the origin); `Manifold.hull([solids or [x,y,z] points])`.
- `Manifold.union([...])`, `Manifold.difference([a, b, ...])`, `Manifold.intersection([...])`.
- `Manifold.extrude(section, height, divisions, twistDegrees, [scaleX, scaleY])` (always pass the top scale as an [x, y] pair), `Manifold.revolve(section, sides, degrees)`.
- Methods: `.translate([x, y, z])`, `.rotate([dx, dy, dz])` (degrees), `.scale([x, y, z])`, `.mirror([nx, ny, nz])`,
  `.add(b)`, `.subtract(b)`, `.intersect(b)`, `.hull()`, `.boundingBox()` (→ {min, max}), `.trimByPlane([nx,ny,nz], d)`.
2D sections (`CrossSection`):
- `new CrossSection([[ [x,y], [x,y], ... ]], 'NonZero')` (polygons; the second argument accepts any winding),
  `CrossSection.square([x, y], centered)`, `CrossSection.circle(radius, sides)`.
- Methods: `.translate([x, y])`, `.rotate(degrees)`, `.scale([x, y])`, `.mirror([nx, ny])`,
  `.offset(distance, 'Round' | 'Square' | 'Miter', 2, sides)`, `.add(b)`, `.subtract(b)`, `.intersect(b)`, `.hull()`,
  `.extrude(height, divisions, twist, [scaleX, scaleY])`, `.revolve(sides, degrees)`.
- `revolve` spins the section around its own Y axis, which becomes the solid's Z (x = radius, y = height).

## Full example (washer with optional chamfer)
```js
// washer.mjs
export default {
  api: 1, id: 'my.washer', nome: 'Arruela', categoria: 'Meus plugins', icone: '◌', cor: '#b8a03a', versao: '1.0.0',
  descricao: 'Arruela lisa com chanfro opcional na borda',
  en: { nome: 'Washer', categoria: 'My plugins', descricao: 'Flat washer with optional edge chamfer',
        rotulos: { externo: 'Outer diameter', interno: 'Inner diameter', espessura: 'Thickness', chanfro: 'Edge chamfer' } },
  parametros: [
    { chave: 'externo', rotulo: 'Diâmetro externo', padrao: 16, min: 0.1 },
    { chave: 'interno', rotulo: 'Diâmetro interno', padrao: 8.4, min: 0 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 1.6, min: 0.1 },
    { chave: 'chanfro', rotulo: 'Chanfro na borda', tipo: 'booleano', padrao: false },
  ],
  gerar(p, { Manifold, segmentos }) {
    const re = p.externo / 2, ri = p.interno / 2, h = p.espessura;
    if (ri >= re) throw new Error('o furo é maior que a arruela');
    const c = p.chanfro ? Math.min(h / 3, (re - ri) / 3) : 0;
    const corpo = c > 0
      ? Manifold.union([Manifold.cylinder(h - c, re, re, segmentos(re)), Manifold.cylinder(c, re, re - c, segmentos(re)).translate([0, 0, h - c])])
      : Manifold.cylinder(h, re, re, segmentos(re));
    const furo = Manifold.cylinder(h + 2, ri, ri, segmentos(re)).translate([0, 0, -1]);
    const r = corpo.subtract(furo);
    corpo.delete(); furo.delete();
    return r;
  },
};
```

## Before answering, check
1. With the `padrao` values, the part is valid, closed, centered in X/Y and resting on Z = 0.
2. Every parameter has a Portuguese `rotulo` and a label in `en.rotulos`.
3. Nothing besides `ctx` is used; there is no `import`.
4. Intermediates get `.delete()`.

## The shape I want
[DESCRIBE THE SHAPE HERE: what it is for, main sizes, what should be adjustable, details such as holes,
fittings, chamfers, example uses. The more concrete, the better.]
