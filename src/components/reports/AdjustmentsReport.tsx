import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { Loader2, SlidersHorizontal, Calendar as CalendarIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
import { getStockAdjustments, StockAdjustment } from '@/services/stock_adjustments'
import { getAreas, getSubareas, Area, Subarea } from '@/services/inventory'
import { InactiveProductMark } from '@/components/shared/InactiveProductMark'

const safeDate = (s: string) => parseISO(String(s).replace(' ', 'T'))

const MOTIVES = [
  'Saiu depois de contar',
  'Nova contagem',
  'Erro de produto',
  'Erro de medida',
  'Outros',
] as const

interface Props {
  /** Início do período ("yyyy-MM-dd"). Vazio = sem limite inicial. */
  startDate: string
  /** Fim do período ("yyyy-MM-dd"). Vazio = sem limite final. */
  endDate: string
}

/**
 * Sub aba "Ajustes" dos Relatórios: tabela dos ajustes de estoque registrados
 * (quantidade, data, usuário e motivo), com os mesmos filtros de período,
 * área e subárea das demais abas.
 */
export default function AdjustmentsReport({ startDate, endDate }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])

  const [areaId, setAreaId] = useState('_all_')
  const [subareaId, setSubareaId] = useState('_all_')
  const [motiveFilter, setMotiveFilter] = useState('_all_')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getStockAdjustments(), getAreas(), getSubareas()])
      .then(([adj, a, s]) => {
        if (cancelled) return
        setAdjustments(adj)
        setAreas(a)
        setSubareas(s)
      })
      .catch(() => {
        if (!cancelled) setError('Erro ao carregar os ajustes de estoque.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const subareasOfArea = useMemo(
    () => (areaId === '_all_' ? subareas : subareas.filter((s) => s.area_id === areaId)),
    [subareas, areaId],
  )

  const filtered = useMemo(() => {
    return adjustments.filter((adj) => {
      const subarea = subareas.find((s) => s.id === adj.expand?.count?.subarea_id)
      if (areaId !== '_all_' && subarea?.area_id !== areaId) return false
      if (subareaId !== '_all_' && subarea?.id !== subareaId) return false

      if (motiveFilter !== '_all_') {
        const reason = adj.reason || ''
        if (motiveFilter === 'Outros') {
          if (!reason.startsWith('Outros')) return false
        } else if (reason !== motiveFilter) {
          return false
        }
      }

      const date = safeDate(adj.adjustment_date || adj.created)
      if (startDate) {
        const start = startOfDay(safeDate(startDate))
        if (date < start) return false
      }
      if (endDate) {
        const end = endOfDay(safeDate(endDate))
        if (date > end) return false
      }
      return true
    })
  }, [adjustments, subareas, areaId, subareaId, motiveFilter, startDate, endDate])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-sm text-red-800">{error}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-zinc-200 bg-white">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label>Área</Label>
            <Select
              value={areaId}
              onValueChange={(v) => {
                setAreaId(v)
                setSubareaId('_all_')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Subárea</Label>
            <Select value={subareaId} onValueChange={setSubareaId} disabled={areaId === '_all_'}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todas</SelectItem>
                {subareasOfArea.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={motiveFilter} onValueChange={setMotiveFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todos</SelectItem>
                {MOTIVES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((adj) => {
                const product = adj.expand?.product
                const user = adj.expand?.adjusted_by
                const diff = adj.corrected_quantity - adj.original_quantity
                return (
                  <TableRow key={adj.id}>
                    <TableCell className="text-zinc-500 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                        {adj.adjustment_date
                          ? format(safeDate(adj.adjustment_date), 'dd/MM/yyyy')
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-zinc-900">
                      <InactiveProductMark active={product ? product.active !== false : true}>
                        {product?.name || 'Produto removido'}
                      </InactiveProductMark>
                      <span className="text-xs text-zinc-500 ml-1">({product?.unit || '—'})</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs text-zinc-500">{adj.original_quantity}</span>
                      <span className="mx-1 text-zinc-300">→</span>
                      <span className="font-bold text-emerald-700">{adj.corrected_quantity}</span>
                      <span
                        className={`ml-2 text-xs ${
                          diff > 0
                            ? 'text-emerald-600'
                            : diff < 0
                              ? 'text-red-600'
                              : 'text-zinc-400'
                        }`}
                      >
                        ({diff > 0 ? '+' : ''}
                        {diff})
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-600 max-w-[240px] truncate">
                      {adj.reason || '—'}
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {user?.name || user?.email || '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                    Nenhum ajuste encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-zinc-100">
          {filtered.map((adj) => {
            const product = adj.expand?.product
            const user = adj.expand?.adjusted_by
            const diff = adj.corrected_quantity - adj.original_quantity
            return (
              <div key={adj.id} className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">
                      <InactiveProductMark active={product ? product.active !== false : true}>
                        {product?.name || 'Produto removido'}
                      </InactiveProductMark>
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {adj.adjustment_date
                        ? format(safeDate(adj.adjustment_date), 'dd/MM/yyyy')
                        : '—'}
                      {' • '}
                      {user?.name || user?.email || '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-zinc-500">{adj.original_quantity}</span>
                    <span className="mx-1 text-zinc-300">→</span>
                    <span className="font-bold text-emerald-700">{adj.corrected_quantity}</span>
                    <div
                      className={`text-xs ${
                        diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-zinc-400'
                      }`}
                    >
                      ({diff > 0 ? '+' : ''}
                      {diff})
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3 text-zinc-400" />
                  {adj.reason || '—'}
                </p>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-zinc-500">
              Nenhum ajuste encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
