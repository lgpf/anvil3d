const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (/rror/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.setItem('teste:origem','1')`);
  const forma = n => js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`);
  const campo = (r, v) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(r)})); const i=c.querySelector('input,select,textarea'); i.value=${JSON.stringify(String(v))}; i.dispatchEvent(new Event('change'));})()`);
  // destino: cunha (rampa inclinada) grande
  await forma('Cunha'); await espera(300); await campo('Largura', 60); await campo('Profundidade', 40); await campo('Altura', 30); await espera(500);
  // texto plano, em qualquer lugar
  await forma('Texto'); await espera(900); await campo('Texto', 'ANVIL'); await campo('Altura das letras', 7); await campo('Espessura / profundidade', 1.5); await espera(600);
  await js(`(()=>{const c=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input'); c[0].value='80'; c[0].dispatchEvent(new Event('change')); return 1;})()`); await espera(400);
  await js(`document.querySelector('[data-cmd=aplicarFace]').click()`); await espera(300);
  console.log(await js(`document.querySelector('#msg').textContent`));
  // clica no meio da rampa da cunha
  const alvo = await js(`(()=>{const F=window.__anvil; const c=F.estado.doc.objetos[0]; const m=F.malhas.get(c.id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m,true); const p=new F.THREE.Vector3((b.min.x+b.max.x)/2, (b.min.y+b.max.y)/2, b.max.z+5); const rc=new F.THREE.Raycaster(p,new F.THREE.Vector3(0,0,-1)); const h=rc.intersectObject(m,false)[0]; const q=h.point.clone().project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [Math.round(r.left+(q.x+1)/2*r.width), Math.round(r.top+(1-q.y)/2*r.height)];})()`);
  w.webContents.sendInputEvent({ type: 'mouseMove', x: alvo[0], y: alvo[1] }); await espera(80);
  for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: alvo[0], y: alvo[1], button: 'left', clickCount: 1 });
  await espera(1500);
  console.log('alças durante a prévia:', await js(`window.__anvil.estado.sel.length`), '| prévia:', await js(`window.__anvil.previaAF`), '| painel:', await js(`document.querySelector('#propriedades h2').textContent`), '| doc ainda tem o texto original?', await js(`window.__anvil.estado.doc.objetos.some(o=>o.nome==='Texto')`));
  await js(`(()=>{const r=[...document.querySelectorAll('#propriedades input[type=range]')][0]; r.value='90'; r.dispatchEvent(new Event('input'));})()`); await espera(1200);
  console.log('girou 90° na prévia:', await js(`window.__anvil.previaAF`));
  await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Aplicar').click()`); await espera(2500);
  console.log(await js(`document.querySelector('#msg').textContent`), '| prévia depois:', await js(`window.__anvil.previaAF`));
  console.log('resultado:', await js(`(()=>{const F=window.__anvil,o=F.estado.doc.objetos.find(o=>o.nome.includes('superfície')); if(!o) return 'nenhum'; const m=F.malhas.get(o.id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m,true); return o.nome+' | caixa '+b.min.toArray().map(v=>v.toFixed(1)).join(',')+' → '+b.max.toArray().map(v=>v.toFixed(1)).join(',');})()`));
  await js(`window.__anvil.selecionar([])`); await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(500);
  fs.writeFileSync('/tmp/shots/96-face.png', (await w.webContents.capturePage()).toPNG());
  app.exit(0);
}); });
require('../main.js');
