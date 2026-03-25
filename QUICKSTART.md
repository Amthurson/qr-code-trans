# 快速启动指南

> 5 分钟开始使用问卷二维码系统

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd /mnt/c/John/code/mosai/project-materials/develop/offline-questionnaire-qrcode
pnpm install
```

### 2. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

---

## 📱 生成问卷二维码（微信扫码）

### 方式一：使用内网穿透（推荐）

#### 1. 启动 ngrok

```bash
# 新开一个终端
ngrok http 3000
```

会生成 HTTPS 链接：`https://xxx.ngrok.io`

#### 2. 生成问卷二维码

访问：`https://xxx.ngrok.io/share`

- 选择问卷
- 点击"生成问卷二维码"
- 下载二维码图片

#### 3. 微信扫码测试

- 微信扫码
- 打开问卷页面
- 填写问卷
- 生成数据二维码

### 方式二：本地 HTTPS

```bash
# 1. 生成证书
pnpm run cert:gen

# 2. 启动 HTTPS 服务器
pnpm run dev:https

# 3. 手机访问
https://<你的 IP>:3000/share
```

---

## 🏥 使用流程

### 完整流程

```
1. 医生/测试者
   ↓ 访问 /share
   ↓ 生成问卷二维码
   
2. 患者微信扫码
   ↓ 打开问卷页面
   ↓ 填写问卷
   
3. 生成数据二维码
   ↓ 出示给医院
   
4. 医院端扫码
   ↓ 访问 /hospital
   ↓ 扫码/输入
   ↓ 查看数据
```

---

## 📋 页面说明

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `/` | 入口选择 |
| 患者端 | `/patient` | 填写问卷 |
| 医院端 | `/hospital` | 扫码解码 |
| 分享 | `/share` | 生成问卷二维码 |

---

## 🔧 常用命令

```bash
# 开发模式
pnpm dev

# HTTPS 开发模式
pnpm run dev:https

# 生成证书
pnpm run cert:gen

# 生产构建
pnpm build

# 启动生产服务器
pnpm start
```

---

## ⚠️ 注意事项

### 微信扫码要求

- ✅ 必须使用 HTTPS
- ✅ 需要正式域名或内网穿透
- ❌ 自签名证书可能无法打开

### 推荐方案

**开发测试**：
- 使用 ngrok/loca.lt 内网穿透
- 获取正式 HTTPS 链接

**生产部署**：
- 部署到 Vercel
- 使用自己的域名

---

## 📚 更多文档

- [README.md](./README.md) - 项目说明
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发文档
- [HTTPS-GUIDE.md](./HTTPS-GUIDE.md) - HTTPS 配置指南

---

## 🆘 遇到问题？

### 常见问题

**Q: 微信扫码打不开**
- 使用内网穿透（ngrok）
- 或部署到 Vercel

**Q: 手机无法访问电脑**
- 确保同一 WiFi
- 检查防火墙
- 使用内网穿透

**Q: 证书警告**
- 自签名证书正常现象
- 点击"继续访问"

---

**更新时间**：2026-03-24
