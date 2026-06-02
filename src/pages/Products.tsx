import { Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function Products() {
  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 w-full">
      <div className="flex flex-col mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Gestão de Produtos</h1>
        <p className="text-sm text-zinc-500 mt-1">Gerencie o catálogo de produtos e insumos.</p>
      </div>

      <Card className="border-dashed border-2 shadow-none bg-zinc-50/50">
        <CardContent className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 text-zinc-400">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">Página em Construção</h3>
          <p className="text-sm text-zinc-500 max-w-sm">
            Esta funcionalidade será implementada na próxima fase. Apenas gerentes e administradores
            terão acesso a esta gestão.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
