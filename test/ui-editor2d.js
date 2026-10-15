const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (e.level > 1 && !/Security/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`[...document.querySelectorAll('.cat-titulo.fechada')].forEach(b=>b.click())`); await espera(200);
  await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent==='Revolução de Perfil').click()`); await espera(400);
  await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent.includes('Desenhar perfil')).click()`); await espera(1500);
  const n0 = await js(`window.__editor2d.pts.length`);
  // meio do trecho entre o ponto 2 e o ponto 3 (longe do eixo), em coordenadas de tela
  const alvo = await js(`(()=>{const E=window.__editor2d, p=E.pts, a=E.paraTela(p[2].x,p[2].y), b=E.paraTela(p[3].x,p[3].y), c=E.tela(), r=c.getBoundingClientRect(), kx=r.width/c.width, ky=r.height/c.height; return [Math.round(r.left+(a[0]+b[0])/2*kx), Math.round(r.top+(a[1]+b[1])/2*ky), ((p[2].x+p[3].x)/2).toFixed(2), ((p[2].y+p[3].y)/2).toFixed(2)];})()`);
  for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: alvo[0], y: alvo[1], button: 'left', clickCount: 1 });
  await espera(300);
  console.log('proporção da tela (largura/altura na tela vs. pixels):', await js(`(()=>{const c=window.__editor2d.tela(), r=c.getBoundingClientRect(); return (r.width/r.height).toFixed(3)+' vs '+(c.width/c.height).toFixed(3);})()`));
  console.log('pontos', n0, '→', await js(`window.__editor2d.pts.length`), '| clique no meio do trecho 2-3 em', alvo[2] + ',' + alvo[3], '| ponto novo na posição 3:', await js(`(()=>{const p=window.__editor2d.pts[3]; return p.x.toFixed(2)+','+p.y.toFixed(2);})()`));
  app.exit(0);
}); });
require('../main.js');
