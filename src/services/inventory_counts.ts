import { format } from 'date-fns'

import pb from '@/lib/pocketbase/client'

export interface InventoryCount {
  id: string
  product_id: string
  subarea_id: string
  user_id: string
  previous_quantity: number
  counted_quantity: number
  created: string
  updated: string
  expand?: {
    product_id: {
      id: string
      name: string
      unit: string
      category_id: string
      image?: string
      price?: number
    }
    subarea_id: {
      id: string
      name: string
      expand?: {
        area_id: {
          id: string
          name: string
        }
      }
    }
    user_id: {
      id: string
      name: string
      email: string
    }
  }
}

export const getInventoryCounts = async (filter: string = '') => {
  return pb.collection('inventory_counts').getFullList<InventoryCount>({
    sort: '-created',
    expand: 'product_id,subarea_id.area_id,user_id',
    filter,
  })
}

/**
 * Última contagem REAL de cada área, direto do servidor (sort=-created,
 * perPage=1 por área). Usado pelo painel de frescor dos relatórios: uma área
 * cuja última contagem é anterior à janela de 60 dias não pode aparecer como
 * "Nunca contada" só porque fora do intervalo carregado.
 */
export const getLastCountDateByArea = async (areaIds: string[]): Promise<Map<string, string>> => {
  const entries = await Promise.all(
    areaIds.map(async (areaId) => {
      try {
        const res = await pb.collection('inventory_counts').getList(1, 1, {
          filter: `subarea_id.area_id = "${areaId}"`,
          sort: '-created',
          fields: 'id,created,subarea_id',
        })
        const first = res.items[0]
        return first ? ([areaId, first.created] as [string, string]) : null
      } catch {
        return null
      }
    }),
  )
  return new Map(entries.filter((e): e is [string, string] => e !== null))
}

const DAY_FMT = 'yyyy-MM-dd'

/**
 * Busca contagens com filtro de data APLICADO NO SERVIDOR (nunca baixa o
 * histórico completo para filtrar no cliente). Páginas de 1000 registros
 * (`batch: 1000`): telas padrão (últimos 60 dias) resolvem em 1-2 requisições.
 * O histórico completo permanece intacto no banco — só não é baixado por padrão.
 */
export const getInventoryCountsRange = async (
  fromIso: string,
  toIsoExclusive?: string,
  extraFilter: string = '',
) => {
  const filters = [`created >= "${format(fromIso, `${DAY_FMT} 00:00:00.000Z`)}"`]
  if (toIsoExclusive) {
    filters.push(`created < "${format(toIsoExclusive, `${DAY_FMT} 00:00:00.000Z`)}"`)
  }
  if (extraFilter) filters.push(`(${extraFilter})`)
  return pb.collection('inventory_counts').getFullList<InventoryCount>({
    sort: '-created',
    expand: 'product_id,subarea_id.area_id,user_id',
    filter: filters.join(' && '),
    batch: 1000,
  })
}

export const createInventoryCount = async (data: Partial<InventoryCount>) => {
  return pb.collection('inventory_counts').create<InventoryCount>(data)
}

export interface SubmitCountItem {
  product_id: string
  subarea_id: string
  counted_quantity: number
}

export const submitInventoryCounts = async (counts: SubmitCountItem[]) => {
  return pb.send('/backend/v1/inventory-counts/submit', {
    method: 'POST',
    body: JSON.stringify({ counts }),
    headers: { 'Content-Type': 'application/json' },
  })
}
