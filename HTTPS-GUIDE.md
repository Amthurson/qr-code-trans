# HTTPS 与扫码调试指南

> 微信扫码需要 HTTPS 环境，本文档提供本地调试和公网访问方案

---

## 🔐 方案一：本地 HTTPS（推荐用于开发）

### 1. 生成证书

```bash
cd /mnt/c/John/code/mosai/project-materials/develop/offline-questionnaire-qrcode
bash scripts/generate-cert.sh
```

### 2. 启动 HTTPS 服务器

```bash
bash scripts/dev-https.sh
```

### 3. 手机访问

1. 确保手机和电脑在同一 WiFi
2. 查看电脑 IP 地址：
   ```bash
   hostname -I
   # 或
   ip addr show
   ```
3. 手机浏览器访问：`https://<你的 IP>:3000`

### ⚠️ 注意事项

- 浏览器会显示"不安全"警告（自签名证书正常现象）
- 点击"继续访问"或"高级 → 继续"
- 微信可能无法直接打开，需要使用方案二

---

## 🌐 方案二：内网穿透（推荐用于微信扫码）

### 使用 ngrok

#### 1. 安装 ngrok

```bash
# Windows (PowerShell)
choco install ngrok

# macOS
brew install ngrok

# Linux
snap install ngrok
```

#### 2. 启动普通 HTTP 服务器

```bash
pnpm dev
```

#### 3. 创建 ngrok 隧道

```bash
ngrok http 3000
```

#### 4. 获取 HTTPS 链接

ngrok 会生成类似这样的链接：
```
https://abc123.ngrok.io
```

#### 5. 微信扫码测试

- 将此 HTTPS 链接生成二维码
- 微信扫码即可打开

---

## 🌍 方案三：使用 localtunnel

### 1. 安装

```bash
npm install -g localtunnel
```

### 2. 启动

```bash
lt --port 3000
```

### 3. 获取链接

会生成类似：`https://xxx-xxx-xxx.loca.lt`

---

## 🚀 方案四：部署到 Vercel（生产环境）

### 1. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 2. 部署

```bash
cd /mnt/c/John/code/mosai/project-materials/develop/offline-questionnaire-qrcode
vercel
```

### 3. 获取生产链接

部署后会生成：
- 预览链接：`https://xxx.vercel.app`
- 生产链接：`https://your-domain.vercel.app`

### ✅ 优势

- 免费 HTTPS
- 全球 CDN
- 自动部署
- 微信扫码完美支持

---

## 📱 微信扫码测试流程

### 完整流程

```
1. 启动开发服务器（HTTP 或 HTTPS）
   ↓
2. 使用内网穿透获取 HTTPS 链接
   ↓
3. 访问 /share 页面生成问卷二维码
   ↓
4. 微信扫码打开问卷
   ↓
5. 填写问卷
   ↓
6. 生成数据二维码
   ↓
7. 医院端扫码解码
```

### 测试检查清单

- [ ] 手机能访问 HTTPS 链接
- [ ] 微信能打开问卷页面
- [ ] 页面在移动端正常显示
- [ ] 能正常填写问卷
- [ ] 能生成数据二维码
- [ ] 医院端能解码

---

## 🔧 常见问题

### Q1: 微信提示"网页包含未授权内容"

**解决**：
- 使用正式域名（方案四）
- 或在微信开发者工具中调试

### Q2: 手机无法访问电脑 IP

**解决**：
- 检查防火墙设置
- 确保同一 WiFi
- 尝试关闭防火墙临时测试

### Q3: ngrok 速度慢

**解决**：
- 使用国内镜像
- 或尝试 localtunnel
- 或使用自己的服务器

### Q4: 证书过期

**解决**：
```bash
# 重新生成证书
rm -rf certs
bash scripts/generate-cert.sh
```

---

## 📊 方案对比

| 方案 | HTTPS | 微信扫码 | 难度 | 推荐场景 |
|------|-------|---------|------|---------|
| 本地 HTTPS | ✅ 自签名 | ❌ 可能受限 | ⭐ | 开发调试 |
| ngrok | ✅ 正式 | ✅ 支持 | ⭐⭐ | 临时测试 |
| localtunnel | ✅ 正式 | ✅ 支持 | ⭐⭐ | 临时测试 |
| Vercel | ✅ 正式 | ✅ 完美 | ⭐⭐ | 生产/演示 |

---

## 🎯 推荐流程

**开发阶段**：
```bash
# 1. 本地 HTTPS 调试
bash scripts/dev-https.sh

# 2. 手机浏览器访问测试
https://<你的 IP>:3000
```

**微信扫码测试**：
```bash
# 1. 启动开发服务器
pnpm dev

# 2. 新开终端启动 ngrok
ngrok http 3000

# 3. 使用 ngrok 的 HTTPS 链接生成问卷二维码
https://xxx.ngrok.io/share
```

**生产部署**：
```bash
# 部署到 Vercel
vercel

# 分享生产链接
https://your-app.vercel.app/share
```

---

## 📚 相关文档

- [README.md](./README.md) - 项目说明
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发文档
- [Next.js HTTPS 文档](https://nextjs.org/docs/pages/api-reference/next-config-js/https)

---

**更新时间**：2026-03-24  
**维护者**：AI 助手
