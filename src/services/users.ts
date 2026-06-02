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
