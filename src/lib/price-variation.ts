import { Product } from '@/services/products'
import { ProductPriceHistory } from '@/services/product_price_history'

/**
 * Limiar de variação de preço aceitável (em percentual).
 * Se a variação absoluta exceder este valor, um alerta visual deve ser disparado.
 * Facilmente reconfigurável.
 */
export const PRICE_VARIATION_THRESHOLD_PERCENT = 15

export interface PriceVariationCheck {
  hasVariation: boolean
  hasReferencePrice: boolean
  referencePrice: number
  enteredPrice: number
  percentDiff: number // Ex: +25.5 ou -18.2
  absPercentDiff: number // Ex: 25.5 ou 18.2
  direction: 'increase' | 'decrease' | 'equal'
  referenceSource: 'product_price' | 'history_average' | 'none'
}

/**
 * Obtém o preço nominal de referência de um produto.
 * 1. Primeiro tenta o preço atual cadastrado no produto (`product.price`).
 * 2. Se não houver preço no produto (ou for <= 0), calcula a média dos preços no histórico (se fornecido).
 * 3. Caso contrário, retorna 0 e fonte 'none'.
 */
export function getProductReferencePrice(
  product?: Product | null,
  history?: ProductPriceHistory[] | null,
): { price: number; source: 'product_price' | 'history_average' | 'none' } {
  if (!product) {
    return { price: 0, source: 'none' }
  }

  const currentPrice = Number(product.price) || 0
  if (currentPrice > 0) {
    return { price: currentPrice, source: 'product_price' }
  }

  // Fallback: se não houver preço atual cadastrado, usar média dos últimos preços do histórico
  if (history && history.length > 0) {
    const productEntries = history.filter((h) => h.product_id === product.id && Number(h.price) > 0)
    if (productEntries.length > 0) {
      const sum = productEntries.reduce((acc, h) => acc + Number(h.price), 0)
      const avg = sum / productEntries.length
      return {
        price: Math.round(avg * 100) / 100,
        source: 'history_average',
      }
    }
  }

  return { price: 0, source: 'none' }
}

/**
 * Calcula a variação entre o preço digitado e o preço de referência do produto.
 *
 * @param enteredPrice Preço unitário digitado para a compra
 * @param product Produto selecionado
 * @param history Lista de histórico de preços (opcional, para fallback caso produto não tenha preço)
 * @param thresholdPercent Limiar de tolerância percentual (padrão 15%)
 */
export function checkPriceVariation(
  enteredPrice: number | undefined | null,
  product?: Product | null,
  history?: ProductPriceHistory[] | null,
  thresholdPercent: number = PRICE_VARIATION_THRESHOLD_PERCENT,
): PriceVariationCheck {
  const entered = Number(enteredPrice) || 0

  if (!product || entered <= 0) {
    return {
      hasVariation: false,
      hasReferencePrice: false,
      referencePrice: 0,
      enteredPrice: entered,
      percentDiff: 0,
      absPercentDiff: 0,
      direction: 'equal',
      referenceSource: 'none',
    }
  }

  const { price: referencePrice, source } = getProductReferencePrice(product, history)

  if (referencePrice <= 0) {
    return {
      hasVariation: false,
      hasReferencePrice: false,
      referencePrice: 0,
      enteredPrice: entered,
      percentDiff: 0,
      absPercentDiff: 0,
      direction: 'equal',
      referenceSource: 'none',
    }
  }

  // percentDiff = ((digitado - referencia) / referencia) * 100
  const diff = entered - referencePrice
  const percentDiff = (diff / referencePrice) * 100
  const absPercentDiff = Math.abs(percentDiff)
  const hasVariation = absPercentDiff > thresholdPercent

  let direction: 'increase' | 'decrease' | 'equal' = 'equal'
  if (percentDiff > 0.001) direction = 'increase'
  else if (percentDiff < -0.001) direction = 'decrease'

  return {
    hasVariation,
    hasReferencePrice: true,
    referencePrice,
    enteredPrice: entered,
    percentDiff: Math.round(percentDiff * 10) / 10,
    absPercentDiff: Math.round(absPercentDiff * 10) / 10,
    direction,
    referenceSource: source,
  }
}
