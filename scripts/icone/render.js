// Renderiza o ícone: xvfb-run electron scripts/icone/render.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1100, height: 1100, show: false, transparent: true, webPreferences: { offscreen: false } });
  await w.loadFile(path.join(__dirname, 'render.html'));
  const dados = fs.readFileSync(path.join(__dirname, 'bigorna.json'), 'utf8');
  await new Promise(r => setTimeout(r, 800));
  const url = await w.webContents.executeJavaScript(`renderizar(${dados}, 1024)`);
  fs.writeFileSync(path.join(__dirname, '..', '..', 'build', 'icone-1024.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('ok');
  app.exit(0);
});
