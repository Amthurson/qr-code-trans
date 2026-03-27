# 基于 Qrs 项目的喷泉码重构进度

> 重构目标：使用 Luby Transform 喷泉码替代原有的简单编码方案  
> 参考项目：`C:\John\code\mosai\project-materials\develop\qrs`  
> 最后更新：2026-03-27 16:00

---

## 📊 重构进度

### ✅ 已完成（2026-03-27 16:00）

#### 1. 核心库实现
- [x] **LT 编码器** (`src/lib/lt-encoder.ts`)
  - ✅ Luby Transform 编码算法
  - ✅ 理想孤波分布（Ideal Soliton Distribution）
  - ✅ 喷泉模式无限生成编码块
  - ✅ 二进制序列化/反序列化
  - ✅ Base64 编码转换

- [x] **LT 解码器** (`src/lib/lt-decoder.ts`)
  - ✅ LT 解码算法实现
  - ✅ XOR 传播解码
  - ✅ 进度追踪
  - ✅ 校验和验证

#### 2. React Hooks
- [x] **useQrFountain** (`src/hooks/useQrFountain.ts`)
  - ✅ 二维码流生成
  - ✅ FPS 控制
  - ✅ 实时比特率计算
  - ✅ 错误处理

- [x] **useQrScanner** (`src/hooks/useQrScanner.ts`)
  - ✅ 摄像头扫码（集成 qr-scanner）
  - ✅ 自动去重
  - ✅ 进度反馈
  - ✅ 解码完成回调

#### 3. 页面组件
- [x] **患者端** (`src/app/patient/page.tsx`)
  - ✅ 问卷表单
  - ✅ 喷泉码二维码生成
  - ✅ 集成 QrCodeDisplay 组件
  - ✅ 实时状态显示

- [x] **医院端** (`src/app/hospital/page.tsx`)
  - ✅ 摄像头扫码模式
  - ✅ 手动输入模式
  - ✅ 进度显示
  - ✅ 解码结果展示

- [x] **测试页面** (`src/app/test/page.tsx`)
  - ✅ 编码/解码流程验证
  - ✅ 实时日志显示
  - ✅ 进度可视化

#### 4. 文件传输功能（新增）
- [x] **文件传输首页** (`src/app/file-transfer/page.tsx`)
  - ✅ 功能介绍
  - ✅ 发送/接收入口
  - ✅ 核心特性展示

- [x] **发送端** (`src/app/file-transfer/send/page.tsx`)
  - ✅ 文件选择
  - ✅ 元数据封装（文件名、类型、大小）
  - ✅ 喷泉码二维码生成
  - ✅ 实时统计（文件大小/预估时间/比特率）

- [x] **接收端** (`src/app/file-transfer/receive/page.tsx`)
  - ✅ 摄像头扫码模式
  - ✅ 手动输入模式
  - ✅ 文件元数据提取
  - ✅ 文件重组与下载

#### 5. 组件库
- [x] **QrCodeDisplay** (`src/components/QrCodeDisplay.tsx`)
  - ✅ uqr 集成
  - ✅ SVG 渲染
  - ✅ 错误处理
  - ✅ 尺寸/边框配置

#### 6. 依赖安装
- [x] pako (压缩/解压)
- [x] js-base64 (Base64 编码)
- [x] qr-scanner (二维码识别)
- [x] uqr (二维码生成)

---

## 📁 完整文件结构

```
src/
├── lib/
│   ├── lt-encoder.ts      # LT 编码器
│   └── lt-decoder.ts       # LT 解码器
├── hooks/
│   ├── useQrFountain.ts    # 二维码流生成
│   └── useQrScanner.ts     # 摄像头扫码
├── components/
│   └── QrCodeDisplay.tsx   # 二维码渲染组件
└── app/
    ├── page.tsx            # 首页（4 个入口 + 文件传输）
    ├── patient/page.tsx    # 患者端
    ├── hospital/page.tsx   # 医院端
    ├── test/page.tsx       # 测试页面
    ├── share/page.tsx      # 问卷二维码（原有）
    ├── stress-test/page.tsx # 极限测试（原有）
    └── file-transfer/
        ├── page.tsx        # 文件传输首页
        ├── send/page.tsx   # 发送端
        └── receive/page.tsx # 接收端
```

---

## 🚀 使用示例

### 文件传输 - 发送端

```typescript
// 选择文件后自动处理
const handleFileChange = async (file: File) => {
  const buffer = await file.arrayBuffer()
  const uint8Data = new Uint8Array(buffer)
  
  // 添加文件元数据
  const meta = {
    filename: file.name,
    contentType: file.type,
    size: file.size,
  }
  
  // 合并元数据和文件数据
  const combinedData = mergeMetaAndData(meta, uint8Data)
  setFileData(combinedData)
}

// 使用喷泉码生成二维码
const { qrData } = useQrFountain({
  data: fileData,
  sliceSize: 1000,
  fps: 20,
})
```

### 文件传输 - 接收端

```typescript
// 扫码解码
const {
  videoRef,
  isScanning,
  progress,
  startScan,
} = useQrScanner({
  onDecoded: (data) => {
    // 提取元数据 [metaLength(4)][meta][fileData]
    const metaLength = view.getUint32(0)
    const meta = JSON.parse(metaJson)
    const fileData = data.slice(4 + metaLength)
    
    // 创建下载链接
    const blob = new Blob([fileData])
    download(blob, meta.filename)
  },
})
```

---

## 📊 功能对比

| 功能 | 问卷传输 | 文件传输 |
|------|---------|---------|
| **数据类型** | JSON 问卷答案 | 任意二进制文件 |
| **编码方式** | 喷泉码 | 喷泉码 |
| **元数据** | version, type, timestamp | filename, contentType, size |
| **二维码容量** | ~650 字符 | 分片传输，无上限 |
| **传输时间** | 即时 | 取决于文件大小 |
| **预估时间** | - | 文件大小 / (sliceSize × FPS) |

---

## 🎯 下一步计划

### 立即可做
1. [ ] 测试完整流程（发送端 → 接收端）
2. [ ] 修复可能的 bug
3. [ ] 优化 UI/UX

### 短期优化
1. [ ] Web Worker 解码（避免阻塞 UI）
2. [ ] 断点续传支持
3. [ ] 传输进度持久化

### 长期增强
1. [ ] 多语言支持
2. [ ] 暗色模式
3. [ ] PWA 支持（离线可用）

---

## 📚 部署步骤

### 1. 推送到 Git

```bash
cd /mnt/c/John/code/mosai/project-materials/develop/offline-questionnaire-qrcode
git add .
git commit -m "feat: 基于喷泉码实现离线文件传输功能"
git push
```

### 2. 自动部署（Vercel）

项目已配置 Vercel 自动部署：
- 推送到 `main` 分支自动部署到生产环境
- 推送到其他分支自动部署到预览环境

### 3. 访问地址

- **生产环境**: `https://qr-trans.test.conova.withinfuel.com`
- **文件传输**: `https://qr-trans.test.conova.withinfuel.com/file-transfer`

---

## ✅ 完成清单

- [x] LT 编码器/解码器实现
- [x] React Hooks（useQrFountain / useQrScanner）
- [x] QrCodeDisplay 组件
- [x] 患者端页面
- [x] 医院端页面
- [x] 测试页面
- [x] 文件传输首页
- [x] 文件传输发送端
- [x] 文件传输接收端
- [x] 首页更新（添加文件传输入口）
- [ ] 完整流程测试
- [ ] 部署到 Vercel

---

**状态**: 🟢 核心功能已完成，准备测试和部署
