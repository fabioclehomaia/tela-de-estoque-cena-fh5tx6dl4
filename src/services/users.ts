import pb from '@/lib/pocketbase/client'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  active: boolean
  avatar?: string
  area_id?: string
  subarea_id?: string
  area_ids?: string[]
  subarea_ids?: string[]
  expand?: {
    area_id?: { id: string; name: string }
    subarea_id?: { id: string; name: string }
    area_ids?: { id: string; name: string }[]
    subarea_ids?: { id: string; name: string }[]
  }
}

export const getUsers = () =>
  pb.collection('users').getFullList<User>({
    sort: 'name',
    expand: 'area_ids,subarea_ids,area_id,subarea_id',
  })
export const createUser = (
  data: Partial<User> & { password?: string; passwordConfirm?: string; emailVisibility?: boolean },
) =>
  pb.collection('users').create<User>({
    emailVisibility: true,
    ...data,
  })

export const updateUser = async (
  id: string,
  data: Partial<User> & { password?: string; passwordConfirm?: string; emailVisibility?: boolean },
) => {
  const payload: Record<string, any> = { ...data }

  // Se o email não foi fornecido ou for string vazia, remove do payload ou busca o original
  if (
    payload.email === undefined ||
    (typeof payload.email === 'string' && payload.email.trim() === '')
  ) {
    delete payload.email
  }

  // Garantir que emailVisibility permaneça true
  if (payload.emailVisibility === undefined) {
    payload.emailVisibility = true
  }

  return pb.collection('users').update<User>(id, payload)
}
