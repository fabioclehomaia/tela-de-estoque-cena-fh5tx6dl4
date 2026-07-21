import { CountableItem } from '@/types/inventory'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'

interface SummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CountableItem[]
  onConfirm: () => void
  submitting: boolean
}

export function SummaryModal({
  open,
  onOpenChange,
  items,
  onConfirm,
  submitting,
}: SummaryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resumo da Contagem</DialogTitle>
          <DialogDescription>Confira os valores antes de finalizar a contagem.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] rounded-md border border-zinc-100">
          <div className="p-4 space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-0"
              >
                <span className="text-sm font-medium text-zinc-800 pr-2">{item.name}</span>
                <span className="text-sm text-zinc-600 whitespace-nowrap">
                  {item.actualQty} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Confirmar Contagem'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
