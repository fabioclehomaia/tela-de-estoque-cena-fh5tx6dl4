import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { getAreas, getSubareas, Area, Subarea } from '@/services/inventory'
import { getProducts, Product } from '@/services/products'
import {
  getInventoryLevels,
  InventoryLevel,
  updateInventoryLevel,
} from '@/services/inventory_levels'
import { createInventoryCount } from '@/services/inventory_counts'
import { CountableItem } from '@/types/inventory'
import { InventoryArea } from '@/components/inventory/InventoryArea'
import { useRealtime } from '@/hooks/use-realtime'
import { Loader2, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'

export default function Index() {
  const { user } = useAuth()
  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [loading, setLoading] = useState(true)

  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [completedAreas, setCompletedAreas] = useState<Record<string, boolean>>({})

  const loadData = async () => {
    try {
      const [fetchedAreas, fetchedSubareas, fetchedProducts, fetchedLevels] = await Promise.all([
        getAreas(),
        getSubareas(),
        getProducts(),
        getInventoryLevels(),
      ])
      setAreas(fetchedAreas)
      setSubareas(fetchedSubareas)
      setProducts(fetchedProducts.filter((p) => p.active !== false))
      setLevels(fetchedLevels)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('inventory_levels', loadData)
  useRealtime('products', loadData)

  const items = useMemo(() => {
    const list: CountableItem[] = []

    let userAreas = areas
    if (user?.area_id) {
      userAreas = areas.filter((a) => a.id === user.area_id)
    }

    levels.forEach((level) => {
      const product = products.find((p) => p.id === level.product_id)
      if (!product) return

      const subarea = subareas.find((s) => s.id === level.subarea_id)
      if (!subarea) return

      const area = userAreas.find((a) => a.id === subarea.area_id)
      if (!area) return

      list.push({
        id: level.id,
        productId: product.id,
        subareaId: subarea.id,
        name: product.name,
        subareaName: subarea.name,
        unit: product.unit,
        expectedQty: level.quantity,
        actualQty: counts[level.id] !== undefined ? counts[level.id] : null,
        minStock: product.min_stock ?? null,
        image: product.image,
        productObj: product,
      })
    })

    return list
  }, [areas, subareas, products, levels, counts, user])

  const areasWithItems = useMemo(() => {
    const map = new Map<string, CountableItem[]>()
    items.forEach((item) => {
      const subarea = subareas.find((s) => s.id === item.subareaId)
      if (!subarea) return
      const area = areas.find((a) => a.id === subarea.area_id)
      if (!area) return

      if (!map.has(area.name)) {
        map.set(area.name, [])
      }
      map.get(area.name)!.push(item)
    })
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
  }, [items, subareas, areas])

  const handleUpdateCount = (id: string, qty: number | null) => {
    setCounts((prev) => ({ ...prev, [id]: qty }))
  }

  const handleCompleteArea = async (areaName: string, areaItems: CountableItem[]) => {
    if (!user) return

    try {
      const promises = areaItems.map(async (item) => {
        if (item.actualQty !== null && item.actualQty !== undefined) {
          await updateInventoryLevel(item.id, {
            quantity: item.actualQty,
          })

          await createInventoryCount({
            product_id: item.productId,
            subarea_id: item.subareaId,
            user_id: user.id,
            previous_quantity: item.expectedQty,
            counted_quantity: item.actualQty,
          })
        }
      })

      await Promise.all(promises)

      setCompletedAreas((prev) => ({ ...prev, [areaName]: true }))
      toast.success(`Contagem da área ${areaName} finalizada!`)
      loadData()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar a contagem.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
      </div>
    )
  }

  if (areasWithItems.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">
        <div className="text-center py-16 flex flex-col items-center bg-white rounded-xl border border-zinc-100 shadow-sm">
          <ClipboardList className="w-12 h-12 mb-4 text-zinc-300" />
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">Nenhum produto para contar</h2>
          <p className="text-zinc-500 max-w-md">
            Você não possui áreas atribuídas com produtos ativos para realizar a contagem no
            momento.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold font-serif text-emerald-900">Contagem de Estoque</h1>
        <p className="text-sm text-zinc-500">
          Realize a contagem física dos produtos nas suas áreas de responsabilidade.
        </p>
      </div>

      <div className="space-y-12">
        {areasWithItems.map((areaData) => (
          <div key={areaData.name} className="space-y-4">
            <h2 className="text-xl font-bold text-zinc-800 border-b border-zinc-200 pb-2">
              {areaData.name}
            </h2>
            <InventoryArea
              areaName={areaData.name}
              items={areaData.items}
              isCompleted={!!completedAreas[areaData.name]}
              onUpdate={handleUpdateCount}
              onComplete={() => handleCompleteArea(areaData.name, areaData.items)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
