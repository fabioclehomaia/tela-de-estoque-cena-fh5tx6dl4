import { useState, useEffect, useMemo } from 'react'
import {
  Loader2,
  BarChart3,
  ShoppingCart,
  Activity,
  Search,
  FilterX,
  Info,
  TrendingDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { getProducts, Product } from '@/services/products'
import { getCompras, Compra } from '@/services/compras'
import { getInventoryLevels, InventoryLevel } from '@/services/inventory_levels'
import { getInventoryCounts, InventoryCount } from '@/services/inventory_counts'
import { PeriodSelector, PeriodRange } from '@/components/shared/PeriodSelector'
import { calculateProductConsumption } from '@/lib/cmv-utils'

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatQuantity = (val: number, unit?: string) => {
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val)
  return unit ? `${formatted} ${unit}` : formatted
}

const COST_CATEGORIES = [
  'CMV',
  'Manutenção predial',
  'Utensílios',
  'Alimentação de funcionários',
  'Limpeza',
  'Descartáveis',
  'Decoração',
  'Operacional',
]

const PIE_COLORS = [
  '#059669',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
]

const safeDate = (s: string) => new Date(s.split(' ')[0])

export type CalculationMode = 'purchases' | 'consumption'

interface FinancialDashboardProps {
  selectedCategoryIds?: string[]
}

export function FinancialDashboard({ selectedCategoryIds = [] }: FinancialDashboardProps) {
  const [calculationMode, setCalculationMode] = useState<CalculationMode>('purchases')
  const [productSearch, setProductSearch] = useState('')
  const [period, setPeriod] = useState<PeriodRange>({ start: '', end: '' })
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['CMV'])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [counts, setCounts] = useState<InventoryCount[]>([])

  useEffect(() => {
    const load = async () => {
      const [p, c, l, ct] = await Promise.all([
        getProducts(),
        getCompras(),
        getInventoryLevels(),
        getInventoryCounts(),
      ])
      setProducts(p)
      setCompras(c)
      setLevels(l)
      setCounts(ct)
      setLoading(false)
    }
    load()
  }, [])

  const categoryData = useMemo(() => {
    if (!period.start || !period.end) return []
    const sStart = safeDate(period.start)
    const sEnd = safeDate(period.end)

    return COST_CATEGORIES.filter((cat) => selectedCategories.includes(cat))
      .map((cat) => {
        let catProducts = products.filter((p) => (p.cost_category || 'CMV') === cat)
        if (selectedCategoryIds.length > 0) {
          catProducts = catProducts.filter((p) => {
            const matchStandard = p.category_id
              ? selectedCategoryIds.includes(p.category_id)
              : false
            const costCat = p.cost_category ? `cost:${p.cost_category}` : undefined
            const matchCost = costCat ? selectedCategoryIds.includes(costCat) : false
            return matchStandard || matchCost
          })
        }

        if (calculationMode === 'purchases') {
          // MODO 1: Gasto com Compras (comportamento atual preservado)
          const catProductIds = new Set(catProducts.map((p) => p.id))
          const catCompras = compras.filter((c) => {
            if (!catProductIds.has(c.product_id)) return false
            const d = safeDate(c.date)
            return d >= sStart && d <= sEnd
          })
          const total = catCompras.reduce((sum, c) => sum + (c.quantity || 0) * (c.price || 0), 0)
          const productBreakdown = catProducts
            .map((p) => {
              const pCompras = catCompras.filter((c) => c.product_id === p.id)
              const pTotal = pCompras.reduce(
                (sum, c) => sum + (c.quantity || 0) * (c.price || 0),
                0,
              )
              const pQtd = pCompras.reduce((sum, c) => sum + (c.quantity || 0), 0)
              return {
                product: p,
                total: pTotal,
                count: pCompras.length,
                comprasQtd: pQtd,
                estoqueInicialQtd: 0,
                estoqueFinalQtd: 0,
                consumoQtd: pQtd,
                hasInventoryData: true,
              }
            })
            .filter((item) => item.total > 0)
            .sort((a, b) => b.total - a.total)

          return { category: cat, total, productBreakdown }
        } else {
          // MODO 2: Consumo Real (Estoque inicial + Compras - Estoque final)
          const productBreakdown = catProducts
            .map((p) => {
              const detail = calculateProductConsumption(p, compras, levels, counts, sStart, sEnd)
              return {
                product: p,
                total: detail.consumoValor,
                count: detail.comprasCount,
                comprasQtd: detail.comprasQtd,
                estoqueInicialQtd: detail.estoqueInicialQtd,
                estoqueFinalQtd: detail.estoqueFinalQtd,
                consumoQtd: detail.consumoQtd,
                hasInventoryData: detail.hasInventoryData,
              }
            })
            .filter((item) => item.total !== 0 || item.count > 0 || item.hasInventoryData)
            .sort((a, b) => b.total - a.total)

          const total = productBreakdown.reduce((sum, item) => sum + item.total, 0)
          return { category: cat, total, productBreakdown }
        }
      })
      .filter((item) => item.total > 0 || item.productBreakdown.length > 0)
  }, [
    products,
    compras,
    levels,
    counts,
    period,
    selectedCategories,
    selectedCategoryIds,
    calculationMode,
  ])

  // Aplicar busca por produto (quando digitado)
  const filteredCategoryData = useMemo(() => {
    if (!productSearch.trim()) return categoryData
    const q = productSearch.toLowerCase().trim()
    return categoryData
      .map((cat) => {
        const filteredBreakdown = cat.productBreakdown.filter((item) =>
          item.product.name.toLowerCase().includes(q),
        )
        const subtotal = filteredBreakdown.reduce((sum, item) => sum + item.total, 0)
        return {
          ...cat,
          total: subtotal,
          productBreakdown: filteredBreakdown,
        }
      })
      .filter((cat) => cat.productBreakdown.length > 0)
  }, [categoryData, productSearch])

  const barData = filteredCategoryData.map((d) => ({
    name: d.category,
    total: Math.max(0, d.total),
  }))
  const pieData = filteredCategoryData
    .filter((d) => d.total > 0)
    .map((d, i) => ({
      name: d.category,
      value: d.total,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }))
  const grandTotal = filteredCategoryData.reduce((s, d) => s + d.total, 0)

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    )

  return (
    <div className="space-y-6">
      {/* SELETOR DE MODO NO TOPO */}
      <Card className="border-emerald-100 bg-gradient-to-r from-emerald-50/40 via-white to-emerald-50/20 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Visão de Cálculo Financeiro
                </span>
                <Badge
                  variant="secondary"
                  className={
                    calculationMode === 'consumption'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-blue-100 text-blue-900 border-blue-300'
                  }
                >
                  {calculationMode === 'consumption'
                    ? 'Visão: Consumo Real'
                    : 'Visão: Gasto com Compras'}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {calculationMode === 'consumption'
                  ? 'Aplica a fórmula do CMV (Estoque inicial + Compras − Estoque final) para todas as fontes de custo.'
                  : 'Soma apenas as compras realizadas no período selecionado (quantidade × preço da compra).'}
              </p>
            </div>

            {/* Toggle / Segmented control claro */}
            <div
              role="radiogroup"
              aria-label="Modo de cálculo"
              className="inline-flex items-center p-1 bg-zinc-100 rounded-lg border border-zinc-200 self-start sm:self-auto shrink-0"
            >
              <button
                type="button"
                role="radio"
                aria-checked={calculationMode === 'purchases'}
                onClick={() => setCalculationMode('purchases')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  calculationMode === 'purchases'
                    ? 'bg-white text-emerald-900 shadow-sm font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Gasto com Compras</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={calculationMode === 'consumption'}
                onClick={() => setCalculationMode('consumption')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  calculationMode === 'consumption'
                    ? 'bg-emerald-700 text-white shadow-sm font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Consumo Real</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="block">Selecionar Categorias de Custo</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategories(COST_CATEGORIES)}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                >
                  Marcar todas
                </button>
                <span className="text-zinc-300">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  Limpar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {COST_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:text-emerald-700"
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={(checked) => {
                      if (checked === true) setSelectedCategories((prev) => [...prev, cat])
                      else setSelectedCategories((prev) => prev.filter((c) => c !== cat))
                    }}
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2 border-t border-zinc-100">
            <div className="md:col-span-2">
              <PeriodSelector value={period} onChange={setPeriod} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600">Buscar Produto</Label>
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
              <span className="font-medium text-zinc-500">Filtros ativos:</span>
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

      {filteredCategoryData.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
          <p>
            {productSearch
              ? `Nenhum registro encontrado para "${productSearch}".`
              : 'Selecione categorias e um período para visualizar a análise financeira.'}
          </p>
        </div>
      ) : (
        <>
          {/* Card Resumo do Modo Ativo */}
          <Card
            className={
              calculationMode === 'consumption'
                ? 'bg-gradient-to-br from-emerald-900 to-emerald-800 text-white shadow-md border-0'
                : 'bg-gradient-to-br from-blue-900 to-blue-800 text-white shadow-md border-0'
            }
          >
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-white/10">
                    {calculationMode === 'consumption' ? (
                      <TrendingDown className="w-5 h-5 text-emerald-200" />
                    ) : (
                      <ShoppingCart className="w-5 h-5 text-blue-200" />
                    )}
                  </div>
                  <span className="text-sm font-semibold uppercase tracking-wider opacity-90">
                    {calculationMode === 'consumption'
                      ? 'Consumo Real Total (Fórmula CMV)'
                      : 'Gasto Total com Compras'}
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                  {formatCurrency(grandTotal)}
                </h2>
                <p className="text-xs opacity-80">
                  Período: {period.start} até {period.end} • Visão:{' '}
                  {calculationMode === 'consumption' ? 'Consumo Real' : 'Gasto com Compras'}
                </p>
              </div>

              {calculationMode === 'consumption' && (
                <div className="bg-white/10 border border-white/20 rounded-lg p-3 text-xs space-y-1 max-w-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-200">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Lógica de Consumo Real</span>
                  </div>
                  <p className="text-emerald-100/90 leading-relaxed">
                    Consumo = Estoque Inicial + Compras − Estoque Final. Produtos sem contagens no
                    período utilizam apenas as compras diretas registradas.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif">
                  {calculationMode === 'consumption'
                    ? 'Consumo Real por Categoria'
                    : 'Gasto por Categoria (Compras)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ total: { label: 'Total', color: 'hsl(var(--primary))' } }}
                  className="h-[300px] w-full"
                >
                  <BarChart data={barData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={60}
                      tickFormatter={(v) => formatCurrency(v).replace('R$', '')}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="total"
                      fill="var(--color-total)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif">Distribuição (Pizza)</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ChartContainer
                    config={Object.fromEntries(
                      filteredCategoryData.map((d, i) => [
                        d.category,
                        { label: d.category, color: PIE_COLORS[i % PIE_COLORS.length] },
                      ]),
                    )}
                    className="h-[300px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-zinc-400 text-sm">
                    Sem dados positivos para exibir na pizza.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-zinc-500 mb-3">
                  {calculationMode === 'consumption'
                    ? 'Consumo Real por Categoria'
                    : 'Total Comprado por Categoria'}
                </p>
                {filteredCategoryData.map((d) => (
                  <div
                    key={d.category}
                    className="flex justify-between py-2 border-b border-zinc-100 last:border-0"
                  >
                    <Badge variant="outline" className="text-xs">
                      {d.category}
                    </Badge>
                    <span className="font-bold text-emerald-700">{formatCurrency(d.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-zinc-500 mb-3">Total Geral da Visão</p>
                <p className="text-2xl font-bold text-emerald-800">{formatCurrency(grandTotal)}</p>
                <p className="text-xs text-zinc-500 mt-2">
                  Modo:{' '}
                  {calculationMode === 'consumption' ? 'Consumo Real (CMV)' : 'Gasto com Compras'}
                </p>
              </CardContent>
            </Card>
          </div>

          {filteredCategoryData.map((d) => (
            <Card key={d.category}>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg font-serif">
                  {d.category} — {formatCurrency(d.total)}
                </CardTitle>
                <Badge
                  variant="secondary"
                  className={
                    calculationMode === 'consumption'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 text-xs'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200 text-xs'
                  }
                >
                  {calculationMode === 'consumption' ? 'Consumo Real' : 'Compras'}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-zinc-50">
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Unidade</TableHead>
                        {calculationMode === 'consumption' ? (
                          <>
                            <TableHead className="text-right hidden sm:table-cell">
                              Est. Inicial
                            </TableHead>
                            <TableHead className="text-right hidden sm:table-cell bg-emerald-50/60 text-emerald-950 font-semibold">
                              Compras (+)
                            </TableHead>
                            <TableHead className="text-right hidden sm:table-cell">
                              Est. Final
                            </TableHead>
                            <TableHead className="text-right bg-red-50 text-red-950 font-semibold">
                              Consumo Físico (-)
                            </TableHead>
                            <TableHead className="text-right font-semibold">Consumo (R$)</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead className="text-right">Qtd Comprada</TableHead>
                            <TableHead className="text-right">Nº Compras</TableHead>
                            <TableHead className="text-right font-semibold">
                              Total Compras
                            </TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.productBreakdown.map((item) => (
                        <TableRow key={item.product.id}>
                          <TableCell className="font-medium text-zinc-900">
                            <div>{item.product.name}</div>
                            {calculationMode === 'consumption' && !item.hasInventoryData && (
                              <div className="text-[11px] text-amber-700 flex items-center gap-1 mt-0.5">
                                <Info className="w-3 h-3 shrink-0" />
                                <span>Sem contagens no período (baseado em compras)</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-zinc-500">{item.product.unit}</TableCell>

                          {calculationMode === 'consumption' ? (
                            <>
                              <TableCell className="text-right hidden sm:table-cell text-xs text-zinc-600">
                                {item.hasInventoryData
                                  ? formatQuantity(item.estoqueInicialQtd, item.product.unit)
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-right hidden sm:table-cell bg-emerald-50/20 text-xs font-semibold text-emerald-800">
                                +{formatQuantity(item.comprasQtd, item.product.unit)}
                              </TableCell>
                              <TableCell className="text-right hidden sm:table-cell text-xs text-zinc-600">
                                {item.hasInventoryData
                                  ? formatQuantity(item.estoqueFinalQtd, item.product.unit)
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-right bg-red-50/40">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs bg-red-100 text-red-700 border border-red-200/70">
                                  {formatQuantity(item.consumoQtd, item.product.unit)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-emerald-700">
                                {formatCurrency(item.total)}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-right text-sm">
                                {formatQuantity(item.comprasQtd, item.product.unit)}
                              </TableCell>
                              <TableCell className="text-right text-sm">{item.count}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-700">
                                {formatCurrency(item.total)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                      {d.productBreakdown.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={calculationMode === 'consumption' ? 7 : 5}
                            className="text-center text-zinc-500"
                          >
                            Nenhum registro nesta categoria para o período.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
