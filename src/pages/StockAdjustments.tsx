import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Loader2,
  PackageSearch,
  AlertTriangle,
  SlidersHorizontal,
  History,
  Search,
  X,
} from 'lucide-react'
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
import { groupCountsByProduct, formatCountDate } from '@/lib/count-history'
import {
  StockAdjustment,
  getStockAdjustments,
  createStockAdjustment,
  buildAdjustmentsByCountId,
} from '@/services/stock_adjustments'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { AdjustmentsConfirmDialog } from '@/components/stock-adjustments/AdjustmentsConfirmDialog'
import { describeStockAdjustmentError } from '@/services/stock_adjustments_errors'

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

const latestByProduct = (rows: InventoryCount[]) => {
  return groupCountsByProduct(rows).map((g) => g[0])
}

/** groupCountsByProduct devolve grupos; a tela guarda um Map productId -> contagens. */
const toCountsByProduct = (rows: InventoryCount[]): Map<string, InventoryCount[]> => {
  const map = new Map<string, InventoryCount[]>()
  for (const group of groupCountsByProduct(rows)) {
    if (group[0]) map.set(group[0].product_id, group)
  }
  return map
}

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

  // Busca de produto específico (a ajustar)
  const [search, setSearch] = useState('')
  const [globalResults, setGlobalResults] = useState<InventoryCount[]>([])
  const [globalLoading, setGlobalLoading] = useState(false)

  // Contagens mantidas por produto (todas as dos últimos 60 dias) para que o
  // usuário escolha QUAL contagem retificar quando houver mais de uma.
  const [countsByProduct, setCountsByProduct] = useState<Map<string, InventoryCount[]>>(new Map())
  // productId -> countId escolhido como base da retificação
  const [selectedCount, setSelectedCount] = useState<Record<string, string>>({})

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
        setCountsByProduct(toCountsByProduct(rows))
        setCounts(latestByProduct(rows))
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

  // Busca global de produto (sem subárea selecionada): última contagem do
  // produto nos últimos 60 dias, em qualquer área. Debounce de 350ms.
  useEffect(() => {
    const term = search.trim()
    if (subareaId || term.length < 2) {
      setGlobalResults([])
      return
    }
    let cancelled = false
    setGlobalLoading(true)
    const timer = setTimeout(() => {
      const from = new Date()
      from.setDate(from.getDate() - 60)
      const fromIso = from.toISOString().slice(0, 10)
      getInventoryCountsRange(fromIso, undefined, `product_id.name ~ "${term}"`)
        .then((rows) => {
          if (!cancelled) setGlobalResults(latestByProduct(rows))
          if (!cancelled) setCountsByProduct(toCountsByProduct(rows))
        })
        .catch(() => {
          if (!cancelled) setGlobalResults([])
        })
        .finally(() => {
          if (!cancelled) setGlobalLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, subareaId])

  const adjustedByCountId = useMemo(() => buildAdjustmentsByCountId(adjustments), [adjustments])

  const selectedArea = areas.find((a) => a.id === areaId) || null
  const selectedSubarea = subareas.find((s) => s.id === subareaId) || null

  // Itens disponíveis na tabela: da subárea selecionada, ou (sem subárea) os
  // produtos encontrados pela busca global.
  const baseItems = useMemo(() => {
    if (subareaId) return counts
    return globalResults
  }, [subareaId, counts, globalResults])

  // Filtro em tempo real pelo termo de busca sobre o que está carregado
  // (quando há subárea selecionada, filtra dentro dela).
  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return baseItems
    return baseItems.filter((c) => (c.expand?.product_id?.name || '').toLowerCase().includes(term))
  }, [baseItems, search])

  // Contagem efetivamente usada como base de cada linha: a escolhida no seletor
  // de data ou, na falta, a mais recente do produto.
  const effectiveCountOf = (productId: string): InventoryCount | undefined => {
    const list = countsByProduct.get(productId) || []
    const chosenId = selectedCount[productId]
    if (chosenId) {
      const chosen = list.find((c) => c.id === chosenId)
      if (chosen) return chosen
    }
    return list[0]
  }

  // Itens retificados (para a tela de confirmação e para gravar) — considera
  // SEMPRE todas as contagens carregadas por produto, mesmo as ocultas pela
  // busca. A chave de edição é `productId::countId`, então retificar contagens
  // diferentes do mesmo produto gera linhas distintas.
  const pendingItems = useMemo(() => {
    const items: { count: InventoryCount; newValue: number }[] = []
    for (const [key, raw] of Object.entries(edits)) {
      if (raw === undefined || raw.trim() === '') continue
      const sep = key.lastIndexOf('::')
      if (sep < 0) continue
      const productId = key.slice(0, sep)
      const countId = key.slice(sep + 2)
      const count = countsByProduct.get(productId)?.find((c) => c.id === countId)
      if (!count) continue
      const value = Number(raw)
      if (Number.isNaN(value) || value < 0) continue
      items.push({ count, newValue: value })
    }
    // Ordena pela data da contagem (mais antiga primeiro) só para leitura
    items.sort(
      (a, b) =>
        new Date(a.count.created.replace(' ', 'T')).getTime() -
        new Date(b.count.created.replace(' ', 'T')).getTime(),
    )
    return items
  }, [edits, countsByProduct])

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
      const created: StockAdjustment[] = []
      for (const item of changedItems) {
        // A data do ajuste é a da CONTAGEM retificada — é ela que ancora o
        // CMV retroativo (o ajuste entra na apuração do período da contagem).
        const countDay = item.count.created.split(' ')[0]
        const rec = await createStockAdjustment({
          product: item.count.product_id,
          count: item.count.id,
          adjustment_date: `${countDay} 00:00:00`,
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
        } em ${format(new Date(), 'dd/MM/yyyy')}. O histórico original permanece intacto.`,
      })
    } catch (error: unknown) {
      console.error('Falha ao gravar ajuste de estoque:', error)
      toast({
        title: 'Erro',
        description:
          describeStockAdjustmentError(error) ||
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

          {/* Busca de produto específico */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-600">Buscar produto específico</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <Input
                type="text"
                className="pl-9 pr-9"
                placeholder={
                  subareaId
                    ? 'Filtrar produto dentro da subárea selecionada...'
                    : 'Digite o nome do produto (mín. 2 letras) para buscá-lo em qualquer subárea...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 transition-colors"
                  title="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {subareaId
                ? 'A busca filtra a lista de produtos da subárea selecionada.'
                : 'Sem subárea selecionada, a busca localiza o produto em qualquer subárea com contagem dos últimos 60 dias.'}
            </p>
          </div>

          {!areaId && search.trim().length < 2 && (
            <p className="text-sm text-zinc-500 flex items-center gap-2 py-2">
              <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
              Selecione a área e a subárea — ou busque um produto pelo nome acima.
            </p>
          )}

          {areaId && subareasOfArea.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              A área <strong>{selectedArea?.name}</strong> não possui subáreas cadastradas.
            </div>
          )}

          {/* 2. Lista de produtos/contagens da subárea (ou resultado da busca global) */}
          {(subareaId || globalResults.length > 0 || globalLoading) && (
            <div className="rounded-lg border border-zinc-200 overflow-hidden">
              <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-zinc-700">
                  {subareaId
                    ? `${selectedArea?.name} • ${selectedSubarea?.name}`
                    : 'Resultado da busca'}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {subareaId
                      ? 'estoque contado anteriormente'
                      : 'última contagem nos últimos 60 dias'}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  {countsLoading && <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />}
                  {globalLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
                  {visibleItems.length !== baseItems.length && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {visibleItems.length} de {baseItems.length} produtos
                    </Badge>
                  )}
                </div>
              </div>
              {!countsLoading && visibleItems.length === 0 && (
                <p className="text-sm text-zinc-500 p-4">
                  {subareaId
                    ? search.trim()
                      ? `Nenhum produto da subárea corresponde a "${search.trim()}".`
                      : 'Nenhuma contagem registrada nesta subárea nos últimos 60 dias.'
                    : 'Nenhum produto encontrado. Digite pelo menos 2 letras do nome.'}
                </p>
              )}
              {visibleItems.length > 0 && (
                <Table>
                  <TableHeader className="bg-white">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Estoque anterior</TableHead>
                      <TableHead className="text-right">
                        Contagem a retificar / novo valor
                      </TableHead>
                      <TableHead>Contado por</TableHead>
                      <TableHead>Quando</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.map((c) => {
                      const product = c.expand?.product_id
                      const alreadyAdjusted = adjustedByCountId.has(c.id)
                      // Todas as contagens deste produto (mais recente primeiro):
                      // base para escolher QUAL contagem será retificada.
                      const countOptions = countsByProduct.get(c.product_id) || [c]
                      // Contagem efetiva (a escolhida no seletor ou a mais recente):
                      // é dela que sai o "estoque anterior" da retificação.
                      const effective = effectiveCountOf(c.product_id) || c
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-zinc-900">
                            <div className="flex items-center gap-2 flex-wrap">
                              {product?.name || 'Produto removido'}
                              {!subareaId && c.expand?.subarea_id?.expand?.area_id && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-normal text-zinc-500"
                                >
                                  {c.expand.subarea_id.expand.area_id.name} •{' '}
                                  {c.expand.subarea_id.name}
                                </Badge>
                              )}
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
                            {effective.counted_quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              {countOptions.length > 1 && (
                                <Select
                                  value={
                                    (selectedCount[c.product_id] || countOptions[0].id) ===
                                    countOptions[0].id
                                      ? 'latest'
                                      : selectedCount[c.product_id]
                                  }
                                  onValueChange={(v) => {
                                    const target = v === 'latest' ? countOptions[0].id : v
                                    setSelectedCount((prev) => ({
                                      ...prev,
                                      [c.product_id]: target,
                                    }))
                                    // A contagem escolhida passa a ser a base da
                                    // retificação deste produto: limpa as edições
                                    // das outras contagens dele.
                                    setEdits((prev) => {
                                      const next: Record<string, string> = {}
                                      for (const [k, val] of Object.entries(prev)) {
                                        if (!k.startsWith(`${c.product_id}::`)) next[k] = val
                                      }
                                      return next
                                    })
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-[170px] text-[11px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {countOptions.map((opt, idx) => (
                                      <SelectItem
                                        key={opt.id}
                                        value={idx === 0 ? 'latest' : opt.id}
                                      >
                                        {idx === 0 ? 'Mais recente' : 'Contagem'} •{' '}
                                        {formatCountDate(opt.created)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                className="w-28 text-right"
                                placeholder={String(c.counted_quantity)}
                                value={edits[`${c.product_id}::${c.id}`] ?? ''}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [`${c.product_id}::${c.id}`]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-600 text-sm">
                            {effective.expand?.user_id?.name ||
                              effective.expand?.user_id?.email ||
                              '—'}
                          </TableCell>
                          <TableCell className="text-zinc-500 text-sm whitespace-nowrap">
                            {formatDateTime(effective.created)}
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
          {(subareaId ? counts.length > 0 : changedItems.length > 0) && (
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
        onSave={handleConfirmSave}
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
                            ? format(new Date(adj.adjustment_date.replace(' ', 'T')), 'dd/MM/yyyy')
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
