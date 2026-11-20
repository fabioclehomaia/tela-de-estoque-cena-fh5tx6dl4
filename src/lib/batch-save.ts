import { createCompra } from '@/services/compras'
import { getInventoryLevels } from '@/services/inventory_levels'
import { updateProduct, Product } from '@/services/products'
import { Compra, CostCategory } from '@/services/compras'
import { toast } from 'sonner'

/** Uma linha do lançamento em lote — produto vinculado ou item avulso. */
export interface BatchLine {
  key: string
  /** item avulso: sem produto, só descrição + valor + fonte de custo */
  is_avulso: boolean
  product_id?: string
  quantity: number
  price: number // preço unitário
  description?: string
  cost_category?: CostCategory
}

export interface BatchHeader {
  supplier_id?: string
  nota_fiscal?: string
  payment_term?: string
  date: string // yyyy-MM-dd
}

export interface BatchLineFailure {
  key: string
  label: string
  reason: string
  line: BatchLine
}

function getVolumeAntigo(allLevels: { product_id: string; quantity: number }[], productId: string) {
  return allLevels
    .filter((l) => l.product_id === productId)
    .reduce((sum, l) => sum + (l.quantity || 0), 0)
}

/**
 * Grava as linhas do lote como compras individuais com cabeçalho comum
 * (fornecedor, data, nota fiscal, condição de pagamento) e atualiza o preço
 * médio ponderado de cada produto — a mesma fórmula usada na compra individual
 * e no espelho da nota: (preço_antigo×volume_antigo + preço_novo×qtd) / (volume_antigo+qtd).
 *
 * Não é transacional no backend (PocketBase grava registro a registro); falhas
 * são coletadas por linha e devolvidas para o usuário reenviar só o que falhou.
 */
export async function saveBatchCompras(
  header: BatchHeader,
  lines: BatchLine[],
  products: Product[],
): Promise<{ saved: number; failures: BatchLineFailure[] }> {
  const allLevels = await getInventoryLevels()
  const productsMap = new Map(products.map((p) => [p.id, p]))
  const failures: BatchLineFailure[] = []
  let saved = 0

  for (const line of lines) {
    const label = line.is_avulso
      ? line.description || 'Item avulso'
      : productsMap.get(line.product_id || '')?.name || 'Item'

    const payload: Partial<Compra> = {
      date: header.date,
      nota_fiscal: header.nota_fiscal || undefined,
      payment_term: header.payment_term || undefined,
      quantity: line.quantity || 1,
      price: line.price,
      supplier_id: header.supplier_id || undefined,
      product_id: line.is_avulso ? undefined : line.product_id,
      is_avulsa: line.is_avulso,
    }
    if (line.is_avulso) {
      payload.description = line.description?.trim()
      payload.cost_category = line.cost_category || 'CMV'
      // avulso herda fornecedor comum do lote, se houver
      if (header.supplier_id) payload.supplier_id = header.supplier_id
      else payload.supplier_id = undefined
    }

    try {
      await createCompra(payload)
      saved++
    } catch (err) {
      console.error('Falha ao gravar compra do lote:', label, err)
      failures.push({
        key: line.key,
        label,
        reason: (err as Error)?.message || 'Erro desconhecido no backend',
        line,
      })
      continue // preço médio só faz sentido se a compra foi gravada
    }

    // Atualizar preço médio ponderado (mesma regra da compra individual)
    if (!line.is_avulso && line.product_id) {
      const product = productsMap.get(line.product_id)
      if (product) {
        try {
          const volumeAntigo = getVolumeAntigo(allLevels, product.id)
          const precoAntigo = product.price || 0
          let weightedPrice = line.price
          if (volumeAntigo > 0 && precoAntigo > 0) {
            weightedPrice =
              (precoAntigo * volumeAntigo + line.price * line.quantity) /
              (volumeAntigo + line.quantity)
          }
          weightedPrice = Math.round(weightedPrice * 100) / 100
          await updateProduct(product.id, { price: weightedPrice })
        } catch (priceErr) {
          console.warn('Compra gravada, mas preço médio do produto não atualizou:', priceErr)
          toast.warning(`Compra de ${label} gravada, mas o preço do produto não foi atualizado.`)
        }
      }
    }
  }

  return { saved, failures }
}
