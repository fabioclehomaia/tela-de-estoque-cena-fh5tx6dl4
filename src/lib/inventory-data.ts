export type SubArea =
  | 'Geladeira'
  | 'Despensa'
  | 'Freezer'
  | 'Garrafeira'
  | 'Armário'
  | 'Câmara Fria'
  | 'Prateleira'
export type Area = 'Cozinha' | 'Bar' | 'Salão'
export type ProductStatus = 'low_stock' | 'near_expiry' | null

export interface Product {
  id: string
  name: string
  expectedQty: number
  actualQty: number | null
  unit: string
  status: ProductStatus
  area: Area
  subArea: SubArea
}

export const mockInventory: Product[] = [
  // Cozinha
  {
    id: 'c1',
    name: 'Arroz Arbório',
    expectedQty: 12.5,
    actualQty: null,
    unit: 'kg',
    status: null,
    area: 'Cozinha',
    subArea: 'Despensa',
  },
  {
    id: 'c2',
    name: 'Sal Marinho',
    expectedQty: 4,
    actualQty: null,
    unit: 'kg',
    status: null,
    area: 'Cozinha',
    subArea: 'Despensa',
  },
  {
    id: 'c3',
    name: 'Tomate Pelati',
    expectedQty: 24,
    actualQty: null,
    unit: 'latas',
    status: null,
    area: 'Cozinha',
    subArea: 'Despensa',
  },
  {
    id: 'c4',
    name: 'Queijo Parmesão',
    expectedQty: 3.2,
    actualQty: null,
    unit: 'kg',
    status: 'low_stock',
    area: 'Cozinha',
    subArea: 'Geladeira',
  },
  {
    id: 'c5',
    name: 'Creme de Leite Fresco',
    expectedQty: 5,
    actualQty: null,
    unit: 'L',
    status: 'near_expiry',
    area: 'Cozinha',
    subArea: 'Geladeira',
  },
  {
    id: 'c6',
    name: 'Manteiga',
    expectedQty: 8,
    actualQty: null,
    unit: 'kg',
    status: null,
    area: 'Cozinha',
    subArea: 'Geladeira',
  },
  {
    id: 'c7',
    name: 'Caldo de Carne Base',
    expectedQty: 10,
    actualQty: null,
    unit: 'L',
    status: null,
    area: 'Cozinha',
    subArea: 'Freezer',
  },
  {
    id: 'c8',
    name: 'Ervilhas Congeladas',
    expectedQty: 5,
    actualQty: null,
    unit: 'kg',
    status: 'low_stock',
    area: 'Cozinha',
    subArea: 'Freezer',
  },

  // Bar
  {
    id: 'b1',
    name: 'Vinho Tinto Casa Valduga',
    expectedQty: 12,
    actualQty: null,
    unit: 'gf',
    status: null,
    area: 'Bar',
    subArea: 'Garrafeira',
  },
  {
    id: 'b2',
    name: 'Vinho Branco Chardonnay',
    expectedQty: 4,
    actualQty: null,
    unit: 'gf',
    status: 'low_stock',
    area: 'Bar',
    subArea: 'Garrafeira',
  },
  {
    id: 'b3',
    name: 'Espumante Brut',
    expectedQty: 18,
    actualQty: null,
    unit: 'gf',
    status: null,
    area: 'Bar',
    subArea: 'Garrafeira',
  },
  {
    id: 'b4',
    name: 'Taças de Vinho',
    expectedQty: 48,
    actualQty: null,
    unit: 'un',
    status: null,
    area: 'Bar',
    subArea: 'Armário',
  },
  {
    id: 'b5',
    name: 'Copos de Água',
    expectedQty: 60,
    actualQty: null,
    unit: 'un',
    status: null,
    area: 'Bar',
    subArea: 'Armário',
  },

  // Salão
  {
    id: 's1',
    name: 'Tiramisu (Porções)',
    expectedQty: 15,
    actualQty: null,
    unit: 'un',
    status: 'near_expiry',
    area: 'Salão',
    subArea: 'Câmara Fria',
  },
  {
    id: 's2',
    name: 'Panna Cotta',
    expectedQty: 12,
    actualQty: null,
    unit: 'un',
    status: null,
    area: 'Salão',
    subArea: 'Câmara Fria',
  },
  {
    id: 's3',
    name: 'Guardanapos de Tecido',
    expectedQty: 100,
    actualQty: null,
    unit: 'un',
    status: null,
    area: 'Salão',
    subArea: 'Prateleira',
  },
  {
    id: 's4',
    name: 'Pratos Principais',
    expectedQty: 80,
    actualQty: null,
    unit: 'un',
    status: null,
    area: 'Salão',
    subArea: 'Prateleira',
  },
  {
    id: 's5',
    name: 'Talheres de Prata',
    expectedQty: 120,
    actualQty: null,
    unit: 'un',
    status: 'low_stock',
    area: 'Salão',
    subArea: 'Prateleira',
  },
]
