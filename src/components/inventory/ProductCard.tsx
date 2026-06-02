import { useState, useEffect } from 'react'
import { Product } from '@/lib/inventory-data'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  onUpdate: (id: string, qty: number | null) => void
  disabled?: boolean
}

export function ProductCard({ product, onUpdate, disabled }: ProductCardProps) {
  const [localVal, setLocalVal] = useState(product.actualQty?.toString() ?? '')

  useEffect(() => {
    if (product.actualQty === null) {
      setLocalVal('')
    }
  }, [product.actualQty])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalVal(val)

    if (val === '') {
      onUpdate(product.id, null)
    } else if (!isNaN(Number(val))) {
      onUpdate(product.id, Number(val))
    }
  }

  return (
    <div
      className={cn(
        'flex items-start justify-between p-4 bg-white border border-zinc-100 rounded-xl shadow-subtle mb-3 transition-colors',
        disabled && 'opacity-60 bg-zinc-50/50',
      )}
    >
      <div className="flex flex-col gap-1.5 flex-1 pr-4">
        <span className="font-semibold text-zinc-900 leading-tight">{product.name}</span>
        <div className="text-sm text-zinc-500">
          Estoque:{' '}
          <span className="font-medium">
            {product.expectedQty} {product.unit}
          </span>
        </div>

        {(product.status === 'low_stock' || product.status === 'near_expiry') && (
          <div className="flex flex-wrap gap-2 mt-1">
            {product.status === 'low_stock' && (
              <Badge
                variant="outline"
                className="text-amber-700 border-amber-200 bg-amber-50 gap-1 px-1.5 font-medium"
              >
                <AlertTriangle className="w-3 h-3" /> Baixo
              </Badge>
            )}
            {product.status === 'near_expiry' && (
              <Badge
                variant="outline"
                className="text-red-700 border-red-200 bg-red-50 gap-1 px-1.5 font-medium"
              >
                <Clock className="w-3 h-3" /> Próx. Venc.
              </Badge>
            )}
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
