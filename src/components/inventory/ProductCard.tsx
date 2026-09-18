import { useState, useEffect, useMemo } from 'react'
import { CountableItem } from '@/types/inventory'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ImageIcon, MinusCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'

const formatLastCountDate = (dateStr: string) => {
  try {
    const d = parseISO(dateStr.replace(' ', 'T'))
    return format(d, 'dd/MM/yyyy')
  } catch {
    return dateStr
  }
}

/**
 * Avalia o status de tempo desde a última contagem:
 * - 'red' (vermelho): mais de 7 dias sem contagem ou nunca contado (risco na semana)
 * - 'green' (verde): 6 a 7 dias sem contagem (atenção para não virar a semana sem contagem)
 * - 'recent' (neutro): contado há menos de 6 dias (contagem recente em dia)
 */
export function getCountRecencyStatus(lastCountDateStr?: string | null): {
  status: 'red' | 'green' | 'recent'
  label: string
  days: number | null
} {
  if (!lastCountDateStr) {
    return {
      status: 'red',
      label: 'Nunca contado nesta subárea (+7 dias)',
      days: null,
    }
  }

  try {
    const lastDate = parseISO(lastCountDateStr.replace(' ', 'T'))
    const days = differenceInCalendarDays(new Date(), lastDate)

    if (days > 7) {
      return {
        status: 'red',
        label: `Sem contagem há ${days} dias (+7 dias)`,
        days,
      }
    }
    if (days >= 6) {
      return {
        status: 'green',
        label: `Sem contagem há ${days} dias (atenção para a semana)`,
        days,
      }
    }
    return {
      status: 'recent',
      label: days === 0 ? 'Contado hoje' : `Contado há ${days} dia(s)`,
      days,
    }
  } catch {
    return {
      status: 'red',
      label: 'Data de contagem indefinida',
      days: null,
    }
  }
}

interface ProductCardProps {
  item: CountableItem
  onUpdate: (id: string, qty: number | null) => void
  disabled?: boolean
  showLastCount?: boolean
}

export function ProductCard({ item, onUpdate, disabled, showLastCount = true }: ProductCardProps) {
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

  const isLowStock =
    item.minStock !== null && item.actualQty !== null && item.actualQty < item.minStock

  const recency = useMemo(() => {
    return getCountRecencyStatus(item.lastCount?.date)
  }, [item.lastCount?.date])

  return (
    <div
      className={cn(
        'flex items-start justify-between p-4 bg-white border rounded-xl shadow-subtle mb-3 transition-all',
        recency.status === 'red' && 'border-l-4 border-l-red-500 border-zinc-200/80 bg-red-50/20',
        recency.status === 'green' &&
          'border-l-4 border-l-emerald-500 border-zinc-200/80 bg-emerald-50/20',
        recency.status === 'recent' && 'border-zinc-100',
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
          {showLastCount && (
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
              <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
              {item.lastCount ? (
                <span>
                  Última contagem: {formatLastCountDate(item.lastCount.date)} por{' '}
                  <span className="text-zinc-600 font-medium">{item.lastCount.userName}</span>
                </span>
              ) : (
                <span className="text-red-600 font-medium">Nunca contado</span>
              )}

              {recency.status === 'red' && (
                <span
                  title={recency.label}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                  +7 dias sem contagem
                </span>
              )}
              {recency.status === 'green' && (
                <span
                  title={recency.label}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  6-7 dias sem contagem
                </span>
              )}
            </div>
          )}
          {(isLowStock || item.actualQty === 0) && (
            <div className="flex flex-wrap gap-2 mt-1">
              {item.actualQty === 0 && (
                <Badge
                  variant="outline"
                  className="text-red-700 border-red-200 bg-red-50 gap-1 px-1.5 font-medium text-[10px] py-0.5"
                >
                  <MinusCircle className="w-3 h-3" /> Zerado
                </Badge>
              )}
              {isLowStock && (
                <Badge
                  variant="outline"
                  className="text-amber-700 border-amber-200 bg-amber-50 gap-1 px-1.5 font-medium text-[10px] py-0.5"
                >
                  <AlertTriangle className="w-3 h-3" /> Estoque Baixo
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 w-24 shrink-0 mt-1">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Qtd"
          value={localVal}
          onChange={handleChange}
          disabled={disabled}
          className="h-12 text-center text-lg font-semibold bg-zinc-50 border-zinc-200 shadow-sm transition-all focus:ring-emerald-700 focus:bg-white"
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              setLocalVal('0')
              onUpdate(item.id, 0)
            }}
            className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200 py-1 rounded hover:bg-amber-100 transition-colors"
          >
            Zerar
          </button>
        )}
      </div>
    </div>
  )
}
