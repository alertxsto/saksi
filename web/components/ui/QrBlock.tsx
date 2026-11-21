'use client'

import { QRCodeSVG } from 'qrcode.react'

export function QrBlock({ value, label, dark }: { value: string; label: string; dark?: boolean }) {
  return (
    <QRCodeSVG
      value={value}
      size={512}
      level="M"
      bgColor={dark ? '#24211D' : '#FBFAF7'}
      fgColor={dark ? '#EDE9E1' : '#1E1A16'}
      className="h-auto w-full"
      title={label}
    />
  )
}
