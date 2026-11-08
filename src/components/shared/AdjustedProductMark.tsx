import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { StockAdjustment } from '@/services/stock_adjustments'
import { cn } from '@/lib/utils'

interface AdjustedProductMarkProps {
  productId: string
  adjustments: StockAdjustment[]
  /** Início do período exibido ("yyyy-MM-dd" ou ISO). Opcional. */
  periodStart?: string
  /** Fim do período exibido ("yyyy-MM-dd" ou ISO). Opcional. */
  periodEnd?: string
  className?: string
}

const startOfDay = (value?: string) => {
  if (!value) return undefined
  const d = parseISO(value)
  return Number.isNaN(d.getTime())
    ? undefined
    : new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Badge discreta "Ajustado" para produtos que tiveram ajuste de contagem no
 * período exibido. No tooltip (hover/click) mostra quem ajustou e quando.
 * Renderiza null quando não há ajuste — igual ao InactiveProductMark.
 */
export function AdjustedProductMark({
  productId,
  adjustments,
  periodStart,
  periodEnd,
  className,
}: AdjustedProductMarkProps) {
  const productAdjustments = useMemo(() => {
    const start = startOfDay(periodStart)
    const end = startOfDay(periodEnd)
    return adjustments.filter((a) => {
      if (a.product !== productId) return false
      const adjDate = startOfDay(a.adjustment_date)
      if (!adjDate) return false
      if (start && adjDate < start) return false
      if (end && adjDate > end) return false
      return true
    })
  }, [adjustments, productId, periodStart, periodEnd])

  if (productAdjustments.length === 0) return null

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] py-0 px-1.5 font-semibold bg-amber-100 text-amber-800 border border-amber-300 cursor-help',
              className,
            )}
          >
            Ajustado
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className="font-semibold text-amber-900">
            {productAdjustments.length === 1
              ? 'Contagem ajustada'
              : `${productAdjustments.length} ajustes de contagem`}
          </p>
          <ul className="mt-1 space-y-1">
            {productAdjustments.slice(0, 5).map((a) => {
              const when = a.created ? format(parseISO(a.created), 'dd/MM/yyyy HH:mm') : ''
              const who = a.expand?.adjusted_by?.name || a.expand?.adjusted_by?.email || 'Usuário'
              const original = a.original_quantity
              const corrected = a.corrected_quantity
              return (
                <li key={a.id} className="text-zinc-600">
                  {who}
                  {when ? ` • ${when}` : ''} — de {original} para {corrected}
                </li>
              )
            })}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
