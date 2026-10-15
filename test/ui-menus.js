// cada menu aberto tem que estar visível (o ponto do meio de cada item é o próprio item)
const { app } = require('electron');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
    await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(200);
    const res = [];
    const nMenus = await js(`document.querySelectorAll('.menu-titulo').length`);
    for (let i = 0; i < nMenus; i++) {
      await js(`document.querySelectorAll('.menu-titulo')[${i}].click()`); await espera(150);
      res.push(await js(`(()=>{const m=document.querySelector('.menu.aberto'); const itens=[...m.querySelectorAll('.menu-itens button')];
        const ok=itens.filter(b=>{const r=b.getBoundingClientRect(); const x=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return b.contains(x) || (b.disabled && r.width>0 && m.contains(x));}).length;
        return m.querySelector('.menu-titulo').textContent+' '+ok+'/'+itens.length;})()`));
      await js(`document.body.click()`); await espera(100);
    }
    console.log('itens visíveis por menu:', res.join(' | '));
    console.log('altura da barra:', await js(`document.querySelector('#barra').getBoundingClientRect().height`));
    app.exit(0);
  });
});
require('../main.js');
