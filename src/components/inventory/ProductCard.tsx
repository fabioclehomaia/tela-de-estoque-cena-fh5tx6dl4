import { useState, useEffect } from 'react'
import { CountableItem } from '@/types/inventory'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  item: CountableItem
  onUpdate: (id: string, qty: number | null) => void
  disabled?: boolean
}

import pb from '@/lib/pocketbase/client'
import { ImageIcon } from 'lucide-react'

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
      <div className="flex gap-3 flex-1 pr-4">
        {item.image ? (
          <div className="w-14 h-14 rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0">
            <img
              src={`${pb.baseUrl}/api/files/products/${item.productId}/${item.image}?thumb=100x100`}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5 text-zinc-300" />
          </div>
        )}
        <div className="flex flex-col gap-1.5 justify-center">
          <span className="font-semibold text-zinc-900 leading-tight">{item.name}</span>
          <span className="text-xs text-zinc-500">Unidade: {item.unit}</span>
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
      </div>

      <div className="w-24 shrink-0 mt-1">
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
