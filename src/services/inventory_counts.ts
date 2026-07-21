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
