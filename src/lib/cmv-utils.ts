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

export interface ProductConsumptionDetail {
  product: Product
  estoqueInicial: number
  compras: number
  estoqueFinal: number
  consumoValor: number
  estoqueInicialQtd: number
  comprasQtd: number
  estoqueFinalQtd: number
  consumoQtd: number
  comprasCount: number
  hasInventoryData: boolean // true se o produto tem contagens ou registro de nível de estoque
}

export function calculateProductConsumption(
  product: Product,
  compras: Compra[],
  levels: InventoryLevel[],
  counts: InventoryCount[],
  startDate: Date,
  endDate: Date,
): ProductConsumptionDetail {
  const matchingCompras = compras.filter((c) => {
    if (c.product_id !== product.id) return false
    const d = new Date(c.date.split(' ')[0])
    return d >= startDate && d <= endDate
  })

  const comprasQtd = matchingCompras.reduce((sum, c) => sum + (c.quantity || 0), 0)
  const productCompras = matchingCompras.reduce(
    (sum, c) => sum + (c.quantity || 0) * (c.price || 0),
    0,
  )

  // Preço unitário base: do produto cadastrado ou preço médio das compras do período
  let unitPrice = product.price || 0
  if (!unitPrice && comprasQtd > 0 && productCompras > 0) {
    unitPrice = productCompras / comprasQtd
  }

  // Verificar se o produto possui histórico de contagens ou nível de estoque
  const hasCounts = counts.some((c) => c.product_id === product.id)
  const hasLevels = levels.some((l) => l.product_id === product.id && (l.quantity ?? 0) > 0)
  const hasInventoryData = hasCounts || hasLevels

  if (!hasInventoryData) {
    // Sem nenhuma contagem ou nível de estoque registrado:
    // O consumo não pode ser inventado. Consideramos apenas compras diretas
    return {
      product,
      estoqueInicial: 0,
      compras: productCompras,
      estoqueFinal: 0,
      consumoValor: productCompras,
      estoqueInicialQtd: 0,
      comprasQtd,
      estoqueFinalQtd: 0,
      consumoQtd: comprasQtd,
      comprasCount: matchingCompras.length,
      hasInventoryData: false,
    }
  }

  const estoqueInicialQtd = getStockAtDate(product.id, startDate, levels, counts)
  const estoqueFinalQtd = getStockAtDate(product.id, endDate, levels, counts)

  const estoqueInicial = estoqueInicialQtd * unitPrice
  const estoqueFinal = estoqueFinalQtd * unitPrice
  const consumoQtd = estoqueInicialQtd + comprasQtd - estoqueFinalQtd
  const consumoValor = estoqueInicial + productCompras - estoqueFinal

  return {
    product,
    estoqueInicial,
    compras: productCompras,
    estoqueFinal,
    consumoValor,
    estoqueInicialQtd,
    comprasQtd,
    estoqueFinalQtd,
    consumoQtd,
    comprasCount: matchingCompras.length,
    hasInventoryData: true,
  }
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
