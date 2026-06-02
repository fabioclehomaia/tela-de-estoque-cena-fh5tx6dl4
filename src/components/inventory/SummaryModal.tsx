import { Product } from '@/lib/inventory-data'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface SummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  area: string
  products: Product[]
  onConfirm: () => void
}

export function SummaryModal({ open, onOpenChange, area, products, onConfirm }: SummaryModalProps) {
  const uncounted = products.filter((p) => p.actualQty === null)
  const discrepancies = products.filter(
    (p) => p.actualQty !== null && p.actualQty !== p.expectedQty,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-md rounded-2xl p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-zinc-900">Resumo - {area}</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Verifique os dados antes de finalizar a contagem desta área.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[50vh] px-6">
          {uncounted.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Não Contados ({uncounted.length})
              </h4>
              <ul className="text-sm text-zinc-600 space-y-1.5">
                {uncounted.map((p) => (
                  <li key={p.id}>• {p.name}</li>
                ))}
              </ul>
            </div>
          )}

          {discrepancies.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-zinc-900 mb-3">
                Discrepâncias ({discrepancies.length})
              </h4>
              <div className="space-y-3">
                {discrepancies.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center text-sm border-b border-zinc-100 pb-2 last:border-0"
                  >
                    <span className="font-medium text-zinc-700 truncate pr-2">{p.name}</span>
                    <div className="flex items-center gap-2 text-xs whitespace-nowrap bg-zinc-50 px-2 py-1 rounded">
                      <span className="text-zinc-500">Esp: {p.expectedQty}</span>
                      <span className="text-zinc-300">→</span>
                      <span
                        className={
                          p.actualQty! < p.expectedQty
                            ? 'text-red-600 font-bold'
                            : 'text-emerald-700 font-bold'
                        }
                      >
                        Real: {p.actualQty}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uncounted.length === 0 && discrepancies.length === 0 && (
            <div className="text-center py-8 text-emerald-700 font-medium flex flex-col items-center gap-3">
              <div className="bg-emerald-100 p-3 rounded-full">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              Tudo perfeito! Nenhuma discrepância.
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Revisar
          </Button>
          <Button
            className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm"
            onClick={onConfirm}
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
