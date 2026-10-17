// aviso de versão nova: consulta real ao GitHub e aviso simulado (release "v9.9.9" guardada)
const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
let fase = 0;
app.on('browser-window-created', (_, w) => { w.webContents.on('console-message', e => { if (/rror/.test(e.message)) console.log('[console]', e.message); });
  w.webContents.on('did-finish-load', async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms)), js = c => w.webContents.executeJavaScript(c);
  for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  if (fase === 0) {
    fase = 1;
    await js(`document.querySelector('[data-cmd=verificarAgora]').click()`); await espera(5000);
    console.log('consulta real:', await js(`document.querySelector('#msg').textContent`), '| guardada:', await js(`localStorage.getItem('releaseConhecida')`));
    await js(`localStorage.setItem('ultimaChecagem', String(Date.now())); localStorage.removeItem('versaoDispensada'); localStorage.setItem('releaseConhecida', JSON.stringify({ tag: 'v9.9.9', url: 'https://github.com/lgpf/anvil3d/releases' }))`);
    w.webContents.reload(); return;
  }
  await espera(4000);
  console.log('aviso:', await js(`document.querySelector('#aviso-versao')?.textContent || 'nenhum'`));
  await js(`[...document.querySelectorAll('#aviso-versao button')].find(b=>b.textContent==='Agora não').click()`); await espera(200);
  console.log('dispensado:', await js(`!document.querySelector('#aviso-versao')`), '| item no menu marcado:', await js(`document.querySelector('[data-cmd=checarAtualizacao]').classList.contains('ativo')`));
  await js(`localStorage.removeItem('releaseConhecida'); localStorage.removeItem('ultimaChecagem'); localStorage.removeItem('versaoDispensada')`);
  app.exit(0);
}); });
require('../main.js');
