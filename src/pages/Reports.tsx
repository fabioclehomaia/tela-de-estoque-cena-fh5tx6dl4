import { useState, useEffect, useMemo } from 'react'
import {
  format,
  parseISO,
  isWithinInterval,
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  subMonths,
  endOfMonth,
} from 'date-fns'
import {
  CheckCircle2,
  Calendar as CalendarIcon,
  FilterX,
  Search,
  Loader2,
  ListOrdered,
  History,
  Download,
  ShoppingCart,
  TrendingUp,
  ImageIcon,
  DollarSign,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { getInventoryCounts, InventoryCount } from '@/services/inventory_counts'
import { getInventoryLevels, InventoryLevel } from '@/services/inventory_levels'
import { getAreas, getSubareas, getCategories, Area, Subarea, Category } from '@/services/inventory'
import { getUsers, User } from '@/services/users'
import { getProducts, Product } from '@/services/products'
import { getProductPriceHistory, ProductPriceHistory } from '@/services/product_price_history'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const safeDate = (dateStr: string) => parseISO(dateStr.replace(' ', 'T'))

export default function Reports() {
  const { toast } = useToast()
  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [levels, setLevels] = useState<InventoryLevel[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [subareas, setSubareas] = useState<Subarea[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('history')

  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [userId, setUserId] = useState<string>('_all_')
  const [areaId, setAreaId] = useState<string>('_all_')
  const [subareaId, setSubareaId] = useState<string>('_all_')
  const [categoryId, setCategoryId] = useState<string>('_all_')
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [sortField, setSortField] = useState<'name' | 'category' | 'quantity'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'doc'>('pdf')
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistory[]>([])
  const [selectedPriceProducts, setSelectedPriceProducts] = useState<string[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [
          fetchedCounts,
          fetchedAreas,
          fetchedSubareas,
          fetchedCategories,
          fetchedUsers,
          fetchedLevels,
          fetchedProducts,
          fetchedPriceHistory,
        ] = await Promise.all([
          getInventoryCounts(),
          getAreas(),
          getSubareas(),
          getCategories(),
          getUsers(),
          getInventoryLevels(),
          getProducts(),
          getProductPriceHistory(),
        ])
        setCounts(fetchedCounts)
        setAreas(fetchedAreas)
        setSubareas(fetchedSubareas)
        setCategories(fetchedCategories)
        setUsers(fetchedUsers)
        setLevels(fetchedLevels)
        setProducts(fetchedProducts)
        setPriceHistory(fetchedPriceHistory)
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

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name || 'Desconhecida'

  const latestCountByProduct = useMemo(() => {
    const map = new Map<string, InventoryCount>()
    for (const count of counts) {
      const existing = map.get(count.product_id)
      if (!existing || new Date(count.created) > new Date(existing.created)) {
        map.set(count.product_id, count)
      }
    }
    return map
  }, [counts])

  // Master lookup for areas/subareas associated with each product (based on levels + history)
  const productLocations = useMemo(() => {
    const map = new Map<string, { areas: Set<string>; subareas: Set<string> }>()
    products.forEach((p) => map.set(p.id, { areas: new Set(), subareas: new Set() }))
    levels.forEach((l) => {
      const p = map.get(l.product_id)
      if (p) {
        p.subareas.add(l.subarea_id)
        const aId = l.expand?.subarea_id?.expand?.area_id?.id
        if (aId) p.areas.add(aId)
      }
    })
    counts.forEach((c) => {
      const p = map.get(c.product_id)
      if (p) {
        p.subareas.add(c.subarea_id)
        const aId = c.expand?.subarea_id?.expand?.area_id?.id
        if (aId) p.areas.add(aId)
      }
    })
    return map
  }, [products, levels, counts])

  // --- HISTORY TAB DATA ---
  const filteredCounts = useMemo(() => {
    return counts.filter((count) => {
      const product = count.expand?.product_id
      const productName = product?.name?.toLowerCase() || ''
      if (searchQuery && !productName.includes(searchQuery.toLowerCase())) return false

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
      if (categoryId !== '_all_' && product?.category_id !== categoryId) return false

      const subarea = count.expand?.subarea_id
      if (areaId !== '_all_') {
        if (subarea?.expand?.area_id?.id !== areaId) return false
      }
      if (subareaId !== '_all_' && subarea?.id !== subareaId) return false

      return true
    })
  }, [counts, searchQuery, startDate, endDate, userId, categoryId, areaId, subareaId])

  // --- SUMMARY TAB DATA ---
  const summaryByProduct = useMemo(() => {
    const map = new Map<string, any>()
    products.forEach((p) => {
      if (categoryId !== '_all_' && p.category_id !== categoryId) return
      map.set(p.id, {
        id: p.id,
        name: p.name,
        unit: p.unit,
        image: p.image,
        categoryId: p.category_id,
        category: p.expand?.category_id?.name || 'Desconhecido',
        total: 0,
        hasMatchingLevel: false,
        breakdown: [],
        latestCount: latestCountByProduct.get(p.id) || null,
      })
    })

    levels.forEach((l) => {
      const pid = l.product_id
      if (!map.has(pid)) return
      const subarea = l.expand?.subarea_id
      const area = subarea?.expand?.area_id

      const areaMatch = areaId === '_all_' || area?.id === areaId
      const subareaMatch = subareaId === '_all_' || subarea?.id === subareaId

      if (areaMatch && subareaMatch) {
        const item = map.get(pid)!
        item.total += l.quantity
        item.hasMatchingLevel = true
        item.breakdown.push({
          subarea: subarea?.name || 'Desconhecida',
          area: area?.name || 'Desconhecida',
          quantity: l.quantity,
        })
      }
    })

    let arr = Array.from(map.values())

    if (areaId !== '_all_' || subareaId !== '_all_') {
      arr = arr.filter((i) => i.hasMatchingLevel)
    }

    if (searchQuery)
      arr = arr.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))

    arr.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortField === 'category') {
        cmp = a.category.localeCompare(b.category)
      } else {
        cmp = a.total - b.total
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })

    return arr
  }, [
    levels,
    products,
    searchQuery,
    categoryId,
    areaId,
    subareaId,
    sortField,
    sortDirection,
    latestCountByProduct,
  ])

  // --- SHOPPING LIST TAB DATA ---
  const shoppingList = useMemo(() => {
    const map = new Map<string, any>()
    products.forEach((p) => {
      if (!p.active) return
      if (categoryId !== '_all_' && p.category_id !== categoryId) return
      map.set(p.id, { product: p, total: 0 })
    })

    levels.forEach((l) => {
      const pid = l.product_id
      if (map.has(pid)) map.get(pid)!.total += l.quantity
    })

    let list = Array.from(map.values())
      .filter((item) => {
        const minStock = item.product.min_stock || 0
        return minStock > 0 && item.total < minStock
      })
      .map((item) => ({
        ...item,
        need: (item.product.min_stock || 0) - item.total,
      }))

    if (areaId !== '_all_') {
      list = list.filter((item) => productLocations.get(item.product.id)?.areas.has(areaId))
    }
    if (subareaId !== '_all_') {
      list = list.filter((item) => productLocations.get(item.product.id)?.subareas.has(subareaId))
    }
    if (searchQuery) {
      list = list.filter((item) =>
        item.product.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }
    return list.sort((a, b) => b.need - a.need)
  }, [products, levels, productLocations, categoryId, areaId, subareaId, searchQuery])

  // --- TRENDS TAB DATA ---
  const consumptionData = useMemo(() => {
    let validCounts = counts.filter((c) => {
      const product = c.expand?.product_id
      if (!product || !products.find((p) => p.id === product.id)?.active) return false

      if (startDate && endDate) {
        const date = safeDate(c.created)
        const start = startOfDay(safeDate(startDate))
        const end = endOfDay(safeDate(endDate))
        if (!isWithinInterval(date, { start, end })) return false
      } else if (startDate) {
        if (safeDate(c.created) < startOfDay(safeDate(startDate))) return false
      } else if (endDate) {
        if (safeDate(c.created) > endOfDay(safeDate(endDate))) return false
      }

      if (categoryId !== '_all_' && product.category_id !== categoryId) return false
      const subarea = c.expand?.subarea_id
      if (areaId !== '_all_' && subarea?.expand?.area_id?.id !== areaId) return false
      if (subareaId !== '_all_' && subarea?.id !== subareaId) return false
      if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase()))
        return false

      return true
    })

    const productConsumption = new Map<string, { product: any; consumed: number }>()
    const timeline = new Map<string, { display: string; ts: number; consumption: number }>()

    validCounts.forEach((c) => {
      if (c.previous_quantity > c.counted_quantity) {
        const consumed = c.previous_quantity - c.counted_quantity

        // Group by product
        const pid = c.product_id
        if (!productConsumption.has(pid)) {
          productConsumption.set(pid, { product: c.expand?.product_id, consumed: 0 })
        }
        productConsumption.get(pid)!.consumed += consumed

        // Group by date for chart
        const d = startOfDay(safeDate(c.created))
        const ts = d.getTime()
        const key = ts.toString()
        if (!timeline.has(key)) {
          timeline.set(key, { display: format(d, 'dd/MM'), ts, consumption: 0 })
        }
        timeline.get(key)!.consumption += consumed
      }
    })

    const list = Array.from(productConsumption.values()).sort((a, b) => b.consumed - a.consumed)
    const chartData = Array.from(timeline.values())
      .sort((a, b) => a.ts - b.ts)
      .map((t) => ({ date: t.display, consumption: t.consumption }))

    return { list, chartData }
  }, [counts, products, startDate, endDate, categoryId, areaId, subareaId, searchQuery])

  const priceEvolutionData = useMemo(() => {
    const history = priceHistory.filter((h) => {
      const product = products.find((p) => p.id === h.product_id)
      if (!product) return false
      if (startDate && endDate) {
        const date = safeDate(h.created)
        if (
          !isWithinInterval(date, {
            start: startOfDay(safeDate(startDate)),
            end: endOfDay(safeDate(endDate)),
          })
        )
          return false
      } else if (startDate) {
        if (safeDate(h.created) < startOfDay(safeDate(startDate))) return false
      } else if (endDate) {
        if (safeDate(h.created) > endOfDay(safeDate(endDate))) return false
      }
      if (selectedPriceProducts.length > 0 && !selectedPriceProducts.includes(h.product_id))
        return false
      return true
    })

    const dateMap = new Map<string, { ts: number; display: string } & Record<string, number>>()
    history.forEach((h) => {
      const product = products.find((p) => p.id === h.product_id)
      if (!product) return
      const d = startOfDay(safeDate(h.created))
      const ts = d.getTime()
      const key = ts.toString()
      if (!dateMap.has(key)) {
        dateMap.set(key, { ts, display: format(d, 'dd/MM/yyyy') })
      }
      dateMap.get(key)![product.name] = h.price
    })

    const chartData = Array.from(dateMap.values()).sort((a, b) => a.ts - b.ts)
    const chartProducts = Array.from(new Set(history.map((h) => h.product_id)))
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean) as Product[]

    return { chartData, chartProducts }
  }, [priceHistory, products, startDate, endDate, selectedPriceProducts])

  // --- EXPORT LOGIC ---
  const handleExport = () => {
    let data: any[] = []
    let title = 'Relatório'
    let headers: string[] = []

    if (activeTab === 'summary') {
      title = 'Estoque Atual'
      headers = ['Produto', 'Categoria', 'Unidade', 'Quantidade', 'Última Contagem', 'Responsável']
      data = summaryByProduct.map((row) => {
        const lc = row.latestCount
        return [
          row.name,
          row.category,
          row.unit,
          row.total,
          lc ? format(safeDate(lc.created), 'dd/MM/yyyy HH:mm') : 'Sem contagem',
          lc?.expand?.user_id?.name || lc?.expand?.user_id?.email || '-',
        ]
      })
    } else if (activeTab === 'shopping') {
      title = 'Lista de Compras'
      headers = [
        'Produto',
        'Categoria',
        'Unidade',
        'Estoque Mínimo',
        'Estoque Atual',
        'Comprar_Produzir',
      ]
      data = shoppingList.map((row) => [
        row.product.name,
        getCategoryName(row.product.category_id),
        row.product.unit,
        row.product.min_stock || 0,
        row.total,
        row.need,
      ])
    } else if (activeTab === 'trends') {
      title = 'Tendências de Consumo'
      headers = ['Produto', 'Categoria', 'Unidade', 'Total Consumido']
      data = consumptionData.list.map((row) => [
        row.product.name,
        getCategoryName(row.product.category_id),
        row.product.unit,
        row.consumed,
      ])
    } else if (activeTab === 'history') {
      title = 'Histórico de Contagens'
      headers = ['Data/Hora', 'Produto', 'Local', 'Funcionário', 'Qtd Contada']
      data = filteredCounts.map((count) => [
        format(safeDate(count.created), 'dd/MM/yyyy HH:mm'),
        count.expand?.product_id?.name || 'Desconhecido',
        `${count.expand?.subarea_id?.expand?.area_id?.name || ''} - ${count.expand?.subarea_id?.name || ''}`,
        count.expand?.user_id?.name || count.expand?.user_id?.email || '',
        count.counted_quantity,
      ])
    }

    if (data.length === 0) {
      toast({
        title: 'Atenção',
        description: 'Não há dados para exportar com os filtros atuais.',
        variant: 'destructive',
      })
      return
    }

    if (exportFormat === 'csv') {
      const csvContent = [
        headers.map((h) => `"${h}"`).join(','),
        ...data.map((row) => row.map((cell: any) => `"${cell}"`).join(',')),
      ].join('\n')
      const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `${title.toLowerCase().replace(/ /g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else if (exportFormat === 'pdf') {
      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      const html = `
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #18181b; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
              th, td { border: 1px solid #e4e4e7; padding: 10px; text-align: left; }
              th { background-color: #f4f4f5; font-weight: 600; color: #3f3f46; }
              h1 { color: #065f46; font-size: 24px; margin-bottom: 8px; }
              p { color: #71717a; margin-top: 0; font-size: 14px; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p>Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            <table>
              <thead>
                <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${data.map((row) => `<tr>${row.map((cell: any) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
            <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
          </body>
        </html>
      `
      printWindow.document.write(html)
      printWindow.document.close()
    } else if (exportFormat === 'doc') {
      const docHeaders = ['Produto', 'Categoria', 'Unidade', 'Quantidade Atual']
      const docData =
        activeTab === 'summary'
          ? summaryByProduct.map((row) => [row.name, row.category, row.unit, row.total])
          : activeTab === 'shopping'
            ? shoppingList.map((row) => [
                row.product.name,
                getCategoryName(row.product.category_id),
                row.product.unit,
                row.total,
              ])
            : activeTab === 'trends'
              ? consumptionData.list.map((row) => [
                  row.product.name,
                  getCategoryName(row.product.category_id),
                  row.product.unit,
                  row.consumed,
                ])
              : activeTab === 'history'
                ? filteredCounts.map((count) => [
                    count.expand?.product_id?.name || 'Desconhecido',
                    getCategoryName(count.expand?.product_id?.category_id || ''),
                    count.expand?.product_id?.unit || '',
                    count.counted_quantity,
                  ])
                : summaryByProduct.map((row) => [row.name, row.category, row.unit, row.total])

      const docTitle = 'Relatório de Estoque Atual'
      const exportDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm")

      const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>${docTitle}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotPromptForConvert/>
              <w:DoNotShowInsertionsAndDeletions/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page { size: A4 landscape; margin: 2cm; }
            body { font-family: 'Calibri', sans-serif; font-size: 11pt; color: #000; }
            .doc-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #065f46; padding-bottom: 12px; }
            .doc-header h1 { font-size: 20pt; color: #065f46; margin: 0 0 4px 0; }
            .doc-header p { font-size: 10pt; color: #555; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
            th { border: 1px solid #333; padding: 8px 10px; text-align: left; background-color: #065f46; color: #fff; font-weight: bold; }
            td { border: 1px solid #999; padding: 6px 10px; text-align: left; }
            tr:nth-child(even) td { background-color: #f4f4f5; }
            .doc-footer { margin-top: 20px; font-size: 9pt; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <div class="doc-header">
            <h1>${docTitle}</h1>
            <p><strong>Data de Exportação:</strong> ${exportDate}</p>
          </div>
          <table>
            <thead>
              <tr>${docHeaders.map((h) => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${docData.map((row) => `<tr>${row.map((cell: any) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <div class="doc-footer">
            <p>Cena Risotteria — Sistema de Gestão de Estoque</p>
            <p>Total de registros: ${docData.length}</p>
          </div>
        </body>
      </html>`

      const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `relatorio_estoque_atual_${format(new Date(), 'yyyy-MM-dd')}.doc`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
    setExportModalOpen(false)
  }

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setUserId('_all_')
    setCategoryId('_all_')
    setAreaId('_all_')
    setSubareaId('_all_')
    setSearchQuery('')
    setSortField('name')
    setSortDirection('asc')
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold font-serif text-emerald-900 tracking-tight">
            Relatórios
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Analise saldos, histórico, necessidades de compras e consumo.
          </p>
        </div>
        <Button onClick={() => setExportModalOpen(true)} className="w-full md:w-auto">
          <Download className="w-4 h-4 mr-2" /> Exportar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6 h-auto">
          <TabsTrigger
            value="history"
            className="flex flex-col md:flex-row items-center gap-2 py-2"
          >
            <History className="w-4 h-4" /> <span className="hidden md:inline">Histórico</span>
          </TabsTrigger>
          <TabsTrigger
            value="summary"
            className="flex flex-col md:flex-row items-center gap-2 py-2"
          >
            <ListOrdered className="w-4 h-4" />{' '}
            <span className="hidden md:inline">Estoque Atual</span>
          </TabsTrigger>
          <TabsTrigger
            value="shopping"
            className="flex flex-col md:flex-row items-center gap-2 py-2"
          >
            <ShoppingCart className="w-4 h-4" />{' '}
            <span className="hidden md:inline">Lista de Compras</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex flex-col md:flex-row items-center gap-2 py-2">
            <TrendingUp className="w-4 h-4" /> <span className="hidden md:inline">Tendências</span>
          </TabsTrigger>
          <TabsTrigger value="prices" className="flex flex-col md:flex-row items-center gap-2 py-2">
            <DollarSign className="w-4 h-4" /> <span className="hidden md:inline">Preços</span>
          </TabsTrigger>
        </TabsList>

        <Card className="shadow-sm border-zinc-200 mb-6 bg-white">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
              {(activeTab === 'history' || activeTab === 'trends' || activeTab === 'prices') && (
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
              )}

              {activeTab === 'trends' && (
                <div className="space-y-1.5 flex flex-col justify-end">
                  <Select
                    onValueChange={(val) => {
                      if (val === '30') {
                        setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
                        setEndDate(format(new Date(), 'yyyy-MM-dd'))
                      } else if (val === 'last_month') {
                        const start = startOfMonth(subMonths(new Date(), 1))
                        const end = endOfMonth(subMonths(new Date(), 1))
                        setStartDate(format(start, 'yyyy-MM-dd'))
                        setEndDate(format(end, 'yyyy-MM-dd'))
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Atalhos..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="last_month">Mês Passado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(activeTab === 'summary' ||
                activeTab === 'shopping' ||
                activeTab === 'trends' ||
                activeTab === 'history') && (
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all_">Todas</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeTab === 'history' && (
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
              )}

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

        {/* HISTÓRICO TAB */}
        <TabsContent value="history" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <Card className="bg-white shadow-sm border-zinc-200">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="bg-emerald-100 p-3 rounded-full text-emerald-700">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500">Total de Registros (Período)</p>
                  <p className="text-3xl font-bold text-zinc-900">{filteredCounts.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-right">Quantidade Contada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCounts.map((count) => {
                    const product = count.expand?.product_id
                    const user = count.expand?.user_id
                    const subarea = count.expand?.subarea_id
                    const area = subarea?.expand?.area_id

                    return (
                      <TableRow key={count.id}>
                        <TableCell className="text-zinc-500 whitespace-nowrap">
                          {format(safeDate(count.created), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium text-zinc-900">
                          <div className="flex items-center gap-3">
                            {product?.image ? (
                              <div className="w-8 h-8 rounded border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0">
                                <img
                                  src={`${pb.baseUrl}/api/files/products/${product.id}/${product.image}?thumb=100x100`}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
                                <ImageIcon className="w-4 h-4 text-zinc-300" />
                              </div>
                            )}
                            <div>
                              {product?.name}
                              <span className="text-xs text-zinc-500 ml-1">({product?.unit})</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-600">
                          <div className="flex flex-col">
                            <span>{area?.name}</span>
                            <span className="text-xs text-zinc-400">{subarea?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-600">{user?.name || user?.email}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          {count.counted_quantity}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredCounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
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

                return (
                  <div key={count.id} className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3 items-center">
                        {product?.image ? (
                          <div className="w-10 h-10 rounded border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0">
                            <img
                              src={`${pb.baseUrl}/api/files/products/${product.id}/${product.image}?thumb=100x100`}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-5 h-5 text-zinc-300" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-zinc-900">{product?.name}</h3>
                          <p className="text-xs text-zinc-500">
                            {area?.name} • {subarea?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-zinc-500 text-xs">Qtd. Contada</span>
                        <span className="font-bold text-emerald-700 text-lg">
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

        {/* SUMMARY TAB */}
        <TabsContent value="summary" className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-zinc-600">Ordenar por:</span>
              <Select
                value={sortField}
                onValueChange={(v: 'name' | 'category' | 'quantity') => setSortField(v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="category">Categoria</SelectItem>
                  <SelectItem value="quantity">Quantidade</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="gap-1.5"
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
                {sortDirection === 'asc' ? 'Crescente' : 'Decrescente'}
              </Button>
            </div>
            <span className="text-sm text-zinc-500">{summaryByProduct.length} produtos</span>
          </div>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Quantidade Total</TableHead>
                    <TableHead>Última Contagem</TableHead>
                    <TableHead>Responsável</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryByProduct.map((item: any) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-zinc-50"
                      onClick={() => setSelectedProduct(item)}
                    >
                      <TableCell className="font-medium text-zinc-900">
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <div className="w-8 h-8 rounded border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0">
                              <img
                                src={`${pb.baseUrl}/api/files/products/${item.id}/${item.image}?thumb=100x100`}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4 text-zinc-300" />
                            </div>
                          )}
                          <div>
                            {item.name}
                            <span className="text-xs text-zinc-500 ml-1">({item.unit})</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {item.total}
                      </TableCell>
                      <TableCell className="text-zinc-600 whitespace-nowrap text-sm">
                        {item.latestCount ? (
                          format(safeDate(item.latestCount.created), 'dd/MM/yyyy HH:mm')
                        ) : (
                          <span className="text-zinc-400">Sem contagem</span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-600 text-sm">
                        {item.latestCount?.expand?.user_id?.name ||
                          item.latestCount?.expand?.user_id?.email || (
                            <span className="text-zinc-400">-</span>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {summaryByProduct.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                        Nenhum produto encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* SHOPPING LIST TAB */}
        <TabsContent value="shopping" className="space-y-6">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Estoque Mínimo</TableHead>
                    <TableHead className="text-right">Estoque Atual</TableHead>
                    <TableHead className="text-right text-red-600 font-bold">
                      Comprar / Produzir
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shoppingList.map((item: any) => (
                    <TableRow key={item.product.id}>
                      <TableCell className="font-medium text-zinc-900">
                        <div className="flex items-center gap-3">
                          {item.product.image ? (
                            <div className="w-8 h-8 rounded border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0">
                              <img
                                src={`${pb.baseUrl}/api/files/products/${item.product.id}/${item.product.image}?thumb=100x100`}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4 text-zinc-300" />
                            </div>
                          )}
                          <div>
                            {item.product.name}
                            <span className="text-xs text-zinc-500 ml-1">
                              ({item.product.unit})
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getCategoryName(item.product.category_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-zinc-600">
                        {item.product.min_stock || 0}{' '}
                        <span className="text-xs font-normal text-zinc-400">
                          {item.product.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.total}{' '}
                        <span className="text-xs font-normal text-zinc-400">
                          {item.product.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        +{item.need}{' '}
                        <span className="text-xs font-normal opacity-80">{item.product.unit}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {shoppingList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                        Todos os produtos estão acima do estoque mínimo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* TRENDS TAB */}
        <TabsContent value="trends" className="space-y-6">
          <Card className="shadow-sm border-zinc-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-serif">Consumo Total ao Longo do Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              {consumptionData.chartData.length > 0 ? (
                <ChartContainer
                  config={{ consumption: { label: 'Consumo', color: 'hsl(var(--primary))' } }}
                  className="h-[250px] w-full"
                >
                  <BarChart data={consumptionData.chartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="consumption"
                      fill="var(--color-consumption)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-zinc-500 text-sm">
                  Nenhum dado de consumo para o período e filtros selecionados.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Total Consumido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptionData.list.map((item: any) => (
                    <TableRow key={item.product.id}>
                      <TableCell className="font-medium text-zinc-900">
                        <div className="flex items-center gap-3">
                          {item.product.image ? (
                            <div className="w-8 h-8 rounded border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0">
                              <img
                                src={`${pb.baseUrl}/api/files/products/${item.product.id}/${item.product.image}?thumb=100x100`}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4 text-zinc-300" />
                            </div>
                          )}
                          <div>
                            {item.product.name}
                            <span className="text-xs text-zinc-500 ml-1">
                              ({item.product.unit})
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getCategoryName(item.product.category_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {item.consumed}{' '}
                        <span className="text-xs font-normal text-zinc-500">
                          {item.product.unit}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {consumptionData.list.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-zinc-500">
                        Nenhum consumo registrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* PRICES TAB */}
        <TabsContent value="prices" className="space-y-6">
          <Card className="shadow-sm border-zinc-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-serif">Relatório Evolutivo de Preços</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label className="mb-2 block">Selecionar Produtos</Label>
                <div className="max-h-40 overflow-y-auto border border-zinc-200 rounded-md p-3 space-y-2 bg-zinc-50/50">
                  {products.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-2">
                      Nenhum produto cadastrado.
                    </p>
                  )}
                  {products.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:text-emerald-700"
                    >
                      <Checkbox
                        checked={selectedPriceProducts.includes(p.id)}
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            setSelectedPriceProducts((prev) => [...prev, p.id])
                          } else {
                            setSelectedPriceProducts((prev) => prev.filter((id) => id !== p.id))
                          }
                        }}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
                {selectedPriceProducts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-zinc-500"
                    onClick={() => setSelectedPriceProducts([])}
                  >
                    Limpar seleção
                  </Button>
                )}
              </div>

              {priceEvolutionData.chartData.length > 0 ? (
                <ChartContainer
                  config={Object.fromEntries(
                    priceEvolutionData.chartProducts.map((p, i) => [
                      p.name,
                      { label: p.name, color: `hsl(${(i * 60) % 360}, 70%, 50%)` },
                    ]),
                  )}
                  className="h-[300px] w-full"
                >
                  <LineChart data={priceEvolutionData.chartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="display" tickLine={false} tickMargin={10} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={60} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {priceEvolutionData.chartProducts.map((p, i) => (
                      <Line
                        key={p.id}
                        type="monotone"
                        dataKey={p.name}
                        stroke={`hsl(${(i * 60) % 360}, 70%, 50%)`}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm">
                  Selecione produtos e um período para visualizar a evolução de preços.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PRODUCT BREAKDOWN MODAL */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedProduct?.image ? (
                <div className="w-10 h-10 rounded border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0">
                  <img
                    src={`${pb.baseUrl}/api/files/products/${selectedProduct.id}/${selectedProduct.image}?thumb=100x100`}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-5 h-5 text-zinc-300" />
                </div>
              )}
              {selectedProduct?.name}
            </DialogTitle>
            <DialogDescription>Distribuição de estoque por subárea</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedProduct?.breakdown.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">
                Este produto não possui estoque visível com os filtros atuais.
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

      {/* EXPORT MODAL */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Relatório</DialogTitle>
            <DialogDescription>
              Exporta os dados atualmente visíveis na aba ativa (respeitando os filtros aplicados).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Select
                value={exportFormat}
                onValueChange={(val: 'csv' | 'pdf') => setExportFormat(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF (Impressão)</SelectItem>
                  <SelectItem value="csv">Excel / CSV</SelectItem>
                  <SelectItem value="doc">Word (.doc)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Exportar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
