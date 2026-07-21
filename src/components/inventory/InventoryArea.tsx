import { useState } from 'react'
import { CountableItem } from '@/types/inventory'
import { ProductCard } from './ProductCard'
import { SummaryModal } from './SummaryModal'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { submitInventoryCounts, SubmitCountItem } from '@/services/inventory_counts'
import { ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'

interface InventoryAreaProps {
  areaName: string
  items: CountableItem[]
  isCompleted: boolean
  onUpdate: (id: string, qty: number | null) => void
  onComplete: () => void
}

export function InventoryArea({
  areaName,
  items,
  isCompleted,
  onUpdate,
  onComplete,
}: InventoryAreaProps) {
  const [showSummary, setShowSummary] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const countedItems = items.filter((item) => item.actualQty !== null)
  const totalCount = items.length
  const countedCount = countedItems.length
  const allCounted = countedCount === totalCount
  const progress = totalCount > 0 ? (countedCount / totalCount) * 100 : 0

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
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
          disabled={!allCounted || submitting || isCompleted}
          onClick={() => setShowSummary(true)}
        >
          <ClipboardCheck className="w-4 h-4 mr-2" />
          Finalizar
        </Button>
      </div>

      <div>
        {items.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            onUpdate={onUpdate}
            disabled={isCompleted || submitting}
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
