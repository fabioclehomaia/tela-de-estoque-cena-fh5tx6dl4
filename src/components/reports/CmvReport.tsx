import { useState, useEffect, useMemo } from 'react'
import { Loader2, Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { getProducts, Product } from '@/services/products'
import { getCompras, Compra } from '@/services/compras'
import { getInventoryLevels, InventoryLevel } from '@/services/inventory_levels'
import { getInventoryCounts, InventoryCount } from '@/services/inventory_counts'
import { getFaturamentos, Faturamento } from '@/services/faturamento'
import { calculateCMV } from '@/lib/cmv-utils'

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const safeDate = (s: string) => new Date(s.split(' ')[0])

export function CmvReport() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
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

  const cmvResult = useMemo(() => {
    if (!startDate || !endDate) return null
    return calculateCMV(products, compras, levels, counts, safeDate(startDate), safeDate(endDate))
  }, [products, compras, levels, counts, startDate, endDate])

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
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {!startDate || !endDate ? (
        <div className="text-center py-16 text-zinc-500">
          <Calculator className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
          <p>Selecione um período para calcular o CMV.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-500">Estoque Inicial</p>
                <p className="text-xl font-bold">{formatCurrency(cmvResult?.totalInicial || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-500">Compras</p>
                <p className="text-xl font-bold">{formatCurrency(cmvResult?.totalCompras || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-500">Estoque Final</p>
                <p className="text-xl font-bold">{formatCurrency(cmvResult?.totalFinal || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-500">CMV</p>
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
            <CardHeader>
              <CardTitle className="text-lg font-serif">Detalhamento por Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-50">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Est. Inicial</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Est. Final</TableHead>
                      <TableHead className="text-right">CMV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cmvResult?.breakdown.map((b) => (
                      <TableRow key={b.product.id}>
                        <TableCell className="font-medium text-zinc-900">
                          {b.product.name}
                          <span className="text-xs text-zinc-500 ml-1">({b.product.unit})</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {b.product.expand?.category_id?.name || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(b.estoqueInicial)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(b.compras)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(b.estoqueFinal)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          {formatCurrency(b.cmv)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!cmvResult || cmvResult.breakdown.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-zinc-500">
                          Nenhum produto CMV encontrado para o período.
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
