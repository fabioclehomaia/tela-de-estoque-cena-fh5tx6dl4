import pb from '@/lib/pocketbase/client'
import { Product } from './products'
import { Subarea } from './inventory'

export interface CountOrder {
  id: string
  product_id: string
  subarea_id: string
  sort_order: number
  created: string
  updated: string
  expand?: {
    product_id: Product
    subarea_id: Subarea
  }
}

export const getCountOrders = async (): Promise<CountOrder[]> => {
  try {
    return await pb.collection('count_order').getFullList<CountOrder>()
  } catch {
    return []
  }
}

export const saveCountOrders = async (
  items: Array<{ product_id: string; subarea_id: string; sort_order: number }>,
) => {
  const existing = await pb.collection('count_order').getFullList<CountOrder>()

  await Promise.all(
    items.map(async (item) => {
      const found = existing.find(
        (e) => e.product_id === item.product_id && e.subarea_id === item.subarea_id,
      )
      if (found) {
        await pb.collection('count_order').update(found.id, { sort_order: item.sort_order })
      } else {
        await pb.collection('count_order').create(item)
      }
    }),
  )
}
