#!/usr/bin/env node
/**
 * HTTPS 生产服务器
 * 用于局域网扫码测试
 */

import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;
const dev = false; // 生产模式
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
    console.log('✅ HTTPS 生产服务器已启动');
    console.log('');
    console.log('📍 访问地址：');
    console.log(`   本地：https://localhost:${port}`);
    console.log(`   网络：https://0.0.0.0:${port}`);
    console.log('');
    console.log('⚠️  手机浏览器会显示"不安全"警告，点击"继续访问"即可');
    console.log('');
    console.log('📱 页面列表：');
    console.log(`   首页：https://<你的 IP>:${port}/`);
    console.log(`   医院端（扫码）：https://<你的 IP>:${port}/hospital`);
    console.log('');
    console.log('⚠️  按 Ctrl+C 停止服务器');
    console.log('');
  });
});
