// a barra não pode mudar de tamanho ao interagir
const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    await espera(2500);
    const medir = () => js(`(()=>{const b=document.querySelector('#barra').getBoundingClientRect(), v=document.querySelector('#vista').getBoundingClientRect(), m=document.querySelector('#bt-modo').getBoundingClientRect(); return [b.height, v.top, v.height, m.width, m.height].map(x=>x.toFixed(1)).join(' ');})()`);
    const medidas = new Set();
    medidas.add(await medir());
    await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(200);
    for (const c of ['alternarGizmo', 'alternarGizmo', 'verTriangulos', 'verTriangulos', 'juntarFaces', 'juntarFaces', 'alternarGizmo', 'idiomaEn', 'alternarGizmo', 'idiomaPt']) {
      await js(`document.querySelector('[data-cmd=${c}]').click()`); await espera(150);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(50);
      medidas.add(await medir());
    }
    for (const t of ['Arquivo', 'Objeto']) { await js(`[...document.querySelectorAll('.menu-titulo')].find(b=>b.textContent==='${t}').click()`); await espera(100); medidas.add(await medir()); await js(`document.body.click()`); }
    console.log('medidas distintas (barra, topo da vista, altura da vista, botão modo):', [...medidas].join(' | '));
    app.exit(0);
  });
});
require('../main.js');
