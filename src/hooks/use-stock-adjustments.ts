import { useEffect, useState } from 'react'
import { getStockAdjustments, StockAdjustment } from '@/services/stock_adjustments'

/**
 * Carrega a lista completa de ajustes de contagem (stock_adjustments) uma vez
 * e a mantém em memória enquanto o componente estiver montado. Usada apenas
 * para SINALIZAÇÃO visual nos relatórios — nunca altera o cálculo do CMV, que
 * continua baseado nas contagens originais.
 */
export const useStockAdjustments = () => {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const list = await getStockAdjustments()
        if (!cancelled) setAdjustments(list)
      } catch {
        // Falha ao carregar ajustes não deve derrubar o relatório: a badge de
        // sinalização simplesmente não aparece.
        if (!cancelled) setError('Erro ao carregar ajustes de estoque.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { adjustments, loading, error }
}
