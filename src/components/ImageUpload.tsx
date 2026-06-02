import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import pb from '@/lib/pocketbase/client'

interface ImageUploadProps {
  value: File | string | null
  onChange: (file: File | null) => void
  collectionId?: string
  recordId?: string
}

export function ImageUpload({ value, onChange, collectionId, recordId }: ImageUploadProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [activeTab, setActiveTab] = useState('upload')
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
  }

  const startCamera = async () => {
    setError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador não suporta acesso à câmera.')
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
      }
    } catch (e: any) {
      console.error('Camera access denied or unavailable', e)
      setError(e.message || 'Erro ao acessar a câmera. Verifique as permissões.')
    }
  }

  useEffect(() => {
    if (activeTab === 'camera' && !value) {
      startCamera()
    } else {
      stopCamera()
    }
    return stopCamera
  }, [activeTab, value])

  const capture = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(videoRef.current, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
          onChange(file)
          stopCamera()
        }
      },
      'image/jpeg',
      0.8,
    )
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onChange(e.target.files[0])
    }
  }

  const handleRemove = () => {
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (activeTab === 'camera') {
      startCamera()
    }
  }

  let imageUrl: string | null = null
  if (value instanceof File) {
    imageUrl = URL.createObjectURL(value)
  } else if (typeof value === 'string' && value && collectionId && recordId) {
    imageUrl = `${pb.baseUrl}/api/files/${collectionId}/${recordId}/${value}`
  }

  if (imageUrl) {
    return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 flex items-center justify-center">
        <img src={imageUrl} alt="Preview" className="object-contain w-full h-full" />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md"
          onClick={handleRemove}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full border border-zinc-200 rounded-lg p-2 bg-zinc-50/50">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-2">
          <TabsTrigger value="upload" className="text-xs flex items-center gap-2">
            <Upload className="w-3.5 h-3.5" /> Arquivo
          </TabsTrigger>
          <TabsTrigger value="camera" className="text-xs flex items-center gap-2">
            <Camera className="w-3.5 h-3.5" /> Câmera
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-0">
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-200 rounded-md bg-white">
            <ImageIcon className="w-8 h-8 text-zinc-300 mb-2" />
            <p className="text-xs text-zinc-500 mb-4 text-center">
              Selecione uma imagem do seu dispositivo
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Procurar Arquivo
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFile}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
          </div>
        </TabsContent>
        <TabsContent value="camera" className="mt-0">
          <div className="flex flex-col items-center justify-center p-2 border border-zinc-200 rounded-md bg-black w-full aspect-video relative overflow-hidden">
            {error ? (
              <div className="text-red-400 text-xs flex flex-col items-center p-4 text-center gap-2">
                <AlertCircle className="w-6 h-6" />
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startCamera}
                  className="mt-2 text-zinc-800"
                >
                  Tentar Novamente
                </Button>
              </div>
            ) : stream ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  onClick={capture}
                  className="absolute bottom-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center gap-2 px-6"
                >
                  <Camera className="w-4 h-4" /> Capturar
                </Button>
              </>
            ) : (
              <div className="text-zinc-500 text-xs flex flex-col items-center">
                <Camera className="w-6 h-6 mb-2 opacity-50" />
                <span>Iniciando câmera...</span>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
