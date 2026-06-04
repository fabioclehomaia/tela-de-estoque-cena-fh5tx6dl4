import { useState, useRef } from 'react'
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

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
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
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
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
