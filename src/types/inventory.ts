export interface LastCountInfo {
  date: string
  userName: string
}

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
  lastCount?: LastCountInfo | null
}
