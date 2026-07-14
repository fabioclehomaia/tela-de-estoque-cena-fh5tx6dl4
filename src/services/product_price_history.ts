import pb from '@/lib/pocketbase/client'

export interface ProductPriceHistory {
  id: string
  product_id: string
  price: number
  created: string
  updated: string
  expand?: {
    product_id: {
      id: string
      name: string
      unit: string
    }
  }
}

export const getProductPriceHistory = (filter: string = '') =>
  pb.collection('product_price_history').getFullList<ProductPriceHistory>({
    sort: 'created',
    expand: 'product_id',
    filter,
  })
