import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react'
import {
  getFaturamentos,
  createFaturamento,
  updateFaturamento,
  deleteFaturamento,
  type Faturamento as FaturamentoType,
} from '@/services/faturamento'
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
import { PeriodSelector, PeriodRange } from '@/components/shared/PeriodSelector'

const schema = z.object({
  period_start: z.string().min(1, 'Data inicial obrigatória'),
  period_end: z.string().min(1, 'Data final obrigatória'),
  value: z.number().min(0, 'Valor inválido'),
})

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function Faturamento() {
  const [records, setRecords] = useState<FaturamentoType[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodRange>({ start: '', end: '' })

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { period_start: '', period_end: '', value: 0 },
  })

  const loadData = async () => setRecords(await getFaturamentos())
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('faturamento', loadData)

  useEffect(() => {
    if (period.start && period.end) {
      form.setValue('period_start', period.start)
      form.setValue('period_end', period.end)
    }
  }, [period])

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      if (editingId) await updateFaturamento(editingId, data)
      else await createFaturamento(data)
      setIsOpen(false)
      toast.success('Faturamento salvo com sucesso!')
    } catch (e) {
      const errs = extractFieldErrors(e)
      Object.keys(errs).forEach((k) => form.setError(k as any, { message: errs[k] }))
    }
  }

  const handleEdit = (f: FaturamentoType) => {
    setEditingId(f.id)
    form.reset({
      period_start: f.period_start ? f.period_start.split(' ')[0] : '',
      period_end: f.period_end ? f.period_end.split(' ')[0] : '',
      value: f.value || 0,
    })
    setIsOpen(true)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setEditingId(null)
      form.reset({ period_start: '', period_end: '', value: 0 })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este faturamento?')) return
    try {
      await deleteFaturamento(id)
      toast.success('Faturamento excluído')
    } catch {
      toast.error('Erro ao excluir.')
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif text-emerald-900">Faturamento</h1>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setEditingId(null)
                form.reset({ period_start: period.start, period_end: period.end, value: 0 })
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Novo Faturamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Faturamento' : 'Novo Faturamento'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="period_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período Início</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="period_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período Fim</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Faturamento (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="0,00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                          }
                        />
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
      <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>
      <div className="grid gap-3">
        {records.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-lg shadow-sm"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-zinc-900">{formatCurrency(f.value)}</span>
              <span className="text-sm text-zinc-500">
                {f.period_start ? format(new Date(f.period_start), 'dd/MM/yyyy') : ''} —{' '}
                {f.period_end ? format(new Date(f.period_end), 'dd/MM/yyyy') : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => handleEdit(f)}>
                <Edit className="w-4 h-4 text-zinc-500" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(f.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center text-zinc-500 bg-white rounded-xl border border-dashed border-zinc-200">
            <DollarSign className="w-12 h-12 mb-3 text-zinc-300" />
            <p className="font-medium text-zinc-700 mb-1">Nenhum faturamento registrado</p>
            <p className="text-sm text-zinc-400">
              Registre o faturamento por período para calcular o CMV.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
