import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Plus, Edit, Trash2, ShoppingCart, Sparkles, ReceiptText, FilterX } from 'lucide-react'
import { getCompras, createCompra, updateCompra, deleteCompra, Compra } from '@/services/compras'
import { getProducts, updateProduct, Product } from '@/services/products'
import { getInventoryLevels } from '@/services/inventory_levels'
import { getFornecedores, Fornecedor } from '@/services/fornecedores'
import { getProductPriceHistory, ProductPriceHistory } from '@/services/product_price_history'
import { Badge } from '@/components/ui/badge'
import { InactiveProductMark } from '@/components/shared/InactiveProductMark'
import { CompraAvulsaModal } from '@/components/compras/CompraAvulsaModal'
import { InvoiceMirrorModal } from '@/components/compras/InvoiceMirrorModal'
import { ProductSearchCombobox } from '@/components/compras/ProductSearchCombobox'
import { PurchasesFilterBar } from '@/components/compras/PurchasesFilterBar'
import { PriceVariationAlert } from '@/components/compras/PriceVariationAlert'
import { checkPriceVariation } from '@/lib/price-variation'
import {
  PurchasesFilterState,
  initialPurchasesFilters,
  filterCompras,
  countActiveFilters,
} from '@/lib/purchases-filter'
import { downloadPurchasesCsv } from '@/lib/purchases-export'
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
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistory[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isAvulsaOpen, setIsAvulsaOpen] = useState(false)
  const [isAiMirrorOpen, setIsAiMirrorOpen] = useState(false)
  const [editingAvulsaCompra, setEditingAvulsaCompra] = useState<Compra | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filters, setFilters] = useState<PurchasesFilterState>(initialPurchasesFilters)
  const [isExporting, setIsExporting] = useState(false)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const selectedProductId = form.watch('product_id')
  const enteredPrice = form.watch('price')
  const selectedProduct = products.find((p) => p.id === selectedProductId)

  const priceVariationCheck = useMemo(() => {
    return checkPriceVariation(enteredPrice, selectedProduct, priceHistory)
  }, [enteredPrice, selectedProduct, priceHistory])

  const loadData = async () => {
    const [c, p, s, ph] = await Promise.all([
      getCompras(),
      getProducts(),
      getFornecedores(),
      getProductPriceHistory().catch((err) => {
        console.warn('Não foi possível carregar histórico de preços:', err)
        return []
      }),
    ])
    setCompras(c)
    setProducts(p)
    setSuppliers(s)
    setPriceHistory(ph)
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('compras', loadData)
  useRealtime('fornecedores', loadData)
  useRealtime('products', loadData)
  useRealtime('product_price_history', loadData)

  const productsMap = useMemo(() => {
    const map = new Map<string, Product>()
    products.forEach((p) => map.set(p.id, p))
    return map
  }, [products])

  const suppliersMap = useMemo(() => {
    const map = new Map<string, Fornecedor>()
    suppliers.forEach((s) => map.set(s.id, s))
    return map
  }, [suppliers])

  const filteredCompras = useMemo(() => {
    return filterCompras(compras, filters, productsMap, suppliersMap)
  }, [compras, filters, productsMap, suppliersMap])

  const totalAmountFiltered = useMemo(() => {
    return filteredCompras.reduce((sum, c) => sum + (c.quantity || 1) * (c.price || 0), 0)
  }, [filteredCompras])

  const activeFiltersCount = countActiveFilters(filters)

  const handleExportCsv = () => {
    if (filteredCompras.length === 0) {
      toast.warning('Nenhuma compra para exportar com os filtros atuais.')
      return
    }

    try {
      setIsExporting(true)
      downloadPurchasesCsv(filteredCompras, filters, productsMap, suppliersMap)
      toast.success(
        `Relatório exportado com sucesso! (${filteredCompras.length} ${filteredCompras.length === 1 ? 'registro' : 'registros'})`,
      )
    } catch (err) {
      console.error('Falha ao exportar relatório de compras:', err)
      toast.error('Erro ao gerar relatório CSV.')
    } finally {
      setIsExporting(false)
    }
  }

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const payload = {
        ...data,
        nota_fiscal: data.nota_fiscal || undefined,
        payment_term: data.payment_term || undefined,
      }
      if (editingId) {
        await updateCompra(editingId, payload)
      } else {
        await createCompra(payload)

        // Atualizar preço médio ponderado do produto (apenas na criação de nova compra)
        try {
          const product = products.find((p) => p.id === data.product_id)
          if (product) {
            const allLevels = await getInventoryLevels()
            const productLevels = allLevels.filter((l) => l.product_id === product.id)
            const volumeAntigo = productLevels.reduce((sum, l) => sum + (l.quantity || 0), 0)
            const precoAntigo = product.price || 0

            let weightedPrice = data.price
            if (volumeAntigo > 0 && precoAntigo > 0) {
              weightedPrice =
                (precoAntigo * volumeAntigo + data.price * data.quantity) /
                (volumeAntigo + data.quantity)
            }
            weightedPrice = Math.round(weightedPrice * 100) / 100
            await updateProduct(product.id, { price: weightedPrice })
          }
        } catch (priceErr) {
          console.error('Falha ao atualizar preço médio ponderado do produto:', priceErr)
          toast.warning('Compra registrada, mas não foi possível atualizar o preço do produto.')
        }
      }
      setIsOpen(false)
      toast.success('Compra registrada com sucesso!')
    } catch (e) {
      const errs = extractFieldErrors(e)
      Object.keys(errs).forEach((k) => form.setError(k as any, { message: errs[k] }))
    }
  }

  const handleEdit = (c: Compra) => {
    if (c.is_avulsa || !c.product_id) {
      setEditingAvulsaCompra(c)
      setIsAvulsaOpen(true)
      return
    }

    setEditingId(c.id)
    form.reset({
      product_id: c.product_id,
      supplier_id: c.supplier_id || '',
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif text-emerald-900">Compras</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Gerencie compras de produtos, compras avulsas e leitura de notas fiscais
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Ler Nota com IA */}
          <Button
            variant="outline"
            className="border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 gap-1.5"
            onClick={() => setIsAiMirrorOpen(true)}
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Ler nota
          </Button>

          {/* Botão Compra Avulsa */}
          <Button
            variant="outline"
            className="border-zinc-300 text-zinc-700 hover:bg-zinc-50 gap-1.5"
            onClick={() => {
              setEditingAvulsaCompra(null)
              setIsAvulsaOpen(true)
            }}
          >
            <ReceiptText className="w-4 h-4 text-zinc-600" />
            Compra Avulsa
          </Button>

          {/* Botão Nova Compra de Produto */}
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  setEditingId(null)
                  form.reset(defaultValues)
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Nova Compra
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
                      <FormItem className="flex flex-col">
                        <FormLabel>Produto</FormLabel>
                        <FormControl>
                          <ProductSearchCombobox
                            products={products}
                            value={field.value}
                            onChange={(id) => {
                              field.onChange(id)
                              // Se o produto selecionado tiver preço sugerido ou unidade, a UI já reflete via selectedProduct
                            }}
                            placeholder="Buscar produto por nome..."
                            onlyActive={true}
                            selectedProduct={selectedProduct}
                          />
                        </FormControl>
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
                          <FormLabel className="flex items-center gap-2">
                            <span>Preço Unitário (R$)</span>
                            {selectedProduct?.unit && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-normal px-1.5 py-0"
                              >
                                por {selectedProduct.unit}
                              </Badge>
                            )}
                          </FormLabel>
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

                  {/* Alerta de variação de preço > 15% */}
                  {priceVariationCheck.hasVariation && (
                    <PriceVariationAlert check={priceVariationCheck} unit={selectedProduct?.unit} />
                  )}

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
      </div>
      {/* Barra de Filtros e Exportação */}
      {compras.length > 0 && (
        <PurchasesFilterBar
          filters={filters}
          onChange={setFilters}
          suppliers={suppliers}
          totalFiltered={filteredCompras.length}
          totalOriginal={compras.length}
          totalAmountFiltered={totalAmountFiltered}
          onExportCsv={handleExportCsv}
          isExporting={isExporting}
        />
      )}

      <div className="grid gap-3">
        {filteredCompras.map((c) => {
          const isAvulsa = Boolean(c.is_avulsa || !c.product_id)
          const valorTotal = (c.quantity || 1) * (c.price || 0)
          const product = c.product_id
            ? productsMap.get(c.product_id) || c.expand?.product_id
            : undefined
          const supplier = c.supplier_id
            ? suppliersMap.get(c.supplier_id) || c.expand?.supplier_id
            : undefined

          return (
            <div
              key={c.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg shadow-sm gap-3 transition-colors ${
                isAvulsa ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-zinc-200'
              }`}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isAvulsa ? (
                    <>
                      <Badge
                        variant="outline"
                        className="bg-amber-100 text-amber-900 border-amber-300 font-semibold text-xs"
                      >
                        Avulsa
                      </Badge>
                      <span className="font-semibold text-zinc-900">
                        {c.description || 'Compra avulsa'}
                      </span>
                      {c.cost_category && (
                        <Badge
                          variant="secondary"
                          className="text-[11px] bg-zinc-100 text-zinc-700"
                        >
                          {c.cost_category}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <>
                      <InactiveProductMark
                        active={product?.active}
                        nameClassName="font-semibold text-zinc-900"
                      >
                        {product?.name || c.expand?.product_id?.name || 'Produto'}
                      </InactiveProductMark>
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {c.quantity} {product?.unit || c.expand?.product_id?.unit || 'un'} ×{' '}
                        {formatCurrency(c.price)}
                      </span>
                      {product?.cost_category && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-zinc-500 border-zinc-200 font-normal"
                        >
                          {product.cost_category}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                  {supplier?.name ? (
                    <span className="font-medium text-zinc-600">{supplier.name}</span>
                  ) : isAvulsa ? (
                    <span className="italic text-zinc-400">Sem fornecedor</span>
                  ) : null}
                  <span>
                    {c.date
                      ? format(new Date(c.date.split(' ')[0] + 'T00:00:00'), 'dd/MM/yyyy')
                      : ''}
                  </span>
                  {c.nota_fiscal && (
                    <span className="bg-zinc-100 text-zinc-700 px-1.5 py-0.2 rounded font-mono text-[11px]">
                      NF: {c.nota_fiscal}
                    </span>
                  )}
                  {c.payment_term && <span>Pag: {c.payment_term}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <span className="font-bold text-emerald-700 font-mono text-base">
                  {formatCurrency(valorTotal)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleEdit(c)}
                  title="Editar compra"
                >
                  <Edit className="w-4 h-4 text-zinc-500" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(c.id)}
                  title="Excluir compra"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          )
        })}

        {/* Estado vazio quando não há NENHUMA compra cadastrada */}
        {compras.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center text-zinc-500 bg-white rounded-xl border border-dashed border-zinc-200 p-6">
            <ShoppingCart className="w-12 h-12 mb-3 text-zinc-300" />
            <p className="font-medium text-zinc-700 mb-1">Nenhuma compra registrada</p>
            <p className="text-sm text-zinc-400 max-w-sm mb-4">
              Registre compras com produtos vinculados, registre compras avulsas ou use "Ler nota"
              para importar notas fiscais com IA.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                onClick={() => setIsAiMirrorOpen(true)}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Ler nota com IA
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingAvulsaCompra(null)
                  setIsAvulsaOpen(true)
                }}
              >
                <ReceiptText className="w-3.5 h-3.5 mr-1" />
                Compra avulsa
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  setEditingId(null)
                  form.reset(defaultValues)
                  setIsOpen(true)
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova compra de produto
              </Button>
            </div>
          </div>
        )}

        {/* Estado vazio quando compras existem mas os filtros não retornam nada */}
        {compras.length > 0 && filteredCompras.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center text-zinc-500 bg-white rounded-xl border border-dashed border-zinc-200 p-6">
            <FilterX className="w-10 h-10 mb-2.5 text-zinc-300" />
            <p className="font-semibold text-zinc-700 mb-1">
              Nenhuma compra encontrada com os filtros atuais
            </p>
            <p className="text-xs text-zinc-400 max-w-md mb-4">
              Tente ampliar as datas, remover filtros de valor, fornecedor ou nota fiscal para ver
              mais resultados.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFilters(initialPurchasesFilters)}
              className="text-xs gap-1.5"
            >
              Limpar todos os filtros ({activeFiltersCount})
            </Button>
          </div>
        )}
      </div>

      {/* Modal Compra Avulsa */}
      <CompraAvulsaModal
        open={isAvulsaOpen}
        onOpenChange={(open) => {
          setIsAvulsaOpen(open)
          if (!open) setEditingAvulsaCompra(null)
        }}
        editingCompra={editingAvulsaCompra}
        onSuccess={loadData}
      />

      {/* Modal Leitura de Nota com IA + Espelho Editável */}
      <InvoiceMirrorModal
        open={isAiMirrorOpen}
        onOpenChange={setIsAiMirrorOpen}
        products={products}
        suppliers={suppliers}
        priceHistory={priceHistory}
        onSuccess={loadData}
      />
    </div>
  )
}
