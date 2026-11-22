import { useEffect, useMemo, useRef, useState } from 'react'
import { endOfDay, startOfDay } from 'date-fns'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ClipboardCheck,
  Loader2,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  User as UserIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getStockAdjustments, StockAdjustment } from '@/services/stock_adjustments'
import { InventoryCount, getInventoryCountsRange } from '@/services/inventory_counts'
import { getSubareas, Subarea } from '@/services/inventory'
import { InactiveProductMark } from '@/components/shared/InactiveProductMark'
import {
  AUDIT_REASON_LABEL,
  AuditEvent,
  StockAdjustmentLike,
  buildAuditEvents,
  detectSuspiciousCountVariations,
  formatAuditDate,
  formatAuditDateTime,
} from '@/lib/stock-audit'

const safeDate = (s: string) => new Date(String(s).replace(' ', 'T'))

interface Props {
  /** Início do período ("yyyy-MM-dd"). Vazio = sem limite inicial. */
  startDate: string
  /** Fim do período ("yyyy-MM-dd"). Vazio = sem limite final. */
  endDate: string
  /** Busca por produto (da barra de filtros global de /reports). */
  searchQuery: string
  /** Id da área selecionada ("_all_" = todas). */
  areaId: string
  /** Id da subárea selecionada ("_all_" = todas). */
  subareaId: string
  /** Tipo de evento: "_all_" | "adjustment" | "variation". */
  eventType: string
}

/**
 * Sub aba "Auditoria de Estoque" dos Relatórios: linha do tempo única, do mais
 * recente ao mais antigo, com os ajustes de estoque registrados e as variações
 * atípicas entre contagens consecutivas (possíveis erros de digitação da
 * equipe), com rastro de responsabilidade (quem contou / quem ajustou).
 */
export default function StockAuditReport({
  startDate,
  endDate,
  searchQuery,
  areaId,
  subareaId,
  eventType,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const requestedPeriodRef = useRef(false)
  const cancelledRef = useRef(false)

  // Carga sob demanda (só acontece ao entrar na aba): últimos 60 dias de
  // contagens — janela suficiente para comparar contagens consecutivas — e
  // todos os ajustes (coleção pequena, mesma base da aba Ajustes).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const from = new Date()
    from.setDate(from.getDate() - 60)
    const fromIso = from.toISOString().slice(0, 10)
    Promise.all([getStockAdjustments(), getInventoryCountsRange(fromIso), getSubareas()])
      .then(([adj, cnt, s]) => {
        if (cancelled) return
        setAdjustments(adj)
        setCounts(cnt)
        setSubareas(s)
      })
      .catch(() => {
        if (!cancelled) setError('Erro ao carregar os dados de auditoria.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Se o período global pede contagens mais antigas que os 60 dias carregados,
  // busca o intervalo extra no servidor (uma vez; o cache é o estado counts).
  useEffect(() => {
    if (!startDate) return
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
    if (startDate > sixtyDaysAgo) return
    if (requestedPeriodRef.current) return
    requestedPeriodRef.current = true
    const to = endDate || new Date().toISOString().slice(0, 10)
    getInventoryCountsRange(startDate, to)
      .then((older) => {
        if (cancelledRef.current) return
        setCounts((prev) => {
          const seen = new Set(prev.map((c) => c.id))
          return [...prev, ...older.filter((c) => !seen.has(c.id))]
        })
      })
      .catch(() => {})
  }, [startDate, endDate])

  // Variações atípicas detectadas nas contagens carregadas.
  const variations = useMemo(() => detectSuspiciousCountVariations(counts), [counts])

  // Rastro: quem contou cada contagem (usado também nos ajustes, via count).
  const countUsers = useMemo(() => {
    const map = new Map<string, { name?: string; email?: string }>()
    counts.forEach((c) => map.set(c.id, c.expand?.user_id))
    return map
  }, [counts])

  const events = useMemo(
    () => buildAuditEvents(adjustments as StockAdjustmentLike[], variations, countUsers),
    [adjustments, variations, countUsers],
  )

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const start = startDate ? startOfDay(safeDate(startDate)) : null
    const end = endDate ? endOfDay(safeDate(endDate)) : null
    return events.filter((ev) => {
      if (q && !ev.productName.toLowerCase().includes(q)) return false
      if (eventType !== '_all_' && ev.type !== eventType) return false

      const subarea = subareas.find((s) => s.id === ev.subareaRefId)
      if (areaId !== '_all_' && subarea?.area_id !== areaId) return false
      if (subareaId !== '_all_' && subarea?.id !== subareaId) return false

      if (start && ev.date < start) return false
      if (end && ev.date > end) return false
      return true
    })
  }, [events, subareas, searchQuery, eventType, areaId, subareaId, startDate, endDate])

  const adjustmentCount = filtered.filter((ev) => ev.type === 'adjustment').length
  const variationCount = filtered.filter((ev) => ev.type === 'variation').length

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
      {/* Totalizadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white shadow-sm border-zinc-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-full text-emerald-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Eventos no período</p>
              <p className="text-2xl font-bold text-zinc-900">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-zinc-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-full text-red-700">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Ajustes de estoque</p>
              <p className="text-2xl font-bold text-zinc-900">{adjustmentCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-zinc-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-full text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Variações sinalizadas</p>
              <p className="text-2xl font-bold text-zinc-900">{variationCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legenda dos filtros (busca/área/subárea/tipo ficam na barra global de /reports) */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span>
          Variações sinalizadas: contagens consecutivas do mesmo produto cuja diferença é atípica
          (zeramento, ordem de grandeza tipo &ldquo;esqueci a vírgula&rdquo;, ou acima de 50% do
          estoque anterior). Periodo aplicável:{' '}
          {startDate ? formatAuditDate(safeDate(startDate)) : 'início'} a{' '}
          {endDate ? formatAuditDate(safeDate(endDate)) : 'hoje'}.
        </span>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Motivo / Suspeita</TableHead>
                <TableHead>Rastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ev) => (
                <TableRow key={ev.id} className={ev.type === 'variation' ? 'bg-amber-50/60' : ''}>
                  <TableCell className="text-zinc-500 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                      {formatAuditDate(ev.date)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {ev.type === 'adjustment' ? (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">
                        Ajuste
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none">
                        Variação
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-900">
                    <InactiveProductMark active={ev.productActive}>
                      {ev.productName}
                    </InactiveProductMark>
                    <span className="text-xs text-zinc-500 ml-1">({ev.unit || '—'})</span>
                    {ev.subareaName && (
                      <div className="text-[10px] text-zinc-400 font-normal mt-0.5">
                        {ev.areaName || '—'} • {ev.subareaName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-zinc-500">{ev.previousQuantity}</span>
                    <span className="mx-1 text-zinc-300">→</span>
                    <span className="font-bold text-emerald-700">{ev.newQuantity}</span>
                    <div
                      className={`text-xs ${
                        ev.delta > 0
                          ? 'text-emerald-600'
                          : ev.delta < 0
                            ? 'text-red-600'
                            : 'text-zinc-400'
                      }`}
                    >
                      ({ev.delta > 0 ? '+' : ''}
                      {ev.delta})
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-600 max-w-[240px]">
                    {ev.type === 'adjustment' ? (
                      ev.reason || '—'
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {ev.flagReason ? AUDIT_REASON_LABEL[ev.flagReason] : 'Variação atípica'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-600">
                    {ev.type === 'adjustment' ? (
                      <span className="flex flex-col text-xs gap-0.5">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3 text-zinc-400" />
                          Ajustou: {ev.adjustedBy || '—'}
                        </span>
                        <span className="text-zinc-400">
                          {ev.adjustedAt ? formatAuditDateTime(ev.adjustedAt) : '—'}
                        </span>
                      </span>
                    ) : (
                      <span className="flex flex-col text-xs gap-0.5">
                        <span className="flex items-center gap-1">
                          <ClipboardCheck className="w-3 h-3 text-zinc-400" />
                          Contou: {ev.countedBy || '—'}
                        </span>
                        <span className="text-zinc-400">{formatAuditDateTime(ev.countedAt)}</span>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                    Nenhum evento encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-zinc-100">
          {filtered.map((ev) => (
            <div
              key={ev.id}
              className={`p-4 flex flex-col gap-2 ${ev.type === 'variation' ? 'bg-amber-50/60' : ''}`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-400 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {formatAuditDate(ev.date)}
                  </p>
                  <h3 className="font-bold text-zinc-900 text-sm">
                    <InactiveProductMark active={ev.productActive}>
                      {ev.productName}
                    </InactiveProductMark>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {ev.areaName ? `${ev.areaName} • ${ev.subareaName}` : ''}
                  </p>
                </div>
                <div className="shrink-0">
                  {ev.type === 'adjustment' ? (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">
                      Ajuste
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none">
                      Variação
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-sm">
                <span className="text-xs text-zinc-500">{ev.previousQuantity}</span>
                <span className="mx-1 text-zinc-300">→</span>
                <span className="font-bold text-emerald-700">{ev.newQuantity}</span>
                <span
                  className={`ml-2 text-xs ${
                    ev.delta > 0
                      ? 'text-emerald-600'
                      : ev.delta < 0
                        ? 'text-red-600'
                        : 'text-zinc-400'
                  }`}
                >
                  ({ev.delta > 0 ? '+' : ''}
                  {ev.delta}) {ev.unit}
                </span>
              </div>
              <p className="text-xs text-zinc-600 flex items-center gap-1">
                <Scale className="w-3 h-3 text-zinc-400 shrink-0" />
                {ev.type === 'adjustment'
                  ? ev.reason || '—'
                  : ev.flagReason
                    ? AUDIT_REASON_LABEL[ev.flagReason]
                    : 'Variação atípica'}
              </p>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <UserIcon className="w-3 h-3 text-zinc-400 shrink-0" />
                {ev.type === 'adjustment'
                  ? `Ajustou: ${ev.adjustedBy || '—'} em ${ev.adjustedAt ? formatAuditDateTime(ev.adjustedAt) : '—'}`
                  : `Contou: ${ev.countedBy || '—'} em ${formatAuditDateTime(ev.countedAt)}`}
              </p>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-zinc-500">
              Nenhum evento encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
