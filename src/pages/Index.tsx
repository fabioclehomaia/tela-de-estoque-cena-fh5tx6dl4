import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { mockInventory, Product, Area } from '@/lib/inventory-data'
import { InventoryArea } from '@/components/inventory/InventoryArea'
import { ChefHat, Wine, ConciergeBell } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Index() {
  const [inventory, setInventory] = useState<Product[]>(mockInventory)
  const [completedAreas, setCompletedAreas] = useState<Set<Area>>(new Set())
  const { toast } = useToast()

  const handleUpdate = (id: string, qty: number | null) => {
    setInventory((prev) => prev.map((p) => (p.id === id ? { ...p, actualQty: qty } : p)))
  }

  const handleComplete = (area: Area) => {
    setCompletedAreas((prev) => {
      const next = new Set(prev)
      next.add(area)
      return next
    })

    toast({
      title: 'Área Concluída',
      description: `A contagem do setor ${area} foi salva com sucesso.`,
      className: 'bg-emerald-800 text-white border-none shadow-elevation',
    })
  }

  const getIcon = (area: Area) => {
    switch (area) {
      case 'Cozinha':
        return <ChefHat className="w-4 h-4 mr-2" />
      case 'Bar':
        return <Wine className="w-4 h-4 mr-2" />
      case 'Salão':
        return <ConciergeBell className="w-4 h-4 mr-2" />
    }
  }

  const areas: Area[] = ['Cozinha', 'Salão', 'Bar']

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <Tabs defaultValue="Cozinha" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 mb-6 bg-zinc-200/60 p-1 rounded-xl">
          {areas.map((area) => (
            <TabsTrigger
              key={area}
              value={area}
              className="data-[state=active]:bg-white data-[state=active]:text-emerald-900 data-[state=active]:shadow-sm text-sm font-semibold rounded-lg transition-all"
            >
              {getIcon(area)}
              {area}
            </TabsTrigger>
          ))}
        </TabsList>

        {areas.map((area) => (
          <TabsContent key={area} value={area} className="focus-visible:outline-none mt-0">
            <InventoryArea
              areaName={area}
              products={inventory.filter((p) => p.area === area)}
              isCompleted={completedAreas.has(area)}
              onUpdate={handleUpdate}
              onComplete={() => handleComplete(area)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
