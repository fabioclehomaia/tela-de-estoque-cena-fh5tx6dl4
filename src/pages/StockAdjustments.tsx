import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Loader2,
  Calendar as CalendarIcon,
  PackageSearch,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  History,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { getAreas, getSubareas, Area, Subarea } from '@/services/inventory'
import { InventoryCount, getInventoryCountsRange } from '@/services/inventory_counts'
import {
  StockAdjustment,
  getStockAdjustments,
  createStockAdjustment,
  buildAdjustmentsByCountId,
} from '@/services/stock_adjustments'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { AdjustmentsConfirmDialog } from '@/components/stock-adjustments/AdjustmentsConfirmDialog'

const formatDateTime = (s: string) => {
  try {
    return format(new Date(s.replace(' ', 'T')), 'dd/MM/yyyy HH:mm')
  } catch {
    return s
  }
}

const MOTIVES = [
  'Saiu depois de contar',
  'Nova contagem',
  'Erro de produto',
  'Erro de medida',
  'Outros',
] as const

type Motive = (typeof MOTIVES)[number]

const fullDate = (s: string) => new Date(s.replace(' ', 'T'))

export default function StockAdjustments() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])

  // Seleção hierárquica
  const [areaId, setAreaId] = useState('')
  const [subareaId, setSubareaId] = useState('')

  // Contagens da subárea selecionada
  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [countsLoading, setCountsLoading] = useState(false)

  // Valores ajustados: productId -> novo valor (string para o input)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [motive, setMotive] = useState<Motive | ''>('')
  const [otherText, setOtherText] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [a, s, adj] = await Promise.all([getAreas(), getSubareas(), getStockAdjustments()])
        setAreas(a)
        setSubareas(s)
        setAdjustments(adj)
      } catch {
        toast({
          title: 'Erro',
          description: 'Erro ao carregar áreas, subáreas e ajustes.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const subareasOfArea = useMemo(
    () => subareas.filter((s) => s.area_id === areaId),
    [subareas, areaId],
  )

  // Contagens da subárea selecionada: busca 60 dias no servidor, agrupa por
  // produto (mais recente = o valor contado anteriormente).
  useEffect(() => {
    if (!subareaId) {
      setCounts([])
      return
    }
    let cancelled = false
    setCountsLoading(true)
    setEdits({})
    const from = new Date()
    from.setDate(from.getDate() - 60)
    const fromIso = from.toISOString().slice(0, 10)
    getInventoryCountsRange(fromIso, undefined, `subarea_id = "${subareaId}"`)
      .then((rows) => {
        if (cancelled) return
        const latestByProduct = new Map<string, InventoryCount>()
        for (const c of rows) {
          const pid = c.product_id
          const existing = latestByProduct.get(pid)
          if (!existing || fullDate(c.created) > fullDate(existing.created)) {
            latestByProduct.set(pid, c)
          }
        }
        setCounts(Array.from(latestByProduct.values()))
      })
      .catch(() => {
        if (!cancelled)
          toast({
            title: 'Erro',
            description: 'Erro ao carregar as contagens desta subárea.',
            variant: 'destructive',
          })
      })
      .finally(() => {
        if (!cancelled) setCountsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [subareaId, toast])

  const adjustedByCountId = useMemo(() => buildAdjustmentsByCountId(adjustments), [adjustments])

  const selectedArea = areas.find((a) => a.id === areaId) || null
  const selectedSubarea = subareas.find((s) => s.id === subareaId) || null

  // Itens retificados (para a tela de confirmação e para gravar)
  const pendingItems = useMemo(() => {
    return counts
      .map((c) => {
        const raw = edits[c.product_id]
        if (raw === undefined || raw.trim() === '') return null
        const value = Number(raw)
        if (Number.isNaN(value) || value < 0) return null
        return { count: c, newValue: value }
      })
      .filter((x): x is { count: InventoryCount; newValue: number } => x !== null)
  }, [counts, edits])

  const changedItems = useMemo(
    () => pendingItems.filter((x) => x.newValue !== x.count.counted_quantity),
    [pendingItems],
  )

  const canOpenConfirm =
    changedItems.length > 0 && motive !== '' && (motive !== 'Outros' || otherText.trim().length > 0)

  const handleConfirmSave = async () => {
    setSaving(true)
    try {
      const finalReason = motive === 'Outros' ? `Outros: ${otherText.trim()}` : motive
      const today = format(new Date(), 'yyyy-MM-dd')
      const created: StockAdjustment[] = []
      for (const item of changedItems) {
        const rec = await createStockAdjustment({
          product: item.count.product_id,
          count: item.count.id,
          adjustment_date: `${today} 00:00:00`,
          original_quantity: item.count.counted_quantity,
          corrected_quantity: item.newValue,
          reason: finalReason,
        })
        created.push(rec)
      }
      setAdjustments((prev) => [...created, ...prev])
      setEdits({})
      setMotive('')
      setOtherText('')
      setShowConfirm(false)
      toast({
        title: 'Ajuste registrado',
        description: `${created.length} ${
          created.length === 1 ? 'retificação gravada' : 'retificações gravadas'
        } em ${format(new Date(today), 'dd/MM/yyyy')}. O histórico original permanece intacto.`,
      })
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
          Retifique contagens sem apagar o histórico original. O valor corrigido fica registrado em
          seu nome para auditoria.
        </p>
      </div>

      <Card className="border-zinc-200 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-emerald-800" />
            Nova retificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 1. Área */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600">Área</Label>
              <Select
                value={areaId}
                onValueChange={(v) => {
                  setAreaId(v)
                  setSubareaId('')
                  setCounts([])
                  setEdits({})
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600">Subárea</Label>
              <Select
                value={subareaId}
                onValueChange={setSubareaId}
                disabled={!areaId || subareasOfArea.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={!areaId ? 'Escolha a área primeiro' : 'Selecione a subárea'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {subareasOfArea.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!areaId && (
            <p className="text-sm text-zinc-500 flex items-center gap-2 py-2">
              <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
              Selecione a área e a subárea para carregar o estoque contado anteriormente.
            </p>
          )}

          {areaId && subareasOfArea.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              A área <strong>{selectedArea?.name}</strong> não possui subáreas cadastradas.
            </div>
          )}

          {/* 2. Lista de produtos/contagens da subárea */}
          {selectedSubarea && (
            <div className="rounded-lg border border-zinc-200 overflow-hidden">
              <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-zinc-700">
                  {selectedArea?.name} • {selectedSubarea.name}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    estoque contado anteriormente
                  </span>
                </p>
                {countsLoading && <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />}
              </div>
              {!countsLoading && counts.length === 0 && (
                <p className="text-sm text-zinc-500 p-4">
                  Nenhuma contagem registrada nesta subárea nos últimos 60 dias.
                </p>
              )}
              {counts.length > 0 && (
                <Table>
                  <TableHeader className="bg-white">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Última contagem</TableHead>
                      <TableHead className="text-right">Estoque ajustado</TableHead>
                      <TableHead>Contado por</TableHead>
                      <TableHead>Quando</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {counts.map((c) => {
                      const product = c.expand?.product_id
                      const alreadyAdjusted = adjustedByCountId.has(c.id)
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-zinc-900">
                            <div className="flex items-center gap-2 flex-wrap">
                              {product?.name || 'Produto removido'}
                              <span className="text-xs text-zinc-500">({product?.unit})</span>
                              {!product?.active && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Inativo
                                </Badge>
                              )}
                              {alreadyAdjusted && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-amber-300 text-amber-700"
                                >
                                  já ajustado
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-zinc-700">
                            {c.counted_quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              className="w-28 ml-auto text-right"
                              placeholder={String(c.counted_quantity)}
                              value={edits[c.product_id] ?? ''}
                              onChange={(e) =>
                                setEdits((prev) => ({ ...prev, [c.product_id]: e.target.value }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-zinc-600 text-sm">
                            {c.expand?.user_id?.name || c.expand?.user_id?.email || '—'}
                          </TableCell>
                          <TableCell className="text-zinc-500 text-sm whitespace-nowrap">
                            {formatDateTime(c.created)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* 3. Motivo obrigatório */}
          {counts.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-zinc-600">
                Motivo do ajuste <span className="text-red-600">*</span>
              </Label>
              <RadioGroup
                value={motive}
                onValueChange={(v) => setMotive(v as Motive)}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
              >
                {MOTIVES.map((m) => (
                  <Label
                    key={m}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-normal cursor-pointer transition-colors',
                      motive === m
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    <RadioGroupItem value={m} className="shrink-0" />
                    {m}
                  </Label>
                ))}
              </RadioGroup>
              {motive === 'Outros' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-600">
                    Justificativa <span className="text-red-600">*</span>
                  </Label>
                  <Textarea
                    rows={2}
                    placeholder="Descreva o motivo do ajuste..."
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!canOpenConfirm}
              className="bg-emerald-800 text-white hover:bg-emerald-900"
            >
              Revisar ajustes
            </Button>
          </div>
        </CardContent>
      </Card>

      <AdjustmentsConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        items={changedItems}
        motive={motive === 'Outros' ? `Outros: ${otherText.trim()}` : motive}
        onConfirm={handleConfirmSave}
        saving={saving}
      />

      {/* Histórico de ajustes */}
      <Card className="border-zinc-200 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-800" />
            Ajustes registrados
          </CardTitle>
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
                            ? format(fullDate(adj.adjustment_date), 'dd/MM/yyyy')
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
