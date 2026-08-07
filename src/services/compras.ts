import pb from '@/lib/pocketbase/client'
import { Product } from './products'
import { Fornecedor } from './fornecedores'

export interface Compra {
  id: string
  product_id: string
  supplier_id: string
  quantity: number
  price: number
  nota_fiscal?: string
  payment_term?: string
  date: string
  created: string
  updated: string
  expand?: {
    product_id: Product
    supplier_id: Fornecedor
  }
}

export const getCompras = () =>
  pb.collection('compras').getFullList<Compra>({
    sort: '-date',
    expand: 'product_id,supplier_id',
  })

export const createCompra = (data: Partial<Compra>) => pb.collection('compras').create<Compra>(data)

export const updateCompra = (id: string, data: Partial<Compra>) =>
  pb.collection('compras').update<Compra>(id, data)

export const deleteCompra = (id: string) => pb.collection('compras').delete(id)
