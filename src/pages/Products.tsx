import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit, Trash2, PackageSearch, Layers } from 'lucide-react'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  Product,
} from '@/services/products'
import { getCategories, Category } from '@/services/inventory'
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
  unit: z.enum(['kg', 'litro', 'unidade', 'caixa'], { required_error: 'Selecione uma unidade' }),
  validity_days: z
    .string()
    .transform((v) => (v ? Number(v) : null))
    .optional(),
  min_stock: z
    .string()
    .transform((v) => (v ? Number(v) : null))
    .optional(),
  category_id: z.string().min(1, 'Selecione a categoria'),
})

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      unit: undefined,
      validity_days: undefined as any,
      min_stock: undefined as any,
      category_id: '',
    },
  })

  const loadData = async () => {
    setProducts(await getProducts())
    setCategories(await getCategories())
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('products', loadData)

  const onSubmit = async (data: any) => {
    try {
      if (editingId) await updateProduct(editingId, data)
      else await createProduct(data)
      setIsOpen(false)
      toast.success('Produto salvo com sucesso!')
    } catch (e) {
      const errs = extractFieldErrors(e)
      Object.keys(errs).forEach((k) => form.setError(k as any, { message: errs[k] }))
    }
  }

  const handleEdit = (p: Product) => {
    setEditingId(p.id)
    form.reset({
      name: p.name,
      unit: p.unit,
      validity_days: p.validity_days?.toString() as any,
      min_stock: p.min_stock?.toString() as any,
      category_id: p.category_id,
    })
    setIsOpen(true)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setEditingId(null)
      form.reset({
        name: '',
        unit: undefined,
        validity_days: undefined as any,
        min_stock: undefined as any,
        category_id: '',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este produto?')) return
    try {
      await deleteProduct(id)
      toast.success('Produto excluído')
    } catch (e) {
      toast.error('Erro ao excluir.')
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif text-emerald-900">Produtos</h1>
        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 hidden sm:flex"
          >
            <Link to="/inventory-levels">
              <Layers className="w-4 h-4 mr-2" />
              Vincular a Subáreas
            </Link>
          </Button>
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Novo Produto</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidade</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Uni" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="kg">Kg</SelectItem>
                              <SelectItem value="litro">Litro</SelectItem>
                              <SelectItem value="unidade">Unid</SelectItem>
                              <SelectItem value="caixa">Caixa</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="validity_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Validade (dias)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="min_stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estoque Min</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                    Salvar
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="sm:hidden mb-2">
        <Button
          asChild
          variant="outline"
          className="w-full text-emerald-700 border-emerald-200 hover:bg-emerald-50"
        >
          <Link to="/inventory-levels">
            <Layers className="w-4 h-4 mr-2" />
            Vincular a Subáreas
          </Link>
        </Button>
      </div>

      <div className="grid gap-3">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-lg shadow-sm"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium text-zinc-900">
                {p.name} <span className="text-xs text-zinc-500 ml-1">({p.unit})</span>
              </span>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px] text-zinc-600 border-zinc-200">
                  {p.expand?.category_id?.name}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => handleEdit(p)}>
                <Edit className="w-4 h-4 text-zinc-500" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center text-zinc-500">
            <PackageSearch className="w-12 h-12 mb-3 text-zinc-300" />
            <p>Nenhum produto encontrado.</p>
          </div>
        )}
      </div>
    </div>
  )
}
