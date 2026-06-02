import { useState, useEffect } from 'react'
import { CountableItem } from '@/lib/inventory-data'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  item: CountableItem
  onUpdate: (id: string, qty: number | null) => void
  disabled?: boolean
}

export function ProductCard({ item, onUpdate, disabled }: ProductCardProps) {
  const [localVal, setLocalVal] = useState(item.actualQty?.toString() ?? '')

  useEffect(() => {
    if (item.actualQty === null) {
      setLocalVal('')
    }
  }, [item.actualQty])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalVal(val)

    if (val === '') {
      onUpdate(item.id, null)
    } else if (!isNaN(Number(val))) {
      onUpdate(item.id, Number(val))
    }
  }

  const isLowStock = item.minStock !== null && item.expectedQty < item.minStock

  return (
    <div
      className={cn(
        'flex items-start justify-between p-4 bg-white border border-zinc-100 rounded-xl shadow-subtle mb-3 transition-colors',
        disabled && 'opacity-60 bg-zinc-50/50',
      )}
    >
      <div className="flex flex-col gap-1.5 flex-1 pr-4">
        <span className="font-semibold text-zinc-900 leading-tight">{item.name}</span>
        <div className="text-sm text-zinc-500">
          Estoque Esperado:{' '}
          <span className="font-medium text-zinc-900">
            {item.expectedQty} {item.unit}
          </span>
        </div>

        {isLowStock && (
          <div className="flex flex-wrap gap-2 mt-1">
            <Badge
              variant="outline"
              className="text-amber-700 border-amber-200 bg-amber-50 gap-1 px-1.5 font-medium text-[10px] py-0.5"
            >
              <AlertTriangle className="w-3 h-3" /> Estoque Baixo
            </Badge>
          </div>
        )}
      </div>

      <div className="w-24 shrink-0">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Qtd"
          value={localVal}
          onChange={handleChange}
          disabled={disabled}
          className="h-12 text-center text-lg font-semibold bg-zinc-50 border-zinc-200 shadow-sm transition-all focus:ring-emerald-700 focus:bg-white"
        />
      </div>
    </div>
  )
}
