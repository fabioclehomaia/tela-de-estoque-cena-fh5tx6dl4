import { format } from 'date-fns'
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

interface AdjustmentsConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PendingAdjustmentItem[]
  motive: string
  onSave: () => void
  saving: boolean
}

export function AdjustmentsConfirmDialog({
  open,
  onOpenChange,
  items,
  motive,
  onSave,
  saving,
}: AdjustmentsConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              ✓
            </span>
            Confirmar ajustes
          </DialogTitle>
          <DialogDescription>
            Revise as retificações antes de gravar. Elas ficam registradas em seu nome e o histórico
            original permanece intacto.
          </DialogDescription>
        </DialogHeader>

        {motive && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
            <span className="text-amber-600">⚠</span>
            <span className="text-amber-800">
              Motivo selecionado: <strong>{motive}</strong>
            </span>
          </div>
        )}

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Data da contagem</TableHead>
                <TableHead className="text-right">Estoque anterior</TableHead>
                <TableHead className="text-right">Estoque ajustado</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(({ count, newValue }) => {
                const diff = newValue - count.counted_quantity
                const countDate = count.created.replace(' ', 'T')
                return (
                  <TableRow key={count.id}>
                    <TableCell className="font-medium">
                      {count.expand?.product_id?.name || 'Produto removido'}
                      <span className="ml-1 text-xs text-zinc-500">
                        ({count.expand?.product_id?.unit})
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-zinc-600 text-sm whitespace-nowrap">
                      {format(new Date(countDate), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-right text-zinc-700">
                      {count.counted_quantity}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700">
                      {newValue}
                    </TableCell>
                    <TableCell
                      className={
                        diff === 0
                          ? 'text-right text-zinc-400'
                          : diff > 0
                            ? 'text-right font-medium text-emerald-600'
                            : 'text-right font-medium text-red-600'
                      }
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving || items.length === 0}>
            {saving ? 'Gravando…' : 'Confirmar e gravar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
