// 本地预览/局域网试玩服务器：node serve.js 后，手机浏览器打开打印出的 Phone 地址即可
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const root = path.resolve(__dirname), port = 8934;
http.createServer((req, res) => {
  const f = req.url.split('?')[0].split('#')[0];
  const rel = decodeURIComponent(f).replace(/^\/+/, '');
  const p = path.resolve(root, rel || 'index.html');
  if (p !== root && !p.startsWith(root + path.sep)) {   // 阻断 ../ 路径穿越
    res.writeHead(403); res.end('403'); return;
  }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end('404'); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
                    '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
    res.setHeader('Content-Type', types[path.extname(p).toLowerCase()] || 'application/octet-stream');
    res.end(d);
  });
}).listen(port, () => {
  console.log('本机:   http://localhost:' + port);
  const ifs = os.networkInterfaces();
  for (const k of Object.keys(ifs))
    for (const it of ifs[k])
      if (it.family === 'IPv4' && !it.internal)
        console.log('手机:   http://' + it.address + ':' + port);
});
