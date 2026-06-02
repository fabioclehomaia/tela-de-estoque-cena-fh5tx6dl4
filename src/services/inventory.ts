import pb from '@/lib/pocketbase/client'

export interface Area {
  id: string
  name: string
  created: string
  updated: string
}

export interface Subarea {
  id: string
  name: string
  area_id: string
  created: string
  updated: string
  expand?: {
    area_id: Area
  }
}

export interface Category {
  id: string
  name: string
  created: string
  updated: string
}

export const getAreas = () => pb.collection('areas').getFullList<Area>({ sort: 'name' })
export const createArea = (data: Partial<Area>) => pb.collection('areas').create<Area>(data)
export const updateArea = (id: string, data: Partial<Area>) =>
  pb.collection('areas').update<Area>(id, data)
export const deleteArea = (id: string) => pb.collection('areas').delete(id)

export const getSubareas = () =>
  pb.collection('subareas').getFullList<Subarea>({ sort: 'name', expand: 'area_id' })
export const createSubarea = (data: Partial<Subarea>) =>
  pb.collection('subareas').create<Subarea>(data)
export const updateSubarea = (id: string, data: Partial<Subarea>) =>
  pb.collection('subareas').update<Subarea>(id, data)
export const deleteSubarea = (id: string) => pb.collection('subareas').delete(id)

export const getCategories = () =>
  pb.collection('categories').getFullList<Category>({ sort: 'name' })
export const createCategory = (data: Partial<Category>) =>
  pb.collection('categories').create<Category>(data)
export const updateCategory = (id: string, data: Partial<Category>) =>
  pb.collection('categories').update<Category>(id, data)
export const deleteCategory = (id: string) => pb.collection('categories').delete(id)
