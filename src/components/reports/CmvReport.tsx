import { useState, useEffect, useMemo } from 'react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  Loader2,
  Calculator,
  Search,
  FilterX,
  TrendingDown,
  Calendar as CalendarIcon,
  Scale,
  Package,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getProducts, Product } from '@/services/products'
import { getCompras, Compra } from '@/services/compras'
import { getInventoryLevels, InventoryLevel } from '@/services/inventory_levels'
import { getInventoryCounts, InventoryCount } from '@/services/inventory_counts'
import { getFaturamentos, Faturamento } from '@/services/faturamento'
import { calculateCMV } from '@/lib/cmv-utils'

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatQuantity = (val: number, unit?: string) => {
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val)
  return unit ? `${formatted} ${unit}` : formatted
}

const safeDate = (s: string) => new Date(s.split(' ')[0])

type PeriodPreset = 'last_7_days' | 'last_month' | 'previous_month' | 'custom'

interface CmvReportProps {
  selectedCategoryIds?: string[]
}

export function CmvReport({ selectedCategoryIds = [] }: CmvReportProps) {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('last_month')
  const [startDate, setStartDate] = useState(() => {
    const start = startOfMonth(new Date())
    return format(start, 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(() => {
    const end = endOfMonth(new Date())
    return format(end, 'yyyy-MM-dd')
  })

  const [productSearch, setProductSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [faturamentos, setFaturamentos] = useState<Faturamento[]>([])

  useEffect(() => {
    const load = async () => {
      const [p, c, l, ct, f] = await Promise.all([
        getProducts(),
        getCompras(),
        getInventoryLevels(),
        getInventoryCounts(),
        getFaturamentos(),
      ])
      setProducts(p)
      setCompras(c)
      setLevels(l)
      setCounts(ct)
      setFaturamentos(f)
      setLoading(false)
    }
    load()
  }, [])

  // Gerenciador de atalhos de período
  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset)
    const now = new Date()
    if (preset === 'last_7_days') {
      setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'))
      setEndDate(format(now, 'yyyy-MM-dd'))
    } else if (preset === 'last_month') {
      // "Último mês" = mês corrente / atual
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
    } else if (preset === 'previous_month') {
      // "Mês anterior" = mês passado completo
      const prev = subMonths(now, 1)
      setStartDate(format(startOfMonth(prev), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(prev), 'yyyy-MM-dd'))
    }
  }

  // Produtos filtrados por categoria (recebidos da barra global de categorias da aba Relatórios)
  const categoryFilteredProducts = useMemo(() => {
    if (selectedCategoryIds.length === 0) return products
    return products.filter((p) => {
      const matchStandardCat = p.category_id ? selectedCategoryIds.includes(p.category_id) : false
      const costCat = p.cost_category ? `cost:${p.cost_category}` : undefined
      const matchCostCat = costCat ? selectedCategoryIds.includes(costCat) : false
      return matchStandardCat || matchCostCat
    })
  }, [products, selectedCategoryIds])

  // Cálculo de CMV para todos os produtos compatíveis no período
  const cmvResult = useMemo(() => {
    if (!startDate || !endDate) return null
    return calculateCMV(
      categoryFilteredProducts,
      compras,
      levels,
      counts,
      safeDate(startDate),
      safeDate(endDate),
    )
  }, [categoryFilteredProducts, compras, levels, counts, startDate, endDate])

  // Produtos do breakdown filtrados pela lupa/busca por texto de produto específico
  const displayedBreakdown = useMemo(() => {
    if (!cmvResult) return []
    if (!productSearch.trim()) return cmvResult.breakdown
    const query = productSearch.toLowerCase().trim()
    return cmvResult.breakdown.filter((b) => b.product.name.toLowerCase().includes(query))
  }, [cmvResult, productSearch])

  // Volume gasto / CMV correspondente aos itens atualmente filtrados na tabela
  const displayedCMVTotal = useMemo(() => {
    return displayedBreakdown.reduce((sum, b) => sum + b.cmv, 0)
  }, [displayedBreakdown])

  // Agrupamento do consumo físico por unidade de medida (kg, litro, unidade, etc.)
  const consumptionByUnit = useMemo(() => {
    const unitMap = new Map<string, { total: number; count: number }>()

    displayedBreakdown.forEach((b) => {
      const unit = b.product.unit || 'unidade'
      const current = unitMap.get(unit) || { total: 0, count: 0 }
      unitMap.set(unit, {
        total: current.total + (b.consumoQtd || 0),
        count: current.count + 1,
      })
    })

    return Array.from(unitMap.entries())
      .map(([unit, data]) => ({
        unit,
        total: data.total,
        count: data.count,
      }))
      .sort((a, b) => b.total - a.total)
  }, [displayedBreakdown])

  // Identifica se há filtro de produto único na busca
  const isSingleProductView = useMemo(() => {
    return Boolean(productSearch.trim()) && displayedBreakdown.length === 1
  }, [productSearch, displayedBreakdown])

  const faturamento = useMemo(() => {
    if (!startDate || !endDate) return null
    return faturamentos.find((f) => {
      const fStart = safeDate(f.period_start)
      const fEnd = safeDate(f.period_end)
      return fStart <= safeDate(endDate) && fEnd >= safeDate(startDate)
    })
  }, [faturamentos, startDate, endDate])

  const cmvPercent =
    cmvResult && faturamento?.value ? (cmvResult.totalCMV / faturamento.value) * 100 : 0

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    )

  return (
    <div className="space-y-6">
      {/* Barra de Filtros: Seletor de período com atalhos + calendário customizado + busca por produto */}
      <Card className="border-zinc-200 shadow-sm bg-white">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-zinc-600">Período Selecionado</Label>
              <Select
                value={periodPreset}
                onValueChange={(val) => handlePresetChange(val as PeriodPreset)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_7_days">Últimos 7 dias</SelectItem>
                  <SelectItem value="last_month">Último mês (Mês atual)</SelectItem>
                  <SelectItem value="previous_month">Mês anterior</SelectItem>
                  <SelectItem value="custom">Data específica no calendário</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                Intervalo de Datas
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setPeriodPreset('custom')
                  }}
                  className="w-full text-sm"
                />
                <span className="text-zinc-400 text-xs">até</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setPeriodPreset('custom')
                  }}
                  className="w-full text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-zinc-600">
                Buscar Produto Específico
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Nome do produto..."
                  className="pl-9 text-sm"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                  >
                    <FilterX className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {(selectedCategoryIds.length > 0 || productSearch) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 text-xs text-zinc-600">
              <span className="font-medium text-zinc-500">Filtros ativos no CMV:</span>
              {selectedCategoryIds.length > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-emerald-50 text-emerald-800 border-emerald-200"
                >
                  {selectedCategoryIds.length} categoria(s) selecionada(s) no topo
                </Badge>
              )}
              {productSearch && (
                <Badge variant="secondary" className="bg-zinc-100 text-zinc-800 border-zinc-200">
                  Produto: "{productSearch}"
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!startDate || !endDate ? (
        <div className="text-center py-16 text-zinc-500">
          <Calculator className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
          <p>Selecione um período para calcular o CMV.</p>
        </div>
      ) : (
        <>
          {/* Card em destaque com o VOLUME GASTO NO PERÍODO (Monetário + Físico) */}
          <Card className="bg-gradient-to-br from-emerald-900 to-emerald-800 text-white shadow-md border-0 overflow-hidden relative">
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-white/10 text-emerald-200">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold uppercase tracking-wider text-emerald-200">
                    Volume Gasto no Período (CMV Total)
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                  {formatCurrency(cmvResult?.totalCMV || 0)}
                </h2>
                <p className="text-xs text-emerald-100/80">
                  Período: {startDate} até {endDate} •{' '}
                  {filteredProductsCount(categoryFilteredProducts.length)}
                </p>
              </div>
              {/* Informação do filtro ativo (se houver busca por produto) */}
              {productSearch && (
                <div className="bg-white/10 border border-white/20 rounded-lg p-3 text-left md:text-right space-y-1">
                  <span className="text-xs text-emerald-200 block font-medium">
                    Filtro de busca: "{productSearch}"
                  </span>
                  <span className="text-xl font-bold text-white block">
                    {formatCurrency(displayedCMVTotal)}
                  </span>
                  {isSingleProductView ? (
                    <span className="text-xs font-semibold text-emerald-100 bg-emerald-700/60 border border-emerald-400/40 px-2.5 py-1 rounded inline-block">
                      Consumo físico:{' '}
                      <span className="text-white font-bold">
                        {formatQuantity(
                          displayedBreakdown[0].consumoQtd,
                          displayedBreakdown[0].product.unit,
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-200 block">
                      {displayedBreakdown.length} produto(s) correspondente(s)
                    </span>
                  )}
                </div>
              )}{' '}
            </div>

            {/* Faixa integrada: Consumo Físico Real Agrupado por Unidade */}
            <div className="bg-black/20 border-t border-white/10 px-6 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200 uppercase tracking-wider">
                  <Scale className="w-4 h-4 shrink-0" />
                  <span>
                    {productSearch
                      ? 'Consumo Físico dos Produtos Filtrados:'
                      : 'Consumo Físico no Período (por unidade de medida):'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {consumptionByUnit.length === 0 ? (
                    <span className="text-xs text-emerald-100/70">Nenhum consumo registrado</span>
                  ) : (
                    consumptionByUnit.map((item) => (
                      <span
                        key={item.unit}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-semibold backdrop-blur-sm border border-white/15"
                      >
                        <Package className="w-3 h-3 text-emerald-300 shrink-0" />
                        <span>{formatQuantity(item.total, item.unit)}</span>
                        <span className="text-[10px] text-emerald-200/80 font-normal">
                          ({item.count} {item.count === 1 ? 'produto' : 'produtos'})
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Resumo de Consumo Físico por Unidade de Medida */}
          <Card className="border-emerald-200/70 bg-emerald-50/30">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-emerald-950 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-700" />
                  Volume Físico Consumido no Período
                </CardTitle>
                <span className="text-xs text-zinc-500">
                  EI + Compras - EF por unidade de medida
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {consumptionByUnit.length === 0 ? (
                  <div className="col-span-full text-sm text-zinc-500 py-2">
                    Nenhum produto com consumo calculado para este período.
                  </div>
                ) : (
                  consumptionByUnit.map((item) => (
                    <div
                      key={item.unit}
                      className="bg-white rounded-lg p-3.5 border border-emerald-100 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                        <span className="uppercase font-semibold tracking-wider text-emerald-800">
                          {item.unit}
                        </span>
                        <span>
                          {item.count} {item.count === 1 ? 'produto' : 'produtos'}
                        </span>
                      </div>
                      <p className="text-xl font-extrabold text-zinc-900">
                        {formatQuantity(item.total, item.unit)}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">consumidos no período</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Grid de Balanço de Estoque Monetário */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-500">Estoque Inicial (R$)</p>
                <p className="text-xl font-bold">{formatCurrency(cmvResult?.totalInicial || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-500">Compras no Período (R$)</p>
                <p className="text-xl font-bold">{formatCurrency(cmvResult?.totalCompras || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-500">Estoque Final (R$)</p>
                <p className="text-xl font-bold">{formatCurrency(cmvResult?.totalFinal || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-500">Volume Gasto (CMV R$)</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatCurrency(cmvResult?.totalCMV || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif">% CMV sobre Faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              {faturamento ? (
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <p className="text-sm text-zinc-500">Faturamento do Período</p>
                    <p className="text-xl font-bold">{formatCurrency(faturamento.value)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">% CMV</p>
                    <p className="text-xl font-bold text-emerald-700">{cmvPercent.toFixed(2)}%</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-600">
                  Nenhum faturamento encontrado para o período selecionado. Cadastre o faturamento
                  na tela de Faturamento.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg font-serif">Detalhamento por Produto</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Consumo físico na unidade de cada produto e valor monetário correspondente
                </p>
              </div>
              <span className="text-xs text-zinc-500">
                {displayedBreakdown.length}{' '}
                {displayedBreakdown.length === 1 ? 'produto exibido' : 'produtos exibidos'}
              </span>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-50">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">
                        Est. Inicial
                      </TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Compras</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Est. Final</TableHead>
                      <TableHead className="text-right bg-emerald-50 text-emerald-950 font-semibold">
                        Consumo no Período
                      </TableHead>
                      <TableHead className="text-right">Volume Gasto (CMV)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedBreakdown.map((b) => (
                      <TableRow key={b.product.id}>
                        <TableCell className="font-medium text-zinc-900">
                          <div>{b.product.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-zinc-500">
                              Unidade: <strong className="text-zinc-700">{b.product.unit}</strong>
                              {b.product.price
                                ? ` • R$ ${b.product.price.toFixed(2)}/${b.product.unit}`
                                : ''}
                            </span>
                            {/* Em mobile, exibe a categoria logo abaixo do nome */}
                            <span className="sm:hidden">
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                {b.product.expand?.category_id?.name || '-'}
                              </Badge>
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {b.product.expand?.category_id?.name || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <div className="font-medium">{formatCurrency(b.estoqueInicial)}</div>
                          <div className="text-xs text-zinc-500">
                            {formatQuantity(b.estoqueInicialQtd, b.product.unit)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <div className="font-medium">{formatCurrency(b.compras)}</div>
                          <div className="text-xs text-zinc-500">
                            {formatQuantity(b.comprasQtd, b.product.unit)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <div className="font-medium">{formatCurrency(b.estoqueFinal)}</div>
                          <div className="text-xs text-zinc-500">
                            {formatQuantity(b.estoqueFinalQtd, b.product.unit)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right bg-emerald-50/40">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs md:text-sm bg-emerald-100 text-emerald-900 border border-emerald-200/60">
                            {formatQuantity(b.consumoQtd, b.product.unit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          {formatCurrency(b.cmv)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {displayedBreakdown.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-zinc-500 py-6 text-sm">
                          {productSearch
                            ? `Nenhum produto encontrado com o termo "${productSearch}".`
                            : 'Nenhum produto CMV encontrado para os filtros e período selecionados.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function filteredProductsCount(count: number) {
  return `${count} ${count === 1 ? 'produto monitorado' : 'produtos monitorados'}`
}
