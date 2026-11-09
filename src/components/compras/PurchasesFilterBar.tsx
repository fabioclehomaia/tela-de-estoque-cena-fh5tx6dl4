import { useState } from 'react'
import {
  Filter,
  X,
  Search,
  Calendar,
  Building2,
  FileText,
  DollarSign,
  Tag,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Fornecedor } from '@/services/fornecedores'
import { CostCategory } from '@/services/compras'
import {
  PurchasesFilterState,
  initialPurchasesFilters,
  countActiveFilters,
} from '@/lib/purchases-filter'

export const COST_CATEGORIES: CostCategory[] = [
  'CMV',
  'Manutenção predial',
  'Utensílios',
  'Alimentação de funcionários',
  'Limpeza',
  'Descartáveis',
  'Decoração',
  'Operacional',
]

interface PurchasesFilterBarProps {
  filters: PurchasesFilterState
  onChange: (filters: PurchasesFilterState) => void
  suppliers: Fornecedor[]
  totalFiltered: number
  totalOriginal: number
  totalAmountFiltered: number
  onExportCsv: () => void
  isExporting?: boolean
}

export function PurchasesFilterBar({
  filters,
  onChange,
  suppliers,
  totalFiltered,
  totalOriginal,
  totalAmountFiltered,
  onExportCsv,
  isExporting = false,
}: PurchasesFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const activeCount = countActiveFilters(filters)

  const handleClearAll = () => {
    onChange(initialPurchasesFilters)
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-3">
      {/* Linha superior: Busca livre + Toggle de Filtros Avançados + Botão Exportar + Limpar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={filters.searchTerm}
            onChange={(e) => onChange({ ...filters, searchTerm: e.target.value })}
            placeholder="Buscar por produto, descrição avulsa, fornecedor ou NF..."
            className="pl-9 pr-8 text-sm h-9"
          />
          {filters.searchTerm && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, searchTerm: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle de filtros avançados */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="h-9 gap-1.5 border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
            <span>Filtros</span>
            {activeCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-1.5 py-0 h-4 ml-0.5"
              >
                {activeCount}
              </Badge>
            )}
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </Button>

          {/* Botão de Limpar filtros (visível se houver filtros ativos) */}
          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-9 text-xs text-zinc-500 hover:text-red-600 gap-1 px-2"
            >
              <X className="w-3.5 h-3.5" />
              Limpar ({activeCount})
            </Button>
          )}

          {/* Botão Exportar Relatório de Compras */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={isExporting || totalFiltered === 0}
            className="h-9 gap-1.5 border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100 hover:text-emerald-900 font-medium"
            title="Exportar compras filtradas em planilha Excel/CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Exportar Relatório</span>
          </Button>
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      {showAdvanced && (
        <div className="pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Período: De / Até */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" /> Data Inicial
            </label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" /> Data Final
            </label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          {/* Faixa de Valor: Mínimo e Máximo */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-zinc-400" /> Valor Mínimo (R$)
            </label>
            <Input
              type="number"
              step="any"
              placeholder="0,00"
              value={filters.minValue}
              onChange={(e) => onChange({ ...filters, minValue: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-zinc-400" /> Valor Máximo (R$)
            </label>
            <Input
              type="number"
              step="any"
              placeholder="Sem limite"
              value={filters.maxValue}
              onChange={(e) => onChange({ ...filters, maxValue: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          {/* Fornecedor */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" /> Fornecedor
            </label>
            <Select
              value={filters.supplierId || '__all__'}
              onValueChange={(val) =>
                onChange({
                  ...filters,
                  supplierId: val === '__all__' ? '' : val,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos os fornecedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os fornecedores</SelectItem>
                <SelectItem value="__none__">Sem fornecedor (Avulsas)</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nota Fiscal */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-zinc-400" /> Nota Fiscal
            </label>
            <Input
              type="text"
              placeholder="Número ou texto da NF..."
              value={filters.notaFiscal}
              onChange={(e) => onChange({ ...filters, notaFiscal: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          {/* Categoria / Fonte de Custo */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-zinc-400" /> Fonte de Custo
            </label>
            <Select
              value={filters.costCategory || '__all__'}
              onValueChange={(val) =>
                onChange({
                  ...filters,
                  costCategory: val === '__all__' ? '' : val,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as categorias</SelectItem>
                {COST_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Compra: Todas / Com Produto / Avulsa */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-zinc-400" /> Tipo de Lançamento
            </label>
            <Select
              value={filters.purchaseType}
              onValueChange={(val: 'all' | 'avulsa' | 'product') =>
                onChange({ ...filters, purchaseType: val })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as compras</SelectItem>
                <SelectItem value="product">Apenas com produto vinculado</SelectItem>
                <SelectItem value="avulsa">Apenas compras avulsas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Barra de resumo com contagem e totalizador financeiro */}
      <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-zinc-800">
            Exibindo <strong className="text-emerald-800 font-semibold">{totalFiltered}</strong>{' '}
            {totalFiltered === 1 ? 'compra' : 'compras'}
            {totalFiltered !== totalOriginal && (
              <span className="text-zinc-400 font-normal"> (de {totalOriginal} no total)</span>
            )}
          </span>
          {activeCount > 0 && (
            <Badge
              variant="outline"
              className="text-[11px] bg-zinc-50 text-zinc-600 border-zinc-200"
            >
              Filtros ativos: {activeCount}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Total filtrado:</span>
          <span className="text-sm font-bold text-emerald-800 font-mono">
            {formatCurrency(totalAmountFiltered)}
          </span>
        </div>
      </div>
    </div>
  )
}
