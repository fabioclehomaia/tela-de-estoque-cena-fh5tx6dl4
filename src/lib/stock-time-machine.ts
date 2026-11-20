import { InventoryLevel } from '@/services/inventory_levels'
import { InventoryCount } from '@/services/inventory_counts'
import { StockAdjustment } from '@/services/stock_adjustments'

/** Data de uma contagem/ajuste (campos "yyyy-MM-dd HH:mm:ss.SSSZ" ou ISO). */
const parseDbDate = (s: string): Date => new Date(String(s).replace(' ', 'T'))

/**
 * Ajuste de estoque efetivo para a data da contagem retificada:
 * corrected_quantity − original_quantity (pode ser negativo).
 */
export const getAdjustmentDelta = (a: StockAdjustment): number =>
  (a.corrected_quantity || 0) - (a.original_quantity || 0)

/**
 * Ajuste mais recente (por data de gravação) para o par produto+contagem.
 * Recontar a mesma contagem gera vários ajustes: só o último vale.
 */
export const getLatestAdjustmentForCount = (
  adjustments: StockAdjustment[],
  productId: string,
  countId: string,
): StockAdjustment | undefined => {
  let latest: StockAdjustment | undefined
  for (const a of adjustments) {
    if (a.product !== productId || a.count !== countId) continue
    if (!latest || parseDbDate(a.created) > parseDbDate(latest.created)) latest = a
  }
  return latest
}

/**
 * Estoque físico do produto na data informada: nível atual (inventory_levels)
 * reconstruído com TODAS as correções retroativas posteriores à data.
 *
 * Fonte das correções (em ordem decrescente de prioridade):
 *  1. stock_adjustments — delta do ajuste pela DATA DA CONTAGEM retificada
 *     (adjustment_date), mesmo que o ajuste tenha sido gravado depois;
 *  2. diferença da própria contagem (counted − previous), como hoje.
 *
 * Assim, um ajuste cuja contagem é DENTRO do período apurado altera o estoque
 * inicial e/ou final daquele período automaticamente — o CMV retroativo.
 */
export function getStockAtDate(
  productId: string,
  date: Date,
  levels: InventoryLevel[],
  counts: InventoryCount[],
  adjustments: StockAdjustment[] = [],
): number {
  const currentStock = levels
    .filter((l) => l.product_id === productId)
    .reduce((sum, l) => sum + (l.quantity || 0), 0)

  // Correções de contagens posteriores à data, já consolidando o ajuste
  // (quando existir) no lugar da diferença bruta counted − previous.
  let retrospective = 0
  for (const c of counts) {
    if (c.product_id !== productId) continue
    const countDate = parseDbDate(c.created)
    if (countDate <= date) continue
    const adjustment = getLatestAdjustmentForCount(adjustments, productId, c.id)
    if (adjustment) {
      retrospective -= getAdjustmentDelta(adjustment)
    } else {
      retrospective -= (c.counted_quantity || 0) - (c.previous_quantity || 0)
    }
  }

  return currentStock + retrospective
}
