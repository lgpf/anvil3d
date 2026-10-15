// a roda sempre dá zoom (mesmo se um arraste anterior deixou a órbita desligada) e o pivô "ponto" não volta sem ponto
const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  console.log('pivô ao abrir (estava "ponto" salvo):', await js(`window.__anvil.estado.pivo`));
  const pos = () => js(`window.__anvil.camera.position.toArray().map(v=>v.toFixed(1)).join(',')`);
  const r = await js(`(()=>{const c=document.querySelector('#vista canvas').getBoundingClientRect(); return [Math.round(c.left+c.width/2), Math.round(c.top+c.height/2)];})()`);
  await js(`window.__anvil.orbita.enabled = false`); // simula um arraste que não terminou
  const a = await pos();
  for (let k = 0; k < 6; k++) { w.webContents.sendInputEvent({ type: 'mouseWheel', x: r[0], y: r[1], deltaX: 0, deltaY: 120, wheelTicksY: 1, canScroll: true }); await espera(60); }
  console.log('roda com a órbita travada: câmera', a, '→', await pos(), '| órbita ligada:', await js(`window.__anvil.orbita.enabled`));
  app.exit(0);
}); });
app.on('ready', () => {}); 
require('../main.js');
