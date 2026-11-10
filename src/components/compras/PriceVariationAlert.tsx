import React from 'react'
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { PriceVariationCheck } from '@/lib/price-variation'
import { cn } from '@/lib/utils'

interface PriceVariationAlertProps {
  check: PriceVariationCheck
  unit?: string
  className?: string
  compact?: boolean
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export const PriceVariationAlert: React.FC<PriceVariationAlertProps> = ({
  check,
  unit,
  className,
  compact = false,
}) => {
  if (!check.hasVariation || !check.hasReferencePrice) {
    return null
  }

  const isIncrease = check.direction === 'increase'
  const sign = isIncrease ? '+' : '-'
  const formattedPercent = `${sign}${Math.abs(check.percentDiff).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`

  const unitLabel = unit ? ` / ${unit}` : ''

  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors border',
          isIncrease
            ? 'bg-amber-50/90 text-amber-900 border-amber-300'
            : 'bg-blue-50/90 text-blue-900 border-blue-300',
          className,
        )}
      >
        <AlertTriangle
          className={cn('w-3.5 h-3.5 shrink-0', isIncrease ? 'text-amber-600' : 'text-blue-600')}
        />
        <span className="truncate">
          Variação de <strong>{formattedPercent}</strong> vs ref. (
          {formatCurrency(check.referencePrice)}
          {unitLabel})
        </span>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border p-3 text-xs flex items-start gap-2.5 transition-all shadow-sm',
        isIncrease
          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
          : 'bg-blue-50/90 border-blue-300 text-blue-950',
        className,
      )}
    >
      <div
        className={cn(
          'p-1.5 rounded-md shrink-0 mt-0.5',
          isIncrease ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700',
        )}
      >
        {isIncrease ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      </div>

      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Alerta de variação de preço
          </span>
          <span
            className={cn(
              'px-1.5 py-0.2 rounded font-bold text-[11px]',
              isIncrease ? 'bg-amber-200/80 text-amber-900' : 'bg-blue-200/80 text-blue-900',
            )}
          >
            {formattedPercent} ({isIncrease ? 'Aumento' : 'Desconto'})
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-zinc-700">
          O valor digitado (
          <strong>
            {formatCurrency(check.enteredPrice)}
            {unitLabel}
          </strong>
          ) diverge mais de <strong>15%</strong> do preço nominal de referência do produto (
          <strong>
            {formatCurrency(check.referencePrice)}
            {unitLabel}
          </strong>
          {check.referenceSource === 'history_average' ? ' - média histórica' : ''}).
        </p>

        <p className="text-[10px] text-zinc-500 italic">
          Aviso para conferência (vírgula/zero). O salvamento não é bloqueado.
        </p>
      </div>
    </div>
  )
}
