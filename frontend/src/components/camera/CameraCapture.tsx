'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { Camera, RefreshCcw, Upload, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void
  aspectRatio?: number
  className?: string
}

function isSamsungInternet(): boolean {
  if (typeof navigator === 'undefined') return false
  return /SamsungBrowser/i.test(navigator.userAgent)
}

export default function CameraCapture({
  onCapture,
  aspectRatio = 3 / 4,
  className,
}: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  )
  const [permissionError, setPermissionError] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [forceFallback, setForceFallback] = useState(false)

  // Samsung Internet has unreliable MediaDevices API — fall back to file input
  useEffect(() => {
    if (isSamsungInternet()) {
      setForceFallback(true)
    }
  }, [])

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      onCapture(imageSrc)
    }
  }, [onCapture])

  const handleFlip = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
    setCameraReady(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      if (ev.target?.result) {
        onCapture(ev.target.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleUserMediaError = () => {
    setPermissionError(true)
  }

  if (forceFallback || permissionError) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-zinc-900 rounded-2xl p-8 gap-4',
          className
        )}
      >
        {permissionError && (
          <div className="flex items-center gap-2 text-amber-400 text-sm text-center">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Camera permission denied. Please upload a photo instead.</span>
          </div>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-3 w-full py-8 border-2 border-dashed border-zinc-700 rounded-xl hover:border-zinc-500 transition-colors active:scale-[0.98]"
        >
          <Upload className="w-10 h-10 text-zinc-400" />
          <span className="text-zinc-300 font-medium">Choose from Gallery</span>
          <span className="text-zinc-500 text-xs">or tap to browse files</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {permissionError && !forceFallback && (
          <button
            onClick={() => setPermissionError(false)}
            className="text-zinc-500 text-sm underline"
          >
            Try camera again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('relative bg-black rounded-2xl overflow-hidden', className)}>
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        screenshotQuality={0.92}
        videoConstraints={{
          facingMode: { ideal: facingMode },
          aspectRatio,
        }}
        onUserMedia={() => setCameraReady(true)}
        onUserMediaError={handleUserMediaError}
        className="w-full h-full object-cover"
        style={{ aspectRatio }}
        mirrored={facingMode === 'user'}
      />

      {/* Loading overlay */}
      {!cameraReady && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        </div>
      )}

      {/* Camera controls overlay */}
      <div className="camera-overlay">
        <div className="flex items-center gap-6">
          {/* Flip button */}
          <button
            onClick={handleFlip}
            className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm active:scale-90 transition-transform"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>

          {/* Capture button */}
          <button
            onClick={handleCapture}
            disabled={!cameraReady}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
          >
            <Camera className="w-7 h-7 text-white" />
          </button>

          {/* Gallery fallback */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm active:scale-90 transition-transform"
          >
            <Upload className="w-5 h-5" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
