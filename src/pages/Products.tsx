import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit, Trash2, PackageSearch, MapPin, ImageIcon } from 'lucide-react'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  Product,
} from '@/services/products'
import { getCategories, Category, getSubareas, Subarea, Area } from '@/services/inventory'
import { useAuth } from '@/hooks/use-auth'
import {
  getInventoryLevels,
  createInventoryLevel,
  updateInventoryLevel,
  deleteInventoryLevel,
  InventoryLevel,
} from '@/services/inventory_levels'
import { useRealtime } from '@/hooks/use-realtime'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
import { ImageUpload } from '@/components/ImageUpload'
import pb from '@/lib/pocketbase/client'

const locationSchema = z.object({
  area_id: z.string().min(1, 'Selecione a área'),
  subarea_id: z.string().min(1, 'Selecione a subárea'),
  quantity: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, 'Inválido')
    .transform(Number),
  existingLevelId: z.string().optional(),
})

const schema = z
  .object({
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
    price: z
      .string()
      .transform((v) => (v ? Number(v) : null))
      .optional(),
    category_id: z.string().min(1, 'Selecione a categoria'),
    locations: z.array(locationSchema).optional().default([]),
    image: z.any().optional(),
    active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const ids = data.locations?.map((l) => l.subarea_id) || []
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Não é possível adicionar a mesma subárea mais de uma vez',
        path: ['locations'],
      })
    }
  })

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterArea, setFilterArea] = useState<string>('all')
  const [filterSubarea, setFilterSubarea] = useState<string>('all')

  const { user } = useAuth()
  const canDelete = user?.role === 'admin'

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      unit: undefined,
      validity_days: undefined as any,
      min_stock: undefined as any,
      price: undefined as any,
      category_id: '',
      locations: [],
      image: null,
      active: true,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'locations' as never,
  })

  const loadData = async () => {
    const [p, c, s, l, a] = await Promise.all([
      getProducts(),
      getCategories(),
      getSubareas(),
      getInventoryLevels(),
      pb.collection('areas').getFullList<Area>({ sort: 'name' }),
    ])
    setProducts(p)
    setCategories(c)
    setSubareas(s)
    setLevels(l)
    setAreas(a)
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('products', loadData)
  useRealtime('inventory_levels', loadData)

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const formData = new FormData()
      formData.append('name', data.name)
      formData.append('unit', data.unit)
      if (data.validity_days) formData.append('validity_days', data.validity_days.toString())
      if (data.min_stock) formData.append('min_stock', data.min_stock.toString())
      formData.append('category_id', data.category_id)
      formData.append('active', String(data.active))

      if (data.image instanceof File) {
        formData.append('image', data.image)
      } else if (data.image === null) {
        formData.append('image', '')
      }

      if (data.price !== null && data.price !== undefined) {
        formData.append('price', data.price.toString())
      }

      let productId = editingId
      if (editingId) {
        await updateProduct(editingId, formData)
      } else {
        const newProd = await createProduct(formData)
        productId = newProd.id
      }

      if (productId) {
        const existingLevels = levels.filter((l) => l.product_id === productId)
        const newLocs = data.locations || []

        const toDelete = existingLevels.filter(
          (el) => !newLocs.some((nl) => nl.existingLevelId === el.id),
        )
        for (const d of toDelete) {
          await deleteInventoryLevel(d.id)
        }

        for (const loc of newLocs) {
          if (loc.existingLevelId) {
            const el = existingLevels.find((e) => e.id === loc.existingLevelId)
            if (el && (el.subarea_id !== loc.subarea_id || el.quantity !== loc.quantity)) {
              await updateInventoryLevel(loc.existingLevelId, {
                subarea_id: loc.subarea_id,
                quantity: loc.quantity,
              })
            }
          } else {
            await createInventoryLevel({
              product_id: productId,
              subarea_id: loc.subarea_id,
              quantity: loc.quantity,
            })
          }
        }
      }

      setIsOpen(false)
      setEditingId(null)
      form.reset({
        name: '',
        unit: undefined,
        validity_days: undefined as any,
        min_stock: undefined as any,
        price: undefined as any,
        category_id: '',
        locations: [],
        image: null,
        active: true,
      })
      toast.success('Produto salvo com sucesso!')
      await loadData()
    } catch (e) {
      const errs = extractFieldErrors(e)
      Object.keys(errs).forEach((k) => form.setError(k as any, { message: errs[k] }))
    }
  }

  const handleEdit = (p: Product) => {
    setEditingId(p.id)
    const pLevels = levels.filter((l) => l.product_id === p.id)

    form.reset({
      name: p.name,
      unit: p.unit,
      validity_days: p.validity_days?.toString() as any,
      min_stock: p.min_stock?.toString() as any,
      price: p.price?.toString() as any,
      category_id: p.category_id,
      locations: pLevels.map((l) => ({
        area_id: l.expand?.subarea_id?.area_id || '',
        subarea_id: l.subarea_id,
        quantity: l.quantity.toString() as any,
        existingLevelId: l.id,
      })) as any,
      image: p.image || null,
      active: p.active ?? true,
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
        price: undefined as any,
        category_id: '',
        locations: [],
        image: null,
        active: true,
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

  const filteredProducts = products.filter((p) => {
    if (filterCategory !== 'all' && p.category_id !== filterCategory) return false
    const pLevels = levels.filter((l) => l.product_id === p.id)
    if (filterArea !== 'all') {
      const hasArea = pLevels.some(
        (l) =>
          l.expand?.subarea_id?.area_id === filterArea ||
          (l.expand?.subarea_id?.expand as any)?.area_id?.id === filterArea,
      )
      if (!hasArea) return false
    }
    if (filterSubarea !== 'all') {
      const hasSubarea = pLevels.some((l) => l.subarea_id === filterSubarea)
      if (!hasSubarea) return false
    }
    return true
  })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-emerald-900">Produtos</h1>
          <p className="text-sm text-zinc-500">
            Gerencie o catálogo de produtos e suas localizações.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setEditingId(null)
                form.reset({
                  name: '',
                  unit: undefined,
                  validity_days: undefined as any,
                  min_stock: undefined as any,
                  price: undefined as any,
                  category_id: '',
                  locations: [],
                  image: null,
                  active: true,
                })
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </DialogHeader>
            <Form {...form} key={editingId || 'new'}>
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

                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço/Valor (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="0,00"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imagem do Produto</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value}
                          onChange={field.onChange}
                          collectionId="products"
                          recordId={editingId || undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-zinc-200 p-3 shadow-sm bg-white">
                      <div className="space-y-0.5">
                        <FormLabel>Status do Produto</FormLabel>
                        <p className="text-[13px] text-zinc-500">
                          {field.value ? 'Ativo no sistema' : 'Inativo (escondido de contagens)'}
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="pt-4 border-t border-zinc-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-900">
                        Localizações e Estoque
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Defina onde este produto está armazenado.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ area_id: '', subarea_id: '', quantity: '0' as any })}
                      className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Adicionar Local
                    </Button>
                  </div>

                  {form.formState.errors.locations?.root?.message && (
                    <p className="text-sm text-red-500 mb-3">
                      {form.formState.errors.locations.root.message}
                    </p>
                  )}

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex flex-col gap-2 bg-zinc-50 p-3 rounded-md border border-zinc-200"
                      >
                        <div className="flex gap-2 items-start">
                          <div className="flex-1">
                            <FormField
                              control={form.control}
                              name={`locations.${index}.area_id` as any}
                              render={({ field: aField }) => (
                                <FormItem>
                                  <Select
                                    onValueChange={(val) => {
                                      aField.onChange(val)
                                      form.setValue(`locations.${index}.subarea_id` as any, '')
                                    }}
                                    value={aField.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Área" />
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
                          </div>
                          <div className="flex-1">
                            <FormField
                              control={form.control}
                              name={`locations.${index}.subarea_id` as any}
                              render={({ field: sField }) => {
                                const areaId = form.watch(`locations.${index}.area_id` as any)
                                return (
                                  <FormItem>
                                    <Select
                                      onValueChange={sField.onChange}
                                      value={sField.value}
                                      disabled={!areaId}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="bg-white">
                                          <SelectValue placeholder="Subárea" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {subareas
                                          .filter((s) => s.area_id === areaId)
                                          .map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                              {s.name}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24">
                            <FormField
                              control={form.control}
                              name={`locations.${index}.quantity` as any}
                              render={({ field: qField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="any"
                                      placeholder="Qtd"
                                      className="bg-white h-9"
                                      {...qField}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="flex-1 text-xs text-zinc-500 font-medium pt-1">
                            {form.watch('unit') || 'Unidades'}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {fields.length === 0 && (
                      <p className="text-sm text-zinc-500 text-center py-4 bg-zinc-50 rounded border border-dashed border-zinc-200">
                        Nenhuma localização vinculada.
                      </p>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Salvar Produto
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200 shadow-sm">
        <div className="flex-1">
          <label className="text-xs font-semibold text-zinc-500 mb-1.5 block px-1">
            Filtrar por Categoria
          </label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="bg-white border-zinc-200">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-zinc-500 mb-1.5 block px-1">
            Filtrar por Área
          </label>
          <Select
            value={filterArea}
            onValueChange={(val) => {
              setFilterArea(val)
              setFilterSubarea('all')
            }}
          >
            <SelectTrigger className="bg-white border-zinc-200">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Áreas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-zinc-500 mb-1.5 block px-1">
            Filtrar por Subárea
          </label>
          <Select
            value={filterSubarea}
            onValueChange={setFilterSubarea}
            disabled={filterArea === 'all'}
          >
            <SelectTrigger className="bg-white border-zinc-200">
              <SelectValue placeholder="Subárea" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Subáreas</SelectItem>
              {subareas
                .filter((s) => s.area_id === filterArea)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-zinc-200 rounded-lg shadow-sm gap-4 ${p.active === false ? 'opacity-70 bg-zinc-50' : ''}`}
          >
            <div className="flex items-center gap-4">
              {p.image ? (
                <div className="w-16 h-16 rounded-md border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0">
                  <img
                    src={`${pb.baseUrl}/api/files/products/${p.id}/${p.image}?thumb=100x100`}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-md border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-6 h-6 text-zinc-300" />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold ${p.active === false ? 'text-zinc-600 line-through' : 'text-zinc-900'}`}
                  >
                    {p.name}
                  </span>
                  <span className="text-xs text-zinc-500">({p.unit})</span>
                  {p.active === false && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-zinc-200 text-zinc-600 border-none uppercase"
                    >
                      Inativo
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] text-zinc-600 border-zinc-200 bg-zinc-50"
                  >
                    {p.expand?.category_id?.name}
                  </Badge>
                  {levels
                    .filter((l) => l.product_id === p.id)
                    .map((l) => (
                      <Badge
                        key={l.id}
                        variant="secondary"
                        className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100"
                      >
                        <MapPin className="w-2.5 h-2.5 mr-1" />
                        {l.expand?.subarea_id?.name}: {l.quantity}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 border-t sm:border-t-0 border-zinc-100 pt-3 sm:pt-0 mt-1 sm:mt-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">Ativo</span>
                <Switch
                  checked={p.active !== false}
                  onCheckedChange={async (checked) => {
                    try {
                      await updateProduct(p.id, { active: checked })
                      toast.success(checked ? 'Produto ativado' : 'Produto inativado')
                      loadData()
                    } catch {
                      toast.error('Erro ao atualizar status')
                    }
                  }}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleEdit(p)}
                  className="h-8 w-8 text-zinc-500 hover:text-emerald-700 hover:bg-emerald-50"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                {canDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(p.id)}
                    className="h-8 w-8 text-zinc-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center text-zinc-500 bg-white rounded-xl border border-dashed border-zinc-200">
            <PackageSearch className="w-12 h-12 mb-3 text-zinc-300" />
            <p>Nenhum produto encontrado com os filtros atuais.</p>
          </div>
        )}
      </div>
    </div>
  )
}
