const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (e.level > 1 && !/Security/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`window.__anvil.moverPeca(false)`);
  await js(`localStorage.setItem('teste:origem','1')`);
  for (const n of ['Caixa', 'Caixa']) { await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent==='${n}').click()`); await espera(300); }
  await js(`[...document.querySelectorAll('#propriedades .segmentado button')].find(b=>b.textContent==='Furo').click()`); await espera(300);
  await js(`(()=>{const c=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; c.value='40'; c.dispatchEvent(new Event('change')); return 1;})()`); await espera(500);
  // compara com a imagem de referência (furo longe): conta pixels que ficaram bem mais escuros
  let ref = null;
  const lum = bm => { const L = new Float32Array(bm.length / 4); for (let i = 0; i < L.length; i++) L[i] = bm[i * 4] * 0.11 + bm[i * 4 + 1] * 0.59 + bm[i * 4 + 2] * 0.3; return L; };
  const escuro = async () => { await espera(150); const L = lum((await w.webContents.capturePage()).toBitmap()); if (!ref) { ref = L; return 'referência'; } let n = 0; for (let i = 0; i < L.length; i++) if (ref[i] - L[i] > 25) n++; return n + ' px mais escuros'; };
  console.log('furo longe: área escura?', await escuro());
  // arrasta o furo (sem soltar) até encostar na caixa
  await js(`(()=>{const F=window.__anvil,g=F.gizmo,o=g.object; g.axis='X'; g.dispatchEvent({type:'mouseDown'}); o.position.x -= 30; o.updateMatrixWorld(true); g.dispatchEvent({type:'objectChange'}); return 1;})()`); await espera(400);
  console.log('arrastando para dentro (sem soltar):', await escuro());
  await js(`(()=>{const F=window.__anvil,g=F.gizmo,o=g.object; o.position.x += 30; o.updateMatrixWorld(true); g.dispatchEvent({type:'objectChange'}); return 1;})()`); await espera(400);
  console.log('arrastando para fora de novo (sem soltar):', await escuro());
  await js(`(()=>{const g=window.__anvil.gizmo; g.dispatchEvent({type:'mouseUp'}); g.axis=null; return 1;})()`); await espera(300);
  app.exit(0);
}); });
require('../main.js');
