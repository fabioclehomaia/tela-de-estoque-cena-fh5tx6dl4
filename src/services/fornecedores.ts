import pb from '@/lib/pocketbase/client'

export interface Fornecedor {
  id: string
  name: string
  phone?: string
  observations?: string
  created: string
  updated: string
}

export const getFornecedores = () =>
  pb.collection('fornecedores').getFullList<Fornecedor>({ sort: 'name' })

export const createFornecedor = (data: Partial<Fornecedor>) =>
  pb.collection('fornecedores').create<Fornecedor>(data)

export const updateFornecedor = (id: string, data: Partial<Fornecedor>) =>
  pb.collection('fornecedores').update<Fornecedor>(id, data)

export const deleteFornecedor = (id: string) => pb.collection('fornecedores').delete(id)
