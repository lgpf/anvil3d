// nenhuma lista de opção do painel pode cortar o texto escolhido
const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
const MEDIR = `(()=>{ const r=[]; const c=document.createElement('canvas').getContext('2d');
  for (const s of document.querySelectorAll('#propriedades select')) {
    const cs=getComputedStyle(s); c.font=cs.fontSize+' '+cs.fontFamily;
    const maior=Math.max(...[...s.options].map(o=>c.measureText(o.text).width));
    const util=s.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-22; // 22px da seta
    if (maior>util) r.push(s.options[s.selectedIndex].text+' ('+Math.round(maior)+' > '+Math.round(util)+')');
  } return r; })()`;
app.on('browser-window-created', (_, w) => {
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    await espera(2500);
    const cortes = new Set();
    for (const idioma of ['idiomaPt', 'idiomaEn']) {
      await js(`document.querySelector('[data-cmd=${idioma}]').click()`); await espera(200);
      for (const f of ['Caixa', 'Cilindro', 'Box', 'Cylinder']) {
        const ok = await js(`(()=>{const b=[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('${f}')); if(!b) return false; b.click(); return true;})()`);
        if (!ok) continue;
        await espera(250);
        await js(`(()=>{const s=[...document.querySelectorAll('#propriedades select')].find(s=>[...s.options].some(o=>o.value==='ponto')); if(s){s.value='ponto'; s.dispatchEvent(new Event('change'));}})()`); await espera(150);
        for (const x of await js(MEDIR)) cortes.add(f + ': ' + x);
      }
    }
    await js(`document.querySelector('[data-cmd=idiomaPt]').click()`);
    await js(`(()=>{const s=[...document.querySelectorAll('#propriedades select')].find(s=>[...s.options].some(o=>o.value==='ponto')); s.scrollIntoView();})()`); await espera(300);
    fs.writeFileSync('/tmp/shots/45-pivo.png', (await w.webContents.capturePage()).toPNG());
    console.log('listas cortando texto:', cortes.size, [...cortes].join(' ; '));
    app.exit(0);
  });
});
require('../main.js');
