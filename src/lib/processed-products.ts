import { Product } from '@/services/products'

/**
 * Categoria "PROCESSADOS" (coleção `categories`, id fixo jjxz2doywld3r6l):
 * itens produzidos na cozinha (sorvetes, pudins, xaropes, molhos etc.), que
 * NÃO devem ser lançados como compra nem contabilizados em totais de compras
 * e CMV — o custo deles entra pela matéria-prima.
 */
export const PROCESSED_CATEGORY_ID = 'jjxz2doywld3r6l'
export const PROCESSED_CATEGORY_NAME = 'PROCESSADOS'

/**
 * True quando o produto pertence à categoria PROCESSADOS — pelo id direto da
 * categoria ou pelo nome vindo do expand (cobre cópias da base com outro id).
 */
export function isProcessedProduct(
  product?: Pick<Product, 'category_id' | 'expand'> | null,
): boolean {
  if (!product) return false
  if (product.category_id === PROCESSED_CATEGORY_ID) return true
  const name = product.expand?.category_id?.name
  return typeof name === 'string' && name.toUpperCase() === PROCESSED_CATEGORY_NAME
}

/**
 * True quando a compra é de um produto da categoria PROCESSADOS.
 * Prefere o expand da compra (id da categoria); na falta dele, usa o mapa de
 * produtos carregado na tela.
 */
export function isProcessedCompra(
  compra: { product_id?: string; expand?: { product_id?: { category_id?: string } } },
  productsMap?: Map<string, Pick<Product, 'category_id' | 'expand'>>,
): boolean {
  if (!compra.product_id) return false
  const expandCatId = compra.expand?.product_id?.category_id
  if (expandCatId) return expandCatId === PROCESSED_CATEGORY_ID
  return isProcessedProduct(productsMap?.get(compra.product_id))
}
