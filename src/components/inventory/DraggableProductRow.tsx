import { CountableItem } from '@/types/inventory'
import { ProductCard } from './ProductCard'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface DraggableProductRowProps {
  item: CountableItem
  isReorderMode: boolean
  isFirst: boolean
  isLast: boolean
  highlighted: boolean
  onUpdate: (id: string, qty: number | null) => void
  disabled?: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

export function DraggableProductRow({
  item,
  isReorderMode,
  isFirst,
  isLast,
  highlighted,
  onUpdate,
  disabled,
  onMoveUp,
  onMoveDown,
}: DraggableProductRowProps) {
  return (
    <div
      className={cn(
        'relative transition-all duration-300 rounded-xl',
        highlighted && 'bg-emerald-50 ring-2 ring-emerald-300 ring-offset-1',
      )}
    >
      <div className="flex items-stretch gap-0.5">
        {isReorderMode && (
          <div className="flex flex-col justify-center gap-0.5 pl-1">
            <button
              type="button"
              disabled={isFirst}
              onClick={onMoveUp}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
                isFirst
                  ? 'text-zinc-300 cursor-not-allowed'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200',
              )}
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={onMoveDown}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
                isLast
                  ? 'text-zinc-300 cursor-not-allowed'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200',
              )}
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <ProductCard item={item} onUpdate={onUpdate} disabled={disabled || isReorderMode} />
        </div>
      </div>
    </div>
  )
}
