import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InventoryArea } from '@/components/inventory/InventoryArea'
import { ChefHat, Wine, ConciergeBell, Loader2, PackageSearch } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { getAreas, getSubareas, Area, Subarea } from '@/services/inventory'
import {
  getInventoryLevels,
  updateInventoryLevel,
  InventoryLevel,
} from '@/services/inventory_levels'
import { createInventoryCount } from '@/services/inventory_counts'
import { CountableItem } from '@/lib/inventory-data'

export default function Index() {
  const { user } = useAuth()
  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [localActualQties, setLocalActualQties] = useState<Record<string, number | null>>({})
  const [completedAreas, setCompletedAreas] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const [a, s, l] = await Promise.all([getAreas(), getSubareas(), getInventoryLevels()])
      setAreas(a)
      setSubareas(s)
      setLevels(l)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdate = (levelId: string, qty: number | null) => {
    setLocalActualQties((prev) => ({ ...prev, [levelId]: qty }))
  }

  const handleComplete = async (areaId: string, areaName: string) => {
    const areaSubareas = subareas.filter((s) => s.area_id === areaId)
    const areaLevels = levels.filter((l) => areaSubareas.some((s) => s.id === l.subarea_id))

    try {
      const promises = areaLevels.map(async (level) => {
        const actualQty = localActualQties[level.id]
        if (actualQty !== undefined && actualQty !== null) {
          await createInventoryCount({
            product_id: level.product_id,
            subarea_id: level.subarea_id,
            user_id: user.id,
            previous_quantity: level.quantity,
            counted_quantity: actualQty,
          })
          await updateInventoryLevel(level.id, { quantity: actualQty })
        }
      })
      await Promise.all(promises)

      setCompletedAreas((prev) => new Set(prev).add(areaId))
      toast({
        title: 'Área Concluída',
        description: `A contagem do setor ${areaName} foi salva com sucesso.`,
        className: 'bg-emerald-800 text-white border-none shadow-elevation',
      })
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao salvar a contagem.',
        variant: 'destructive',
      })
    }
  }

  const getIcon = (name: string) => {
    if (name.toLowerCase().includes('cozinha')) return <ChefHat className="w-4 h-4 mr-2" />
    if (name.toLowerCase().includes('bar')) return <Wine className="w-4 h-4 mr-2" />
    return <ConciergeBell className="w-4 h-4 mr-2" />
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
      </div>
    )
  }

  if (areas.length === 0) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-20 text-center">
        <PackageSearch className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-zinc-500">Nenhuma área configurada</h2>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <Tabs defaultValue={areas[0].id} className="w-full">
        <TabsList
          className="grid w-full h-auto flex-wrap mb-6 bg-zinc-200/60 p-1 rounded-xl"
          style={{ gridTemplateColumns: `repeat(${Math.min(areas.length, 4)}, minmax(0, 1fr))` }}
        >
          {areas.map((area) => (
            <TabsTrigger
              key={area.id}
              value={area.id}
              className="data-[state=active]:bg-white data-[state=active]:text-emerald-900 data-[state=active]:shadow-sm text-sm font-semibold rounded-lg transition-all py-2.5"
            >
              {getIcon(area.name)}
              {area.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {areas.map((area) => {
          const areaSubareas = subareas.filter((s) => s.area_id === area.id)
          const areaLevels = levels.filter((l) => areaSubareas.some((s) => s.id === l.subarea_id))

          const items: CountableItem[] = areaLevels.map((l) => ({
            id: l.id,
            productId: l.product_id,
            subareaId: l.subarea_id,
            subareaName: areaSubareas.find((s) => s.id === l.subarea_id)?.name || '',
            name: l.expand?.product_id?.name || 'Desconhecido',
            unit: l.expand?.product_id?.unit || '',
            expectedQty: l.quantity,
            actualQty: localActualQties[l.id] ?? null,
            minStock: l.expand?.product_id?.min_stock ?? null,
          }))

          return (
            <TabsContent key={area.id} value={area.id} className="focus-visible:outline-none mt-0">
              <InventoryArea
                areaName={area.name}
                items={items}
                isCompleted={completedAreas.has(area.id)}
                onUpdate={handleUpdate}
                onComplete={() => handleComplete(area.id, area.name)}
              />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
