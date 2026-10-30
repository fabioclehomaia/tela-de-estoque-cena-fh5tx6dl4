import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { createCompra, updateCompra, Compra, CostCategory } from '@/services/compras'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

const COST_CATEGORIES: CostCategory[] = [
  'CMV',
  'Manutenção predial',
  'Utensílios',
  'Alimentação de funcionários',
  'Limpeza',
  'Descartáveis',
  'Decoração',
  'Operacional',
]

const avulsaSchema = z.object({
  description: z.string().min(1, 'A descrição da compra é obrigatória'),
  total_value: z.number().min(0.01, 'O valor total deve ser maior que zero'),
  cost_category: z.enum([
    'CMV',
    'Manutenção predial',
    'Utensílios',
    'Alimentação de funcionários',
    'Limpeza',
    'Descartáveis',
    'Decoração',
    'Operacional',
  ]),
  date: z.string().min(1, 'Data é obrigatória'),
  nota_fiscal: z.string().optional(),
  payment_term: z.string().optional(),
})

type AvulsaFormValues = z.infer<typeof avulsaSchema>

interface CompraAvulsaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingCompra?: Compra | null
  onSuccess: () => void
}

export function CompraAvulsaModal({
  open,
  onOpenChange,
  editingCompra,
  onSuccess,
}: CompraAvulsaModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AvulsaFormValues>({
    resolver: zodResolver(avulsaSchema),
    defaultValues: {
      description: editingCompra?.description || '',
      total_value: editingCompra ? (editingCompra.quantity || 1) * (editingCompra.price || 0) : 0,
      cost_category: (editingCompra?.cost_category as CostCategory) || 'CMV',
      date: editingCompra?.date
        ? editingCompra.date.split(' ')[0]
        : format(new Date(), 'yyyy-MM-dd'),
      nota_fiscal: editingCompra?.nota_fiscal || '',
      payment_term: editingCompra?.payment_term || '',
    },
  })

  // Sincronizar com o editingCompra quando abrir ou alterar
  useEffect(() => {
    if (open) {
      if (editingCompra) {
        form.reset({
          description: editingCompra.description || '',
          total_value: (editingCompra.quantity || 1) * (editingCompra.price || 0),
          cost_category: (editingCompra.cost_category as CostCategory) || 'CMV',
          date: editingCompra.date
            ? editingCompra.date.split(' ')[0]
            : format(new Date(), 'yyyy-MM-dd'),
          nota_fiscal: editingCompra.nota_fiscal || '',
          payment_term: editingCompra.payment_term || '',
        })
      } else {
        form.reset({
          description: '',
          total_value: 0,
          cost_category: 'CMV',
          date: format(new Date(), 'yyyy-MM-dd'),
          nota_fiscal: '',
          payment_term: '',
        })
      }
    }
  }, [open, editingCompra, form])

  const onSubmit = async (values: AvulsaFormValues) => {
    setIsSubmitting(true)
    try {
      const payload: Partial<Compra> = {
        description: values.description.trim(),
        cost_category: values.cost_category,
        quantity: 1,
        price: values.total_value,
        date: values.date,
        nota_fiscal: values.nota_fiscal?.trim() || undefined,
        payment_term: values.payment_term?.trim() || undefined,
        is_avulsa: true,
        // SEM produto e SEM fornecedor vinculados
        product_id: undefined,
        supplier_id: undefined,
      }

      if (editingCompra) {
        await updateCompra(editingCompra.id, payload)
        toast.success('Compra avulsa atualizada com sucesso!')
      } else {
        await createCompra(payload)
        toast.success('Compra avulsa registrada com sucesso!')
      }

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error('Erro ao salvar compra avulsa:', err)
      toast.error('Erro ao salvar compra avulsa: ' + (err.message || 'Verifique os dados.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editingCompra ? 'Editar Compra Avulsa' : 'Nova Compra Avulsa'}</DialogTitle>
          <p className="text-xs text-zinc-500">
            Registro rápido de despesa sem produto nem fornecedor cadastrados.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Livre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Compra de urgência na feira, hortifrúti extra, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="total_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0,00"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fonte de Custo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a fonte" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COST_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nota_fiscal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº Nota / Recibo (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 00123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment_term"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condição de Pagamento (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: À vista, PIX, 15 dias" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Compra Avulsa'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
