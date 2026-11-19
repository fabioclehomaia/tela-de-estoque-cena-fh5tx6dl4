import { useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { Loader2, Search, CalendarClock, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Product } from '@/services/products'
import { ProductPriceHistory } from '@/services/product_price_history'
import { Category } from '@/services/inventory'
import { InactiveProductMark } from '@/components/shared/InactiveProductMark'

const safeDate = (s: string) => parseISO(String(s).replace(' ', 'T'))

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const STALENESS_OPTIONS = [
  { value: '_all_', label: 'Todos' },
  { value: '7', label: 'Mais de 7 dias' },
  { value: '15', label: 'Mais de 15 dias' },
  { value: '30', label: 'Mais de 30 dias' },
  { value: '60', label: 'Mais de 60 dias' },
  { value: '90', label: 'Mais de 90 dias' },
] as const

interface Props {
  /** Lista de produtos (com expand.category_id), já carregada em Reports.tsx */
  products: Product[]
  /** Histórico de preços, buscado sob demanda em Reports.tsx (cache compartilhado) */
  priceHistory: ProductPriceHistory[]
  /** true enquanto o histórico de preços ainda não chegou */
  priceHistoryLoading: boolean
  /** Categorias cadastradas (coleção categories) */
  categories: Category[]
  /** Filtro global de categorias aplicado no topo dos Relatórios */
  selectedCategoryIds: string[]
}

interface StalenessRow {
  product: Product
  categoryName: string
  currentPrice: number
  lastPriceDate: Date | null
  /** Fonte da data: histórico de preços ou updated do produto */
  source: 'historico' | 'updated'
  days: number
}

/**
 * Sub aba "Dias sem Ajuste de Preço" dos Relatórios: para cada produto, há
 * quantos dias o preço não é ajustado (base: última entrada em
 * product_price_history; sem histórico, usa `products.updated` como fallback).
 * Ordenado do mais defasado ao mais recente.
 */
export default function PriceStalenessReport({
  products,
  priceHistory,
  priceHistoryLoading,
  categories: allCategories,
  selectedCategoryIds,
}: Props) {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('_all_')
  const [minDays, setMinDays] = useState('_all_')

  // Último registro de preço por produto (histórico vem ordenado por created asc)
  const lastPriceByProduct = useMemo(() => {
    const map = new Map<string, ProductPriceHistory>()
    for (const h of priceHistory) {
      const prev = map.get(h.product_id)
      if (!prev || safeDate(h.created) > safeDate(prev.created)) {
        map.set(h.product_id, h)
      }
    }
    return map
  }, [priceHistory])

  const rows = useMemo<StalenessRow[]>(() => {
    const today = new Date()
    return products
      .map((product) => {
        const last = lastPriceByProduct.get(product.id)
        const lastPriceDate = last ? safeDate(last.created) : safeDate(product.updated)
        const days = differenceInCalendarDays(today, lastPriceDate)
        return {
          product,
          categoryName: product.expand?.category_id?.name || 'Sem categoria',
          currentPrice: product.price || 0,
          lastPriceDate,
          source: last ? ('historico' as const) : ('updated' as const),
          days: Math.max(0, days),
        }
      })
      .sort((a, b) => b.days - a.days)
  }, [products, lastPriceByProduct])

  // Filtro global de categorias aplicado no topo dos Relatórios
  const visibleRows = useMemo(() => {
    if (selectedCategoryIds.length === 0) return rows
    return rows.filter((row) => selectedCategoryIds.includes(row.product.category_id))
  }, [rows, selectedCategoryIds])

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of allCategories) map.set(c.id, c.name)
    for (const p of products) {
      if (p.expand?.category_id) map.set(p.expand.category_id.id, p.expand.category_id.name)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [allCategories, products])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return visibleRows.filter((row) => {
      if (q && !row.product.name.toLowerCase().includes(q)) return false
      if (categoryId !== '_all_' && row.product.category_id !== categoryId) return false
      if (minDays !== '_all_' && row.days < Number(minDays)) return false
      return true
    })
  }, [visibleRows, search, categoryId, minDays])

  const stalenessColor = (days: number) =>
    days >= 30 ? 'text-red-600' : days >= 15 ? 'text-amber-600' : 'text-zinc-600'

  const stalenessBg = (days: number) => (days >= 30 ? 'bg-red-50' : days >= 15 ? 'bg-amber-50' : '')

  if (priceHistoryLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-zinc-200 bg-white">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label>Buscar produto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Buscar por nome do produto..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todas</SelectItem>
                {categories.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Defasagem mínima</Label>
            <Select value={minDays} onValueChange={setMinDays}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                {STALENESS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span>
          Amarelo: 15 dias ou mais sem ajuste &bull; Vermelho: 30 dias ou mais. Produtos sem
          histórico de preço usam a data da última alteração do cadastro.
        </span>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50">
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Preço atual</TableHead>
                <TableHead>Último ajuste</TableHead>
                <TableHead className="text-right">Dias sem ajuste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.product.id} className={stalenessBg(row.days)}>
                  <TableCell className="font-medium text-zinc-900">
                    <InactiveProductMark active={row.product.active !== false}>
                      {row.product.name}
                    </InactiveProductMark>
                  </TableCell>
                  <TableCell className="text-zinc-600">{row.categoryName}</TableCell>
                  <TableCell className="text-zinc-500">{row.product.unit}</TableCell>
                  <TableCell className="text-right">
                    {row.currentPrice > 0 ? (
                      formatCurrency(row.currentPrice)
                    ) : (
                      <span title="Produto sem preço cadastrado">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-600 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5 text-zinc-400" />
                      {row.lastPriceDate ? format(row.lastPriceDate, 'dd/MM/yyyy') : '—'}
                      {row.source === 'updated' && (
                        <span className="text-[10px] text-zinc-400">(cadastro)</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${stalenessColor(row.days)}`}>
                    {row.days}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                    Nenhum produto encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-zinc-100">
          {filtered.map((row) => (
            <div
              key={row.product.id}
              className={`p-4 flex flex-col gap-2 ${stalenessBg(row.days)}`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">
                    <InactiveProductMark active={row.product.active !== false}>
                      {row.product.name}
                    </InactiveProductMark>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {row.categoryName} &bull; {row.product.unit}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-bold ${stalenessColor(row.days)}`}>
                    {row.days} {row.days === 1 ? 'dia' : 'dias'}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {row.currentPrice > 0 ? formatCurrency(row.currentPrice) : '—'}
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-600 flex items-center gap-1">
                <CalendarClock className="w-3 h-3 text-zinc-400" />
                Último ajuste: {row.lastPriceDate ? format(row.lastPriceDate, 'dd/MM/yyyy') : '—'}
                {row.source === 'updated' && ' (data do cadastro)'}
              </p>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-zinc-500">
              Nenhum produto encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
