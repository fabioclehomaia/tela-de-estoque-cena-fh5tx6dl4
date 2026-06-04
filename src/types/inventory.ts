export interface CountableItem {
  id: string
  productId: string
  subareaId: string
  name: string
  subareaName: string
  unit: string
  expectedQty: number
  actualQty: number | null
  minStock: number | null
  image?: string
  productObj?: any
}
