import { InventoryLevel } from '@/services/inventory_levels'
import { InventoryCount } from '@/services/inventory_counts'
import { Compra } from '@/services/compras'
import { Product } from '@/services/products'
import { isProcessedProduct } from '@/lib/processed-products'
import { StockAdjustment } from '@/services/stock_adjustments'
import { getStockAtDate } from '@/lib/stock-time-machine'

export { getStockAtDate }

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
  comprasAvulsasCMV?: number
  comprasAvulsasCount?: number
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

/**
 * Parâmetro opcional `adjustments` (stock_adjustments): quando informado, o
 * estoque reconstruído passa a incorporar os ajustes PELA DATA DA CONTAGEM
 * retificada (adjustment_date), e não pela data de gravação do ajuste — é o
 * que torna o CMV retroativo: contagem ajustada dentro do período altera o
 * estoque inicial/final daquele período, mesmo com ajuste gravado depois.
 */
export function calculateProductConsumption(
  product: Product,
  compras: Compra[],
  levels: InventoryLevel[],
  counts: InventoryCount[],
  startDate: Date,
  endDate: Date,
  adjustments: StockAdjustment[] = [],
): ProductConsumptionDetail {
  const matchingCompras = compras.filter((c) => {
    if (c.product_id !== product.id) return false
    // Compras de produtos PROCESSADOS não contabilizam como compra/consumo
    if (isProcessedProduct(product)) return false
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

  const estoqueInicialQtd = getStockAtDate(product.id, startDate, levels, counts, adjustments)
  const estoqueFinalQtd = getStockAtDate(product.id, endDate, levels, counts, adjustments)

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
  adjustments: StockAdjustment[] = [],
): CMVResult {
  // Produtos PROCESSADOS (produzidos na cozinha) entram no CMV pela matéria-
  // prima: excluídos do breakdown e, portanto, de todos os totais.
  const cmvProducts = products.filter(
    (p) => (!p.cost_category || p.cost_category === 'CMV') && !isProcessedProduct(p),
  )

  const breakdown = cmvProducts.map((product) => {
    const unitPrice = product.price || 0
    const estoqueInicialQtd = getStockAtDate(product.id, startDate, levels, counts, adjustments)
    const estoqueFinalQtd = getStockAtDate(product.id, endDate, levels, counts, adjustments)

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

  // Compras avulsas cuja fonte de custo seja 'CMV' no período
  const avulsasCMV = compras.filter((c) => {
    if (!c.is_avulsa && c.product_id) return false
    const costCat = c.cost_category || 'CMV'
    if (costCat !== 'CMV') return false
    const d = new Date(c.date.split(' ')[0])
    return d >= startDate && d <= endDate
  })

  const totalAvulsasCMV = avulsasCMV.reduce((sum, c) => sum + (c.quantity || 1) * (c.price || 0), 0)

  const produtosTotalInicial = breakdown.reduce((s, b) => s + b.estoqueInicial, 0)
  const produtosTotalCompras = breakdown.reduce((s, b) => s + b.compras, 0)
  const produtosTotalFinal = breakdown.reduce((s, b) => s + b.estoqueFinal, 0)
  const produtosTotalCMV = breakdown.reduce((s, b) => s + b.cmv, 0)

  return {
    breakdown,
    totalInicial: produtosTotalInicial,
    totalCompras: produtosTotalCompras + totalAvulsasCMV,
    totalFinal: produtosTotalFinal,
    totalCMV: produtosTotalCMV + totalAvulsasCMV,
    comprasAvulsasCMV: totalAvulsasCMV,
    comprasAvulsasCount: avulsasCMV.length,
  }
}
