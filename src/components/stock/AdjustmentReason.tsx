import { useMemo } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, ArrowRight, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export const ADJUSTMENT_REASONS = [
  'Saiu depois de contar',
  'Nova contagem',
  'Erro de produto',
  'Erro de medida',
  'Outros',
] as const

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]

export interface AdjustmentDraftItem {
  countId: string
  productId: string
  productName: string
  unit: string
  previousQuantity: number
  newQuantity: number
  areaName: string
  subareaName: string
}

interface AdjustmentConfirmModalProps {
  open: boolean
  loading: boolean
  items: AdjustmentDraftItem[]
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function AdjustmentReasonPicker({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {ADJUSTMENT_REASONS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
            value === r
              ? 'bg-emerald-800 text-white border-emerald-800'
              : 'bg-white text-zinc-600 border-zinc-200 hover:border-emerald-300 hover:text-emerald-800',
          )}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

export function AdjustmentConfirmModal({
  open,
  loading,
  items,
  onOpenChange,
  onConfirm,
}: AdjustmentConfirmModalProps) {
  const changed = items.filter((i) => i.newQuantity !== i.previousQuantity)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Confirmar ajuste de estoque</DialogTitle>
          <DialogDescription>
            Revise as retificações antes de gravar. O histórico original de contagens permanece
            intacto.
          </DialogDescription>
        </DialogHeader>

        {changed.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Nenhuma quantidade foi alterada. Corrija pelo menos um valor antes de registrar o
              ajuste.
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-50">
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-right">Estoque anterior</TableHead>
                  <TableHead className="text-center w-8" />
                  <TableHead className="text-right">Estoque ajustado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changed.map((item) => (
                  <TableRow key={item.countId}>
                    <TableCell className="font-medium text-zinc-900">
                      {item.productName}
                      <span className="text-xs text-zinc-500 ml-1">({item.unit})</span>
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      <div className="flex flex-col">
                        <span>{item.areaName}</span>
                        <span className="text-xs text-zinc-400">{item.subareaName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-zinc-500">
                      {item.previousQuantity}
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-300 mx-auto" />
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-700">
                      {item.newQuantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {changed.length > 0 && items.length > changed.length && (
          <p className="text-xs text-zinc-500">
            {items.length - changed.length}{' '}
            {items.length - changed.length === 1 ? 'item sem alteração' : 'itens sem alteração'}{' '}
            permanecerá com o valor contado.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Voltar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading || changed.length === 0}
            className="bg-emerald-800 text-white hover:bg-emerald-900"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gravando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" /> Gravar ajuste
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
