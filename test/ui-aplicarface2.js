// aplicar texto num toroide e num icosaedro com prévia, modos e aviso de curvatura
const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (/rror/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.removeItem('teste:origem'); window.__anvil.moverPeca(false)`);
  const forma = async n => { await js(`(()=>{const i=document.querySelector('#busca-forma, input[placeholder^="Buscar"]'); i.value=${JSON.stringify(n)}; i.dispatchEvent(new Event('input'));})()`); await espera(300); await js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`); await js(`(()=>{const i=document.querySelector('#busca-forma, input[placeholder^="Buscar"]'); i.value=''; i.dispatchEvent(new Event('input'));})()`); };
  const campo = (r, v) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(r)})); const i=c.querySelector('input,select,textarea'); i.value=${JSON.stringify(String(v))}; i.dispatchEvent(new Event('change'));})()`);
  const pos = (x, y) => js(`(()=>{const c=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input'); c[0].value='${x}'; c[0].dispatchEvent(new Event('change')); c[1].value='${y}'; c[1].dispatchEvent(new Event('change')); return 1;})()`);
  await forma('Toroide'); await espera(400); await pos(60, 100); await espera(300);
  await forma('Icosaedro'); await espera(400); await campo('Diâmetro', 40).catch(()=>{}); await pos(150, 110); await espera(300);
  await js(`window.__anvil.selecionar([])`); await js(`document.querySelector('[data-cmd=vistaIso]').click()`); await espera(500);
  const aplicar = async (alvo, modo) => {
    await forma('Texto'); await espera(900); await campo('Texto', 'Luiz Pacheco'); await campo('Altura das letras', 6); await campo('Espessura / profundidade', 1.5); await espera(500);
    await js(`document.querySelector('[data-cmd=aplicarFace]').click()`); await espera(300);
    const p = await js(`(()=>{const F=window.__anvil; const o=F.estado.doc.objetos[${alvo}]; const m=F.malhas.get(o.id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m,true); const c=b.getCenter(new F.THREE.Vector3()); const rc=new F.THREE.Raycaster(new F.THREE.Vector3(c.x${alvo===0?'-12':''},c.y,b.max.z+30),new F.THREE.Vector3(0,0,-1)); const h=rc.intersectObject(m,false)[0]; const q=h.point.clone().project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [Math.round(r.left+(q.x+1)/2*r.width), Math.round(r.top+(1-q.y)/2*r.height)];})()`);
    w.webContents.sendInputEvent({ type: 'mouseMove', x: p[0], y: p[1] }); await espera(80);
    for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x: p[0], y: p[1], button: 'left', clickCount: 1 });
    await espera(2000);
    const aviso1 = await js(`!document.querySelector('#aviso-curva-af')?.hidden`);
    await js(`(()=>{const s=[...document.querySelectorAll('#propriedades select')].at(-1); s.value='${modo}'; s.dispatchEvent(new Event('change'));})()`); await espera(2000);
    console.log(`alvo ${alvo} | prévia ${await js(`window.__anvil.previaAF`)} | aviso no modo curva: ${aviso1} | modo ${modo}`);
    await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Aplicar').click()`); await espera(2500);
    console.log('   ', await js(`document.querySelector('#msg').textContent.slice(0,70)`));
  };
  await aplicar(0, 'suave');
  await aplicar(1, 'reto');
  await js(`window.__anvil.selecionar([])`); await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(600);
  fs.writeFileSync('/tmp/shots/100.png', (await w.webContents.capturePage()).toPNG());
  app.exit(0);
}); });
require('../main.js');
