import pb from '@/lib/pocketbase/client'

export interface Faturamento {
  id: string
  period_start: string
  period_end: string
  value: number
  created: string
  updated: string
}

export const getFaturamentos = () =>
  pb.collection('faturamento').getFullList<Faturamento>({ sort: '-period_start' })

export const createFaturamento = (data: Partial<Faturamento>) =>
  pb.collection('faturamento').create<Faturamento>(data)

export const updateFaturamento = (id: string, data: Partial<Faturamento>) =>
  pb.collection('faturamento').update<Faturamento>(id, data)

export const deleteFaturamento = (id: string) => pb.collection('faturamento').delete(id)
