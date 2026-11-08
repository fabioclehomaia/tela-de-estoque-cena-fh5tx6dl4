import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Loader2,
  Calendar as CalendarIcon,
  Search,
  PackageSearch,
  CheckCircle2,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getProducts, Product } from '@/services/products'
import { InventoryCount, getInventoryCountsRange } from '@/services/inventory_counts'
import {
  StockAdjustment,
  getStockAdjustments,
  createStockAdjustment,
} from '@/services/stock_adjustments'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const formatDateTime = (s: string) => {
  try {
    return format(new Date(s), 'dd/MM/yyyy HH:mm')
  } catch {
    return s
  }
}

export default function StockAdjustments() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Formulário
  const [adjustmentDate, setAdjustmentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [correctedQuantity, setCorrectedQuantity] = useState('')
  const [reason, setReason] = useState('')

  // Contagens do dia escolhido + ajustes existentes
  const [dayCounts, setDayCounts] = useState<InventoryCount[]>([])
  const [dayCountsLoading, setDayCountsLoading] = useState(false)
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [p, adj] = await Promise.all([getProducts(), getStockAdjustments()])
        setProducts(p)
        setAdjustments(adj)
      } catch {
        toast({
          title: 'Erro',
          description: 'Erro ao carregar produtos e ajustes.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  // Contagens do dia selecionado (busca no servidor, janela de 1 dia)
  useEffect(() => {
    if (!adjustmentDate) {
      setDayCounts([])
      return
    }
    let cancelled = false
    setDayCountsLoading(true)
    const from = `${adjustmentDate} 00:00:00`
    const to = `${adjustmentDate} 23:59:59`
    getInventoryCountsRange(from, undefined)
      .then((all) => {
        if (cancelled) return
        setDayCounts(all.filter((c) => c.created.slice(0, 10) === adjustmentDate))
      })
      .catch(() => {
        if (!cancelled)
          toast({
            title: 'Erro',
            description: 'Erro ao carregar as contagens desta data.',
            variant: 'destructive',
          })
      })
      .finally(() => {
        if (!cancelled) setDayCountsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [adjustmentDate, toast])

  const hasCountForProduct = useMemo(() => {
    if (!selectedProductId) return null
    const matches = dayCounts.filter((c) => c.product_id === selectedProductId)
    if (matches.length === 0) return null
    // mais recente do dia
    return matches.reduce((latest, c) => (c.created > latest.created ? c : latest), matches[0])
  }, [dayCounts, selectedProductId])

  const adjustedCountIds = useMemo(() => new Set(adjustments.map((a) => a.count)), [adjustments])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    const base = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products
    // Produtos contados no dia primeiro, para facilitar achar o que será ajustado
    const countedToday = new Set(dayCounts.map((c) => c.product_id))
    return [...base].sort((a, b) => {
      const aCounted = countedToday.has(a.id) ? 0 : 1
      const bCounted = countedToday.has(b.id) ? 0 : 1
      if (aCounted !== bCounted) return aCounted - bCounted
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [products, productSearch, dayCounts])

  const selectedProduct = products.find((p) => p.id === selectedProductId) || null
  const originalQuantity = hasCountForProduct ? hasCountForProduct.counted_quantity : null

  const canSubmit =
    Boolean(selectedProductId) &&
    Boolean(hasCountForProduct) &&
    correctedQuantity !== '' &&
    !Number.isNaN(Number(correctedQuantity))

  const handleSubmit = async () => {
    if (!canSubmit || !hasCountForProduct || !selectedProduct) return
    setSaving(true)
    try {
      const created = await createStockAdjustment({
        product: selectedProductId,
        count: hasCountForProduct.id,
        adjustment_date: `${adjustmentDate} 00:00:00`,
        original_quantity: hasCountForProduct.counted_quantity,
        corrected_quantity: Number(correctedQuantity),
        reason: reason.trim(),
      })
      setAdjustments((prev) => [created, ...prev])
      toast({
        title: 'Ajuste registrado',
        description: `Contagem de ${selectedProduct.name} em ${format(
          new Date(adjustmentDate),
          'dd/MM/yyyy',
        )} retificada. O histórico original permanece intacto.`,
      })
      setCorrectedQuantity('')
      setReason('')
    } catch (error: any) {
      toast({
        title: 'Erro',
        description:
          error?.response?.data?.message ||
          'Não foi possível registrar o ajuste. Verifique seu perfil de acesso.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    )

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-zinc-900">Ajuste de Estoque</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Retifique uma contagem sem apagar o histórico original. O valor corrigido fica registrado
          em seu nome para auditoria.
        </p>
      </div>

      {/* Formulário de ajuste */}
      <Card className="border-zinc-200 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-emerald-800" />
            Nova retificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 1. Data da contagem a retificar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                Data da contagem a retificar
              </Label>
              <Input
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
              />
            </div>

            {/* 2. Produto */}
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-zinc-400" />
                Produto
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder="Buscar produto..."
                    className="pl-9"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                  disabled={filteredProducts.length === 0}
                >
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {filteredProducts.map((p) => {
                      const counted = dayCounts.some((c) => c.product_id === p.id)
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            {p.name}
                            {!p.active && (
                              <Badge variant="secondary" className="text-[10px]">
                                Inativo
                              </Badge>
                            )}
                            {counted && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-emerald-300 text-emerald-700"
                              >
                                contado neste dia
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 3. Contagem localizada na data */}
          {selectedProductId && (
            <div
              className={cn(
                'rounded-lg border p-4 text-sm space-y-2',
                hasCountForProduct
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-amber-200 bg-amber-50/50',
              )}
            >
              {!hasCountForProduct ? (
                <p className="text-amber-800">
                  Nenhuma contagem de <strong>{selectedProduct?.name || 'produto'}</strong>{' '}
                  encontrada em {format(new Date(adjustmentDate), 'dd/MM/yyyy')}. Selecione a data
                  em que a contagem foi feita.
                </p>
              ) : (
                <>
                  <p className="text-emerald-900 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    Contagem localizada em {format(new Date(adjustmentDate), 'dd/MM/yyyy')}
                  </p>
                  <p className="text-zinc-700">
                    Quantidade gravada:{' '}
                    <strong className="text-lg font-bold text-zinc-900">{originalQuantity}</strong>{' '}
                    <span className="text-zinc-500">
                      {selectedProduct?.unit} • registrada por{' '}
                      {hasCountForProduct.expand?.user_id?.name ||
                        hasCountForProduct.expand?.user_id?.email ||
                        '—'}{' '}
                      em {formatDateTime(hasCountForProduct.created)}
                    </span>
                  </p>
                  {adjustedCountIds.has(hasCountForProduct.id) && (
                    <p className="text-xs text-zinc-500">
                      Esta contagem já possui ajuste registrado anteriormente.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* 4. Quantidade correta + motivo */}
          {hasCountForProduct && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-600">
                  Quantidade correta ({selectedProduct?.unit})
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder={String(originalQuantity ?? '')}
                  value={correctedQuantity}
                  onChange={(e) => setCorrectedQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold text-zinc-600">Motivo (opcional)</Label>
                <Input
                  type="text"
                  placeholder="Ex.: vírgula esquecida na contagem, volume somado errado..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || saving}
              className="bg-emerald-800 text-white hover:bg-emerald-900"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                'Registrar ajuste'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de ajustes */}
      <Card className="border-zinc-200 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif">Ajustes registrados</CardTitle>
          <p className="text-xs text-zinc-500">
            O histórico original de contagens nunca é alterado — cada linha abaixo é uma retificação
            à parte.
          </p>
        </CardHeader>
        <CardContent>
          {adjustments.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">
              Nenhum ajuste registrado até agora.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead>Data da contagem</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd. original</TableHead>
                    <TableHead className="text-right">Qtd. corrigida</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Ajustado por</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adj) => {
                    const product = adj.expand?.product
                    return (
                      <TableRow key={adj.id}>
                        <TableCell className="whitespace-nowrap">
                          {adj.adjustment_date
                            ? format(new Date(adj.adjustment_date), 'dd/MM/yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {product?.name || 'Produto removido'}
                        </TableCell>
                        <TableCell className="text-right">{adj.original_quantity}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          {adj.corrected_quantity}
                        </TableCell>
                        <TableCell className="text-zinc-600 max-w-[220px] truncate">
                          {adj.reason || '—'}
                        </TableCell>
                        <TableCell>
                          {adj.expand?.adjusted_by?.name || adj.expand?.adjusted_by?.email || '—'}
                        </TableCell>
                        <TableCell className="text-zinc-500 whitespace-nowrap">
                          {formatDateTime(adj.created)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
