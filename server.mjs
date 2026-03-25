#!/usr/bin/env node
/**
 * HTTPS 开发服务器
 * 使用 Next.js + HTTPS 证书
 */

import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs/cert.pem')),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, '0.0.0.0', () => {
    console.log('✅ HTTPS 服务器已启动');
    console.log(`📍 本地：https://localhost:${port}`);
    console.log(`🌐 网络：https://0.0.0.0:${port}`);
    console.log('');
    console.log('⚠️  浏览器会显示安全警告，点击"继续访问"即可');
  });
});
