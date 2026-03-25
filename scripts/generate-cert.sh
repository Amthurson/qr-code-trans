#!/bin/bash

# 生成自签名 HTTPS 证书（用于本地开发）

CERT_DIR="./certs"

echo "🔐 生成 HTTPS 自签名证书..."

# 创建证书目录
mkdir -p $CERT_DIR

# 生成私钥
openssl genrsa -out $CERT_DIR/key.pem 2048

# 生成证书（有效期 365 天）
openssl req -new -x509 -key $CERT_DIR/key.pem -out $CERT_DIR/cert.pem -days 365 -subj "/C=CN/ST=Local/L=Local/O=Dev/OU=Dev/CN=localhost"

echo "✅ 证书生成成功！"
echo "📁 证书位置：$CERT_DIR/"
echo "   - cert.pem (证书)"
echo "   - key.pem (私钥)"
echo ""
echo "⚠️  注意：自签名证书在浏览器中会显示不安全警告，这是正常的"
echo "   微信扫码需要真实域名 HTTPS，本地调试可用内网穿透工具"
