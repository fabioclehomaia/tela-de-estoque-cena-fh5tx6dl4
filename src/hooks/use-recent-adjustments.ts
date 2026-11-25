import { useEffect, useMemo, useState } from 'react'
import type { RecordModel } from 'pocketbase'

import {
  buildAdjustmentsByCountId,
  getStockAdjustments,
  StockAdjustment,
} from '@/services/stock_adjustments'
import { useRealtime } from '@/hooks/use-realtime'

/**
 * Ajustes de estoque para os relatórios: a coleção é pequena (mesma base da
 * aba Ajustes de Estoque), então a lista completa é carregada uma única vez e
 * mantida ao vivo por realtime (merge incremental, sem recarregar tudo).
 *
 * Expõe também o ajuste mais recente de cada produto — primeiro o mais recente
 * por contagem retificada, depois o mais recente entre essas contagens — pronto
 * para o Estoque Atual aplicar sobre os níveis atuais (inventory_levels guardam
 * o valor CONTADO; o ajuste é a retificação sobre esse valor).
 */
export function useRecentAdjustments(enabled = true) {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    getStockAdjustments()
      .then((rows) => {
        if (cancelled) return
        setAdjustments(rows)
        setError(null)
      })
      .catch(() => {
        if (!cancelled) setError('Erro ao carregar ajustes de estoque.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  useRealtime<RecordModel & Partial<StockAdjustment>>(
    'stock_adjustments',
    (e) => {
      if (e.action === 'delete') {
        setAdjustments((prev) => prev.filter((a) => a.id !== e.record.id))
      } else {
        setAdjustments((prev) => {
          const map = new Map(prev.map((a) => [a.id, a]))
          const existing = map.get(e.record.id)
          // Realtime não traz expand: preserva o expand já carregado.
          map.set(e.record.id, { ...(existing || {}), ...e.record } as StockAdjustment)
          return Array.from(map.values())
        })
      }
    },
    enabled,
  )

  const latestAdjustmentByProduct = useMemo(() => {
    const byCount = buildAdjustmentsByCountId(adjustments)
    const map = new Map<string, StockAdjustment>()
    for (const adj of byCount.values()) {
      const existing = map.get(adj.product)
      if (!existing || new Date(adj.created) > new Date(existing.created)) {
        map.set(adj.product, adj)
      }
    }
    return map
  }, [adjustments])

  return { adjustments, latestAdjustmentByProduct, loading, error }
}

export default useRecentAdjustments
