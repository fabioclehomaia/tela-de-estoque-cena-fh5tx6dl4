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
  const payload: Record<string, any> = {}

  // Copiar apenas campos válidos
  if (data.name !== undefined) payload.name = data.name.trim()
  if (data.email !== undefined && data.email.trim() !== '') {
    payload.email = data.email.trim().toLowerCase()
  }
  if (data.phone !== undefined) payload.phone = data.phone.trim()
  if (data.role !== undefined) payload.role = data.role
  if (data.active !== undefined) payload.active = !!data.active
  if (data.area_ids !== undefined) payload.area_ids = data.area_ids
  if (data.subarea_ids !== undefined) payload.subarea_ids = data.subarea_ids
  if (data.avatar !== undefined) payload.avatar = data.avatar

  // SÓ incluir password e passwordConfirm se a senha for uma string não-vazia com 6+ caracteres
  const pwd = typeof data.password === 'string' ? data.password.trim() : ''
  const pwdConfirm = typeof data.passwordConfirm === 'string' ? data.passwordConfirm.trim() : ''

  if (pwd.length >= 6) {
    payload.password = pwd
    payload.passwordConfirm = pwdConfirm || pwd
  }

  // Garantir que emailVisibility permaneça true
  payload.emailVisibility = true

  return pb.collection('users').update<User>(id, payload)
}

export const deleteUser = async (id: string) => {
  return pb.collection('users').delete(id)
}
