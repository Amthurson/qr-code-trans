# 🚀 Vercel 部署指南

## 方式一：命令行部署（最简单）⭐

### 步骤 1：安装 Vercel CLI

```powershell
npm i -g vercel
```

### 步骤 2：登录 Vercel

```powershell
vercel login
```

### 步骤 3：部署

```powershell
cd C:\John\code\mosai\project-materials\develop\offline-questionnaire-qrcode

vercel --prod
```

---

## 方式二：GitHub Actions 自动部署

### 步骤 1：推送到 GitHub

```bash
# 初始化 git
git init
git add .
git commit -m "Initial commit"

# 创建 GitHub 仓库并推送
git remote add origin https://github.com/你的用户名/offline-questionnaire.git
git branch -M main
git push -u origin main
```

### 步骤 2：配置 Vercel Secrets

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加：

- `VERCEL_TOKEN` - Vercel API Token
- `VERCEL_ORG_ID` - Vercel 组织 ID
- `VERCEL_PROJECT_ID` - Vercel 项目 ID

### 步骤 3：获取 Vercel 凭证

```bash
# 在 Vercel 控制台获取
# Settings → Tokens → Create Token
# 项目页面 URL 中包含 orgId 和 projectId
```

### 步骤 4：自动部署

每次 push 到 main 分支，GitHub Actions 会自动部署到 Vercel！

---

## 方式三：Vercel Dashboard 部署

### 步骤 1：访问 Vercel

打开 https://vercel.com

### 步骤 2：导入项目

1. 点击 "Add New Project"
2. 选择 "Import Git Repository"
3. 选择你的 GitHub 仓库
4. 点击 "Deploy"

### 步骤 3：配置构建设置

- **Framework Preset**: Next.js
- **Build Command**: `pnpm build`
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`

---

## 📋 部署前检查清单

- [ ] 已安装 Node.js 20+
- [ ] 已安装 pnpm
- [ ] 已安装 Vercel CLI（方式一）
- [ ] 代码已推送到 GitHub（方式二/三）
- [ ] 已配置 Vercel 账号

---

## 🔍 获取 Vercel 凭证

### VERCEL_TOKEN

1. 访问 https://vercel.com/account/tokens
2. 点击 "Create Token"
3. 复制 Token
4. 添加到 GitHub Secrets

### VERCEL_ORG_ID 和 VERCEL_PROJECT_ID

1. 访问 Vercel 项目页面
2. URL 格式：`https://vercel.com/你的组织名/项目名/settings`
3. 点击 "General"
4. 找到 "Project ID" 和 "Org ID"

---

## 📱 部署成功后

访问 Vercel 提供的链接：
```
https://offline-questionnaire-xxx.vercel.app
```

**测试功能**：
- ✅ 首页访问
- ✅ 患者端填写问卷
- ✅ 生成数据二维码
- ✅ 医院端扫码（需要 HTTPS）
- ✅ 图片上传解析

---

## ⚠️ 常见问题

### Q: 部署失败 "Command exited with 1"
**解决**：检查 `package.json` 中的依赖是否兼容

### Q: 构建时出现 "useSearchParams" 错误
**解决**：已修复，确保使用最新的代码

### Q: 摄像头无法使用
**解决**：Vercel 提供正式 HTTPS，应该可以正常使用

### Q: 图片上传失败
**解决**：检查文件大小（最大 5MB）和格式

---

**更新时间**：2026-03-24
**适用版本**：Next.js 16 + Vercel
