import pb from '@/lib/pocketbase/client'
import { Category } from './inventory'

export interface Product {
  id: string
  name: string
  unit: 'kg' | 'litro' | 'unidade' | 'caixa'
  validity_days?: number
  min_stock?: number
  price?: number
  category_id: string
  active: boolean
  image?: string
  created: string
  updated: string
  expand?: {
    category_id: Category
  }
}

export const getProducts = () =>
  pb.collection('products').getFullList<Product>({ sort: 'name', expand: 'category_id' })
export const createProduct = (data: Partial<Product> | FormData) =>
  pb.collection('products').create<Product>(data)
export const updateProduct = (id: string, data: Partial<Product> | FormData) =>
  pb.collection('products').update<Product>(id, data)
export const deleteProduct = (id: string) => pb.collection('products').delete(id)
