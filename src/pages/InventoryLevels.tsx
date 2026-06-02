import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getProducts, Product } from '@/services/products'
import { getSubareas, Subarea } from '@/services/inventory'
import {
  getInventoryLevels,
  createInventoryLevel,
  updateInventoryLevel,
  deleteInventoryLevel,
  InventoryLevel,
} from '@/services/inventory_levels'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'

export default function InventoryLevels() {
  const [products, setProducts] = useState<Product[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const [editState, setEditState] = useState<
    Record<string, { checked: boolean; quantity: string }>
  >({})

  const loadData = async () => {
    try {
      const [p, s, l] = await Promise.all([getProducts(), getSubareas(), getInventoryLevels()])
      setProducts(p)
      setSubareas(s)
      setLevels(l)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('inventory_levels', loadData)

  useEffect(() => {
    if (selectedProductId) {
      const pLevels = levels.filter((l) => l.product_id === selectedProductId)
      const newState: Record<string, { checked: boolean; quantity: string }> = {}
      subareas.forEach((sub) => {
        const existing = pLevels.find((l) => l.subarea_id === sub.id)
        if (existing) {
          newState[sub.id] = { checked: true, quantity: existing.quantity.toString() }
        } else {
          newState[sub.id] = { checked: false, quantity: '0' }
        }
      })
      setEditState(newState)
    } else {
      setEditState({})
    }
  }, [selectedProductId, levels, subareas])

  const handleSave = async () => {
    if (!selectedProductId) return
    try {
      const pLevels = levels.filter((l) => l.product_id === selectedProductId)
      const promises = []

      for (const sub of subareas) {
        const state = editState[sub.id]
        const existing = pLevels.find((l) => l.subarea_id === sub.id)

        if (state.checked) {
          const qty = parseFloat(state.quantity) || 0
          if (existing) {
            if (existing.quantity !== qty) {
              promises.push(updateInventoryLevel(existing.id, { quantity: qty }))
            }
          } else {
            promises.push(
              createInventoryLevel({
                product_id: selectedProductId,
                subarea_id: sub.id,
                quantity: qty,
              }),
            )
          }
        } else {
          if (existing) {
            promises.push(deleteInventoryLevel(existing.id))
          }
        }
      }

      await Promise.all(promises)
      toast.success('Vínculos atualizados com sucesso!')
      await loadData()
    } catch (err) {
      toast.error('Erro ao atualizar vínculos.')
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/products">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-serif text-emerald-900">Vincular a Subáreas</h1>
          <p className="text-sm text-zinc-500">
            Distribua produtos em diferentes locais de armazenamento.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200 flex flex-col gap-6">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Selecione o Produto</label>
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um produto..." />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProductId && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-semibold text-zinc-900 border-b pb-2">
              Selecione os locais e estoque inicial
            </h3>
            <div className="grid gap-3">
              {subareas.map((sub) => {
                const state = editState[sub.id] || { checked: false, quantity: '0' }
                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 bg-zinc-50 rounded-md border border-zinc-100 transition-colors hover:border-emerald-100"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={state.checked}
                        onCheckedChange={(c) =>
                          setEditState((prev) => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], checked: c === true },
                          }))
                        }
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-zinc-900">{sub.name}</span>
                        <span className="text-xs text-zinc-500">{sub.expand?.area_id?.name}</span>
                      </div>
                    </div>
                    {state.checked && (
                      <div className="w-24">
                        <Input
                          type="number"
                          value={state.quantity}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              [sub.id]: { ...prev[sub.id], quantity: e.target.value },
                            }))
                          }
                          className="h-9 text-right font-medium"
                          placeholder="Qtd"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <Button
              onClick={handleSave}
              className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4 h-12 text-base"
            >
              <Save className="w-5 h-5 mr-2" /> Salvar Vínculos
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
