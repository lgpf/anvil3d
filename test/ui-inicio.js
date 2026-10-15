// a vista fica escondida até a câmera ser enquadrada; depois aparece já no lugar certo
const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  const amostras = [];
  w.webContents.on('dom-ready', async () => {
    try { await w.webContents.executeJavaScript("localStorage.removeItem('teste:origem')"); } catch {}
    for (let i = 0; i < 120; i++) {
      try { amostras.push(await w.webContents.executeJavaScript(`(()=>{const c=document.querySelector('#vista canvas'); const F=window.__anvil; return c ? (getComputedStyle(c).opacity==='0'?'oculta':'visível')+(F?' câmera '+F.camera.position.toArray().map(v=>Math.round(v)).join(',')+' tela '+c.clientWidth+'x'+c.clientHeight+' alvo '+(F.orbita?F.orbita.target.toArray().map(v=>Math.round(v)).join(','):'?'):'') : 'sem canvas';})()`)); } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    const vis = amostras.filter(a => a.startsWith('visível'));
    console.log('primeira visível:', vis[0], '| estados distintos enquanto visível:', [...new Set(vis.map(v => v.split('câmera ')[1]))].join(' // '));
    app.exit(0);
  });
});
require('../main.js');
