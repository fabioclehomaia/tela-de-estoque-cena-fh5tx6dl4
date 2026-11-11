import { useCallback, useEffect, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import type { RecordModel, RecordSubscription } from 'pocketbase'
import { ClientResponseError } from 'pocketbase'

import { getInventoryCountsRange, InventoryCount } from '@/services/inventory_counts'
import { useRealtime } from '@/hooks/use-realtime'

const DAY_FMT = 'yyyy-MM-dd'
const DEFAULT_WINDOW_DAYS = 60

/**
 * Fonte única de contagens de estoque para as telas de Contagem e Relatórios.
 *
 * - Carregamento inicial: somente a janela de dias configurada pelo caller
 *   (padrão 60), com filtro de `created` aplicado no servidor. Em telas com
 *   múltiplas abas (Relatórios) a janela inicial é curta (7 dias) para abrir
 *   rápido e sem baixar o histórico; as abas que precisam de mais dados pedem
 *   `ensureRange` explicitamente.
 * - Histórico mais antigo: permanece intacto no banco e só é buscado quando o
 *   usuário pede mais profundidade ou seleciona um filtro de datas que alcança
 *   período anterior, via `ensureRange(startIso)` — com filtro no servidor.
 *   Cobertura já carregada nunca é encolhida.
 * - Tempo real: incremental. Cada evento adiciona/atualiza/remove apenas o
 *   registro que mudou, sem recarregar o histórico inteiro.
 * - Erros NUNCA são engolidos: ficam em `error` para a tela exibir um aviso
 *   (banner) com opção de nova tentativa (`reload`).
 */
export function useInventoryCounts(enabled = true, initialWindowDays = DEFAULT_WINDOW_DAYS) {
  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeLoading, setRangeLoading] = useState(false)
  const [coveredFrom, setCoveredFrom] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const earliestRef = useRef<string | null>(null)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const initialWindowRef = useRef(initialWindowDays)
  initialWindowRef.current = initialWindowDays

  type PartialCount = Pick<InventoryCount, 'id'> & Partial<InventoryCount>

  const mergeRecords = useCallback((fetched: PartialCount[]) => {
    if (fetched.length === 0) return
    setCounts((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]))
      for (const c of fetched) map.set(c.id, c as InventoryCount)
      return Array.from(map.values())
    })
  }, [])

  const describeError = (e: unknown) => {
    if (e instanceof ClientResponseError) {
      if (e.status === 0) return 'Erro de rede ao buscar contagens.'
      return e.message || `Erro ${e.status} ao buscar contagens.`
    }
    // Erros síncronos (ex.: montagem de filtro) carregam a causa real — sem
    // mascará-los como "erro de rede".
    return e instanceof Error && e.message ? e.message : 'Erro ao buscar contagens.'
  }

  // Janela padrão: últimos 60 dias, filtrados no servidor.
  const loadWindow = useCallback(
    async (force = false) => {
      if (force) setError(null) // limpa o banner antes de rebuscar
      setLoading(true)
      const windowFrom = format(subDays(new Date(), initialWindowRef.current), DAY_FMT)
      // Cobertura mais ampla já carregada nunca é encolhida por um reload.
      const from =
        earliestRef.current && earliestRef.current < windowFrom ? earliestRef.current : windowFrom
      try {
        const res = await getInventoryCountsRange(from)
        mergeRecords(res)
        earliestRef.current = from
        setCoveredFrom(from)
        setError(null)
      } catch (e) {
        setError(describeError(e))
      } finally {
        setLoading(false)
      }
    },
    [mergeRecords],
  )

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  useEffect(() => {
    if (!enabled) return
    void loadWindow()
  }, [enabled, loadWindow])

  // Busca sob demanda o intervalo entre a data pedida e o que já está carregado.
  // Chamadas em sequência são serializadas para não disparar buscas concorrentes.
  const ensureRange = useCallback(
    (startIso: string) => {
      if (!startIso) return
      chainRef.current = chainRef.current.then(async () => {
        const earliest = earliestRef.current
        if (earliest && startIso >= earliest) return // intervalo já coberto
        const upper = earliest ?? format(new Date(), DAY_FMT)
        setRangeLoading(true)
        try {
          const res = await getInventoryCountsRange(startIso, upper)
          mergeRecords(res)
          earliestRef.current = startIso
          setCoveredFrom(startIso)
          setError(null)
        } catch (e) {
          setError(describeError(e))
        } finally {
          setRangeLoading(false)
        }
      })
    },
    [mergeRecords],
  )

  // Nova tentativa: recarrega a janela atualmente coberta (não encolhe a
  // cobertura já carregada quando a janela inicial é curta).
  const reload = useCallback(() => {
    chainRef.current = chainRef.current.then(() => {
      const earliest = earliestRef.current
      if (earliest && earliest < format(subDays(new Date(), initialWindowRef.current), DAY_FMT)) {
        return loadWindow(true).then(() => {
          // preserva a cobertura mais ampla já buscada anteriormente
          if (earliest < earliestRef.current!) earliestRef.current = earliest
        })
      }
      return loadWindow(true)
    })
  }, [loadWindow])

  // Tempo real incremental: aplica somente o registro que mudou
  useRealtime<RecordModel & Partial<InventoryCount>>(
    'inventory_counts',
    (e) => {
      if (e.action === 'delete') {
        setCounts((prev) => prev.filter((c) => c.id !== e.record.id))
      } else {
        mergeRecords([e.record])
      }
    },
    enabled,
  )

  // Aliases usados pelas telas: countsLoading/countsError/reloadCounts deixam
  // claro que se tratam das contagens de estoque.
  return {
    counts,
    countsLoading: loading,
    rangeLoading,
    coveredFrom,
    ensureRange,
    countsError: error,
    reloadCounts: reload,
  }
}

export default useInventoryCounts
