import pb from '@/lib/pocketbase/client'
import { Category, Subarea } from './inventory'

export interface Product {
  id: string
  name: string
  unit: 'kg' | 'litro' | 'unidade' | 'caixa'
  validity_days?: number
  min_stock?: number
  category_id: string
  subarea_id: string
  created: string
  updated: string
  expand?: {
    category_id: Category
    subarea_id: Subarea
  }
}

export const getProducts = () =>
  pb.collection('products').getFullList<Product>({ sort: 'name', expand: 'category_id,subarea_id' })
export const createProduct = (data: Partial<Product>) =>
  pb.collection('products').create<Product>(data)
export const updateProduct = (id: string, data: Partial<Product>) =>
  pb.collection('products').update<Product>(id, data)
export const deleteProduct = (id: string) => pb.collection('products').delete(id)
