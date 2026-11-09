import { format } from 'date-fns'
import { Compra } from '@/services/compras'
import { Product } from '@/services/products'
import { Fornecedor } from '@/services/fornecedores'

export interface PurchasesFilterState {
  startDate: string
  endDate: string
  minValue: string
  maxValue: string
  supplierId: string // '' | '__none__' | specific supplier id
  notaFiscal: string
  searchTerm: string // busca livre por produto, descrição avulsa ou fornecedor
  costCategory: string // '' | 'CMV' | ...
  purchaseType: 'all' | 'avulsa' | 'product' // todos, só avulsas, só com produto
  onlyActiveProducts: boolean // se true, filtra compras cujo produto está ativo (ou compras avulsas)
}

export const initialPurchasesFilters: PurchasesFilterState = {
  startDate: '',
  endDate: '',
  minValue: '',
  maxValue: '',
  supplierId: '',
  notaFiscal: '',
  searchTerm: '',
  costCategory: '',
  purchaseType: 'all',
  onlyActiveProducts: false,
}

/**
 * Normaliza uma data vinda do PocketBase ou input (ex: '2026-11-03 00:00:00.000Z' ou '2026-11-03')
 * para uma string 'yyyy-MM-dd' segura para comparação lexicográfica.
 */
export function normalizeDateYmd(raw?: string | null): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (trimmed.length >= 10) {
    return trimmed.slice(0, 10)
  }
  return ''
}

export function filterCompras(
  compras: Compra[],
  filters: PurchasesFilterState,
  productsMap: Map<string, Product>,
  suppliersMap: Map<string, Fornecedor>,
): Compra[] {
  const minVal = filters.minValue.trim() !== '' ? Number(filters.minValue.replace(',', '.')) : null
  const maxVal = filters.maxValue.trim() !== '' ? Number(filters.maxValue.replace(',', '.')) : null
  const nfTerm = filters.notaFiscal.trim().toLowerCase()
  const search = filters.searchTerm.trim().toLowerCase()

  return compras.filter((c) => {
    const isAvulsa = Boolean(c.is_avulsa || !c.product_id)
    const total = (c.quantity || 1) * (c.price || 0)
    const ymd = normalizeDateYmd(c.date)

    // 1. Filtro de Data Início / Fim
    if (filters.startDate && ymd && ymd < filters.startDate) {
      return false
    }
    if (filters.endDate && ymd && ymd > filters.endDate) {
      return false
    }

    // 2. Filtro de Valor (total da compra)
    if (minVal !== null && !isNaN(minVal) && total < minVal) {
      return false
    }
    if (maxVal !== null && !isNaN(maxVal) && total > maxVal) {
      return false
    }

    // 3. Filtro de Fornecedor
    if (filters.supplierId) {
      if (filters.supplierId === '__none__') {
        if (c.supplier_id) return false
      } else {
        if (c.supplier_id !== filters.supplierId) return false
      }
    }

    // 4. Filtro de Nota Fiscal
    if (nfTerm) {
      const nf = (c.nota_fiscal || '').toLowerCase()
      if (!nf.includes(nfTerm)) {
        return false
      }
    }

    // 5. Tipo de Compra (avulsa vs produto)
    if (filters.purchaseType === 'avulsa' && !isAvulsa) {
      return false
    }
    if (filters.purchaseType === 'product' && isAvulsa) {
      return false
    }

    // 6. Categoria / Fonte de custo
    if (filters.costCategory) {
      const product = c.product_id
        ? productsMap.get(c.product_id) || c.expand?.product_id
        : undefined
      const effectiveCategory = isAvulsa
        ? c.cost_category || 'CMV'
        : product?.cost_category || c.cost_category || 'CMV'

      if (effectiveCategory !== filters.costCategory) {
        return false
      }
    }

    // 7. Filtro de produtos ativos (opcional)
    if (filters.onlyActiveProducts && !isAvulsa) {
      const product = c.product_id
        ? productsMap.get(c.product_id) || c.expand?.product_id
        : undefined
      if (product && product.active === false) {
        return false
      }
    }

    // 8. Busca livre (termo de pesquisa por nome do produto, descrição ou fornecedor)
    if (search) {
      const product = c.product_id
        ? productsMap.get(c.product_id) || c.expand?.product_id
        : undefined
      const productName = (product?.name || c.expand?.product_id?.name || '').toLowerCase()
      const desc = (c.description || '').toLowerCase()
      const supplierName = (
        (c.supplier_id ? suppliersMap.get(c.supplier_id)?.name : '') ||
        c.expand?.supplier_id?.name ||
        ''
      ).toLowerCase()
      const nf = (c.nota_fiscal || '').toLowerCase()

      const matches =
        productName.includes(search) ||
        desc.includes(search) ||
        supplierName.includes(search) ||
        nf.includes(search)

      if (!matches) {
        return false
      }
    }

    return true
  })
}

export function countActiveFilters(filters: PurchasesFilterState): number {
  let count = 0
  if (filters.startDate || filters.endDate) count++
  if (filters.minValue.trim() !== '' || filters.maxValue.trim() !== '') count++
  if (filters.supplierId) count++
  if (filters.notaFiscal.trim() !== '') count++
  if (filters.searchTerm.trim() !== '') count++
  if (filters.costCategory) count++
  if (filters.purchaseType !== 'all') count++
  if (filters.onlyActiveProducts) count++
  return count
}
