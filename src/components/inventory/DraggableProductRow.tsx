import { CountableItem } from '@/types/inventory'
import { ProductCard } from './ProductCard'
import { cn } from '@/lib/utils'
import { GripVertical } from 'lucide-react'

interface DraggableProductRowProps {
  item: CountableItem
  index: number
  isReorderMode: boolean
  canDrag: boolean
  isDragging: boolean
  showIndicatorAbove: boolean
  onUpdate: (id: string, qty: number | null) => void
  disabled?: boolean
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: () => void
  onDragEnd: () => void
}

export function DraggableProductRow({
  item,
  index,
  isReorderMode,
  canDrag,
  isDragging,
  showIndicatorAbove,
  onUpdate,
  disabled,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: DraggableProductRowProps) {
  return (
    <>
      {isReorderMode && showIndicatorAbove && (
        <div className="h-1 bg-emerald-500 rounded-full mx-3 shadow-sm animate-fade-in" />
      )}
      <div
        draggable={isReorderMode && canDrag}
        onDragStart={(e) => {
          if (!isReorderMode || !canDrag) {
            e.preventDefault()
            return
          }
          e.dataTransfer.effectAllowed = 'move'
          onDragStart(index)
        }}
        onDragOver={(e) => {
          if (!isReorderMode) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDragOver(e, index)
        }}
        onDrop={(e) => {
          if (!isReorderMode) return
          e.preventDefault()
          onDrop()
        }}
        onDragEnd={onDragEnd}
        className={cn(
          'relative transition-opacity',
          isReorderMode && canDrag && 'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-30',
        )}
      >
        {isReorderMode && canDrag && (
          <div className="absolute left-1 top-4 z-10 text-zinc-300 pointer-events-none">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        )}
        <ProductCard item={item} onUpdate={onUpdate} disabled={disabled || isReorderMode} />
      </div>
    </>
  )
}
