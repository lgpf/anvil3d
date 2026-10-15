# Anvil3D

**English** · [Português](README.pt-BR.md)

**Anvil3D** is a free, local 3D CAD for Windows, made for 3D printing — in the spirit of Tinkercad,
but running on your own computer, without an account or internet connection.

You build parts by combining **solids and holes**, with an **editable history**: every shape keeps its
parameters, so you can go back and change any measurement at any time. The `.nvl3d` project stores the
whole construction tree; STL is only the export.

[⬇ Download the latest version](https://github.com/lgpf/anvil3d/releases) · [♥ Support on Ko-fi](https://ko-fi.com/anvil3d)

## Features

- **Shape library in categories**: basic shapes, polyhedra (including the soccer ball), symbols,
  fasteners (screws with real threads, nuts, washers), mechanics (gears, racks, pulleys, springs),
  joints (pins, dovetails, ball joints), containers and generators (extrusion, profile revolve,
  bent pipe, SVG).
- **Solids and holes**, groups, multicolor groups and real-time preview of what a hole will cut.
- **Fillet and chamfer** on straight and curved edges, with continuous lines and tangent chains.
- **3D text** with built-in and Windows fonts, wrapped around a cylinder or **applied to any face**
  (ramps, domes, curved parts), following the surface.
- **Import SVG** as an extruded, editable part; **import and export STL** (also one file per object).
- **Join faces**, align, mirror, resize several parts at once, move by dragging (like Tinkercad).
- **Mesh editing**, simplification and **repair for printing**.
- **Plugins**: create new shapes in JavaScript — or ask an AI to write them using the included guide.
- Interface and manual in **English and Portuguese**.

## Getting started

1. Download `Anvil3D-<version>-windows-x64.zip` from [Releases](https://github.com/lgpf/anvil3d/releases).
2. Unzip it anywhere and run `Anvil3D.exe` (no installation needed).
3. Projects, plugins and saved parts live in `Documents\Anvil3D`.

**Mouse:** right button rotates the view, middle button pans, wheel zooms. Click selects,
Shift+click adds to the selection. **F1** opens the full manual; the **?** buttons in the panel show
quick tips.

**Preferences** menu: move by dragging, side handles, bed size (200–300 mm) and language.

## Development

    npm install
    npm start            # run the app
    npm test             # core tests (geometry, file format, STL)
    npm run dist         # build the Windows package

Structure:
- `main.js`, `preload.js` — window, files, `app://` protocol and plugins folder.
- `app/core/` — UI-free core (file format with migrations, Manifold geometry engine, history, STL).
- `app/principal.mjs` — 3D interface.
- `plugins/` — built-in shapes, using the same API as user plugins (see `plugins/LEIA-ME.md` and
  `plugins/GENERATE-SHAPES-WITH-AI.md`).

Built with Electron, three.js, Manifold, meshoptimizer and opentype.js; DejaVu fonts.

## Support the project

Anvil3D is free. If it helped you, please consider supporting its development:
**[ko-fi.com/anvil3d](https://ko-fi.com/anvil3d)**

## License

Anvil3D is free software under the **GNU General Public License v3.0 or later** (see `LICENSE`).
Plugins that use only the public plugin API may use **any license** — see `EXCECAO-PLUGINS.md`.

Created by **Luiz Pacheco** · luizgpf@gmail.com · [nobetteridea.com](https://nobetteridea.com) · © 2026
