import { InventoryCount } from '@/services/inventory_counts'

const fullDate = (s: string) => new Date(s.replace(' ', 'T'))

/**
 * Contagens agrupadas por produto, da mais recente para a mais antiga.
 * Usada pela tela de Ajuste de Estoque para oferecer QUAL contagem o usuário
 * quer retificar (o estoque anterior passa a ser o valor da contagem escolhida).
 */
export function groupCountsByProduct(rows: InventoryCount[]): InventoryCount[][] {
  const map = new Map<string, InventoryCount[]>()
  for (const c of rows) {
    const list = map.get(c.product_id)
    if (list) list.push(c)
    else map.set(c.product_id, [c])
  }
  for (const list of map.values()) {
    list.sort((a, b) => fullDate(b.created).getTime() - fullDate(a.created).getTime())
  }
  return Array.from(map.values())
}

/** Formata a data de uma contagem como "dd/MM/yyyy HH:mm". */
export const formatCountDate = (s: string): string => {
  try {
    const d = fullDate(s)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
      d.getMinutes(),
    )}`
  } catch {
    return s
  }
}
