import { CountableItem } from '@/types/inventory'
import { ProductCard } from './ProductCard'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface ReorderableProductRowProps {
  item: CountableItem
  index: number
  total: number
  isReorderMode: boolean
  isHighlighted: boolean
  onUpdate: (id: string, qty: number | null) => void
  disabled?: boolean
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
}

export function ReorderableProductRow({
  item,
  index,
  total,
  isReorderMode,
  isHighlighted,
  onUpdate,
  disabled,
  onMoveUp,
  onMoveDown,
}: ReorderableProductRowProps) {
  const isFirst = index === 0
  const isLast = index === total - 1

  return (
    <div
      className={cn(
        'flex items-stretch gap-1 transition-all duration-300 rounded-xl',
        isHighlighted && 'bg-emerald-50 ring-1 ring-emerald-200',
      )}
    >
      {isReorderMode && (
        <div className="flex flex-col justify-center gap-0.5 shrink-0 pl-1 py-3">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMoveUp(index)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
            aria-label="Mover para cima"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMoveDown(index)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
            aria-label="Mover para baixo"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex-1">
        <ProductCard item={item} onUpdate={onUpdate} disabled={disabled || isReorderMode} />
      </div>
    </div>
  )
}
