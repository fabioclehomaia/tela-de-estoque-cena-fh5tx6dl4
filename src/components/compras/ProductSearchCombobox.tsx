import * as React from 'react'
import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { Product } from '@/services/products'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface ProductSearchComboboxProps {
  products: Product[]
  value?: string
  onChange: (productId: string) => void
  placeholder?: string
  disabled?: boolean
  /** Se true, esconde produtos com active === false da listagem de opções */
  onlyActive?: boolean
  className?: string
  /** Texto mostrado caso o produto selecionado esteja inativo (ex: em edição de compra antiga) */
  selectedProduct?: Product
}

export function ProductSearchCombobox({
  products,
  value,
  onChange,
  placeholder = 'Buscar produto por nome...',
  disabled = false,
  onlyActive = true,
  className,
  selectedProduct: explicitSelected,
}: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = useMemo(() => {
    if (explicitSelected && explicitSelected.id === value) return explicitSelected
    return products.find((p) => p.id === value)
  }, [products, value, explicitSelected])

  // Lista de produtos visíveis
  const availableProducts = useMemo(() => {
    let list = products
    if (onlyActive) {
      list = list.filter((p) => p.active !== false || p.id === value)
    }
    return list
  }, [products, onlyActive, value])

  // Filtro por termo de busca
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return availableProducts
    return availableProducts.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(term)
      const unitMatch = p.unit.toLowerCase().includes(term)
      const catMatch = p.expand?.category_id?.name?.toLowerCase().includes(term)
      return nameMatch || unitMatch || catMatch
    })
  }, [availableProducts, search])

  const handleSelect = (productId: string) => {
    onChange(productId)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal h-10 px-3 bg-white hover:bg-zinc-50 border-zinc-200 text-left',
            !selected && 'text-zinc-500',
            className,
          )}
        >
          <span className="truncate flex items-center gap-2 min-w-0">
            {selected ? (
              <>
                <span
                  className={cn(
                    'truncate font-medium text-zinc-900',
                    selected.active === false && 'line-through text-zinc-500',
                  )}
                >
                  {selected.name}
                </span>
                <span className="text-xs text-zinc-400 shrink-0">({selected.unit})</span>
                {selected.active === false && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-zinc-200 text-zinc-600 border-none shrink-0"
                  >
                    Inativo
                  </Badge>
                )}
              </>
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selected && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                className="p-0.5 rounded-sm hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors"
                title="Limpar seleção"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronsUpDown className="w-4 h-4 text-zinc-400" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 bg-white shadow-lg border border-zinc-200 rounded-lg overflow-hidden"
      >
        <div className="p-2 border-b border-zinc-100 flex items-center gap-2 bg-zinc-50/50">
          <Search className="w-4 h-4 text-zinc-400 shrink-0 ml-1" />
          <input
            type="text"
            className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            placeholder="Digite para filtrar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="p-1 rounded-sm text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto p-1 divide-y divide-zinc-50">
          {filteredProducts.length === 0 ? (
            <div className="py-6 px-4 text-center text-xs text-zinc-500">
              Nenhum produto ativo encontrado com &quot;{search}&quot;.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isSelected = p.id === value
              const isInactive = p.active === false
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  className={cn(
                    'w-full text-left px-2.5 py-2 rounded-md text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors',
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900 font-medium'
                      : 'hover:bg-zinc-100 text-zinc-800',
                  )}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('truncate', isInactive && 'line-through text-zinc-500')}>
                        {p.name}
                      </span>
                      <span className="text-zinc-400 text-xs shrink-0">({p.unit})</span>
                      {isInactive && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 bg-zinc-200 text-zinc-600 border-none shrink-0"
                        >
                          Inativo
                        </Badge>
                      )}
                    </div>
                    {p.expand?.category_id?.name && (
                      <span className="text-[11px] text-zinc-400 truncate">
                        {p.expand.category_id.name}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
