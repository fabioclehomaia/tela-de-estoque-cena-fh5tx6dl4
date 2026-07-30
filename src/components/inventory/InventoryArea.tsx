import { useState, useEffect } from 'react'
import { CountableItem } from '@/types/inventory'
import { SummaryModal } from './SummaryModal'
import { ReorderableProductRow } from './ReorderableProductRow'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { submitInventoryCounts, SubmitCountItem } from '@/services/inventory_counts'
import { Subarea } from '@/services/inventory'
import { ClipboardCheck, ArrowUpDown, Check } from 'lucide-react'
import { toast } from 'sonner'

interface InventoryAreaProps {
  areaName: string
  items: CountableItem[]
  isCompleted: boolean
  onUpdate: (id: string, qty: number | null) => void
  onComplete: () => void
  userRole?: string
  subareas: Subarea[]
  onSaveOrder: (
    orders: Array<{ product_id: string; subarea_id: string; sort_order: number }>,
  ) => Promise<void>
}

export function InventoryArea({
  areaName,
  items,
  isCompleted,
  onUpdate,
  onComplete,
  userRole,
  onSaveOrder,
}: InventoryAreaProps) {
  const [showSummary, setShowSummary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [localItems, setLocalItems] = useState<CountableItem[]>(items)
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const canReorder = userRole === 'admin' || userRole === 'manager'

  useEffect(() => {
    if (!isReorderMode) {
      setLocalItems(items)
    }
  }, [items, isReorderMode])

  const displayItems = isReorderMode ? localItems : items
  const countedItems = displayItems.filter((item) => item.actualQty !== null)
  const totalCount = displayItems.length
  const countedCount = countedItems.length
  const allCounted = countedCount === totalCount
  const progress = totalCount > 0 ? (countedCount / totalCount) * 100 : 0

  const enterReorderMode = () => {
    setLocalItems([...items])
    setIsReorderMode(true)
  }

  const exitReorderMode = () => {
    setIsReorderMode(false)
    setHighlightIndex(null)
  }

  const swapAndSave = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= localItems.length) return

    const newItems = [...localItems]
    ;[newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]]
    setLocalItems(newItems)

    const subareaCounters = new Map<string, number>()
    const orders = newItems.map((item) => {
      const counter = subareaCounters.get(item.subareaId) ?? 0
      subareaCounters.set(item.subareaId, counter + 1)
      return {
        product_id: item.productId,
        subarea_id: item.subareaId,
        sort_order: counter,
      }
    })

    setHighlightIndex(toIndex)
    setTimeout(() => setHighlightIndex(null), 600)

    onSaveOrder(orders).catch(() => {
      toast.error('Erro ao salvar ordem.')
    })
  }

  const handleMoveUp = (index: number) => {
    swapAndSave(index, index - 1)
  }

  const handleMoveDown = (index: number) => {
    swapAndSave(index, index + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const counts: SubmitCountItem[] = countedItems.map((item) => ({
        product_id: item.productId,
        subarea_id: item.subareaId,
        counted_quantity: item.actualQty as number,
      }))
      await submitInventoryCounts(counts)
      toast.success('Contagem salva com sucesso!')
      setShowSummary(false)
      onComplete()
    } catch (err: any) {
      const message =
        err?.response?.message || err?.message || 'Erro ao salvar contagens. Tente novamente.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-zinc-100 shadow-sm">
        <div className="flex flex-col gap-1.5 flex-1">
          <span className="text-sm font-medium text-zinc-700">
            {countedCount} de {totalCount} produtos contados
          </span>
          <Progress value={progress} className="h-2" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canReorder && !isReorderMode && (
            <Button
              variant="outline"
              size="sm"
              disabled={isCompleted || items.length === 0}
              onClick={enterReorderMode}
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Reordenar
            </Button>
          )}
          {canReorder && isReorderMode && (
            <Button
              size="sm"
              onClick={exitReorderMode}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="w-4 h-4 mr-1" />
              Concluir
            </Button>
          )}
          {!isReorderMode && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!allCounted || submitting || isCompleted}
              onClick={() => setShowSummary(true)}
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Finalizar
            </Button>
          )}
        </div>
      </div>

      <div>
        {displayItems.map((item, index) => (
          <ReorderableProductRow
            key={item.id}
            item={item}
            index={index}
            total={displayItems.length}
            isReorderMode={isReorderMode}
            isHighlighted={highlightIndex === index}
            onUpdate={onUpdate}
            disabled={isCompleted || submitting}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />
        ))}
      </div>

      <SummaryModal
        open={showSummary}
        onOpenChange={setShowSummary}
        items={countedItems}
        onConfirm={handleSubmit}
        submitting={submitting}
      />
    </div>
  )
}
