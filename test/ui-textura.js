// textura: escolher a lateral de fora de um tubo, aplicar canelado; o lado de dentro e a boca ficam lisos
const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (/rror/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.removeItem('teste:origem')`);
  const forma = n => js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`);
  const campo = (r, v) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(r)})); const i=c.querySelector('input,select'); i.value=${JSON.stringify(String(v))}; i.dispatchEvent(new Event('change'));})()`);
  await forma('Tubo'); await espera(500);
  console.log('campos do tubo:', await js(`[...document.querySelectorAll('#propriedades .campo')].map(c=>c.firstChild?.textContent?.trim()).slice(0,8).join(' | ')`));
  await js(`window.__anvil.selecionar([window.__anvil.estado.doc.objetos[0].id])`);
  await js(`document.querySelector('[data-cmd=vistaIso]').click()`); await espera(300); await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(400);
  await js(`document.querySelector('[data-cmd=textura]').click()`); await espera(400);
  // clica na lateral de fora (frente do tubo, meia altura)
  const p = await js(`(()=>{const F=window.__anvil,m=F.malhas.get(F.estado.doc.objetos[0].id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m); const c=b.getCenter(new F.THREE.Vector3()); const rc=new F.THREE.Raycaster(new F.THREE.Vector3(c.x, b.min.y-30, c.z), new F.THREE.Vector3(0,1,0)); const h=rc.intersectObject(m,false)[0]; const q=h.point.clone().project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [Math.round(r.left+(q.x+1)/2*r.width), Math.round(r.top+(1-q.y)/2*r.height)];})()`);
  w.webContents.sendInputEvent({ type: 'mouseMove', x: p[0], y: p[1] }); await espera(80);
  for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: p[0], y: p[1], button: 'left', clickCount: 1 });
  await espera(2500);
  console.log('escolhido:', await js(`document.querySelector('#propriedades .dica').textContent.slice(0,60)`), '| msg:', await js(`document.querySelector('#msg').textContent`));
  fs.writeFileSync('/tmp/shots/111-previa.png', (await w.webContents.capturePage()).toPNG());
  const raioDentro = () => js(`(()=>{const F=window.__anvil,o=F.estado.doc.objetos[0],m=F.malhas.get(o.id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m), c=b.getCenter(new F.THREE.Vector3()); const rc=new F.THREE.Raycaster(new F.THREE.Vector3(c.x,c.y,c.z), new F.THREE.Vector3(0,-1,0)); const h=rc.intersectObject(m,false)[0]; return (h? h.distance.toFixed(3):'?')+' | largura total '+(b.max.x-b.min.x).toFixed(2);})()`);
  // tira a região (clicar de novo): a peça não pode sumir
  w.webContents.sendInputEvent({ type: 'mouseMove', x: p[0], y: p[1] }); await espera(80);
  for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: p[0], y: p[1], button: 'left', clickCount: 1 });
  await espera(800);
  console.log('sem faces: peça visível?', await js(`window.__anvil.malhas.get(window.__anvil.estado.doc.objetos[0].id).visible`));
  w.webContents.sendInputEvent({ type: 'mouseMove', x: p[0], y: p[1] }); await espera(80);
  for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: p[0], y: p[1], button: 'left', clickCount: 1 });
  await espera(2500);
  console.log('detalhe:', await js(`[...document.querySelectorAll('#propriedades .dica')].at(-1).textContent.slice(0,70)`));
  const antes = await raioDentro();
  await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Aplicar').click()`); await espera(4000);
  console.log('aplicado:', await js(`document.querySelector('#msg').textContent`));
  console.log('raio de dentro / largura: antes', antes, '| depois', await raioDentro());
  await js(`window.__anvil.selecionar([])`); await espera(300);
  fs.writeFileSync('/tmp/shots/111.png', (await w.webContents.capturePage()).toPNG());
  app.exit(0);
}); });
require('../main.js');
