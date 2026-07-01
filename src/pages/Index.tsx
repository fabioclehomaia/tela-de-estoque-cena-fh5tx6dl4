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
import { Loader2, ClipboardList, Play, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type WorkflowState = 'idle' | 'selecting' | 'counting'

export default function Index() {
  const { user } = useAuth()
  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [loading, setLoading] = useState(true)

  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle')
  const [selectedAreaId, setSelectedAreaId] = useState<string>('')
  const [selectedSubareaId, setSelectedSubareaId] = useState<string>('')

  const [counts, setCounts] = useState<Record<string, number | null>>({})

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

  const userAreas = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'manager') return areas
    const allowed = user?.area_ids || []
    return areas.filter((a) => allowed.includes(a.id))
  }, [areas, user])

  const userSubareas = useMemo(() => {
    let list = subareas
    if (user?.role === 'employee') {
      const allowed = user?.subarea_ids || []
      list = subareas.filter((s) => allowed.includes(s.id))
    }
    return list.filter((s) => s.area_id === selectedAreaId)
  }, [subareas, user, selectedAreaId])

  useEffect(() => {
    setSelectedSubareaId('')
  }, [selectedAreaId])

  const currentSubarea = useMemo(() => {
    return subareas.find((s) => s.id === selectedSubareaId)
  }, [subareas, selectedSubareaId])

  const currentArea = useMemo(() => {
    return areas.find((a) => a.id === selectedAreaId)
  }, [areas, selectedAreaId])

  const items = useMemo(() => {
    if (workflowState !== 'counting' || !selectedSubareaId) return []
    const list: CountableItem[] = []

    levels.forEach((level) => {
      if (level.subarea_id !== selectedSubareaId) return

      const product = products.find((p) => p.id === level.product_id)
      if (!product) return

      list.push({
        id: level.id,
        productId: product.id,
        subareaId: selectedSubareaId,
        name: product.name,
        subareaName: currentSubarea?.name || '',
        unit: product.unit,
        expectedQty: level.quantity,
        actualQty: counts[level.id] !== undefined ? counts[level.id] : null,
        minStock: product.min_stock ?? null,
        image: product.image,
        productObj: product,
      })
    })

    return list
  }, [workflowState, selectedSubareaId, levels, products, counts, currentSubarea])

  const handleUpdateCount = (id: string, qty: number | null) => {
    setCounts((prev) => ({ ...prev, [id]: qty }))
  }

  const handleCompleteCount = async () => {
    if (!user || !selectedSubareaId) return

    try {
      const promises = items.map(async (item) => {
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

      toast.success(`Contagem da subárea ${currentSubarea?.name} finalizada!`)
      loadData()
      setWorkflowState('idle')
      setSelectedAreaId('')
      setSelectedSubareaId('')
      setCounts({})
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

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold font-serif text-emerald-900">Contagem de Estoque</h1>
        <p className="text-sm text-zinc-500">
          Realize a contagem física dos produtos nas suas áreas de responsabilidade.
        </p>
      </div>

      {workflowState === 'idle' && (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-xl border border-zinc-100 shadow-sm">
          <ClipboardList className="w-16 h-16 text-emerald-600 mb-6" />
          <h2 className="text-2xl font-bold text-zinc-800 mb-2">Pronto para iniciar?</h2>
          <p className="text-zinc-500 mb-8 max-w-md">
            Inicie uma nova contagem de estoque para atualizar as quantidades dos produtos na sua
            área de responsabilidade.
          </p>
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setWorkflowState('selecting')}
          >
            <Play className="w-4 h-4 mr-2 fill-current" />
            Início de Contagem
          </Button>
        </div>
      )}

      {workflowState === 'selecting' && (
        <div className="max-w-md mx-auto py-12 w-full animate-in fade-in duration-300">
          <div className="mb-6 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-500 hover:text-zinc-900"
              onClick={() => {
                setWorkflowState('idle')
                setSelectedAreaId('')
                setSelectedSubareaId('')
              }}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-bold text-zinc-800">Selecione o local</h2>
          </div>

          <div className="space-y-6 bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Área</label>
              <Select value={selectedAreaId || undefined} onValueChange={setSelectedAreaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma área" />
                </SelectTrigger>
                <SelectContent>
                  {userAreas.length === 0 ? (
                    <div className="p-2 text-sm text-zinc-500 text-center">
                      Nenhuma área disponível
                    </div>
                  ) : (
                    userAreas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Subárea</label>
              <Select
                value={selectedSubareaId || undefined}
                onValueChange={setSelectedSubareaId}
                disabled={!selectedAreaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma subárea" />
                </SelectTrigger>
                <SelectContent>
                  {userSubareas.length === 0 ? (
                    <div className="p-2 text-sm text-zinc-500 text-center">
                      Nenhuma subárea disponível
                    </div>
                  ) : (
                    userSubareas.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setWorkflowState('idle')
                  setSelectedAreaId('')
                  setSelectedSubareaId('')
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!selectedAreaId || !selectedSubareaId}
                onClick={() => setWorkflowState('counting')}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {workflowState === 'counting' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-4 border-b border-zinc-200 pb-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-500 hover:text-zinc-900"
              onClick={() => setWorkflowState('selecting')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-zinc-800">
                {currentArea?.name} - {currentSubarea?.name}
              </h2>
              <p className="text-sm text-zinc-500">Contagem de produtos</p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center bg-white rounded-xl border border-zinc-100 shadow-sm">
              <ClipboardList className="w-12 h-12 mb-4 text-zinc-300" />
              <h2 className="text-xl font-semibold text-zinc-900 mb-2">
                Nenhum produto para contar
              </h2>
              <p className="text-zinc-500 max-w-md">
                Esta subárea não possui produtos cadastrados para contagem ou com estoque
                configurado.
              </p>
            </div>
          ) : (
            <InventoryArea
              areaName={`${currentArea?.name} - ${currentSubarea?.name}`}
              items={items}
              isCompleted={false}
              onUpdate={handleUpdateCount}
              onComplete={handleCompleteCount}
            />
          )}
        </div>
      )}
    </div>
  )
}
