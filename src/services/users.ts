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
export const createUser = (data: Partial<User> & { password?: string; passwordConfirm?: string }) =>
  pb.collection('users').create<User>(data)
export const updateUser = (id: string, data: Partial<User>) =>
  pb.collection('users').update<User>(id, data)
