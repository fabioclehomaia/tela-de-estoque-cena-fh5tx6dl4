import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InventoryCount } from '@/services/inventory_counts'

export interface PendingAdjustmentItem {
  count: InventoryCount
  newValue: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PendingAdjustmentItem[]
  motive: string
  onConfirm: () => void
  saving: boolean
}

export function AdjustmentsConfirmDialog({
  open,
  onOpenChange,
  items,
  motive,
  onConfirm,
  saving,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            Confirmar ajustes
          </DialogTitle>
          <DialogDescription>
            Revise as retificações antes de gravar. Elas ficam registradas em seu nome e o histórico
            original permanece intacto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Motivo selecionado: <strong>{motive}</strong>
            </span>
          </div>

          <div className="rounded-lg border border-zinc-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-50">
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Estoque anterior</TableHead>
                  <TableHead className="text-right">Estoque ajustado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const product = item.count.expand?.product_id
                  const diff = item.newValue - item.count.counted_quantity
                  return (
                    <TableRow key={item.count.id}>
                      <TableCell className="font-medium text-zinc-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          {product?.name || 'Produto removido'}
                          <span className="text-xs text-zinc-500">({product?.unit})</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-zinc-700">
                        {item.count.counted_quantity}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {item.newValue}
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm ${
                          diff > 0
                            ? 'text-emerald-600'
                            : diff < 0
                              ? 'text-red-600'
                              : 'text-zinc-500'
                        }`}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={saving}
            className="bg-emerald-800 text-white hover:bg-emerald-900"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? 'Gravando...' : 'Confirmar e gravar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AdjustmentsConfirmDialog
