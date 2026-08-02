import { CountableItem } from '@/types/inventory'
import { ProductCard } from './ProductCard'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface ReorderableProductRowProps {
  item: CountableItem
  isReordering: boolean
  isFirst: boolean
  isLast: boolean
  isHighlighted: boolean
  onUpdate: (id: string, qty: number | null) => void
  disabled?: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

export function ReorderableProductRow({
  item,
  isReordering,
  isFirst,
  isLast,
  isHighlighted,
  onUpdate,
  disabled,
  onMoveUp,
  onMoveDown,
}: ReorderableProductRowProps) {
  return (
    <div
      data-item-key={item.id}
      className={cn(
        'relative rounded-xl transition-colors duration-200',
        isHighlighted && 'bg-emerald-50 ring-2 ring-emerald-300 ring-offset-1',
      )}
    >
      <div className="flex items-stretch gap-0.5">
        {isReordering && (
          <div className="flex flex-col justify-center gap-0.5 pl-1">
            <button
              type="button"
              disabled={isFirst || disabled}
              onClick={onMoveUp}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
                isFirst || disabled
                  ? 'text-zinc-300 cursor-not-allowed'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200',
              )}
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={isLast || disabled}
              onClick={onMoveDown}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
                isLast || disabled
                  ? 'text-zinc-300 cursor-not-allowed'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200',
              )}
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <ProductCard item={item} onUpdate={onUpdate} disabled={disabled} />
        </div>
      </div>
    </div>
  )
}
