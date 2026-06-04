import { useState, useEffect, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InventoryArea } from '@/components/inventory/InventoryArea'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getInventoryLevels,
  InventoryLevel,
  updateInventoryLevel,
} from '@/services/inventory_levels'
import { createInventoryCount } from '@/services/inventory_counts'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { CountableItem } from '@/types/inventory'

interface Area {
  id: string
  name: string
}
interface Subarea {
  id: string
  name: string
  area_id: string
}

export default function Index() {
  const { user } = useAuth()
  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])

  const [selectedAreaId, setSelectedAreaId] = useState<string>('all')
  const [selectedSubareaId, setSelectedSubareaId] = useState<string>('all')

  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [counts, setCounts] = useState<Record<string, number | null>>({})

  const fetchData = async () => {
    try {
      const [areasRes, subareasRes, levelsRes] = await Promise.all([
        pb.collection('areas').getFullList<Area>({ sort: 'name' }),
        pb.collection('subareas').getFullList<Subarea>({ sort: 'name' }),
        getInventoryLevels(),
      ])
      setAreas(areasRes)
      setSubareas(subareasRes)
      setLevels(levelsRes)
    } catch (err) {
      toast.error('Erro ao carregar dados do estoque.')
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useRealtime('inventory_levels', () => {
    getInventoryLevels().then(setLevels)
  })

  const filteredSubareas = useMemo(() => {
    if (selectedAreaId === 'all') return subareas
    return subareas.filter((s) => s.area_id === selectedAreaId)
  }, [subareas, selectedAreaId])

  useEffect(() => {
    if (selectedAreaId !== 'all' && !filteredSubareas.find((s) => s.id === selectedSubareaId)) {
      setSelectedSubareaId('all')
    }
  }, [selectedAreaId, filteredSubareas])

  const displayedLevels = useMemo(() => {
    let filtered = levels
    if (selectedAreaId !== 'all') {
      filtered = filtered.filter(
        (l) => l.expand?.subarea_id?.expand?.area_id?.id === selectedAreaId,
      )
    }
    if (selectedSubareaId !== 'all') {
      filtered = filtered.filter((l) => l.subarea_id === selectedSubareaId)
    }
    return filtered
  }, [levels, selectedAreaId, selectedSubareaId])

  const items = useMemo(() => {
    return displayedLevels.map((level) => {
      const product = level.expand?.product_id as any
      const subarea = level.expand?.subarea_id

      return {
        id: level.id,
        productId: level.product_id,
        subareaId: level.subarea_id,
        name: product?.name || 'Desconhecido',
        subareaName: subarea?.name || 'Desconhecido',
        unit: product?.unit || 'un',
        expectedQty: level.quantity,
        actualQty: counts[level.id] !== undefined ? counts[level.id] : null,
        minStock: product?.min_stock ?? null,
        image: product?.image,
        productObj: product,
      } as CountableItem
    })
  }, [displayedLevels, counts])

  const handleUpdateCount = (id: string, qty: number | null) => {
    setCounts((prev) => ({ ...prev, [id]: qty }))
  }

  const handleComplete = async () => {
    if (!user) return
    const toSave = items.filter((i) => i.actualQty !== null)
    if (toSave.length === 0) {
      toast.info('Nenhum item contado para salvar.')
      return
    }

    const toastId = toast.loading('Salvando contagem...')

    try {
      for (const item of toSave) {
        await createInventoryCount({
          product_id: item.productId,
          subarea_id: item.subareaId,
          user_id: user.id,
          previous_quantity: item.expectedQty,
          counted_quantity: item.actualQty!,
        })

        if (item.actualQty !== item.expectedQty) {
          await updateInventoryLevel(item.id, {
            quantity: item.actualQty!,
          })
        }
      }

      toast.success('Contagem salva com sucesso!', { id: toastId })

      setCounts((prev) => {
        const next = { ...prev }
        toSave.forEach((i) => {
          delete next[i.id]
        })
        return next
      })

      await fetchData()
    } catch (err) {
      toast.error('Erro ao salvar contagem.', { id: toastId })
    }
  }

  const areaName = useMemo(() => {
    if (selectedSubareaId !== 'all')
      return subareas.find((s) => s.id === selectedSubareaId)?.name || 'Subárea'
    if (selectedAreaId !== 'all') return areas.find((a) => a.id === selectedAreaId)?.name || 'Área'
    return 'Geral'
  }, [selectedAreaId, selectedSubareaId, areas, subareas])

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">
          Contagem de Estoque
        </h1>
        <p className="text-zinc-500">
          Selecione uma área e subárea para registrar a contagem dos produtos.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
        <div className="flex-1">
          <label className="text-sm font-semibold text-zinc-700 mb-1.5 block">Área</label>
          <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
            <SelectTrigger className="h-11 bg-white shadow-sm">
              <SelectValue placeholder="Selecione a Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Áreas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-semibold text-zinc-700 mb-1.5 block">Subárea</label>
          <Select value={selectedSubareaId} onValueChange={setSelectedSubareaId}>
            <SelectTrigger className="h-11 bg-white shadow-sm">
              <SelectValue placeholder="Selecione a Subárea" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Subáreas</SelectItem>
              {filteredSubareas.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {items.length > 0 ? (
        <InventoryArea
          areaName={areaName}
          items={items}
          isCompleted={false}
          onUpdate={handleUpdateCount}
          onComplete={handleComplete}
        />
      ) : (
        <div className="text-center py-16 flex flex-col items-center bg-white rounded-xl border border-zinc-100 shadow-sm">
          <p className="text-zinc-500 font-medium">
            Nenhum produto encontrado para a seleção atual.
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            Vá em Produtos &gt; Vincular a Subáreas para adicionar.
          </p>
        </div>
      )}
    </div>
  )
}
