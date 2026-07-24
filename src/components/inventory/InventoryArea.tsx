import { useState, useEffect } from 'react'
import { CountableItem } from '@/types/inventory'
import { SummaryModal } from './SummaryModal'
import { DraggableProductRow } from './DraggableProductRow'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { submitInventoryCounts, SubmitCountItem } from '@/services/inventory_counts'
import { Subarea } from '@/services/inventory'
import { ClipboardCheck, ArrowUpDown, Check, X } from 'lucide-react'
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const canReorder = userRole === 'admin' || userRole === 'manager'

  useEffect(() => {
    if (!isReorderMode) {
      setLocalItems(items)
    }
  }, [items, isReorderMode])

  const displayItems = isReorderMode ? localItems : items
  const canDrag = displayItems.length > 1
  const countedItems = displayItems.filter((item) => item.actualQty !== null)
  const totalCount = displayItems.length
  const countedCount = countedItems.length
  const allCounted = countedCount === totalCount
  const progress = totalCount > 0 ? (countedCount / totalCount) * 100 : 0

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2
    const target = e.clientY < midpoint ? index : index + 1
    if (target === draggedIndex || target === draggedIndex + 1) {
      setDropTargetIndex(null)
      return
    }
    setDropTargetIndex(target)
  }

  const handleDrop = async () => {
    if (draggedIndex === null || dropTargetIndex === null) {
      setDraggedIndex(null)
      setDropTargetIndex(null)
      return
    }
    const target = dropTargetIndex
    if (target === draggedIndex || target === draggedIndex + 1) {
      setDraggedIndex(null)
      setDropTargetIndex(null)
      return
    }

    const newItems = [...localItems]
    const [moved] = newItems.splice(draggedIndex, 1)
    const adjustedTarget = target > draggedIndex ? target - 1 : target
    newItems.splice(adjustedTarget, 0, moved)

    setLocalItems(newItems)
    setDraggedIndex(null)
    setDropTargetIndex(null)

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

    setSavingOrder(true)
    try {
      await onSaveOrder(orders)
    } catch {
      setLocalItems(items)
      toast.error('Erro ao salvar ordem. Revertendo alterações.')
    } finally {
      setSavingOrder(false)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }

  const enterReorderMode = () => {
    setLocalItems([...items])
    setIsReorderMode(true)
  }

  const exitReorderMode = () => {
    setLocalItems(items)
    setIsReorderMode(false)
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }

  const saveAndExitReorderMode = () => {
    setIsReorderMode(false)
    setDraggedIndex(null)
    setDropTargetIndex(null)
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
            <>
              <Button variant="outline" size="sm" onClick={exitReorderMode} disabled={savingOrder}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={saveAndExitReorderMode}
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={savingOrder}
              >
                <Check className="w-4 h-4 mr-1" />
                Finalizar
              </Button>
            </>
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
          <DraggableProductRow
            key={item.id}
            item={item}
            index={index}
            isReorderMode={isReorderMode}
            canDrag={canDrag}
            isDragging={draggedIndex === index}
            showIndicatorAbove={dropTargetIndex === index}
            onUpdate={onUpdate}
            disabled={isCompleted || submitting}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
        {isReorderMode && dropTargetIndex === displayItems.length && (
          <div className="h-1 bg-emerald-500 rounded-full mx-3 shadow-sm animate-fade-in" />
        )}
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
