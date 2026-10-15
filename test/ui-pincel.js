const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    await espera(2500);
    await js(`localStorage.setItem('teste:origem','1'); localStorage.setItem('arestaContinua','0')`);
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Fillet…').click()`); await espera(500);
      // arrasta pelas 4 arestas de cima, passando pelo meio de cada uma
      const pts = await js(`(()=>{const F=window.__anvil, ma=F.modoAresta; const r=document.querySelector('#vista canvas').getBoundingClientRect();
        return [[-6,-10],[10,-10],[10,10],[-10,10],[-10,-6]].map(([x,y])=>{const p=new F.THREE.Vector3(x,y,20).applyMatrix4(F.grupoArestas.matrixWorld).project(F.camera); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];});})()`);
      const ev = (type, p, mods = []) => w.webContents.sendInputEvent({ type, x: Math.round(p[0]), y: Math.round(p[1]), button: 'left', clickCount: 1, modifiers: mods });
      ev('mouseMove', pts[0]); await espera(80); ev('mouseDown', pts[0]); await espera(80);
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        for (let t = 0; t <= 8; t++) { ev('mouseMove', [a[0] + (b[0] - a[0]) * t / 8, a[1] + (b[1] - a[1]) * t / 8], ['leftButtonDown']); await espera(30); }
      }
      ev('mouseUp', pts[pts.length - 1]); await espera(400);
      console.log('pincel:', await js(`document.querySelector('#msg').textContent`), '| marcadas:', await js(`window.__anvil.modoAresta.sel.size`));
      // de novo começando numa marcada: desmarca
      ev('mouseMove', pts[0]); await espera(80); ev('mouseDown', pts[0]); await espera(80);
      for (let t = 0; t <= 8; t++) { ev('mouseMove', [pts[0][0] + (pts[1][0] - pts[0][0]) * t / 8, pts[0][1] + (pts[1][1] - pts[0][1]) * t / 8], ['leftButtonDown']); await espera(30); }
      ev('mouseUp', pts[1]); await espera(400);
      console.log('pincel desmarcando:', await js(`document.querySelector('#msg').textContent`), '| marcadas:', await js(`window.__anvil.modoAresta.sel.size`));
    } catch (e) { console.log('ERRO TESTE', e); }
    await js(`localStorage.setItem('arestaContinua','1')`);
    app.exit(0);
  });
});
require('../main.js');
