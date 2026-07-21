import { useState, useEffect, useMemo } from 'react'
import { getProducts, Product } from '@/services/products'
import { getAreas, getSubareas, getCategories, Area, Subarea, Category } from '@/services/inventory'
import { getInventoryLevels, InventoryLevel } from '@/services/inventory_levels'
import { CountableItem } from '@/types/inventory'
import { InventoryArea } from '@/components/inventory/InventoryArea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { Search, FilterX, Loader2, PackageSearch } from 'lucide-react'
import { toast } from 'sonner'

export default function Index() {
  const { user } = useAuth()
  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedAreaId, setSelectedAreaId] = useState<string>('_all_')
  const [selectedSubareaId, setSelectedSubareaId] = useState<string>('_all_')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('_all_')
  const [searchQuery, setSearchQuery] = useState('')
  const [countState, setCountState] = useState<Record<string, number | null>>({})
  const [completedAreas, setCompletedAreas] = useState<Set<string>>(new Set())

  const loadData = async () => {
    try {
      const [a, s, c, p, l] = await Promise.all([
        getAreas(),
        getSubareas(),
        getCategories(),
        getProducts(),
        getInventoryLevels(),
      ])
      setAreas(a)
      setSubareas(s)
      setCategories(c)
      setProducts(p)
      setLevels(l)
    } catch {
      toast.error('Erro ao carregar dados do estoque.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('inventory_levels', loadData)
  useRealtime('inventory_counts', loadData)

  const availableAreas = useMemo(() => {
    if (!user) return areas
    if (user.role === 'admin' || user.role === 'manager') return areas
    const userAreaIds = user.area_ids || []
    if (userAreaIds.length === 0) return areas
    return areas.filter((a) => userAreaIds.includes(a.id))
  }, [areas, user])

  const availableSubareas = useMemo(() => {
    let filtered = subareas
    if (selectedAreaId !== '_all_') {
      filtered = filtered.filter((s) => s.area_id === selectedAreaId)
    }
    if (user && user.role === 'employee') {
      const userSubareaIds = user.subarea_ids || []
      if (userSubareaIds.length > 0) {
        filtered = filtered.filter((s) => userSubareaIds.includes(s.id))
      }
    }
    return filtered
  }, [subareas, selectedAreaId, user])

  const allItems = useMemo<CountableItem[]>(() => {
    const productMap = new Map(products.map((p) => [p.id, p]))
    const items: CountableItem[] = []

    levels.forEach((level) => {
      const product = level.expand?.product_id || productMap.get(level.product_id)
      if (!product) return
      const subarea = level.expand?.subarea_id || subareas.find((s) => s.id === level.subarea_id)
      if (!subarea) return

      const itemId = `${level.product_id}_${level.subarea_id}`
      items.push({
        id: itemId,
        productId: level.product_id,
        subareaId: level.subarea_id,
        name: product.name,
        subareaName: subarea.name,
        unit: product.unit,
        expectedQty: level.quantity,
        actualQty: countState[itemId] ?? null,
        minStock: product.min_stock ?? null,
        image: product.image,
        productObj: product,
      })
    })

    return items
  }, [levels, products, subareas, countState])

  const filteredItems = useMemo(() => {
    return allItems
      .filter((item) => {
        if (selectedAreaId !== '_all_') {
          const subarea = subareas.find((s) => s.id === item.subareaId)
          if (subarea?.area_id !== selectedAreaId) return false
        }
        if (selectedSubareaId !== '_all_' && item.subareaId !== selectedSubareaId) return false
        if (selectedCategoryId !== '_all_') {
          if (item.productObj?.category_id !== selectedCategoryId) return false
        }
        if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase()))
          return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allItems, selectedAreaId, selectedSubareaId, selectedCategoryId, searchQuery, subareas])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, { areaName: string; items: CountableItem[] }>()
    filteredItems.forEach((item) => {
      const subarea = subareas.find((s) => s.id === item.subareaId)
      const areaId = subarea?.area_id || ''
      const areaName = areas.find((a) => a.id === areaId)?.name || 'Desconhecida'
      if (!groups.has(areaId)) {
        groups.set(areaId, { areaName, items: [] })
      }
      groups.get(areaId)!.items.push(item)
    })
    return Array.from(groups.entries()).map(([areaId, data]) => ({
      areaId,
      ...data,
    }))
  }, [filteredItems, subareas, areas])

  const handleUpdate = (id: string, qty: number | null) => {
    setCountState((prev) => ({ ...prev, [id]: qty }))
  }

  const handleComplete = (areaId: string) => {
    setCompletedAreas((prev) => new Set(prev).add(areaId))
  }

  const clearFilters = () => {
    setSelectedAreaId('_all_')
    setSelectedSubareaId('_all_')
    setSelectedCategoryId('_all_')
    setSearchQuery('')
  }

  const hasActiveFilters =
    selectedAreaId !== '_all_' ||
    selectedSubareaId !== '_all_' ||
    selectedCategoryId !== '_all_' ||
    searchQuery !== ''

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold font-serif text-emerald-900">Contagem de Estoque</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Selecione uma área e subárea para iniciar a contagem.
        </p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-zinc-100 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Área</label>
            <Select
              value={selectedAreaId}
              onValueChange={(val) => {
                setSelectedAreaId(val)
                setSelectedSubareaId('_all_')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todas as áreas</SelectItem>
                {availableAreas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subárea</label>
            <Select
              value={selectedSubareaId}
              onValueChange={setSelectedSubareaId}
              disabled={selectedAreaId === '_all_'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as subáreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todas as subáreas</SelectItem>
                {availableSubareas.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categoria</label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Buscar produto por nome..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <FilterX className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {groupedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PackageSearch className="w-12 h-12 text-zinc-300 mb-3" />
          <p className="text-zinc-500 font-medium">
            {selectedSubareaId !== '_all_'
              ? 'Nenhum produto encontrado nesta subárea.'
              : 'Nenhum produto encontrado com os filtros atuais.'}
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {selectedSubareaId !== '_all_'
              ? 'Vincule produtos a esta subárea na página de Produtos.'
              : 'Tente ajustar os filtros ou limpar a busca.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedItems.map((group) => (
            <div key={group.areaId} className="space-y-3">
              <h2 className="text-lg font-bold font-serif text-zinc-900 border-b border-zinc-200 pb-2">
                {group.areaName}
                {selectedSubareaId !== '_all_' && (
                  <span className="text-sm font-normal text-zinc-500 ml-2">
                    • {subareas.find((s) => s.id === selectedSubareaId)?.name}
                  </span>
                )}
              </h2>
              <InventoryArea
                areaName={group.areaName}
                items={group.items}
                isCompleted={completedAreas.has(group.areaId)}
                onUpdate={handleUpdate}
                onComplete={() => handleComplete(group.areaId)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
