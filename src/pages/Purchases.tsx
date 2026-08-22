import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Plus, Edit, Trash2, ShoppingCart } from 'lucide-react'
import { getCompras, createCompra, updateCompra, deleteCompra, Compra } from '@/services/compras'
import { getProducts, Product } from '@/services/products'
import { getFornecedores, Fornecedor } from '@/services/fornecedores'
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

const schema = z.object({
  product_id: z.string().min(1, 'Selecione um produto'),
  supplier_id: z.string().min(1, 'Selecione um fornecedor'),
  quantity: z.number().min(0.0001, 'Inválido'),
  price: z.number().min(0, 'Inválido'),
  nota_fiscal: z.string().optional(),
  payment_term: z.string().optional(),
  date: z.string().min(1, 'Data é obrigatória'),
})

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const defaultValues = {
  product_id: '',
  supplier_id: '',
  quantity: 0,
  price: 0,
  nota_fiscal: '',
  payment_term: '',
  date: format(new Date(), 'yyyy-MM-dd'),
}

export default function Purchases() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Fornecedor[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const loadData = async () => {
    const [c, p, s] = await Promise.all([getCompras(), getProducts(), getFornecedores()])
    setCompras(c)
    setProducts(p)
    setSuppliers(s)
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('compras', loadData)
  useRealtime('fornecedores', loadData)
  useRealtime('products', loadData)

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const payload = {
        ...data,
        nota_fiscal: data.nota_fiscal || undefined,
        payment_term: data.payment_term || undefined,
      }
      if (editingId) await updateCompra(editingId, payload)
      else await createCompra(payload)
      setIsOpen(false)
      toast.success('Compra registrada com sucesso!')
    } catch (e) {
      const errs = extractFieldErrors(e)
      Object.keys(errs).forEach((k) => form.setError(k as any, { message: errs[k] }))
    }
  }

  const handleEdit = (c: Compra) => {
    setEditingId(c.id)
    form.reset({
      product_id: c.product_id,
      supplier_id: c.supplier_id,
      quantity: c.quantity || 0,
      price: c.price || 0,
      nota_fiscal: c.nota_fiscal || '',
      payment_term: c.payment_term || '',
      date: c.date ? c.date.split(' ')[0] : format(new Date(), 'yyyy-MM-dd'),
    })
    setIsOpen(true)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setEditingId(null)
      form.reset(defaultValues)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta compra?')) return
    try {
      await deleteCompra(id)
      toast.success('Compra excluída')
    } catch {
      toast.error('Erro ao excluir.')
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif text-emerald-900">Compras</h1>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setEditingId(null)
                form.reset(defaultValues)
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Nova Compra
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Compra' : 'Nova Compra'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="product_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produto</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.unit})
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
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fornecedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
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
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço Unitário (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
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
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nota_fiscal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nota Fiscal</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payment_term"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condição de Pagamento</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 30 dias" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Salvar
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3">
        {compras.map((c) => (
          <div
            key={c.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-zinc-200 rounded-lg shadow-sm gap-3"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900">{c.expand?.product_id?.name}</span>
                <span className="text-xs text-zinc-500">
                  {c.quantity} {c.expand?.product_id?.unit} × {formatCurrency(c.price)}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>{c.expand?.supplier_id?.name}</span>
                <span>{c.date ? format(new Date(c.date), 'dd/MM/yyyy') : ''}</span>
                {c.nota_fiscal && <span>NF: {c.nota_fiscal}</span>}
                {c.payment_term && <span>Pag: {c.payment_term}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-emerald-700">
                {formatCurrency(c.quantity * c.price)}
              </span>
              <Button size="icon" variant="ghost" onClick={() => handleEdit(c)}>
                <Edit className="w-4 h-4 text-zinc-500" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {compras.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center text-zinc-500 bg-white rounded-xl border border-dashed border-zinc-200">
            <ShoppingCart className="w-12 h-12 mb-3 text-zinc-300" />
            <p className="font-medium text-zinc-700 mb-1">Nenhuma compra registrada</p>
            <p className="text-sm text-zinc-400">
              Registre compras de produtos para análise de CMV.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
