/**
 * 二维码渲染组件 - 使用 uqr 库
 */

'use client'

import { useEffect, useState } from 'react'
import { renderSVG } from 'uqr'

interface QrCodeDisplayProps {
  data: string // Base64 编码的数据
  size?: number
  border?: number
  className?: string
}

export default function QrCodeDisplay({
  data,
  size = 300,
  border = 4,
  className = '',
}: QrCodeDisplayProps) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // 渲染二维码
  useEffect(() => {
    if (!data) {
      setSvg('')
      return
    }

    try {
      // 使用 uqr 渲染 SVG
      const svgString = renderSVG(data, {
        border,
      })
      setSvg(svgString)
      setError(null)
    } catch (e) {
      console.error('二维码渲染失败:', e)
      setError(e instanceof Error ? e.message : '渲染失败')
    }
  }, [data, size, border])

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <p className="text-red-600 text-sm text-center">
          ❌ 渲染失败<br/>
          {error}
        </p>
      </div>
    )
  }

  if (!svg) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-lg animate-pulse ${className}`}
        style={{ width: size, height: size }}
      >
        <p className="text-gray-500 text-sm">生成中...</p>
      </div>
    )
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
