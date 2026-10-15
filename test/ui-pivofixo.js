// girar várias peças juntas: o gizmo (pivô) não anda entre um giro e outro
const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (/rror/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`localStorage.setItem('teste:origem','1'); window.__anvil.moverPeca(false)`);
  const forma = n => js(`[...document.querySelectorAll('.forma')].find(b=>b.querySelector('.nome-forma')?.textContent===${JSON.stringify(n)}).click()`);
  for (const [n, x, y] of [['Cunha', -30, 10], ['Esfera', 20, -15], ['Meia esfera', 35, 30]]) {
    await forma(n); await espera(250);
    await js(`(()=>{const c=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input'); c[0].value='${x}'; c[0].dispatchEvent(new Event('change')); c[1].value='${y}'; c[1].dispatchEvent(new Event('change')); return 1;})()`); await espera(200);
  }
  await js(`(()=>{const F=window.__anvil; F.selecionar(F.estado.doc.objetos.map(o=>o.id));})()`); await espera(200);
  await js(`document.querySelector('[data-cmd=alternarGizmo]').click()`); await espera(300);
  const gz = () => js(`window.__anvil.gizmo.object.position.toArray().map(v=>v.toFixed(2)).join(',')`);
  const pos = [await gz()];
  for (let k = 0; k < 3; k++) {
    await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent.includes('Girar +')).click()`); await espera(300);
    pos.push(await gz());
  }
  console.log('pivô antes e depois de 3 giros:', pos.join('  →  '), '| fixo?', new Set(pos).size === 1);
  // mover a seleção: aí o pivô deve acompanhar
  await js(`(()=>{const x=[...document.querySelectorAll('#propriedades .xyz')][0].querySelectorAll('input')[0]; x.value=String(Number(x.value.replace(',','.'))+20); x.dispatchEvent(new Event('change'));})()`); await espera(300);
  console.log('depois de mover +20 em X:', await gz());
  app.exit(0);
}); });
require('../main.js');
