import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { CountableItem } from '@/types/inventory'
import { SummaryModal } from './SummaryModal'
import { ReorderableProductRow } from './ReorderableProductRow'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { submitInventoryCounts, SubmitCountItem } from '@/services/inventory_counts'
import { Subarea } from '@/services/inventory'
import { ClipboardCheck, ArrowUpDown, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

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
}: InventoryAreaProps) {
  const [showSummary, setShowSummary] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localItems, setLocalItems] = useState<CountableItem[]>(items)
  const [isReordering, setIsReordering] = useState(false)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const canReorder = userRole === 'manager' || userRole === 'admin'

  const containerRef = useRef<HTMLDivElement>(null)
  const positionsRef = useRef<Map<string, number>>(new Map())
  const shouldAnimateRef = useRef(false)
  const itemsBeforeReorderRef = useRef<CountableItem[]>([])

  useEffect(() => {
    setLocalItems(items)
  }, [items])

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
  const missingItems = localItems.filter((item) => item.actualQty === null)
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

  const swapItems = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= localItems.length) return
    if (localItems[fromIndex].subareaId !== localItems[toIndex].subareaId) return

    recordPositions()

    const newItems = [...localItems]
    ;[newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]]
    setLocalItems(newItems)

    shouldAnimateRef.current = true
    setHighlightIndex(toIndex)
    setTimeout(() => setHighlightIndex(null), 600)
  }

  const handleMoveUp = (index: number) => {
    swapItems(index, index - 1)
  }

  const handleMoveDown = (index: number) => {
    swapItems(index, index + 1)
  }

  const handleStartReordering = () => {
    itemsBeforeReorderRef.current = [...localItems]
    setIsReordering(true)
  }

  const handleFinishReordering = async () => {
    setIsSavingOrder(true)

    const subareaCounters = new Map<string, number>()
    const orders = localItems.map((item) => {
      const counter = subareaCounters.get(item.subareaId) ?? 0
      subareaCounters.set(item.subareaId, counter + 1)
      return {
        product_id: item.productId,
        subarea_id: item.subareaId,
        sort_order: counter,
      }
    })

    try {
      await onSaveOrder(orders)
      setIsReordering(false)
    } catch {
      toast.error('Erro ao salvar a ordem. A lista foi restaurada à ordem anterior.')
      setLocalItems(itemsBeforeReorderRef.current)
    } finally {
      setIsSavingOrder(false)
    }
  }

  const handleFinalizeClick = () => {
    if (!allCounted) {
      setShowMissing(true)
      toast.error(
        `Há ${missingItems.length} produto(s) sem preenchimento. Preencha ou zere antes de finalizar.`,
      )
      return
    }
    setShowSummary(true)
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
          {canReorder && !isReordering && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartReordering}
              disabled={isCompleted || submitting}
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Reordenar
            </Button>
          )}
          {canReorder && isReordering && (
            <Button size="sm" onClick={handleFinishReordering} disabled={isSavingOrder}>
              {isSavingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  Concluir
                </>
              )}
            </Button>
          )}
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={submitting || isCompleted || isReordering}
            onClick={handleFinalizeClick}
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
              isReordering={isReordering}
              isFirst={isFirstInSubarea}
              isLast={isLastInSubarea}
              isHighlighted={highlightIndex === index}
              onUpdate={onUpdate}
              disabled={isCompleted || submitting || isSavingOrder}
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

      <AlertDialog open={showMissing} onOpenChange={setShowMissing}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Não é possível finalizar a contagem
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">
                  Os seguintes produtos precisam ser preenchidos ou zerados antes de finalizar:
                </p>
                <ScrollArea className="max-h-[260px] rounded-md border border-zinc-100">
                  <ul className="p-3 space-y-1">
                    {missingItems.map((item) => (
                      <li
                        key={item.id}
                        className="text-sm font-medium text-zinc-800 flex justify-between gap-2 py-1 border-b border-zinc-100 last:border-0"
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="text-zinc-400 text-xs whitespace-nowrap">
                          {item.subareaName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700">
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
