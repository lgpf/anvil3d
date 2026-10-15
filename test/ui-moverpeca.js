const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (/DBG|rror/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.setItem('teste:origem','1'); localStorage.setItem('moverPeca','1')`); await js(`window.__anvil.moverPeca(true)`);
  await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent==='Caixa').click()`); await espera(300);
  await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(400);
  const est = () => js(`(()=>{const F=window.__anvil,o=F.estado.doc.objetos[0]; return 'pos '+o.transformacao.posicao.join(',')+' | gizmo '+(F.gizmo.object?'visível':'escondido');})()`);
  console.log('início:', await est());
  const tela = p => js(`(()=>{const F=window.__anvil; const q=new F.THREE.Vector3(...${JSON.stringify(p)}).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [Math.round(r.left+(q.x+1)/2*r.width), Math.round(r.top+(1-q.y)/2*r.height)];})()`);
  const arrastar = async (de, para) => {
    w.webContents.sendInputEvent({ type: 'mouseMove', x: de[0], y: de[1] }); await espera(60);
    w.webContents.sendInputEvent({ type: 'mouseDown', x: de[0], y: de[1], button: 'left', clickCount: 1 }); await espera(60);
    for (let k = 1; k <= 6; k++) { w.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(de[0] + (para[0] - de[0]) * k / 6), y: Math.round(de[1] + (para[1] - de[1]) * k / 6), button: 'left', modifiers: ['leftButtonDown'] }); await espera(50); }
    w.webContents.sendInputEvent({ type: 'mouseUp', x: para[0], y: para[1], button: 'left', clickCount: 1 }); await espera(500);
  };
  // arrasta o topo da caixa: deve andar em X/Y e manter Z
  await arrastar(await tela([-5, -6, 20]), await tela([10, -1, 20]));
  console.log('arrastando a peça:', await est());
  // seta Z: puxa para cima
  const sz = await js(`(()=>{const F=window.__anvil; const s=F.cena.children.find(o=>o.isGroup && o.children.length===3 && o.children[1].geometry?.type==='ConeGeometry'); const p=s.position.clone().add(new F.THREE.Vector3(0,0,s.scale.z*0.6)); return p.toArray();})()`);
  const a = await tela(sz), b = await tela([sz[0], sz[1], sz[2] + 10]);
  await arrastar(a, b);
  console.log('puxando a seta Z:', await est(), '| caixa de seleção aparecendo?', await js(`(()=>{return [...document.querySelectorAll('#vista > div')].some(d=>!d.hidden && getComputedStyle(d).borderStyle.includes('dashed') && d.offsetWidth>5);})()`));
  const clicar = async p => { w.webContents.sendInputEvent({ type: 'mouseMove', x: p[0], y: p[1] }); await espera(80); for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: p[0], y: p[1], button: 'left', clickCount: 1 }); await espera(400); };
  await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(500);
  const corpo = await tela([20, 0, 31]);
  await clicar(corpo); console.log('clique na peça já selecionada:', await js(`window.__anvil.gizmo.mode + ' / botão ' + document.querySelector('#bt-modo').textContent`));
  await clicar(corpo); console.log('clique de novo:', await js(`(window.__anvil.gizmo.object ? window.__anvil.gizmo.mode : 'sem gizmo (arrastar)') + ' / botão ' + document.querySelector('#bt-modo').textContent`));
  await js(`document.querySelector('[data-cmd=moverPeca]').click()`); await espera(400);
  console.log('preferência desligada:', await est());
  app.exit(0);
}); });
require('../main.js');
