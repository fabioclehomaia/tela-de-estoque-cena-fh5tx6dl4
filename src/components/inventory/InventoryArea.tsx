import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { CountableItem } from '@/types/inventory'
import { SummaryModal } from './SummaryModal'
import { ReorderableProductRow } from './ReorderableProductRow'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { submitInventoryCounts, SubmitCountItem } from '@/services/inventory_counts'
import { Subarea } from '@/services/inventory'
import { ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useRealtime } from '@/hooks/use-realtime'

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
  onRefreshOrder?: () => void
}

export function InventoryArea({
  areaName,
  items,
  isCompleted,
  onUpdate,
  onComplete,
  userRole,
  onSaveOrder,
  onRefreshOrder,
}: InventoryAreaProps) {
  const [showSummary, setShowSummary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localItems, setLocalItems] = useState<CountableItem[]>(items)
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const canReorder = userRole === 'admin' || userRole === 'manager'

  const containerRef = useRef<HTMLDivElement>(null)
  const positionsRef = useRef<Map<string, number>>(new Map())
  const shouldAnimateRef = useRef(false)

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  useRealtime('count_order', () => {
    onRefreshOrder?.()
  })

  useLayoutEffect(() => {
    if (!shouldAnimateRef.current) return
    shouldAnimateRef.current = false

    const container = containerRef.current
    if (!container) return

    const elements = container.querySelectorAll('[data-item-key]')
    elements.forEach((el) => {
      const htmlEl = el as HTMLElement
      const key = htmlEl.dataset.itemKey
      if (!key) return

      const prevTop = positionsRef.current.get(key)
      if (prevTop === undefined) return

      const newTop = htmlEl.getBoundingClientRect().top
      const deltaY = prevTop - newTop

      if (deltaY !== 0) {
        htmlEl.style.transform = `translateY(${deltaY}px)`
        htmlEl.style.transition = 'none'

        requestAnimationFrame(() => {
          htmlEl.style.transform = ''
          htmlEl.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)'

          const cleanup = () => {
            htmlEl.style.transition = ''
            htmlEl.removeEventListener('transitionend', cleanup)
          }
          htmlEl.addEventListener('transitionend', cleanup)
        })
      }
    })

    positionsRef.current.clear()
  }, [localItems])

  const countedItems = localItems.filter((item) => item.actualQty !== null)
  const totalCount = localItems.length
  const countedCount = countedItems.length
  const allCounted = countedCount === totalCount
  const progress = totalCount > 0 ? (countedCount / totalCount) * 100 : 0

  const recordPositions = () => {
    const container = containerRef.current
    if (!container) return
    const elements = container.querySelectorAll('[data-item-key]')
    elements.forEach((el) => {
      const htmlEl = el as HTMLElement
      const key = htmlEl.dataset.itemKey
      if (key) {
        positionsRef.current.set(key, htmlEl.getBoundingClientRect().top)
      }
    })
  }

  const swapAndSave = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= localItems.length) return
    if (localItems[fromIndex].subareaId !== localItems[toIndex].subareaId) return

    recordPositions()

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

    shouldAnimateRef.current = true
    setHighlightIndex(toIndex)
    setTimeout(() => setHighlightIndex(null), 600)

    onSaveOrder(orders).catch(() => {
      toast.error('Erro ao salvar ordem. Revertendo para a posição original.')
      shouldAnimateRef.current = false
      setLocalItems(items)
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
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!allCounted || submitting || isCompleted}
            onClick={() => setShowSummary(true)}
          >
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Finalizar
          </Button>
        </div>
      </div>

      <div ref={containerRef}>
        {localItems.map((item, index) => {
          const prevItem = localItems[index - 1]
          const nextItem = localItems[index + 1]
          const isFirstInSubarea = !prevItem || prevItem.subareaId !== item.subareaId
          const isLastInSubarea = !nextItem || nextItem.subareaId !== item.subareaId

          return (
            <ReorderableProductRow
              key={item.id}
              item={item}
              canReorder={canReorder}
              isFirst={isFirstInSubarea}
              isLast={isLastInSubarea}
              isHighlighted={highlightIndex === index}
              onUpdate={onUpdate}
              disabled={isCompleted || submitting}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
            />
          )
        })}
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
