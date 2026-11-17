import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { InventoryCount } from '@/services/inventory_counts'
import type { Subarea } from '@/services/inventory'

export interface PendingAdjustmentItem {
  count: InventoryCount
  newValue: number
}

export interface ConfirmationItem {
  label: string
  count: InventoryCount
  original: number
  newValue: number
  unit: string
}

interface Props {
  open: boolean
  items: ConfirmationItem[]
  saving: boolean
  subarea: Subarea | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Tela de confirmação final do Ajuste de Estoque: mostra, para cada item
 * retificado, o "estoque anterior" e o "estoque ajustado" antes de gravar.
 */
export default function AdjustmentsConfirmDialog({
  open,
  items,
  saving,
  subarea,
  onConfirm,
  onCancel,
}: Props) {
  const confirmable = items.length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            Confirmar ajustes de estoque
          </DialogTitle>
          <DialogDescription>
            {subarea
              ? `Os itens abaixo serão retificados na subárea ${subarea.name}. Revise antes de gravar.`
              : 'Os itens abaixo serão retificados. Revise antes de gravar.'}
          </DialogDescription>
        </DialogHeader>

        {confirmable ? (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <Table>
              <TableHeader className="bg-zinc-50">
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Estoque anterior</TableHead>
                  <TableHead className="w-8" />
                  <TableHead className="text-right">Estoque ajustado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.count.id}>
                    <TableCell className="font-medium text-zinc-900 max-w-[220px]">
                      <div className="flex flex-col">
                        <span className="truncate">{it.label}</span>
                        <span className="text-xs text-zinc-500">{it.unit}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-zinc-600">
                      <Input readOnly disabled value={it.original} className="w-20 text-right" />
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="w-4 h-4 text-emerald-600 mx-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        readOnly
                        disabled
                        value={it.newValue}
                        className="w-20 text-right font-bold text-emerald-700"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Nenhum item com valor alterado. Edite ao menos um valor antes de confirmar.</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Voltar / Corrigir
          </Button>
          <Button
            onClick={onConfirm}
            disabled={saving || !confirmable}
            className="bg-emerald-800 text-white hover:bg-emerald-900"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gravando...
              </>
            ) : (
              <>
                <Badge
                  variant="outline"
                  className="bg-white/10 text-white border-white/30 mr-1 hidden sm:inline-flex"
                >
                  {items.length}
                </Badge>
                Confirmar ajuste{items.length === 1 ? '' : 's'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
