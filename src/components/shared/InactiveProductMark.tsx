import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface InactiveProductMarkProps {
  active?: boolean | null
  /** Classes extras para o span do nome (ex.: peso da fonte). */
  nameClassName?: string
  children: React.ReactNode
}

/**
 * Marcação visual consistente de produto inativo: nome tachado + badge discreta
 * "Inativo" — o mesmo visual usado na aba Produtos. Apenas apresentação: não
 * altera cálculos, filtros, ordenação ou cores semânticas.
 */
export function InactiveProductMark({ active, nameClassName, children }: InactiveProductMarkProps) {
  const inactive = active === false
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap min-w-0">
      <span className={cn(inactive && 'text-zinc-600 line-through', nameClassName)}>
        {children}
      </span>
      {inactive && (
        <Badge
          variant="secondary"
          className="text-[10px] bg-zinc-200 text-zinc-600 border-none uppercase shrink-0"
        >
          Inativo
        </Badge>
      )}
    </span>
  )
}
