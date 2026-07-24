import { useState, useEffect } from 'react'
import { CountableItem } from '@/types/inventory'
import { Subarea } from '@/services/inventory'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronUp, ChevronDown, GripVertical, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ReorderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CountableItem[]
  subareas: Subarea[]
  onSave: (
    orders: Array<{ product_id: string; subarea_id: string; sort_order: number }>,
  ) => Promise<void>
}

interface ReorderGroup {
  subareaId: string
  subareaName: string
  items: CountableItem[]
}

export function ReorderModal({ open, onOpenChange, items, subareas, onSave }: ReorderModalProps) {
  const [groups, setGroups] = useState<ReorderGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (open) {
      const groupMap = new Map<string, CountableItem[]>()
      items.forEach((item) => {
        if (!groupMap.has(item.subareaId)) {
          groupMap.set(item.subareaId, [])
        }
        groupMap.get(item.subareaId)!.push(item)
      })
      const newGroups = Array.from(groupMap.entries()).map(([subareaId, groupItems]) => ({
        subareaId,
        subareaName: subareas.find((s) => s.id === subareaId)?.name || 'Desconhecida',
        items: groupItems,
      }))
      setGroups(newGroups)
      setHasError(false)
    }
  }, [open, items, subareas])

  const moveItem = (groupIdx: number, itemIdx: number, direction: 'up' | 'down') => {
    setGroups((prev) => {
      const next = [...prev]
      const groupItems = [...next[groupIdx].items]
      const newIdx = direction === 'up' ? itemIdx - 1 : itemIdx + 1
      if (newIdx < 0 || newIdx >= groupItems.length) return prev
      ;[groupItems[itemIdx], groupItems[newIdx]] = [groupItems[newIdx], groupItems[itemIdx]]
      next[groupIdx] = { ...next[groupIdx], items: groupItems }
      return next
    })
  }

  const setPosition = (groupIdx: number, itemIdx: number, newPos: number) => {
    setGroups((prev) => {
      const next = [...prev]
      const groupItems = [...next[groupIdx].items]
      const clamped = Math.max(1, Math.min(newPos, groupItems.length))
      const targetIdx = clamped - 1
      if (targetIdx === itemIdx) return prev
      const [moved] = groupItems.splice(itemIdx, 1)
      groupItems.splice(targetIdx, 0, moved)
      next[groupIdx] = { ...next[groupIdx], items: groupItems }
      return next
    })
  }

  const handleSave = async () => {
    let hasDup = false
    const orders: Array<{ product_id: string; subarea_id: string; sort_order: number }> = []
    groups.forEach((group) => {
      const seen = new Set<number>()
      group.items.forEach((_, idx) => {
        const pos = idx + 1
        if (seen.has(pos)) hasDup = true
        seen.add(pos)
        orders.push({
          product_id: group.items[idx].productId,
          subarea_id: group.subareaId,
          sort_order: pos,
        })
      })
    })
    if (hasDup) {
      setHasError(true)
      return
    }
    setSaving(true)
    try {
      await onSave(orders)
      onOpenChange(false)
    } catch {
      toast.error('Erro ao salvar ordem. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const hasMultipleGroups = groups.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reordenar Produtos</DialogTitle>
        </DialogHeader>

        {hasError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Posições duplicadas detectadas. Ajuste antes de salvar.
          </div>
        )}

        <div className="space-y-4">
          {groups.map((group, groupIdx) => (
            <div key={group.subareaId} className="space-y-2">
              {hasMultipleGroups && (
                <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">
                  {group.subareaName}
                </h3>
              )}
              {group.items.map((item, itemIdx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-white border border-zinc-100 rounded-lg"
                >
                  <GripVertical className="w-4 h-4 text-zinc-300 shrink-0" />
                  <Input
                    type="number"
                    min={1}
                    max={group.items.length}
                    value={itemIdx + 1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (
                        !isNaN(val) &&
                        val >= 1 &&
                        val <= group.items.length &&
                        val !== itemIdx + 1
                      ) {
                        setPosition(groupIdx, itemIdx, val)
                      }
                    }}
                    className="w-14 h-9 text-center font-semibold"
                  />
                  <span className="flex-1 text-sm font-medium text-zinc-900 truncate">
                    {item.name}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveItem(groupIdx, itemIdx, 'up')}
                      disabled={itemIdx === 0}
                      className="p-0.5 text-zinc-400 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(groupIdx, itemIdx, 'down')}
                      disabled={itemIdx === group.items.length - 1}
                      className="p-0.5 text-zinc-400 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? 'Salvando...' : 'Salvar Ordem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
