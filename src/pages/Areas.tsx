import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { getAreas, createArea, updateArea, deleteArea, Area } from '@/services/inventory'
import { useRealtime } from '@/hooks/use-realtime'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const schema = z.object({ name: z.string().min(1, 'Nome é obrigatório') })

export default function Areas() {
  const [areas, setAreas] = useState<Area[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  })

  const loadData = async () => setAreas(await getAreas())
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('areas', loadData)

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      if (editingId) await updateArea(editingId, data)
      else await createArea(data)
      setIsOpen(false)
      toast.success('Área salva com sucesso!')
    } catch (e) {
      const errs = extractFieldErrors(e)
      Object.keys(errs).forEach((k) => form.setError(k as any, { message: errs[k] }))
    }
  }

  const handleEdit = (item: Area) => {
    setEditingId(item.id)
    form.reset({ name: item.name })
    setIsOpen(true)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setEditingId(null)
      form.reset({ name: '' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta área?')) return
    try {
      await deleteArea(id)
      toast.success('Área excluída')
    } catch (e) {
      toast.error('Erro ao excluir. Pode haver itens dependentes.')
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif text-emerald-900">Áreas</h1>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Nova Área
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Área' : 'Nova Área'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Área</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Cozinha" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Salvar
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {areas.map((area) => (
          <div
            key={area.id}
            className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-lg shadow-sm"
          >
            <span className="font-medium text-zinc-900">{area.name}</span>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => handleEdit(area)}>
                <Edit className="w-4 h-4 text-zinc-500" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(area.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {areas.length === 0 && (
          <p className="text-zinc-500 text-center py-8">Nenhuma área cadastrada.</p>
        )}
      </div>
    </div>
  )
}
