# Anvil3D

**English** · [Português](README.pt-BR.md)

**Anvil3D** is a free, local 3D CAD for **Windows and macOS**, made for 3D printing — in the spirit of
Tinkercad, but running on your own computer, without an account or internet connection.

You build parts by combining **solids and holes**, with an **editable history**: every shape keeps its
parameters, so you can go back and change any measurement at any time. The `.nvl3d` project stores the
whole construction tree; STL, OBJ and 3MF are only the export.

[⬇ Download the latest version](https://github.com/lgpf/anvil3d/releases) · [♥ Support on Ko-fi](https://ko-fi.com/anvil3d)

## Features

- **Shape library in categories**: basic shapes, polyhedra (including the soccer ball), symbols,
  fasteners (screws with real threads, nuts, washers), mechanics (gears, racks, pulleys, springs),
  joints (pins, dovetails, ball joints), containers and generators (extrusion, profile revolve,
  bent pipe, SVG).
- **Solids and holes**, groups, multicolor groups and real-time preview of what a hole will cut.
- **Fillet and chamfer** on straight and curved edges, with continuous lines and tangent chains. On
  extruded parts (text, SVG, polygons) the finish is computed from the outline, clean and fast, with a
  warning when the size is too large for the thin parts.
- **3D text** with built-in and Windows fonts, wrapped around a cylinder or **applied to any face**
  (ramps, domes, curved parts, the inside of tubes), following the surface, or folding over the edges of
  flat-faced parts (star, icosahedron, boxes).
- **Import SVG** as an extruded, editable part; **import and export STL, OBJ and 3MF** (3MF keeps one
  part per object, each with its color; STL can also be one file per object); **import STEP** (.step/.stp,
  from other CAD programs), with each part of an assembly separate, in place and with its color.
- **Join faces**, align, mirror, resize several parts at once, move by dragging (like Tinkercad).
- **Handles and dimensions on the part**: corners, top and bottom; the clicked handle stays chosen, with its
  dimensions always visible and a typed size growing towards it.
- **Mesh editing**, simplification and **repair for printing**.
- **Plugins**: create new shapes in JavaScript — or ask an AI to write them using the included guide.
- Interface and manual in **English and Portuguese**.

## Getting started

Download the latest version from [Releases](https://github.com/lgpf/anvil3d/releases):

| System | File | How to use |
|---|---|---|
| Windows | `Anvil3D-Instalador-<version>.exe` | Installer, creates shortcuts. |
| Windows | `Anvil3D-<version>-windows-x64.zip` | No installation: unzip anywhere and run `Anvil3D.exe`. |
| Windows | `Anvil3D-Portatil-<version>.exe` | Single file, runs directly (e.g. from a USB stick). Slower to start, as it unpacks itself every time. |
| macOS 13 or later | `Anvil3D-Mac-<version>.dmg` | Open it and drag Anvil3D to Applications (Intel and Apple Silicon). |

Projects, plugins and saved parts live in `Documents\Anvil3D` (on the Mac, `Documents/Anvil3D`).

**First-run warnings.** Anvil3D has no paid Microsoft or Apple signature, so both systems are wary of it
at first:
- **Windows:** if the browser says the file is unsafe, choose **Keep**. When opening, if "Windows
  protected your PC" appears, click **More info › Run anyway**.
- **Mac:** right-click Anvil3D and choose **Open**. If macOS says the app is "damaged", run in Terminal:
  `xattr -cr /Applications/Anvil3D.app`

**Mouse:** right button rotates the view, middle button pans, wheel zooms. Click selects,
Shift+click adds to the selection. The arrow keys move the part following the view. **F1** opens the
full manual; the **?** buttons in the panel show quick tips. On the Mac, shortcuts use ⌘ instead of Ctrl
(⌘+click adds to the selection).

**Preferences** menu: move by dragging, side handles, dimension lines, bed size (200–300 mm) and language.

## Development

    npm install
    npm start            # run the app
    npm test             # core tests (geometry, file format, STL)
    npm run dist         # build the Windows packages (installer, zip and portable)
npm run dist:mac     # build the macOS app (needs a Mac; automatic on GitHub Actions)

Structure:
- `main.js`, `preload.js` — window, files, `app://` protocol and plugins folder.
- `app/core/` — UI-free core (file format with migrations, Manifold geometry engine, history, STL/OBJ/3MF; STEP reading through OpenCascade).
- `app/principal.mjs` — 3D interface.
- `plugins/` — built-in shapes, using the same API as user plugins (see `plugins/LEIA-ME.md` and
  `plugins/GENERATE-SHAPES-WITH-AI.md`).

Built with Electron, three.js, Manifold, meshoptimizer, opentype.js and occt-import-js (OpenCascade, LGPL-2.1); DejaVu fonts.

## Support the project

Anvil3D is free. If it helped you, please consider supporting its development:
**[ko-fi.com/anvil3d](https://ko-fi.com/anvil3d)**

## License

Anvil3D is free software under the **GNU General Public License v3.0 or later** (see `LICENSE`).
Plugins that use only the public plugin API may use **any license** — see `EXCECAO-PLUGINS.md`.

Created by **Luiz Pacheco** · luizgpf@gmail.com · [nobetteridea.com](https://nobetteridea.com) · © 2026
