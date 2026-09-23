import { useState, useEffect, useMemo } from 'react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  Loader2,
  Calculator,
  Search,
  FilterX,
  TrendingDown,
  Calendar as CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

export type CmvSortColumn =
  | 'consumoQtd'
  | 'cmv'
  | 'compras'
  | 'comprasQtd'
  | 'estoqueFinal'
  | 'estoqueInicial'
  | 'name'

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

  const [sortColumn, setSortColumn] = useState<CmvSortColumn>('consumoQtd')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')

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

  // Produtos do breakdown filtrados pela lupa/busca por texto de produto específico e reordenados simultaneamente
  const displayedBreakdown = useMemo(() => {
    if (!cmvResult) return []
    let list = cmvResult.breakdown
    if (productSearch.trim()) {
      const query = productSearch.toLowerCase().trim()
      list = list.filter((b) => b.product.name.toLowerCase().includes(query))
    }

    const sorted = [...list].sort((a, b) => {
      let comparison = 0
      switch (sortColumn) {
        case 'consumoQtd':
          comparison = a.consumoQtd - b.consumoQtd
          break
        case 'cmv':
          comparison = a.cmv - b.cmv
          break
        case 'compras':
          comparison = a.compras - b.compras
          break
        case 'comprasQtd':
          comparison = a.comprasQtd - b.comprasQtd
          break
        case 'estoqueFinal':
          comparison = a.estoqueFinal - b.estoqueFinal
          break
        case 'estoqueInicial':
          comparison = a.estoqueInicial - b.estoqueInicial
          break
        case 'name':
          comparison = a.product.name.localeCompare(b.product.name, 'pt-BR')
          break
        default:
          comparison = 0
      }
      return sortDirection === 'desc' ? -comparison : comparison
    })

    return sorted
  }, [cmvResult, productSearch, sortColumn, sortDirection])

  // Volume gasto / CMV correspondente aos itens atualmente filtrados na tabela
  const displayedCMVTotal = useMemo(() => {
    return displayedBreakdown.reduce((sum, b) => sum + b.cmv, 0)
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
          {/* Card em destaque com o VOLUME GASTO NO PERÍODO (Monetário) */}
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
                    <div className="flex flex-wrap md:justify-end gap-1.5 pt-1">
                      <span className="text-xs font-semibold text-emerald-100 bg-emerald-950/70 border border-emerald-400/50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                        Entrou:
                        <span className="text-emerald-200 font-bold">
                          +
                          {formatQuantity(
                            displayedBreakdown[0].comprasQtd,
                            displayedBreakdown[0].product.unit,
                          )}
                        </span>
                      </span>
                      {(() => {
                        const item = displayedBreakdown[0]
                        const isNegative = item.consumoQtd < -0.0001
                        const isZero = Math.abs(item.consumoQtd) <= 0.0001
                        return (
                          <span
                            className={cn(
                              'text-xs font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1 border',
                              isNegative
                                ? 'text-emerald-100 bg-emerald-950/80 border-emerald-400/60'
                                : isZero
                                  ? 'text-zinc-200 bg-zinc-800/80 border-zinc-600/60'
                                  : 'text-rose-100 bg-rose-950/70 border-rose-400/50',
                            )}
                          >
                            Consumo físico:
                            <span
                              className={cn(
                                'font-bold',
                                isNegative
                                  ? 'text-emerald-300'
                                  : isZero
                                    ? 'text-zinc-300'
                                    : 'text-rose-200',
                              )}
                            >
                              {formatQuantity(item.consumoQtd, item.product.unit)}
                            </span>
                            {isNegative && (
                              <span className="text-[10px] ml-0.5 bg-emerald-500/20 px-1 py-0.2 rounded text-emerald-200">
                                Acréscimo s/ compra
                              </span>
                            )}
                          </span>
                        )
                      })()}
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-200 block">
                      {displayedBreakdown.length} produto(s) correspondente(s)
                    </span>
                  )}
                </div>
              )}
            </div>
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
            <CardHeader className="flex flex-col gap-3 pb-3">
              <div className="flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg font-serif">Detalhamento por Produto</CardTitle>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Consumo físico na unidade de cada produto e valor monetário correspondente
                  </p>
                </div>
                <span className="text-xs text-zinc-500 font-medium">
                  {displayedBreakdown.length}{' '}
                  {displayedBreakdown.length === 1 ? 'produto exibido' : 'produtos exibidos'}
                </span>
              </div>

              {/* SELETOR DE MODO DE EXIBIÇÃO / ORDENAÇÃO */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100">
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <span className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5 shrink-0">
                    <ArrowUpDown className="w-3.5 h-3.5 text-emerald-700" />
                    Modo de exibição (ordenar por):
                  </span>
                  <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                    <Select
                      value={sortColumn}
                      onValueChange={(val) => setSortColumn(val as CmvSortColumn)}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-[240px] text-xs sm:text-sm bg-white">
                        <SelectValue placeholder="Ordenar por..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consumoQtd">
                          Consumo Físico (
                          {sortDirection === 'desc' ? 'Maior → Menor' : 'Menor → Maior'})
                        </SelectItem>
                        <SelectItem value="cmv">
                          Volume Gasto / CMV R$ (
                          {sortDirection === 'desc' ? 'Maior → Menor' : 'Menor → Maior'})
                        </SelectItem>
                        <SelectItem value="compras">
                          Compras em R$ (
                          {sortDirection === 'desc' ? 'Maior → Menor' : 'Menor → Maior'})
                        </SelectItem>
                        <SelectItem value="comprasQtd">Compras Físicas (Qtd)</SelectItem>
                        <SelectItem value="estoqueFinal">Estoque Final (R$)</SelectItem>
                        <SelectItem value="estoqueInicial">Estoque Inicial (R$)</SelectItem>
                        <SelectItem value="name">Nome do Produto (A-Z)</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                      className="h-9 px-2.5 text-xs shrink-0 gap-1 bg-white hover:bg-zinc-50 border-zinc-200"
                      title={
                        sortDirection === 'desc'
                          ? 'Ordenação decrescente (maior para menor)'
                          : 'Ordenação crescente (menor para maior)'
                      }
                    >
                      {sortDirection === 'desc' ? (
                        <>
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="hidden xs:inline">Decrescente</span>
                        </>
                      ) : (
                        <>
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="hidden xs:inline">Crescente</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* LEGENDA RÁPIDA DAS CORES SEMÂNTICAS DO CONSUMO */}
                <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
                  <span className="font-medium text-zinc-600">Cores de consumo físico:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                    Negativo (Acréscimo s/ compra)
                  </span>
                  <span className="inline-flex items-center gap-1 text-zinc-600 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 ring-2 ring-zinc-200" />
                    Zero (Sem movimento)
                  </span>
                  <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />
                    Positivo (Baixa de estoque)
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TooltipProvider delayDuration={150}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-zinc-50">
                      <TableRow>
                        <TableHead>
                          <button
                            type="button"
                            onClick={() => {
                              if (sortColumn === 'name') {
                                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                              } else {
                                setSortColumn('name')
                                setSortDirection('asc')
                              }
                            }}
                            className="inline-flex items-center gap-1 text-inherit font-semibold hover:text-zinc-900"
                          >
                            Produto
                            {sortColumn === 'name' &&
                              (sortDirection === 'asc' ? (
                                <ArrowUp className="w-3 h-3 text-emerald-700" />
                              ) : (
                                <ArrowDown className="w-3 h-3 text-emerald-700" />
                              ))}
                          </button>
                        </TableHead>
                        <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortColumn === 'estoqueInicial') {
                                setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                              } else {
                                setSortColumn('estoqueInicial')
                                setSortDirection('desc')
                              }
                            }}
                            className="inline-flex items-center justify-end gap-1 text-inherit font-semibold hover:text-zinc-900 ml-auto"
                          >
                            Est. Inicial
                            {sortColumn === 'estoqueInicial' &&
                              (sortDirection === 'desc' ? (
                                <ArrowDown className="w-3 h-3 text-emerald-700" />
                              ) : (
                                <ArrowUp className="w-3 h-3 text-emerald-700" />
                              ))}
                          </button>
                        </TableHead>
                        <TableHead className="text-right hidden sm:table-cell bg-emerald-50/60 text-emerald-950 font-semibold">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortColumn === 'compras') {
                                setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                              } else {
                                setSortColumn('compras')
                                setSortDirection('desc')
                              }
                            }}
                            className="inline-flex items-center justify-end gap-1 text-emerald-950 font-semibold hover:text-emerald-900 ml-auto"
                          >
                            Compras (+)
                            {sortColumn === 'compras' &&
                              (sortDirection === 'desc' ? (
                                <ArrowDown className="w-3 h-3 text-emerald-700" />
                              ) : (
                                <ArrowUp className="w-3 h-3 text-emerald-700" />
                              ))}
                          </button>
                        </TableHead>
                        <TableHead className="text-right hidden sm:table-cell">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortColumn === 'estoqueFinal') {
                                setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                              } else {
                                setSortColumn('estoqueFinal')
                                setSortDirection('desc')
                              }
                            }}
                            className="inline-flex items-center justify-end gap-1 text-inherit font-semibold hover:text-zinc-900 ml-auto"
                          >
                            Est. Final
                            {sortColumn === 'estoqueFinal' &&
                              (sortDirection === 'desc' ? (
                                <ArrowDown className="w-3 h-3 text-emerald-700" />
                              ) : (
                                <ArrowUp className="w-3 h-3 text-emerald-700" />
                              ))}
                          </button>
                        </TableHead>
                        <TableHead className="text-right bg-zinc-100/70 text-zinc-900 font-semibold">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortColumn === 'consumoQtd') {
                                setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                              } else {
                                setSortColumn('consumoQtd')
                                setSortDirection('desc')
                              }
                            }}
                            className="inline-flex items-center justify-end gap-1 text-inherit font-semibold hover:text-zinc-900 ml-auto"
                          >
                            Consumo no Período (−)
                            {sortColumn === 'consumoQtd' &&
                              (sortDirection === 'desc' ? (
                                <ArrowDown className="w-3 h-3 text-emerald-700" />
                              ) : (
                                <ArrowUp className="w-3 h-3 text-emerald-700" />
                              ))}
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortColumn === 'cmv') {
                                setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                              } else {
                                setSortColumn('cmv')
                                setSortDirection('desc')
                              }
                            }}
                            className="inline-flex items-center justify-end gap-1 text-inherit font-semibold hover:text-zinc-900 ml-auto"
                          >
                            Volume Gasto (CMV)
                            {sortColumn === 'cmv' &&
                              (sortDirection === 'desc' ? (
                                <ArrowDown className="w-3 h-3 text-emerald-700" />
                              ) : (
                                <ArrowUp className="w-3 h-3 text-emerald-700" />
                              ))}
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedBreakdown.map((b) => {
                        const isNegativeConsumo = b.consumoQtd < -0.0001
                        const isZeroConsumo = Math.abs(b.consumoQtd) <= 0.0001
                        const isPositiveConsumo = b.consumoQtd > 0.0001

                        return (
                          <TableRow key={b.product.id}>
                            <TableCell className="font-medium text-zinc-900">
                              <div>{b.product.name}</div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-zinc-500">
                                  Unidade:{' '}
                                  <strong className="text-zinc-700">{b.product.unit}</strong>
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
                              {/* Em mobile, exibe resumo rápido de compras e consumo */}
                              <div className="sm:hidden mt-1 text-xs text-zinc-600 flex items-center gap-2 flex-wrap">
                                <span>
                                  Entrou:{' '}
                                  <strong className="text-emerald-700 font-semibold">
                                    +{formatQuantity(b.comprasQtd, b.product.unit)}
                                  </strong>
                                </span>
                                {isNegativeConsumo && (
                                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-emerald-700" />
                                    Acréscimo s/ compra (
                                    {formatQuantity(b.consumoQtd, b.product.unit)})
                                  </span>
                                )}
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
                            <TableCell className="text-right hidden sm:table-cell bg-emerald-50/20">
                              <div className="font-medium text-emerald-950">
                                {formatCurrency(b.compras)}
                              </div>
                              <div className="text-xs font-semibold text-emerald-700 inline-flex items-center justify-end gap-0.5">
                                <span className="font-bold">+</span>
                                {formatQuantity(b.comprasQtd, b.product.unit)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right hidden sm:table-cell">
                              <div className="font-medium">{formatCurrency(b.estoqueFinal)}</div>
                              <div className="text-xs text-zinc-500">
                                {formatQuantity(b.estoqueFinalQtd, b.product.unit)}
                              </div>
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right transition-colors',
                                isNegativeConsumo && 'bg-emerald-50/50',
                                isZeroConsumo && 'bg-zinc-50/60',
                                isPositiveConsumo && 'bg-red-50/40',
                              )}
                            >
                              {isNegativeConsumo ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs md:text-sm bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs cursor-help">
                                      <AlertTriangle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                      {formatQuantity(b.consumoQtd, b.product.unit)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs text-xs">
                                    <p className="font-semibold text-emerald-950">
                                      Acréscimo no estoque sem compra
                                    </p>
                                    <p className="text-zinc-600 mt-0.5">
                                      O estoque final superou o inicial sem compras registradas.
                                      Verifique se faltou imputar compras ou houve contagem errada.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : isZeroConsumo ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-medium text-xs md:text-sm bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  {formatQuantity(0, b.product.unit)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs md:text-sm bg-red-100 text-red-700 border border-red-200/70">
                                  {formatQuantity(b.consumoQtd, b.product.unit)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-700">
                              {formatCurrency(b.cmv)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
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
              </TooltipProvider>
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
