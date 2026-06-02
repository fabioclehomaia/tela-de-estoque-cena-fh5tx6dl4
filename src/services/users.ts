import pb from '@/lib/pocketbase/client'

export interface User {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  avatar?: string
}

export const getUsers = () => pb.collection('users').getFullList<User>({ sort: 'name' })
export const createUser = (data: Partial<User> & { password?: string; passwordConfirm?: string }) =>
  pb.collection('users').create<User>(data)
export const updateUser = (id: string, data: Partial<User>) =>
  pb.collection('users').update<User>(id, data)
