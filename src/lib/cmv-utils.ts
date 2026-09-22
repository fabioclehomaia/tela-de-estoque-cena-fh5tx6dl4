import { InventoryLevel } from '@/services/inventory_levels'
import { InventoryCount } from '@/services/inventory_counts'
import { Compra } from '@/services/compras'
import { Product } from '@/services/products'

export function getStockAtDate(
  productId: string,
  date: Date,
  levels: InventoryLevel[],
  counts: InventoryCount[],
): number {
  const currentStock = levels
    .filter((l) => l.product_id === productId)
    .reduce((sum, l) => sum + (l.quantity || 0), 0)

  const adjustments = counts
    .filter((c) => {
      if (c.product_id !== productId) return false
      const countDate = new Date(c.created.replace(' ', 'T'))
      return countDate > date
    })
    .reduce((sum, c) => sum - ((c.counted_quantity || 0) - (c.previous_quantity || 0)), 0)

  return currentStock + adjustments
}

export interface CMVBreakdown {
  product: Product
  estoqueInicial: number
  compras: number
  estoqueFinal: number
  cmv: number
  // Quantidades físicas reais na unidade de medida do produto
  estoqueInicialQtd: number
  comprasQtd: number
  estoqueFinalQtd: number
  consumoQtd: number
}

export interface CMVResult {
  breakdown: CMVBreakdown[]
  totalInicial: number
  totalCompras: number
  totalFinal: number
  totalCMV: number
}

export function calculateCMV(
  products: Product[],
  compras: Compra[],
  levels: InventoryLevel[],
  counts: InventoryCount[],
  startDate: Date,
  endDate: Date,
): CMVResult {
  const cmvProducts = products.filter((p) => !p.cost_category || p.cost_category === 'CMV')

  const breakdown = cmvProducts.map((product) => {
    const unitPrice = product.price || 0
    const estoqueInicialQtd = getStockAtDate(product.id, startDate, levels, counts)
    const estoqueFinalQtd = getStockAtDate(product.id, endDate, levels, counts)

    const matchingCompras = compras.filter((c) => {
      if (c.product_id !== product.id) return false
      const d = new Date(c.date)
      return d >= startDate && d <= endDate
    })

    const comprasQtd = matchingCompras.reduce((sum, c) => sum + (c.quantity || 0), 0)
    const productCompras = matchingCompras.reduce(
      (sum, c) => sum + (c.quantity || 0) * (c.price || 0),
      0,
    )

    const estoqueInicial = estoqueInicialQtd * unitPrice
    const estoqueFinal = estoqueFinalQtd * unitPrice
    const cmv = estoqueInicial + productCompras - estoqueFinal
    const consumoQtd = estoqueInicialQtd + comprasQtd - estoqueFinalQtd

    return {
      product,
      estoqueInicial,
      compras: productCompras,
      estoqueFinal,
      cmv,
      estoqueInicialQtd,
      comprasQtd,
      estoqueFinalQtd,
      consumoQtd,
    }
  })

  return {
    breakdown,
    totalInicial: breakdown.reduce((s, b) => s + b.estoqueInicial, 0),
    totalCompras: breakdown.reduce((s, b) => s + b.compras, 0),
    totalFinal: breakdown.reduce((s, b) => s + b.estoqueFinal, 0),
    totalCMV: breakdown.reduce((s, b) => s + b.cmv, 0),
  }
}
