import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit, Trash2 } from 'lucide-react'
import {
  getSubareas,
  createSubarea,
  updateSubarea,
  deleteSubarea,
  getAreas,
  Subarea,
  Area,
} from '@/services/inventory'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  area_id: z.string().min(1, 'Selecione uma área'),
})

export default function Subareas() {
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', area_id: '' },
  })

  const loadData = async () => {
    setSubareas(await getSubareas())
    setAreas(await getAreas())
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('subareas', loadData)
  useRealtime('areas', loadData)

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      if (editingId) await updateSubarea(editingId, data)
      else await createSubarea(data)
      setIsOpen(false)
      toast.success('Subárea salva com sucesso!')
    } catch (e) {
      const errs = extractFieldErrors(e)
      Object.keys(errs).forEach((k) => form.setError(k as any, { message: errs[k] }))
    }
  }

  const handleEdit = (item: Subarea) => {
    setEditingId(item.id)
    form.reset({ name: item.name, area_id: item.area_id })
    setIsOpen(true)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setEditingId(null)
      form.reset({ name: '', area_id: '' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta subárea?')) return
    try {
      await deleteSubarea(id)
      toast.success('Subárea excluída')
    } catch (e) {
      toast.error('Erro ao excluir.')
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif text-emerald-900">Subáreas</h1>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Nova Subárea
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Subárea' : 'Nova Subárea'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="area_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área Pai</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a área..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {areas.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Subárea</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Geladeira" {...field} />
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
        {subareas.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-lg shadow-sm"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium text-zinc-900">{sub.name}</span>
              {sub.expand?.area_id && (
                <Badge
                  variant="secondary"
                  className="w-fit text-[10px] bg-emerald-50 text-emerald-700"
                >
                  {sub.expand.area_id.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => handleEdit(sub)}>
                <Edit className="w-4 h-4 text-zinc-500" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(sub.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {subareas.length === 0 && (
          <p className="text-zinc-500 text-center py-8">Nenhuma subárea cadastrada.</p>
        )}
      </div>
    </div>
  )
}
