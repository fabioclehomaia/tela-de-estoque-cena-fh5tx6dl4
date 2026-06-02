import pb from '@/lib/pocketbase/client'
import type { User } from '@/hooks/use-auth'

export const getUsers = () => pb.collection('users').getFullList<User>({ sort: '-created' })

export const createUser = (data: Partial<User> & { password?: string; passwordConfirm?: string }) =>
  pb.collection('users').create<User>(data)

export const updateUser = (
  id: string,
  data: Partial<User> & { password?: string; passwordConfirm?: string },
) => pb.collection('users').update<User>(id, data)
