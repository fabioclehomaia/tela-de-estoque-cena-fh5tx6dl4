import { useState, useMemo } from 'react'
import { Product } from '@/lib/inventory-data'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { SummaryModal } from './SummaryModal'
import { cn } from '@/lib/utils'

interface InventoryAreaProps {
  areaName: string
  products: Product[]
  isCompleted: boolean
  onUpdate: (id: string, qty: number | null) => void
  onComplete: () => void
}

export function InventoryArea({
  areaName,
  products,
  isCompleted,
  onUpdate,
  onComplete,
}: InventoryAreaProps) {
  const [modalOpen, setModalOpen] = useState(false)

  const subAreas = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.subArea)))
  }, [products])

  const completedCount = products.filter((p) => p.actualQty !== null).length
  const totalCount = products.length
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

  return (
    <div className="pb-28 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-sm font-semibold text-zinc-600">Progresso da Área</div>
        <div className="text-sm font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
          {completedCount} / {totalCount}
        </div>
      </div>
      <Progress value={progress} className="h-2.5 mb-6 bg-zinc-200" />

      <div
        className={cn(
          'space-y-6 transition-all duration-500',
          isCompleted && 'opacity-60 pointer-events-none grayscale-[0.3]',
        )}
      >
        <Accordion type="multiple" defaultValue={subAreas} className="space-y-4">
          {subAreas.map((sub) => (
            <AccordionItem key={sub} value={sub} className="border-0 bg-transparent">
              <AccordionTrigger className="px-1 py-2 hover:no-underline [&[data-state=open]>svg]:text-emerald-700">
                <h3 className="text-lg font-bold text-zinc-900 tracking-tight sticky top-16 z-10 bg-zinc-50 py-1">
                  {sub}
                </h3>
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-0">
                {products
                  .filter((p) => p.subArea === sub)
                  .map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onUpdate={onUpdate}
                      disabled={isCompleted}
                    />
                  ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent z-40">
          <div className="max-w-3xl mx-auto">
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold shadow-elevation bg-emerald-800 hover:bg-emerald-900 text-white transition-all active:scale-[0.98]"
              onClick={() => setModalOpen(true)}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Concluir {areaName}
            </Button>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="mt-8 text-center p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 flex items-center justify-center gap-2 font-medium">
          <CheckCircle2 className="w-5 h-5" />
          Área finalizada com sucesso.
        </div>
      )}

      <SummaryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        area={areaName}
        products={products}
        onConfirm={() => {
          setModalOpen(false)
          onComplete()
        }}
      />
    </div>
  )
}
