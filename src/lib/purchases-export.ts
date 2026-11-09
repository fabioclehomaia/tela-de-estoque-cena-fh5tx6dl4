import { format } from 'date-fns'
import { Compra, CostCategory } from '@/services/compras'
import { Product } from '@/services/products'
import { Fornecedor } from '@/services/fornecedores'
import { PurchasesFilterState } from './purchases-filter'

export interface PurchasesExportSummary {
  totalItems: number
  totalAmount: number
  totalAvulsas: number
  amountAvulsas: number
  totalWithProduct: number
  amountWithProduct: number
  byCategory: Record<string, { count: number; amount: number }>
}

function escapeCsvCell(cell: string | number | null | undefined): string {
  if (cell === null || cell === undefined) return '""'
  const str = String(cell)
  const escaped = str.replace(/"/g, '""')
  return `"${escaped}"`
}

function formatNumberPtBr(num: number, decimals: number = 2): string {
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Constrói o conteúdo CSV completo, com cabeçalho UTF-8 (BOM), separador ponto-e-vírgula (padrão Excel pt-BR),
 * linhas de compras filtradas, linha de totais e resumo por categoria/fonte de custo.
 */
export function buildPurchasesCsvContent(
  filteredCompras: Compra[],
  filters: PurchasesFilterState,
  productsMap: Map<string, Product>,
  suppliersMap: Map<string, Fornecedor>,
): string {
  const rows: string[] = []

  // Metadados do relatório no topo
  rows.push(['RELATÓRIO DE COMPRAS - CENA RISOTTERIA'].map(escapeCsvCell).join(';'))
  rows.push(['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm:ss')].map(escapeCsvCell).join(';'))

  const periodLabel =
    filters.startDate && filters.endDate
      ? `${format(new Date(filters.startDate + 'T00:00:00'), 'dd/MM/yyyy')} a ${format(new Date(filters.endDate + 'T00:00:00'), 'dd/MM/yyyy')}`
      : filters.startDate
        ? `A partir de ${format(new Date(filters.startDate + 'T00:00:00'), 'dd/MM/yyyy')}`
        : filters.endDate
          ? `Até ${format(new Date(filters.endDate + 'T00:00:00'), 'dd/MM/yyyy')}`
          : 'Todos os períodos'

  rows.push(['Filtro de Período', periodLabel].map(escapeCsvCell).join(';'))

  if (filters.supplierId) {
    const supName =
      filters.supplierId === '__none__'
        ? 'Sem fornecedor'
        : suppliersMap.get(filters.supplierId)?.name || 'Fornecedor selecionado'
    rows.push(['Filtro de Fornecedor', supName].map(escapeCsvCell).join(';'))
  }
  if (filters.notaFiscal) {
    rows.push(['Filtro de Nota Fiscal', filters.notaFiscal].map(escapeCsvCell).join(';'))
  }
  if (filters.costCategory) {
    rows.push(['Filtro de Categoria/Fonte', filters.costCategory].map(escapeCsvCell).join(';'))
  }
  if (filters.purchaseType !== 'all') {
    rows.push(
      [
        'Tipo de Compra',
        filters.purchaseType === 'avulsa' ? 'Apenas Avulsas' : 'Apenas com Produto',
      ]
        .map(escapeCsvCell)
        .join(';'),
    )
  }
  if (filters.minValue || filters.maxValue) {
    rows.push(
      ['Faixa de Valor', `Min: R$ ${filters.minValue || '0'} | Max: R$ ${filters.maxValue || '∞'}`]
        .map(escapeCsvCell)
        .join(';'),
    )
  }

  rows.push(
    ['Total de Registros Filtrados', filteredCompras.length.toString()]
      .map(escapeCsvCell)
      .join(';'),
  )
  rows.push('') // linha em branco

  // Cabeçalho da tabela principal
  const headers = [
    'Data',
    'Tipo',
    'Produto / Descrição',
    'Status Produto',
    'Categoria / Fonte de Custo',
    'Quantidade',
    'Unidade',
    'Preço Unitário (R$)',
    'Valor Total (R$)',
    'Fornecedor',
    'Nota Fiscal',
    'Condição de Pagamento',
  ]
  rows.push(headers.map(escapeCsvCell).join(';'))

  let sumTotal = 0
  let countAvulsas = 0
  let amountAvulsas = 0
  let countProduct = 0
  let amountProduct = 0
  const byCategory: Record<string, { count: number; amount: number }> = {}

  filteredCompras.forEach((c) => {
    const isAvulsa = Boolean(c.is_avulsa || !c.product_id)
    const product = c.product_id ? productsMap.get(c.product_id) || c.expand?.product_id : undefined
    const supplier = c.supplier_id
      ? suppliersMap.get(c.supplier_id) || c.expand?.supplier_id
      : undefined

    const dateStr = c.date ? format(new Date(c.date.split(' ')[0] + 'T00:00:00'), 'dd/MM/yyyy') : ''
    const typeLabel = isAvulsa ? 'Avulsa' : 'Produto'
    const nameLabel = isAvulsa
      ? c.description || 'Compra avulsa'
      : product?.name || c.expand?.product_id?.name || 'Produto'

    let statusProduct = '-'
    if (!isAvulsa) {
      statusProduct = product?.active === false ? 'Inativo' : 'Ativo'
    }

    const category: CostCategory | string = isAvulsa
      ? c.cost_category || 'CMV'
      : product?.cost_category || c.cost_category || 'CMV'

    const qty = c.quantity || 1
    const unit = isAvulsa ? 'un' : product?.unit || c.expand?.product_id?.unit || 'un'
    const unitPrice = c.price || 0
    const lineTotal = qty * unitPrice

    sumTotal += lineTotal
    if (isAvulsa) {
      countAvulsas++
      amountAvulsas += lineTotal
    } else {
      countProduct++
      amountProduct += lineTotal
    }

    if (!byCategory[category]) {
      byCategory[category] = { count: 0, amount: 0 }
    }
    byCategory[category].count++
    byCategory[category].amount += lineTotal

    const row = [
      dateStr,
      typeLabel,
      nameLabel,
      statusProduct,
      category,
      formatNumberPtBr(qty, 4),
      unit,
      formatNumberPtBr(unitPrice, 2),
      formatNumberPtBr(lineTotal, 2),
      supplier?.name || (isAvulsa ? 'Sem fornecedor' : '-'),
      c.nota_fiscal || '',
      c.payment_term || '',
    ]
    rows.push(row.map(escapeCsvCell).join(';'))
  })

  // Linha de total geral
  rows.push('')
  rows.push(
    ['TOTAIS', '', '', '', '', '', '', '', formatNumberPtBr(sumTotal, 2), '', '', '']
      .map(escapeCsvCell)
      .join(';'),
  )

  // Resumo por categoria / fonte de custo
  rows.push('')
  rows.push(['RESUMO POR FONTE DE CUSTO / CATEGORIA'].map(escapeCsvCell).join(';'))
  rows.push(
    ['Categoria / Fonte', 'Qtd de Compras', 'Valor Total (R$)', '% do Total']
      .map(escapeCsvCell)
      .join(';'),
  )

  Object.entries(byCategory)
    .sort((a, b) => b[1].amount - a[1].amount)
    .forEach(([cat, stats]) => {
      const pct = sumTotal > 0 ? (stats.amount / sumTotal) * 100 : 0
      rows.push(
        [
          cat,
          stats.count.toString(),
          formatNumberPtBr(stats.amount, 2),
          `${formatNumberPtBr(pct, 1)}%`,
        ]
          .map(escapeCsvCell)
          .join(';'),
      )
    })

  // Resumo por tipo de compra (produto vs avulsa)
  rows.push('')
  rows.push(['RESUMO POR TIPO DE COMPRA'].map(escapeCsvCell).join(';'))
  rows.push(
    ['Tipo', 'Qtd de Compras', 'Valor Total (R$)', '% do Total'].map(escapeCsvCell).join(';'),
  )

  const pctProd = sumTotal > 0 ? (amountProduct / sumTotal) * 100 : 0
  const pctAvulsa = sumTotal > 0 ? (amountAvulsas / sumTotal) * 100 : 0

  rows.push(
    [
      'Compras com Produto',
      countProduct.toString(),
      formatNumberPtBr(amountProduct, 2),
      `${formatNumberPtBr(pctProd, 1)}%`,
    ]
      .map(escapeCsvCell)
      .join(';'),
  )
  rows.push(
    [
      'Compras Avulsas',
      countAvulsas.toString(),
      formatNumberPtBr(amountAvulsas, 2),
      `${formatNumberPtBr(pctAvulsa, 1)}%`,
    ]
      .map(escapeCsvCell)
      .join(';'),
  )

  return rows.join('\r\n')
}

export function downloadPurchasesCsv(
  filteredCompras: Compra[],
  filters: PurchasesFilterState,
  productsMap: Map<string, Product>,
  suppliersMap: Map<string, Fornecedor>,
) {
  const content = buildPurchasesCsvContent(filteredCompras, filters, productsMap, suppliersMap)
  // BOM UTF-8 (\uFEFF) para garantir abertura direta e correta de caracteres com acentos no Excel
  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), content], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url

  const dateSuffix = format(new Date(), 'yyyyMMdd_HHmm')
  link.setAttribute('download', `relatorio_compras_cena_${dateSuffix}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
