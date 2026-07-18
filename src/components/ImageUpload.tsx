import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

const MAX_FILE_SIZE = 5242880
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface ImageUploadProps {
  value: File | string | null
  onChange: (file: File | null) => void
  collectionId?: string
  recordId?: string
}

export function ImageUpload({ value, onChange, collectionId, recordId }: ImageUploadProps) {
  const [activeTab, setActiveTab] = useState('upload')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setError(null)
  }, [value])

  const validateFile = (file: File): boolean => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      const msg = 'Formato não suportado. Use JPEG, PNG ou WebP.'
      setError(msg)
      toast.error(msg)
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      const msg = `Arquivo muito grande (${(file.size / 1048576).toFixed(1)}MB). Máximo: 5MB.`
      setError(msg)
      toast.error(msg)
      return false
    }
    setError(null)
    return true
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      toast.error('Nenhuma imagem capturada. Tente novamente.')
      return
    }
    if (file.size === 0) {
      toast.error('A imagem capturada está vazia. Verifique as permissões da câmera.')
      e.target.value = ''
      return
    }
    if (validateFile(file)) {
      onChange(file)
    }
    e.target.value = ''
  }

  const handleRemove = () => {
    onChange(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const handleCameraError = () => {
    const msg = 'Não foi possível acessar a câmera. Verifique as permissões do navegador.'
    setError(msg)
    toast.error(msg)
  }

  let imageUrl: string | null = null
  if (value instanceof File) {
    imageUrl = URL.createObjectURL(value)
  } else if (typeof value === 'string' && value && collectionId && recordId) {
    imageUrl = `${pb.baseUrl}/api/files/${collectionId}/${recordId}/${value}`
  }

  useEffect(() => {
    if (value instanceof File) {
      return () => URL.revokeObjectURL(imageUrl!)
    }
  }, [value, imageUrl])

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
    <div className="w-full">
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
                accept={ACCEPTED_TYPES.join(',')}
                className="hidden"
              />
            </div>
          </TabsContent>
          <TabsContent value="camera" className="mt-0">
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-200 rounded-md bg-white">
              <Camera className="w-8 h-8 text-zinc-300 mb-2" />
              <p className="text-xs text-zinc-500 mb-4 text-center">
                Tire uma foto usando a câmera do seu dispositivo
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
              >
                Abrir Câmera
              </Button>
              <input
                type="file"
                ref={cameraInputRef}
                onChange={handleFile}
                onError={handleCameraError}
                accept={ACCEPTED_TYPES.join(',')}
                capture="environment"
                className="hidden"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {error && (
        <div className="flex items-center gap-2 mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <p className="text-[11px] text-zinc-400 mt-1.5 px-1">JPEG, PNG ou WebP · Máximo 5MB</p>
    </div>
  )
}
