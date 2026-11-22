import { format, parseISO } from 'date-fns'
import { InventoryCount } from '@/services/inventory_counts'

const safeDate = (s: string) => parseISO(String(s).replace(' ', 'T'))

const formatDateTime = (s: string) => {
  try {
    return format(safeDate(s), 'dd/MM/yyyy HH:mm')
  } catch {
    return s
  }
}

const formatDate = (s: string) => {
  try {
    return format(safeDate(s), 'dd/MM/yyyy')
  } catch {
    return s
  }
}

/**
 * Detecção de variações atípicas entre contagens consecutivas do mesmo
 * produto (mesma subárea): usada pela Auditoria de Estoque para apontar
 * prováveis erros de digitação da equipe (ex.: esquecer a vírgula, somar
 * volume errado).
 *
 * Regra, da mais específica para a mais geral — sinaliza a contagem MAIS
 * RECENTE do par (é a que está sendo auditada):
 *  1. Zeramento: estoque anterior > 0 e contagem = 0;
 *  2. Multiplicação por 10 / 100 / 1000: a razão entre os valores é uma
 *     dessas potências (tolerância de 5% — cobre "esqueci a vírgula");
 *  3. Variação relativa: |diferença| > 50% do anterior E |diferença| absoluta
 *     acima do piso (evita falsos positivos em quantidades pequenas).
 */

/** Piso absoluto: variações menores que isso em unidades são ruído normal. */
export const AUDIT_ABSOLUTE_THRESHOLD = 5

/** Variação relativa máxima considerada normal entre contagens consecutivas. */
export const AUDIT_RELATIVE_THRESHOLD = 0.5

/** Tolerância para reconhecer uma "contagem com vírgula esquecida" (x10/x100/1000). */
const ORDER_OF_MAGNITUDE_TOLERANCE = 0.05

export type AuditFlagReason = 'zeramento' | 'magnitude' | 'relativa'

export interface CountVariationFlag {
  count: InventoryCount
  previous: InventoryCount
  delta: number
  deltaPercent: number | null
  reason: AuditFlagReason
}

/**
 * Compara cada contagem com a anterior do MESMO produto na MESMA subárea
 * (ordenadas do mais antigo ao mais recente) e devolve as que tiveram
 * variação atípica. A lista de entrada pode vir em qualquer ordem.
 */
export const detectSuspiciousCountVariations = (counts: InventoryCount[]): CountVariationFlag[] => {
  // Agrupa por produto+subárea e ordena cada grupo cronologicamente.
  const groups = new Map<string, InventoryCount[]>()
  for (const c of counts) {
    const key = `${c.product_id}::${c.subarea_id}`
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }

  const flags: CountVariationFlag[] = []
  for (const list of groups.values()) {
    list.sort((a, b) => safeDate(a.created).getTime() - safeDate(b.created).getTime())
    for (let i = 1; i < list.length; i++) {
      const current = list[i]
      const previous = list[i - 1]
      const flag = flagVariation(previous, current)
      if (flag) flags.push(flag)
    }
  }

  // Mais recente primeiro (padrão da auditoria).
  flags.sort((a, b) => safeDate(b.count.created).getTime() - safeDate(a.count.created).getTime())
  return flags
}

const flagVariation = (
  previous: InventoryCount,
  current: InventoryCount,
): CountVariationFlag | null => {
  const prev = previous.counted_quantity
  const curr = current.counted_quantity
  const delta = curr - prev
  const absDelta = Math.abs(delta)
  // Sem mudança, ou pequena demais para ser suspeita, não sinaliza.
  if (absDelta < AUDIT_ABSOLUTE_THRESHOLD) return null

  // 1. Zeramento: tinha estoque e a contagem veio zerada.
  if (prev > 0 && curr === 0) {
    return { count: current, previous, delta, deltaPercent: -100, reason: 'zeramento' }
  }

  if (prev <= 0) return null

  const ratio = curr / prev

  // 2. Ordem de grandeza: x10, x100, x1000 (ou frações de si mesmo) —
  //    clássico "esqueci a vírgula".
  for (const m of [10, 100, 1000, 0.1, 0.01, 0.001]) {
    if (Math.abs(ratio - m) / m <= ORDER_OF_MAGNITUDE_TOLERANCE) {
      return {
        count: current,
        previous,
        delta,
        deltaPercent: (delta / prev) * 100,
        reason: 'magnitude',
      }
    }
  }

  // 3. Variação relativa grande com valor absoluto relevante.
  const relDelta = Math.abs(delta) / prev
  if (relDelta > AUDIT_RELATIVE_THRESHOLD) {
    return {
      count: current,
      previous,
      delta,
      deltaPercent: (delta / prev) * 100,
      reason: 'relativa',
    }
  }

  return null
}

export const AUDIT_REASON_LABEL: Record<AuditFlagReason, string> = {
  zeramento: 'Contagem zerada',
  magnitude: 'Ordem de grandeza (x10/x100?)',
  relativa: 'Variação atípica',
}

export interface AuditEvent {
  id: string
  type: 'adjustment' | 'variation'
  /** Data do evento (da contagem retificada, ou da contagem sinalizada). */
  date: Date
  productName: string
  productActive: boolean
  unit: string
  categoryName: string
  areaName: string
  subareaName: string
  /** Quem contou (ajuste e variação). */
  countedBy: string
  /** Quando a contagem foi feita (ajuste e variação). */
  countedAt: string
  /** Quem ajustou / quando — só em ajustes. */
  adjustedBy?: string
  adjustedAt?: string
  /** Ajustes: original -> corrigido. Variações: anterior -> contado. */
  previousQuantity: number
  newQuantity: number
  delta: number
  /** Ajustes: motivo registrado (com justificativa embutida quando "Outros"). */
  reason?: string
  /** Variações: classificação da suspeita. */
  flagReason?: AuditFlagReason
  deltaPercent?: number | null
  /** Id da subárea onde o evento aconteceu (para os filtros de área/subárea). */
  subareaRefId: string
}

/**
 * Mescla ajustes e variações sinalizadas em uma única linha do tempo
 * (mais recente primeiro) para a Auditoria de Estoque.
 */
export const buildAuditEvents = (
  adjustments: StockAdjustmentLike[],
  variations: CountVariationFlag[],
  /** Mapa opcional: id da contagem -> usuário que a realizou (para o rastro dos ajustes). */
  countUsers?: Map<string, { name?: string; email?: string }>,
): AuditEvent[] => {
  const events: AuditEvent[] = []

  for (const adj of adjustments) {
    const product = adj.expand?.product
    const countDate = adj.expand?.count?.created || adj.adjustment_date || adj.created
    events.push({
      id: `adj-${adj.id}`,
      type: 'adjustment',
      date: safeDate(adj.adjustment_date || adj.created),
      productName: product?.name || 'Produto removido',
      productActive: product ? product.active !== false : true,
      unit: product?.unit || '',
      categoryName: '',
      areaName: '',
      subareaName: '',
      subareaRefId: adj.expand?.count?.subarea_id || '',
      countedBy: (() => {
        const fromCount = countUsers?.get(adj.expand?.count?.id || '')
        return fromCount?.name || fromCount?.email || '—'
      })(),
      countedAt: countDate,
      adjustedBy: adj.expand?.adjusted_by?.name || adj.expand?.adjusted_by?.email || '—',
      adjustedAt: adj.created,
      previousQuantity: adj.original_quantity,
      newQuantity: adj.corrected_quantity,
      delta: adj.corrected_quantity - adj.original_quantity,
      reason: adj.reason || '',
    })
  }

  for (const v of variations) {
    const product = v.count.expand?.product_id
    const subarea = v.count.expand?.subarea_id
    const user = v.count.expand?.user_id
    events.push({
      id: `var-${v.count.id}`,
      type: 'variation',
      date: safeDate(v.count.created),
      productName: product?.name || 'Produto removido',
      productActive: product ? product.active !== false : true,
      unit: product?.unit || '',
      categoryName: '',
      areaName: subarea?.expand?.area_id?.name || '',
      subareaName: subarea?.name || '',
      subareaRefId: v.count.subarea_id || '',
      countedBy: user?.name || user?.email || '—',
      countedAt: v.count.created,
      previousQuantity: v.previous.counted_quantity,
      newQuantity: v.count.counted_quantity,
      delta: v.delta,
      flagReason: v.reason,
      deltaPercent: v.deltaPercent,
    })
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime())
  return events
}

/** Forma do ajuste que a auditoria precisa — igual ao serviço de ajustes. */
export interface StockAdjustmentLike {
  id: string
  adjustment_date: string
  original_quantity: number
  corrected_quantity: number
  reason: string
  created: string
  expand?: {
    product?: { id: string; name: string; unit: string; active?: boolean }
    count?: { id: string; created: string; subarea_id: string }
    adjusted_by?: { id: string; name: string; email: string }
  }
}

export const formatAuditDate = (d: Date) => format(d, 'dd/MM/yyyy')
export const formatAuditDateTime = (s: string) => formatDateTime(s)
