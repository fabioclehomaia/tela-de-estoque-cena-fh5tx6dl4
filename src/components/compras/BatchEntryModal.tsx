import { useState, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus, Trash2, Loader2, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Product } from '@/services/products'
import { Fornecedor } from '@/services/fornecedores'
import { ProductPriceHistory } from '@/services/product_price_history'
import { CostCategory } from '@/services/compras'
import { ProductSearchCombobox } from '@/components/compras/ProductSearchCombobox'
import { PriceVariationAlert } from '@/components/compras/PriceVariationAlert'
import { checkPriceVariation } from '@/lib/price-variation'
import { saveBatchCompras, BatchLine, BatchHeader, BatchLineFailure } from '@/lib/batch-save'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export interface BatchSeed {
  supplier_id?: string
  date?: string
  nota_fiscal?: string
  payment_term?: string
  lines: BatchLine[]
}

interface BatchEntryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  suppliers: Fornecedor[]
  priceHistory?: ProductPriceHistory[]
  /** Linhas pré-carregadas (ex: itens do espelho da nota IA) */
  seed?: BatchSeed | null
  onSuccess: () => void
}

const emptyLine = (): BatchLine => ({
  key: `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  is_avulso: false,
  product_id: '',
  quantity: 1,
  price: 0,
  description: '',
  cost_category: 'CMV',
})

export function BatchEntryModal({
  open,
  onOpenChange,
  products,
  suppliers,
  priceHistory,
  seed,
  onSuccess,
}: BatchEntryModalProps) {
  const [supplierId, setSupplierId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notaFiscal, setNotaFiscal] = useState('')
  const [paymentTerm, setPaymentTerm] = useState('')
  const [lines, setLines] = useState<BatchLine[]>([emptyLine()])
  const [lineErrors, setLineErrors] = useState<Map<string, string>>(new Map())
  const [isSaving, setIsSaving] = useState(false)

  // Pré-carga (ex: itens vindos do espelho da nota IA)
  useEffect(() => {
    if (!open) return
    setSupplierId(seed?.supplier_id || '')
    setDate(seed?.date || format(new Date(), 'yyyy-MM-dd'))
    setNotaFiscal(seed?.nota_fiscal || '')
    setPaymentTerm(seed?.payment_term || '')
    setLines(seed?.lines?.length ? seed.lines : [emptyLine()])
    setLineErrors(new Map())
  }, [open, seed])

  const productsMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const updateLine = (key: string, updates: Partial<BatchLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...updates } : l)))
    setLineErrors((prev) => {
      if (!prev.has(key)) return prev
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }

  const addLine = () => setLines((prev) => [...prev, emptyLine()])

  const removeLine = (key: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : [emptyLine()]))

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (l.is_avulso ? l.price : l.price * (l.quantity || 0)), 0),
    [lines],
  )

  const validate = (): boolean => {
    const errors = new Map<string, string>()
    if (!date) errors.set('__header__', 'Informe a data da compra.')
    for (const l of lines) {
      if (l.is_avulso) {
        if (!l.description?.trim()) errors.set(l.key, 'Informe a descrição do item avulso.')
        else if (l.price <= 0) errors.set(l.key, 'Informe o valor do item avulso.')
      } else {
        if (!l.product_id) errors.set(l.key, 'Selecione um produto (ou marque como avulso).')
        else if ((l.quantity || 0) <= 0) errors.set(l.key, 'Informe a quantidade.')
        else if (l.price <= 0) errors.set(l.key, 'Informe o preço unitário.')
      }
    }
    setLineErrors(errors)
    return errors.size === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Corrija os itens destacados antes de salvar.')
      return
    }

    setIsSaving(true)
    try {
      const header: BatchHeader = {
        supplier_id: supplierId || undefined,
        date,
        nota_fiscal: notaFiscal.trim() || undefined,
        payment_term: paymentTerm.trim() || undefined,
      }
      const { saved, failures } = await saveBatchCompras(header, lines, products)
      handleSaveResult(saved, failures)
    } catch (err: any) {
      console.error('Erro ao salvar lote de compras:', err)
      toast.error('Erro ao salvar lote: ' + (err?.message || 'Verifique os dados.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveResult = (saved: number, failures: BatchLineFailure[]) => {
    if (failures.length === 0) {
      toast.success(
        `${saved} ${saved === 1 ? 'compra registrada' : 'compras registradas'} com sucesso!`,
      )
      onOpenChange(false)
      onSuccess()
      return
    }

    // Mantém aberto apenas com as linhas que falharam, para reenvio
    const failedKeys = new Set(failures.map((f) => f.key))
    setLines((prev) => prev.filter((l) => failedKeys.has(l.key)))
    setLineErrors(new Map(failures.map((f) => [f.key, f.reason])))
    toast.error(
      `${saved} ${saved === 1 ? 'item salvo' : 'itens salvos'}, mas ${failures.length} falharam: ` +
        failures.map((f) => `${f.label} (${f.reason})`).join('; '),
      { duration: 8000 },
    )
    onSuccess()
  }

  const hasBlockingErrors = lineErrors.size > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !isSaving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[900px] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-serif text-emerald-950">
                Lançamento em Lote
              </DialogTitle>
              <p className="text-xs text-zinc-500 mt-0.5">
                Vários itens de uma mesma nota — salvos de uma vez, cada um como sua compra
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Cabeçalho comum: fornecedor, data, NF, pagamento */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs shrink-0">
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <Label className="text-xs font-semibold">Fornecedor</Label>
            <Select
              value={supplierId || '__none__'}
              onValueChange={(v) => setSupplierId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem fornecedor</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Data</Label>
            <Input
              type="date"
              className="h-8 text-xs bg-white"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Nº Nota Fiscal</Label>
            <Input
              className="h-8 text-xs bg-white"
              placeholder="Ex: 12345"
              value={notaFiscal}
              onChange={(e) => setNotaFiscal(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Cond. Pagamento</Label>
            <Input
              className="h-8 text-xs bg-white"
              placeholder="Ex: 30 dias"
              value={paymentTerm}
              onChange={(e) => setPaymentTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Linhas do lote */}
        <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1 min-h-0">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-zinc-700">
              Itens do lote ({lines.length})
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={addLine}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar item
            </Button>
          </div>

          {lines.map((l, idx) => {
            const product = productsMap.get(l.product_id || '')
            const lineError = lineErrors.get(l.key)
            const variation =
              !l.is_avulso && product ? checkPriceVariation(l.price, product, priceHistory) : null

            return (
              <div
                key={l.key}
                className={`p-3 rounded-lg border text-xs space-y-2.5 transition-colors ${
                  lineError ? 'bg-rose-50/70 border-rose-300' : 'bg-white border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-zinc-500 text-[11px]">#{idx + 1}</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-zinc-700">
                      <Checkbox
                        checked={l.is_avulso}
                        onCheckedChange={(c) =>
                          updateLine(l.key, { is_avulso: Boolean(c), product_id: '' })
                        }
                      />
                      <span>Avulso (sem produto)</span>
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-500 hover:text-red-700"
                    onClick={() => removeLine(l.key)}
                    title="Remover item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {variation?.hasVariation && (
                  <PriceVariationAlert
                    check={variation}
                    unit={product?.unit}
                    compact={true}
                    className="mt-1"
                  />
                )}

                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                  {!l.is_avulso ? (
                    <div className="col-span-2 sm:col-span-5 space-y-1">
                      <Label className="text-[11px] text-zinc-500">Produto</Label>
                      <ProductSearchCombobox
                        products={products}
                        value={l.product_id || ''}
                        onChange={(val) => updateLine(l.key, { product_id: val })}
                        placeholder="Buscar produto ativo por nome..."
                        onlyActive={true}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="col-span-2 sm:col-span-3 space-y-1">
                        <Label className="text-[11px] text-zinc-500">Descrição do Item</Label>
                        <Input
                          className="h-8 text-xs bg-white"
                          placeholder="Descrição livre"
                          value={l.description || ''}
                          onChange={(e) => updateLine(l.key, { description: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-2 space-y-1">
                        <Label className="text-[11px] text-zinc-500">Fonte de Custo</Label>
                        <Select
                          value={l.cost_category || 'CMV'}
                          onValueChange={(val) =>
                            updateLine(l.key, { cost_category: val as CostCategory })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COST_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {!l.is_avulso && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zinc-500">Qtd</Label>
                      <Input
                        type="number"
                        step="any"
                        className="h-8 text-xs bg-white text-right"
                        value={l.quantity ?? ''}
                        onChange={(e) =>
                          updateLine(l.key, {
                            quantity: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <span>{l.is_avulso ? 'Valor (R$)' : 'Preço Un.'}</span>
                      {!l.is_avulso && product?.unit && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 font-normal">
                          por {product.unit}
                        </Badge>
                      )}
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      className="h-8 text-xs bg-white text-right"
                      value={l.price ?? ''}
                      onChange={(e) =>
                        updateLine(l.key, {
                          price: e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-500">Total</Label>
                    <div className="h-8 flex items-center justify-end px-2 rounded-md border border-emerald-100 bg-emerald-50/60 text-xs font-semibold text-emerald-800">
                      {formatCurrency(l.is_avulso ? l.price : l.price * (l.quantity || 0))}
                    </div>
                  </div>
                </div>

                {lineError && (
                  <div className="flex items-start gap-1.5 text-[11px] text-rose-800 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{lineError}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rodapé: subtotal + salvar */}
        <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {hasBlockingErrors && (
              <Badge variant="secondary" className="bg-rose-100 text-rose-800 border-rose-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {lineErrors.size} {lineErrors.size === 1 ? 'item com erro' : 'itens com erro'}
              </Badge>
            )}
            <div className="text-xs text-zinc-600">
              Subtotal do lote:{' '}
              <strong className="text-emerald-800 text-base">{formatCurrency(subtotal)}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar tudo ({lines.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
