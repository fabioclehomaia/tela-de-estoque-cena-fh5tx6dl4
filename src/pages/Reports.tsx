import { useState, useEffect, useMemo } from 'react'
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  FilterX,
  Search,
  Loader2,
  ListOrdered,
  History,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getInventoryCounts, InventoryCount } from '@/services/inventory_counts'
import { getInventoryLevels, InventoryLevel } from '@/services/inventory_levels'
import { getAreas, getSubareas, Area, Subarea } from '@/services/inventory'
import { getUsers, User } from '@/services/users'
import { getProducts, Product } from '@/services/products'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const safeDate = (dateStr: string) => parseISO(dateStr.replace(' ', 'T'))

export default function Reports() {
  const { toast } = useToast()
  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [userId, setUserId] = useState<string>('_all_')
  const [areaId, setAreaId] = useState<string>('_all_')
  const [subareaId, setSubareaId] = useState<string>('_all_')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [
          fetchedCounts,
          fetchedAreas,
          fetchedSubareas,
          fetchedUsers,
          fetchedLevels,
          fetchedProducts,
        ] = await Promise.all([
          getInventoryCounts(),
          getAreas(),
          getSubareas(),
          getUsers(),
          getInventoryLevels(),
          getProducts(),
        ])
        setCounts(fetchedCounts)
        setAreas(fetchedAreas)
        setSubareas(fetchedSubareas)
        setUsers(fetchedUsers)
        setLevels(fetchedLevels)
        setProducts(fetchedProducts)
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Erro ao carregar os relatórios.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [toast])

  const filteredCounts = useMemo(() => {
    return counts.filter((count) => {
      const product = count.expand?.product_id
      const productName = product?.name?.toLowerCase() || ''
      if (searchQuery && !productName.includes(searchQuery.toLowerCase())) {
        return false
      }

      if (startDate && endDate) {
        const date = safeDate(count.created)
        const start = startOfDay(safeDate(startDate))
        const end = endOfDay(safeDate(endDate))
        if (!isWithinInterval(date, { start, end })) return false
      } else if (startDate) {
        const date = safeDate(count.created)
        if (date < startOfDay(safeDate(startDate))) return false
      } else if (endDate) {
        const date = safeDate(count.created)
        if (date > endOfDay(safeDate(endDate))) return false
      }

      if (userId !== '_all_' && count.user_id !== userId) return false

      const subarea = count.expand?.subarea_id
      if (areaId !== '_all_') {
        if (subarea?.expand?.area_id?.id !== areaId) return false
      }
      if (subareaId !== '_all_' && subarea?.id !== subareaId) return false

      return true
    })
  }, [counts, searchQuery, startDate, endDate, userId, areaId, subareaId])

  const summaryByProduct = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        unit: string
        category: string
        total: number
        breakdown: { subarea: string; area: string; quantity: number }[]
      }
    >()

    products.forEach((p) => {
      map.set(p.id, {
        id: p.id,
        name: p.name,
        unit: p.unit,
        category: p.expand?.category_id?.name || 'Desconhecido',
        total: 0,
        breakdown: [],
      })
    })

    levels.forEach((l) => {
      const pid = l.product_id
      if (!map.has(pid)) return
      const item = map.get(pid)!
      item.total += l.quantity
      item.breakdown.push({
        subarea: l.expand?.subarea_id?.name || 'Desconhecida',
        area: l.expand?.subarea_id?.expand?.area_id?.name || 'Desconhecida',
        quantity: l.quantity,
      })
    })

    let arr = Array.from(map.values())
    if (searchQuery) {
      arr = arr.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    return arr.sort((a, b) => a.name.localeCompare(b.name))
  }, [levels, products, searchQuery])

  const totalItems = filteredCounts.length
  const discrepancies = filteredCounts.filter(
    (c) => c.counted_quantity !== c.previous_quantity,
  ).length

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setUserId('_all_')
    setAreaId('_all_')
    setSubareaId('_all_')
    setSearchQuery('')
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center w-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col mb-2">
        <h1 className="text-2xl font-bold font-serif text-emerald-900 tracking-tight">
          Relatórios
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Acompanhe o estoque consolidado e histórico de contagens.
        </p>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4" /> Estoque Atual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white shadow-sm border-zinc-200">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-emerald-100 p-3 rounded-full text-emerald-700">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500">Total de Registros (Período)</p>
                  <p className="text-3xl font-bold text-zinc-900">{totalItems}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-sm border-zinc-200">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-amber-100 p-3 rounded-full text-amber-700">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500">Com Discrepâncias</p>
                  <p className="text-3xl font-bold text-amber-600">{discrepancies}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm border-zinc-200">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-1.5 lg:col-span-2">
                  <Label>Período</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-sm"
                    />
                    <span className="text-zinc-400">até</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Funcionário</Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all_">Todos</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Área</Label>
                  <Select
                    value={areaId}
                    onValueChange={(val) => {
                      setAreaId(val)
                      setSubareaId('_all_')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all_">Todas</SelectItem>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subárea</Label>
                  <Select
                    value={subareaId}
                    onValueChange={setSubareaId}
                    disabled={areaId === '_all_'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all_">Todas</SelectItem>
                      {subareas
                        .filter((s) => s.area_id === areaId)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-4 mt-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder="Buscar por produto..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <FilterX className="h-4 w-4 mr-2" /> Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-right">Qtd. Esperada</TableHead>
                    <TableHead className="text-right">Qtd. Real</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCounts.map((count) => {
                    const product = count.expand?.product_id
                    const user = count.expand?.user_id
                    const subarea = count.expand?.subarea_id
                    const area = subarea?.expand?.area_id
                    const hasDiscrepancy = count.previous_quantity !== count.counted_quantity

                    return (
                      <TableRow key={count.id}>
                        <TableCell className="text-zinc-500 whitespace-nowrap">
                          {format(safeDate(count.created), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium text-zinc-900">
                          {product?.name}
                          <span className="text-xs text-zinc-500 ml-1">({product?.unit})</span>
                        </TableCell>
                        <TableCell className="text-zinc-600">
                          <div className="flex flex-col">
                            <span>{area?.name}</span>
                            <span className="text-xs text-zinc-400">{subarea?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-600">{user?.name || user?.email}</TableCell>
                        <TableCell className="text-right text-zinc-600">
                          {count.previous_quantity}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-bold',
                            hasDiscrepancy ? 'text-amber-600' : 'text-emerald-600',
                          )}
                        >
                          {count.counted_quantity}
                        </TableCell>
                        <TableCell className="text-center">
                          {hasDiscrepancy ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-200"
                            >
                              Divergente
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              Correto
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredCounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-zinc-500">
                        Nenhum registro encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-zinc-100">
              {filteredCounts.map((count) => {
                const product = count.expand?.product_id
                const user = count.expand?.user_id
                const subarea = count.expand?.subarea_id
                const area = subarea?.expand?.area_id
                const hasDiscrepancy = count.previous_quantity !== count.counted_quantity

                return (
                  <div key={count.id} className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-zinc-900">{product?.name}</h3>
                        <p className="text-xs text-zinc-500">
                          {area?.name} • {subarea?.name}
                        </p>
                      </div>
                      {hasDiscrepancy ? (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap"
                        >
                          Divergente
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap"
                        >
                          Correto
                        </Badge>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-sm p-3 bg-zinc-50 rounded-md">
                      <div className="flex flex-col">
                        <span className="text-zinc-500 text-xs">Esperado ({product?.unit})</span>
                        <span className="font-medium text-zinc-700">{count.previous_quantity}</span>
                      </div>
                      <span className="text-zinc-300">→</span>
                      <div className="flex flex-col text-right">
                        <span className="text-zinc-500 text-xs">Real ({product?.unit})</span>
                        <span
                          className={cn(
                            'font-bold',
                            hasDiscrepancy ? 'text-amber-600' : 'text-emerald-600',
                          )}
                        >
                          {count.counted_quantity}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-zinc-500 mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5" />{' '}
                        {format(safeDate(count.created), 'dd/MM/yyyy HH:mm')}
                      </span>
                      <span>
                        Por: <span className="font-medium">{user?.name || user?.email}</span>
                      </span>
                    </div>
                  </div>
                )
              })}
              {filteredCounts.length === 0 && (
                <div className="p-8 text-center text-zinc-500">Nenhum registro encontrado.</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          <Card className="shadow-sm border-zinc-200">
            <CardContent className="p-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Buscar por produto..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Quantidade Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryByProduct.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-zinc-50"
                      onClick={() => setSelectedProduct(item)}
                    >
                      <TableCell className="font-medium text-zinc-900">
                        {item.name}
                        <span className="text-xs text-zinc-500 ml-1">({item.unit})</span>
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {item.total}
                      </TableCell>
                    </TableRow>
                  ))}
                  {summaryByProduct.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-zinc-500">
                        Nenhum produto encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
            <DialogDescription>Distribuição de estoque por subárea</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedProduct?.breakdown.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">
                Este produto não possui estoque vinculado a nenhuma subárea.
              </p>
            ) : (
              <div className="rounded-md border border-zinc-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-zinc-50">
                    <TableRow>
                      <TableHead>Local</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedProduct?.breakdown.map((b: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-900">{b.area}</span>
                            <span className="text-xs text-zinc-500">{b.subarea}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {b.quantity}{' '}
                          <span className="text-xs text-zinc-500 font-normal">
                            {selectedProduct.unit}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
