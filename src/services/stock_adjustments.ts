import { format, parseISO } from 'date-fns'
import pb from '@/lib/pocketbase/client'

export interface StockAdjustment {
  id: string
  product: string
  count: string
  adjustment_date: string
  original_quantity: number
  corrected_quantity: number
  reason: string
  adjusted_by: string
  created: string
  updated: string
  expand?: {
    product?: { id: string; name: string; unit: string }
    count?: { id: string; created: string }
    adjusted_by?: { id: string; name: string; email: string }
  }
}

export interface CreateStockAdjustmentInput {
  product: string
  count: string
  adjustment_date: string
  original_quantity: number
  corrected_quantity: number
  reason?: string
}

/**
 * Normaliza uma data ("yyyy-MM-dd" ou ISO) para o início do dia em UTC, no
 * formato que o PocketBase espera em filtros de campo date.
 */
const toDayStartUtc = (value: string | Date): string => {
  const d = typeof value === 'string' ? parseISO(value) : value
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Data inválida para filtro de ajustes: ${String(value)}`)
  }
  return format(d, 'yyyy-MM-dd 00:00:00.000') + 'Z'
}

export const getStockAdjustments = async (filter: string = '') => {
  return pb.collection('stock_adjustments').getFullList<StockAdjustment>({
    sort: '-created',
    expand: 'product,count,adjusted_by',
    filter,
    batch: 1000,
  })
}

export const createStockAdjustment = async (data: CreateStockAdjustmentInput) => {
  const user = pb.authStore.record
  return pb.collection('stock_adjustments').create<StockAdjustment>({
    ...data,
    reason: data.reason || '',
    adjusted_by: user?.id,
  })
}

/** Ajustes cuja contagem retificada cai dentro do período [fromIso, toIso]. */
export const getStockAdjustmentsRange = async (fromIso: string | Date, toIso: string | Date) => {
  const filters = [
    `adjustment_date >= "${toDayStartUtc(fromIso)}"`,
    `adjustment_date <= "${toDayStartUtc(toIso)}"`,
  ]
  return getStockAdjustments(filters.join(' && '))
}

/** Mapa: id da contagem -> ajuste mais recente registrado para ela. */
export const buildAdjustmentsByCountId = (adjustments: StockAdjustment[]) => {
  const map = new Map<string, StockAdjustment>()
  for (const adj of adjustments) {
    const existing = map.get(adj.count)
    if (!existing || new Date(adj.created) > new Date(existing.created)) {
      map.set(adj.count, adj)
    }
  }
  return map
}
