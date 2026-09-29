const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/plain','.ico':'image/x-icon'};
const server = http.createServer((req,res) => {
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || path.relative(root,file).split(path.sep).some(p=>p.startsWith('.') || p==='node_modules')) throw new Error();
  } catch { res.writeHead(400); res.end('Invalid path'); return; }
  fs.readFile(file, (err,data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type':(types[path.extname(file)] || 'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(data);
  });
});
server.listen(Number(process.env.PORT || 8766), '127.0.0.1', () => console.log(`EvoSim: http://127.0.0.1:${server.address().port}`));
