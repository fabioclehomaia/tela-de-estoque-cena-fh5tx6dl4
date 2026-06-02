export interface CountableItem {
  id: string
  productId: string
  subareaId: string
  subareaName: string
  name: string
  unit: string
  expectedQty: number
  actualQty: number | null
  minStock: number | null
}
