import { useState, useEffect, useMemo } from 'react'
import { Loader2, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
import { PeriodSelector, PeriodRange } from '@/components/shared/PeriodSelector'

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

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

export function FinancialDashboard() {
  const [period, setPeriod] = useState<PeriodRange>({ start: '', end: '' })
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['CMV'])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [compras, setCompras] = useState<Compra[]>([])

  useEffect(() => {
    const load = async () => {
      const [p, c] = await Promise.all([getProducts(), getCompras()])
      setProducts(p)
      setCompras(c)
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
        const catProducts = products.filter((p) => (p.cost_category || 'CMV') === cat)
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
            const pTotal = pCompras.reduce((sum, c) => sum + (c.quantity || 0) * (c.price || 0), 0)
            return { product: p, total: pTotal, count: pCompras.length }
          })
          .filter((item) => item.total > 0)
          .sort((a, b) => b.total - a.total)
        return { category: cat, total, productBreakdown }
      })
      .filter((item) => item.total > 0 || item.productBreakdown.length > 0)
  }, [products, compras, period, selectedCategories])

  const barData = categoryData.map((d) => ({ name: d.category, total: d.total }))
  const pieData = categoryData.map((d, i) => ({
    name: d.category,
    value: d.total,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }))
  const grandTotal = categoryData.reduce((s, d) => s + d.total, 0)

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    )

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="mb-2 block">Selecionar Categorias de Custo</Label>
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
          <PeriodSelector value={period} onChange={setPeriod} />
        </CardContent>
      </Card>

      {categoryData.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
          <p>Selecione categorias e um período para visualizar a análise financeira.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif">Comparativo por Categoria</CardTitle>
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
                <ChartContainer
                  config={Object.fromEntries(
                    categoryData.map((d, i) => [
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
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-zinc-500 mb-3">Total por Categoria</p>
                {categoryData.map((d) => (
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
                <p className="text-sm font-medium text-zinc-500 mb-3">Total Geral</p>
                <p className="text-2xl font-bold text-emerald-800">{formatCurrency(grandTotal)}</p>
              </CardContent>
            </Card>
          </div>

          {categoryData.map((d) => (
            <Card key={d.category}>
              <CardHeader>
                <CardTitle className="text-lg font-serif">
                  {d.category} — {formatCurrency(d.total)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-zinc-50">
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Nº Compras</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.productBreakdown.map((item) => (
                        <TableRow key={item.product.id}>
                          <TableCell className="font-medium text-zinc-900">
                            {item.product.name}
                          </TableCell>
                          <TableCell className="text-zinc-500">{item.product.unit}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-700">
                            {formatCurrency(item.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {d.productBreakdown.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-zinc-500">
                            Nenhuma compra registrada nesta categoria para o período.
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
