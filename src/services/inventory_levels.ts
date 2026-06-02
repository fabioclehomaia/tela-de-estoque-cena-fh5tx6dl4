import pb from '@/lib/pocketbase/client'
import { Product } from './products'
import { Subarea } from './inventory'

export interface InventoryLevel {
  id: string
  product_id: string
  subarea_id: string
  quantity: number
  created: string
  updated: string
  expand?: {
    product_id: Product & { expand?: { category_id: { name: string } } }
    subarea_id: Subarea
  }
}

export const getInventoryLevels = () =>
  pb.collection('inventory_levels').getFullList<InventoryLevel>({
    expand: 'product_id.category_id,subarea_id.area_id',
    sort: 'subarea_id',
  })

export const createInventoryLevel = (data: Partial<InventoryLevel>) =>
  pb.collection('inventory_levels').create<InventoryLevel>(data)

export const updateInventoryLevel = (id: string, data: Partial<InventoryLevel>) =>
  pb.collection('inventory_levels').update<InventoryLevel>(id, data)

export const deleteInventoryLevel = (id: string) => pb.collection('inventory_levels').delete(id)
