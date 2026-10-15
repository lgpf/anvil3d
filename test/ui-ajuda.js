const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
fs.mkdirSync('/tmp/shots', { recursive: true });
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    const foto = async n => fs.writeFileSync(`/tmp/shots/${n}.png`, (await w.webContents.capturePage()).toPNG());
    await espera(2500);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      console.log('título:', w.getTitle(), '| interrogações:', await js(`document.querySelectorAll('.interrog').length`));
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      console.log('com objeto:', await js(`document.querySelectorAll('.interrog').length`));
      await js(`document.querySelector('#propriedades [data-dica=pivo]').scrollIntoView(); document.querySelector('#propriedades [data-dica=pivo]').click()`); await espera(300);
      console.log('dica:', await js(`document.querySelector('#popdica p').textContent`));
      await foto('15-dica');
      await js(`document.querySelector('#popdica .link').click()`); await espera(1200);
      console.log('manual aberto em:', await js(`document.querySelector('#modal iframe').contentWindow.location.hash`), '| seções:', await js(`document.querySelector('#modal iframe').contentDocument.querySelectorAll('section').length`));
      await foto('16-manual');
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(300);
      await js(`document.querySelector('[data-cmd=sobre]').click()`); await espera(500);
      console.log('sobre:', await js(`document.querySelector('.sobre').innerText.replace(/\\n+/g,' | ')`));
      await foto('17-sobre');
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
