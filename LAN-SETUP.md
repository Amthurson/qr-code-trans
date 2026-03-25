# 🚀 局域网访问解决方案

> 解决 Next.js 开发服务器 IP 访问时 WebSocket 报错问题

---

## ❌ 问题原因

Next.js 开发服务器（`next dev`）使用 WebSocket 进行热更新（HMR），但出于安全考虑：
- ✅ **localhost** 访问：允许 WebSocket 连接
- ❌ **IP 地址** 访问：阻止 WebSocket 连接（403 Forbidden）

**影响**：
- 页面 JavaScript 可能无法正常加载
- 按钮点击无反应
- 功能完全失效

---

## ✅ 解决方案：使用生产模式

生产模式（`next start`）不使用 WebSocket，完美支持局域网访问。

---

## 📋 操作步骤

### 方式 1：使用启动脚本（推荐）⭐

在 **Windows PowerShell** 中运行：

```powershell
cd C:\John\code\mosai\project-materials\develop\offline-questionnaire-qrcode

# 运行启动脚本
.\scripts\start-lan.ps1
```

脚本会自动：
1. 检查是否已构建
2. 首次运行时自动构建
3. 启动生产服务器
4. 显示访问地址

---

### 方式 2：手动构建和启动

```powershell
cd C:\John\code\mosai\project-materials\develop\offline-questionnaire-qrcode

# 1. 构建生产版本
pnpm build

# 2. 启动生产服务器（绑定所有网络接口）
pnpm start -- -H 0.0.0.0 -p 3000
```

---

## 📱 访问地址

启动后显示：
```
✓ Ready in xxx ms
- Local:   http://localhost:3000
- Network: http://192.168.31.99:3000
```

**手机访问**：
```
http://192.168.31.99:3000
```

**所有页面**：
| 页面 | 地址 |
|------|------|
| 首页 | `http://192.168.31.99:3000/` |
| 患者端 | `http://192.168.31.99:3000/patient` |
| 医院端（扫码） | `http://192.168.31.99:3000/hospital` |
| 问卷二维码 | `http://192.168.31.99:3000/share` |

---

## ⚠️ 注意事项

### 开发 vs 生产模式

| 特性 | 开发模式 (next dev) | 生产模式 (next start) |
|------|-------------------|---------------------|
| 局域网访问 | ❌ 有问题 | ✅ 完美支持 |
| 热更新 | ✅ 自动刷新 | ❌ 需手动刷新 |
| 启动速度 | ⚡ 快 | 🐢 慢（需构建） |
| 性能优化 | ❌ 无 | ✅ 完整优化 |
| WebSocket | ✅ 有 | ❌ 无 |

### 修改代码后

生产模式下，修改代码需要重新构建：

```powershell
# 停止服务器（Ctrl+C）

# 重新构建
pnpm build

# 重新启动
pnpm start -- -H 0.0.0.0 -p 3000
```

**或者**：开发时用开发模式（localhost 访问），测试时用生产模式。

---

## 🔧 扫码功能（需要摄像头）

生产模式使用 HTTP，但摄像头需要 HTTPS 或 localhost。

### 方案 A：手机浏览器允许 HTTP 摄像头

某些 Android 浏览器允许 HTTP 访问摄像头：
1. 访问 `http://192.168.31.99:3000/hospital`
2. 切换到"扫码识别"
3. 授权摄像头权限

### 方案 B：使用 HTTPS（需要证书）

```powershell
# 生成证书
pnpm run cert:gen

# 启动 HTTPS 生产服务器
node server.mjs
```

然后访问：
```
https://192.168.31.99:3000/hospital
```

**注意**：需要在手机浏览器中手动信任证书。

### 方案 C：使用 Vite（推荐用于开发）

如果经常需要测试扫码功能，建议切换到 Vite：

```powershell
# 创建 Vite 项目
npm create vite@latest questionnaire-vite -- --template react-ts
cd questionnaire-vite
npm install

# 配置 vite.config.ts
# server: { host: '0.0.0.0', https: true }

# 启动
npm run dev
```

---

## 🎯 快速测试

```powershell
# 1. 运行启动脚本
.\scripts\start-lan.ps1

# 2. 手机访问
http://192.168.31.99:3000

# 3. 测试功能
# - 首页按钮点击
# - 患者端填写问卷
# - 生成数据二维码
# - 医院端扫码
```

---

## 📞 遇到问题？

### Q: 构建失败
```powershell
# 清理并重新安装
rm -r node_modules
rm pnpm-lock.yaml
pnpm install
pnpm build
```

### Q: 手机无法访问
- 检查防火墙：`Set-NetFirewallProfile -Enabled False`（临时）
- 确认同一 WiFi
- 检查 IP 是否正确：`ipconfig`

### Q: 摄像头无法使用
- 使用 HTTPS：`pnpm run cert:gen` + `node server.mjs`
- 或在浏览器中信任证书

---

**更新时间**：2026-03-24  
**适用系统**：Windows 10/11
