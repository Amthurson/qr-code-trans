# 局域网访问启动脚本（Windows）
# 解决 IP 访问时 WebSocket 报错问题

Write-Host "🚀 启动离线问卷系统（生产模式）" -ForegroundColor Green
Write-Host ""

# 检查是否已构建
if (-not (Test-Path ".next")) {
    Write-Host "📦 首次构建，请稍候..." -ForegroundColor Yellow
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 构建失败" -ForegroundColor Red
        exit 1
    }
}

# 获取本机 IP
$IP = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1 -ExpandProperty IPAddress

Write-Host "✅ 构建完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📍 访问地址：" -ForegroundColor Cyan
Write-Host "   本地：http://localhost:3000"
Write-Host "   局域网：http://$IP`:3000"
Write-Host ""
Write-Host "📱 页面列表：" -ForegroundColor Cyan
Write-Host "   首页：http://$IP`:3000/"
Write-Host "   患者端：http://$IP`:3000/patient"
Write-Host "   医院端：http://$IP`:3000/hospital"
Write-Host "   问卷二维码：http://$IP`:3000/share"
Write-Host ""
Write-Host "⚠️  按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

# 启动生产服务器
pnpm start -- -H 0.0.0.0 -p 3000
