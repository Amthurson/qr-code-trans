#!/bin/bash

# HTTPS 开发模式启动脚本（使用 Node.js HTTPS）

CERT_DIR="./certs"

# 检查证书是否存在
if [ ! -f "$CERT_DIR/cert.pem" ] || [ ! -f "$CERT_DIR/key.pem" ]; then
    echo "❌ 证书不存在，请先生成证书："
    echo "   pnpm run cert:gen"
    exit 1
fi

echo "🚀 启动 HTTPS 开发服务器..."
echo "📍 本地访问：https://localhost:3000"
echo "🌐 局域网访问：https://<你的 IP>:3000"
echo ""
echo "⚠️  浏览器会显示安全警告，点击"继续访问"即可"
echo ""

# 获取本机 IP（Windows）
if command -v ipconfig &> /dev/null; then
    LOCAL_IP=$(ipconfig | grep "IPv4" | grep -v "127.0.0.1" | head -1 | awk '{print $NF}')
else
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

echo "💡 你的手机应该访问：https://${LOCAL_IP}:3000"
echo "   确保手机和电脑在同一 WiFi 网络"
echo ""

# 创建自定义服务器脚本
cat > server.mjs << 'EOF'
import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 3000;
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
    console.log(`✅ HTTPS 服务器已启动`);
    console.log(`📍 本地：https://localhost:${port}`);
    console.log(`🌐 网络：https://0.0.0.0:${port}`);
  });
});
EOF

# 启动服务器
node server.mjs
