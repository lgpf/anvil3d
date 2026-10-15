const { app } = require('electron'); const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (e.level > 1 && !/Security/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.setItem('teste:origem','1')`);
  const forma = n => js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`);
  const campo = (r, v) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(r)})); const i=c.querySelector('input,select,textarea'); i.value=${JSON.stringify(String(v))}; i.dispatchEvent(new Event('change'));})()`);
  // destino: esfera grande achatada (superfície curva irregular em cima)
  await forma('Esfera'); await espera(300); await campo('Diâmetro', 60); await espera(300);
  // texto plano, acima da esfera
  await forma('Texto'); await espera(800); await campo('Texto', 'ANVIL'); await campo('Altura das letras', 8); await campo('Espessura / profundidade', 2); await espera(500);
  await js(`(()=>{const c=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[2]; c.value='70'; c.dispatchEvent(new Event('change')); return 1;})()`); await espera(500);
  await js(`(()=>{const F=window.__anvil; const [esf, tx]=F.estado.doc.objetos; F.selecionar([tx.id, esf.id]);})()`); await espera(300);
  console.log('botão no painel:', await js(`!![...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Projetar na superfície')`));
  const t0 = Date.now();
  await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Projetar na superfície').click()`); await espera(500);
  console.log(await js(`document.querySelector('#msg').textContent`), '|', (Date.now() - t0) + 'ms');
  console.log('resultado:', await js(`(()=>{const F=window.__anvil,o=F.estado.doc.objetos.find(o=>o.nome.includes('superfície')); if(!o) return 'nenhum'; const m=F.malhas.get(o.id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m,true); return o.nome+' | tipo '+o.tipo+' | z '+b.min.z.toFixed(1)+' → '+b.max.z.toFixed(1)+' | receita '+(o.receita?.length||0);})()`));
  await js(`window.__anvil.selecionar([])`); await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(500);
  await js(`(()=>{const F=window.__anvil; F.camera.position.set(40,-70,90); F.camera.lookAt(0,0,25); F.camera.updateMatrixWorld(); return 1;})()`);
  await js(`document.querySelector('[data-cmd=verTriangulos]').click(); document.querySelector('[data-cmd=verTriangulos]').click();`); await espera(500);
  fs.writeFileSync('/tmp/shots/75-projetar.png', (await w.webContents.capturePage()).toPNG());
  app.exit(0);
}); });
require('../main.js');
