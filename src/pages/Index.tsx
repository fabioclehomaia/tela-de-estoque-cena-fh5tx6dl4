import { useState, useEffect, useMemo } from 'react'
import { getProducts, Product } from '@/services/products'
import { getAreas, getSubareas, getCategories, Area, Subarea, Category } from '@/services/inventory'
import { getInventoryLevels, InventoryLevel } from '@/services/inventory_levels'
import { getCountOrders, CountOrder, batchSaveCountOrders } from '@/services/count_order'
import { CountableItem } from '@/types/inventory'
import { InventoryArea } from '@/components/inventory/InventoryArea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { Search, FilterX, Loader2, PackageSearch, ChevronDown, Check, X } from 'lucide-react'
import { toast } from 'sonner'

export default function Index() {
  const { user } = useAuth()
  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [countOrders, setCountOrders] = useState<CountOrder[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedAreaId, setSelectedAreaId] = useState<string>('_all_')
  const [selectedSubareaId, setSelectedSubareaId] = useState<string>('_all_')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [countState, setCountState] = useState<Record<string, number | null>>({})
  const [completedAreas, setCompletedAreas] = useState<Set<string>>(new Set())

  const loadData = async () => {
    try {
      const [a, s, c, p, l, co] = await Promise.all([
        getAreas(),
        getSubareas(),
        getCategories(),
        getProducts(),
        getInventoryLevels(),
        getCountOrders(),
      ])
      setAreas(a)
      setSubareas(s)
      setCategories(c)
      setProducts(p)
      setLevels(l)
      setCountOrders(co)
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
  useRealtime('count_order', loadData)

  const availableAreas = useMemo(() => {
    if (!user) return areas
    if (user.role === 'admin' || user.role === 'manager') return areas
    const userAreaIds = user.area_ids || []
    const userSubareaIds = user.subarea_ids || []
    if (userAreaIds.length === 0 && userSubareaIds.length === 0) return areas
    return areas.filter(
      (a) =>
        userAreaIds.includes(a.id) ||
        subareas.some((s) => s.area_id === a.id && userSubareaIds.includes(s.id)),
    )
  }, [areas, subareas, user])

  const availableSubareas = useMemo(() => {
    let filtered = subareas
    if (selectedAreaId !== '_all_') {
      filtered = filtered.filter((s) => s.area_id === selectedAreaId)
    }
    if (user && user.role === 'employee') {
      const userAreaIds = user.area_ids || []
      const userSubareaIds = user.subarea_ids || []
      if (userAreaIds.length > 0 || userSubareaIds.length > 0) {
        filtered = filtered.filter(
          (s) => userAreaIds.includes(s.area_id) || userSubareaIds.includes(s.id),
        )
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
      // Inactive products are hidden from the counting screen.
      if (product.active === false) return
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

  const orderMap = useMemo(() => {
    const map = new Map<string, number>()
    countOrders.forEach((co) => {
      map.set(`${co.product_id}_${co.subarea_id}`, co.sort_order)
    })
    return map
  }, [countOrders])

  const filteredItems = useMemo(() => {
    return allItems
      .filter((item) => {
        const subarea = subareas.find((s) => s.id === item.subareaId)
        const areaId = subarea?.area_id

        // Permissão de acesso por perfil: funcionários só veem suas áreas/subáreas permitidas
        if (user && user.role === 'employee') {
          const userAreaIds = user.area_ids || []
          const userSubareaIds = user.subarea_ids || []
          if (userAreaIds.length > 0 || userSubareaIds.length > 0) {
            const hasAreaAccess = areaId ? userAreaIds.includes(areaId) : false
            const hasSubareaAccess = userSubareaIds.includes(item.subareaId)
            if (!hasAreaAccess && !hasSubareaAccess) {
              return false
            }
          }
        }

        // Filtros selecionados na UI
        if (selectedAreaId !== '_all_') {
          if (areaId !== selectedAreaId) return false
        }
        if (selectedSubareaId !== '_all_' && item.subareaId !== selectedSubareaId) return false

        // Multi-seleção de categorias: se o usuário selecionou categorias ou categorias de custo
        if (selectedCategoryIds.length > 0) {
          const catId = item.productObj?.category_id
          const costCat = item.productObj?.cost_category
            ? `cost:${item.productObj.cost_category}`
            : undefined
          const matchStandardCat = catId ? selectedCategoryIds.includes(catId) : false
          const matchCostCat = costCat ? selectedCategoryIds.includes(costCat) : false
          if (!matchStandardCat && !matchCostCat) {
            return false
          }
        }

        if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase()))
          return false
        return true
      })
      .sort((a, b) => {
        const subareaA = subareas.find((s) => s.id === a.subareaId)
        const subareaB = subareas.find((s) => s.id === b.subareaId)
        const nameA = subareaA?.name || ''
        const nameB = subareaB?.name || ''
        if (nameA !== nameB) return nameA.localeCompare(nameB)
        const orderA = orderMap.get(`${a.productId}_${a.subareaId}`)
        const orderB = orderMap.get(`${b.productId}_${b.subareaId}`)
        if (orderA !== undefined && orderB !== undefined) return orderA - orderB
        if (orderA !== undefined) return -1
        if (orderB !== undefined) return 1
        return a.name.localeCompare(b.name)
      })
  }, [
    allItems,
    selectedAreaId,
    selectedSubareaId,
    selectedCategoryIds,
    searchQuery,
    subareas,
    orderMap,
    user,
  ])

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

  const handleSaveOrder = async (
    orders: Array<{ product_id: string; subarea_id: string; sort_order: number }>,
  ) => {
    await batchSaveCountOrders(orders)
    try {
      const co = await getCountOrders()
      setCountOrders(co)
    } catch {
      // Real-time will refresh eventually
    }
  }

  const clearFilters = () => {
    setSelectedAreaId('_all_')
    setSelectedSubareaId('_all_')
    setSelectedCategoryIds([])
    setSearchQuery('')
  }

  const hasActiveFilters =
    selectedAreaId !== '_all_' ||
    selectedSubareaId !== '_all_' ||
    selectedCategoryIds.length > 0 ||
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Categorias</label>
              {selectedCategoryIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryIds([])}
                  className="text-xs text-zinc-400 hover:text-zinc-600 font-medium"
                >
                  Limpar ({selectedCategoryIds.length})
                </button>
              )}
            </div>
            <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={categoryPopoverOpen}
                  className="w-full justify-between font-normal bg-white h-10 px-3 border-input"
                >
                  <span className="truncate text-sm text-left">
                    {selectedCategoryIds.length === 0 ? (
                      <span className="text-zinc-700 font-normal">Todas as categorias</span>
                    ) : selectedCategoryIds.length === 1 ? (
                      (() => {
                        const id = selectedCategoryIds[0]
                        const cat = categories.find((c) => c.id === id)
                        return cat?.name || id
                      })()
                    ) : (
                      <span className="font-medium text-emerald-800">
                        {selectedCategoryIds.length} categorias selecionadas
                      </span>
                    )}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-2 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
                  <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                    Filtrar por Categoria
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selectedCategoryIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryIds([])}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-medium px-1.5 py-0.5 rounded hover:bg-emerald-50"
                      >
                        Limpar seleção
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryIds(categories.map((c) => c.id))}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-medium px-1.5 py-0.5 rounded hover:bg-emerald-50"
                      >
                        Marcar todas
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryIds([])}
                    className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-md transition-colors text-left ${
                      selectedCategoryIds.length === 0
                        ? 'bg-emerald-50 text-emerald-900 font-medium'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={selectedCategoryIds.length === 0}
                        onCheckedChange={() => setSelectedCategoryIds([])}
                      />
                      <span>Todas as categorias</span>
                    </div>
                    {selectedCategoryIds.length === 0 && (
                      <Check className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>

                  <div className="my-1 border-t border-zinc-100" />

                  {categories.map((c) => {
                    const isChecked = selectedCategoryIds.includes(c.id)
                    const count = allItems.filter(
                      (item) => item.productObj?.category_id === c.id,
                    ).length
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryIds((prev) =>
                            prev.includes(c.id)
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id],
                          )
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-md transition-colors text-left ${
                          isChecked
                            ? 'bg-emerald-50/70 text-emerald-900 font-medium'
                            : 'text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => {
                              setSelectedCategoryIds((prev) =>
                                prev.includes(c.id)
                                  ? prev.filter((id) => id !== c.id)
                                  : [...prev, c.id],
                              )
                            }}
                          />
                          <span className="truncate">{c.name}</span>
                        </div>
                        {count > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 shrink-0 font-normal">
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {selectedCategoryIds.length > 0 && (
                  <div className="p-2 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {selectedCategoryIds.length} selecionada(s)
                    </span>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800"
                      onClick={() => setCategoryPopoverOpen(false)}
                    >
                      Aplicar
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
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
              <FilterX className="h-4 w-4 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>

        {selectedCategoryIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-100">
            <span className="text-xs text-zinc-500 mr-1">Categorias filtradas:</span>
            {selectedCategoryIds.map((id) => {
              const cat = categories.find((c) => c.id === id)
              const name = cat?.name || id
              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100/70 text-xs font-normal pl-2 pr-1 py-0.5 flex items-center gap-1"
                >
                  <span className="max-w-[160px] truncate">{name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCategoryIds((prev) => prev.filter((item) => item !== id))
                    }
                    className="rounded-full p-0.5 hover:bg-emerald-200/60 text-emerald-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )
            })}
            <button
              type="button"
              onClick={() => setSelectedCategoryIds([])}
              className="text-xs text-zinc-400 hover:text-zinc-600 underline ml-1"
            >
              Remover todas
            </button>
          </div>
        )}
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
                userRole={user?.role}
                subareas={subareas}
                onSaveOrder={handleSaveOrder}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
