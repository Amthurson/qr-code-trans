# 交互问题排查指南

> 如果按钮点击没反应，请按以下步骤排查

---

## 🔍 快速诊断

### 方案 A：使用独立测试页面（推荐）

**访问地址**：
```
http://192.168.31.99:3000/test-qr.html
```

这个页面：
- ✅ 使用 CDN 加载 qrcode 库
- ✅ 纯 HTML 无框架依赖
- ✅ 详细的日志输出
- ✅ 实时显示错误信息

**测试步骤**：
1. 打开 `http://192.168.31.99:3000/test-qr.html`
2. 点击"测试生成二维码"按钮
3. 查看日志输出
4. 如果成功，说明库没问题，是 React 代码的问题

---

### 方案 B：浏览器控制台调试

**步骤**：

1. **打开开发者工具**
   - 按 `F12` 或右键 → 检查
   - 切换到 Console 标签

2. **刷新页面**
   - 按 `Ctrl + Shift + R` 强制刷新

3. **点击按钮**
   - 观察控制台输出

4. **查看错误信息**
   - 红色的是错误
   - 截图发给我

---

## 🐛 常见问题

### 问题 1：按钮点击没反应

**可能原因**：
- JavaScript 加载失败
- React 组件渲染问题
- 事件绑定失败

**检查方法**：
```javascript
// 在控制台输入
document.querySelector('button')
// 应该返回按钮元素
```

---

### 问题 2：QRCode 库未定义

**错误信息**：
```
TypeError: Cannot read property 'toCanvas' of undefined
```

**原因**：
- 依赖未安装
- 导入路径错误

**解决**：
```powershell
cd C:\John\code\mosai\project-materials\develop\offline-questionnaire-qrcode
npm install qrcode
```

---

### 问题 3：Canvas 元素未找到

**错误信息**：
```
Error: Canvas 元素未找到
```

**原因**：
- DOM 未渲染完成
- ID 不匹配

**解决**：
- 检查代码中的 `id="qrCanvas"` 是否存在
- 添加延迟等待渲染

---

## 🧪 手动测试

在浏览器控制台输入以下代码测试：

```javascript
// 1. 检查 QRCode 库
console.log('QRCode:', typeof QRCode);

// 2. 检查 Canvas
const canvas = document.createElement('canvas');
console.log('Canvas:', !!canvas.getContext);

// 3. 测试生成
const testUrl = 'http://192.168.31.99:3000';
QRCode.toCanvas(canvas, testUrl, (err) => {
  if (err) {
    console.error('失败:', err);
  } else {
    console.log('成功!');
    document.body.appendChild(canvas);
  }
});
```

---

## 📋 检查清单

- [ ] 能访问 `http://192.168.31.99:3000`
- [ ] 能访问 `http://192.168.31.99:3000/test-qr.html`
- [ ] 独立测试页面能生成二维码
- [ ] 浏览器控制台无红色错误
- [ ] 按钮点击有 console.log 输出

---

## 🎯 下一步

### 如果独立测试页面成功：
说明是 React 代码的问题，我需要：
- 检查组件渲染
- 检查事件绑定
- 检查状态更新

### 如果独立测试页面也失败：
说明是环境或库的问题，我需要：
- 检查 qrcode 库安装
- 检查浏览器兼容性
- 检查网络连接

---

## 📞 反馈

请告诉我：
1. 独立测试页面能否访问？
2. 点击按钮后控制台显示什么？
3. 截图错误信息

---

**更新时间**：2026-03-24
