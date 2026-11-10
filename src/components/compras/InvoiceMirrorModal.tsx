import { useState, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import { Product, updateProduct } from '@/services/products'
import { Fornecedor, createFornecedor } from '@/services/fornecedores'
import { ProductPriceHistory } from '@/services/product_price_history'
import { PriceVariationAlert } from '@/components/compras/PriceVariationAlert'
import { checkPriceVariation } from '@/lib/price-variation'
import { createCompra, CostCategory } from '@/services/compras'
import { ProductSearchCombobox } from '@/components/compras/ProductSearchCombobox'
import { getInventoryLevels } from '@/services/inventory_levels'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  FileText,
  Camera,
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

const COST_CATEGORIES: CostCategory[] = [
  'CMV',
  'Manutenção predial',
  'Utensílios',
  'Alimentação de funcionários',
  'Limpeza',
  'Descartáveis',
  'Decoração',
  'Operacional',
]

export interface ExtractedItem {
  id: string
  descricao: string
  quantidade: number
  unidade: 'kg' | 'litro' | 'unidade' | 'fração'
  preco_unitario: number
  valor_total: number
  confianca?: 'alta' | 'media' | 'baixa'
  is_avulso: boolean
  product_id?: string
  cost_category: CostCategory
  inactive_match_warning?: string
}

interface InvoiceMirrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  suppliers: Fornecedor[]
  priceHistory?: ProductPriceHistory[]
  onSuccess: () => void
}

export function InvoiceMirrorModal({
  open,
  onOpenChange,
  products,
  suppliers,
  priceHistory,
  onSuccess,
}: InvoiceMirrorModalProps) {
  const [step, setStep] = useState<'upload' | 'mirror'>('upload')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Espelho state
  const [supplierName, setSupplierName] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [dataNota, setDataNota] = useState('')
  const [paymentTerm, setPaymentTerm] = useState('')
  const [itens, setItens] = useState<ExtractedItem[]>([])
  const [confiancaGeral, setConfiancaGeral] = useState<'alta' | 'media' | 'baixa'>('alta')
  const [observacaoIA, setObservacaoIA] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setStep('upload')
    setIsProcessing(false)
    setIsSaving(false)
    setSupplierName('')
    setSelectedSupplierId('')
    setNotaFiscal('')
    setDataNota(new Date().toISOString().split('T')[0])
    setPaymentTerm('')
    setItens([])
    setConfiancaGeral('alta')
    setObservacaoIA('')
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(resetState, 200)
  }

  // Enviar arquivo para análise
  const processFile = async (file: File) => {
    setIsProcessing(true)
    const fileName = file.name.toLowerCase()

    try {
      let responseData: any = null

      if (
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.png') ||
        fileName.endsWith('.webp')
      ) {
        // Enviar imagem em base64
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
        })
        reader.readAsDataURL(file)
        const base64Data = await base64Promise

        responseData = await pb.send('/backend/v1/compras/ler-nota', {
          method: 'POST',
          body: JSON.stringify({
            image_base64: base64Data,
            image_mime: file.type || 'image/jpeg',
          }),
        })
      } else if (fileName.endsWith('.xml')) {
        // Arquivo XML de NF-e: ler texto local e enviar como text_content
        const xmlText = await file.text()
        responseData = await pb.send('/backend/v1/compras/ler-nota', {
          method: 'POST',
          body: JSON.stringify({
            text_content: xmlText,
          }),
        })
      } else {
        // Documento multipart (PDF, XLSX)
        const formData = new FormData()
        formData.append('arquivo', file)

        responseData = await pb.send('/backend/v1/compras/ler-nota', {
          method: 'POST',
          body: formData,
        })
      }

      if (!responseData) {
        throw new Error('Nenhum dado retornado da leitura.')
      }

      // Preencher espelho
      const extractedSupplier = responseData.fornecedor || ''
      setSupplierName(extractedSupplier)

      // Tentar associar fornecedor automaticamente por nome
      if (extractedSupplier) {
        const found = suppliers.find(
          (s) =>
            s.name.toLowerCase().includes(extractedSupplier.toLowerCase()) ||
            extractedSupplier.toLowerCase().includes(s.name.toLowerCase()),
        )
        if (found) {
          setSelectedSupplierId(found.id)
        } else {
          setSelectedSupplierId('__new__')
        }
      }

      if (responseData.data) {
        setDataNota(responseData.data.split(' ')[0])
      } else {
        setDataNota(new Date().toISOString().split('T')[0])
      }

      setNotaFiscal(responseData.nota_fiscal || '')
      setConfiancaGeral(responseData.confianca_geral || 'alta')
      setObservacaoIA(responseData.observacao || '')

      const rawItens = Array.isArray(responseData.itens) ? responseData.itens : []

      if (rawItens.length === 0) {
        toast.warning(
          'Não foi possível identificar itens com clareza nesta nota. Revise ou adicione manualmente.',
        )
      }

      // Mapear itens tentando vincular com produtos cadastrados
      const mappedItens: ExtractedItem[] = rawItens.map((item: any, idx: number) => {
        const desc = (item.descricao || '').trim()
        let matchedProductId: string | undefined = undefined

        let inactiveMatchWarning: string | undefined = undefined

        if (desc) {
          const lowerDesc = desc.toLowerCase()
          const matched = products.find((p) => {
            const pName = p.name.toLowerCase()
            return pName === lowerDesc || lowerDesc.includes(pName) || pName.includes(lowerDesc)
          })
          if (matched) {
            // Se o produto encontrado estiver inativo, não auto-vincula silenciosamente:
            // sinaliza para revisão do usuário
            if (matched.active === false) {
              inactiveMatchWarning = `Produto sugerido "${matched.name}" está inativo. Selecione outro produto ativo ou marque como avulso.`
            } else {
              matchedProductId = matched.id
            }
          }
        }

        const qty = Number(item.quantidade) || 1
        const unitPrice = Number(item.preco_unitario) || Number(item.valor_total) || 0
        const total = Number(item.valor_total) || qty * unitPrice

        return {
          id: `item_${Date.now()}_${idx}`,
          descricao: desc,
          quantidade: qty,
          unidade: (['kg', 'litro', 'unidade', 'fração'].includes(item.unidade)
            ? item.unidade
            : 'unidade') as any,
          preco_unitario: unitPrice,
          valor_total: total,
          confianca: item.confianca || 'alta',
          is_avulso: !matchedProductId,
          product_id: matchedProductId,
          cost_category: 'CMV',
          inactive_match_warning: inactiveMatchWarning,
        }
      })

      setItens(mappedItens)
      setStep('mirror')
      toast.success('Nota fiscal processada! Revise os itens antes de salvar.')
    } catch (err: any) {
      console.error('Erro na leitura da nota:', err)
      const msg =
        err?.response?.error ||
        err?.message ||
        'Não foi possível identificar com segurança os dados da nota. Revise o arquivo e tente novamente.'
      toast.error(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  // Atualizar campo de item
  const updateItem = (id: string, updates: Partial<ExtractedItem>) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const updated = { ...it, ...updates }
        // Se recalculou qtd ou preço, atualizar total
        if ('quantidade' in updates || 'preco_unitario' in updates) {
          updated.valor_total =
            Math.round((updated.quantidade || 0) * (updated.preco_unitario || 0) * 100) / 100
        }
        return updated
      }),
    )
  }

  // Remover item do espelho
  const removeItem = (id: string) => {
    setItens((prev) => prev.filter((it) => it.id !== id))
  }

  // Adicionar item em branco no espelho
  const addItem = () => {
    setItens((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}`,
        descricao: '',
        quantidade: 1,
        unidade: 'unidade',
        preco_unitario: 0,
        valor_total: 0,
        confianca: 'alta',
        is_avulso: true,
        cost_category: 'CMV',
      },
    ])
  }

  // Salvar compra do espelho
  const handleSaveCompra = async () => {
    if (itens.length === 0) {
      toast.error('Adicione ao menos um item para salvar a compra.')
      return
    }

    if (!dataNota) {
      toast.error('Informe a data da compra.')
      return
    }

    // Validar itens
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]
      if (!it.is_avulso && !it.product_id) {
        toast.error(
          `Item ${i + 1} ("${it.descricao || 'Sem descrição'}"): Selecione um produto ou marque como avulso.`,
        )
        return
      }
      if (it.is_avulso && !it.descricao.trim()) {
        toast.error(`Item ${i + 1}: Informe uma descrição para o item avulso.`)
        return
      }
      if (it.valor_total <= 0 && it.preco_unitario <= 0) {
        toast.error(`Item ${i + 1}: Informe o valor ou preço unitário.`)
        return
      }
    }

    setIsSaving(true)
    try {
      // 1. Resolver fornecedor se necessário
      let finalSupplierId = selectedSupplierId
      if (selectedSupplierId === '__new__' && supplierName.trim()) {
        // Criar fornecedor novo
        const createdSup = await createFornecedor({
          name: supplierName.trim(),
          observations: 'Cadastrado automaticamente via leitura de nota com IA',
        })
        finalSupplierId = createdSup.id
      } else if (selectedSupplierId === '__none__' || selectedSupplierId === '__new__') {
        finalSupplierId = ''
      }

      // 2. Salvar cada item como compra no formato do sistema
      const allLevels = await getInventoryLevels()

      for (const it of itens) {
        const payload: any = {
          date: dataNota,
          nota_fiscal: notaFiscal || undefined,
          payment_term: paymentTerm || undefined,
          quantity: it.quantidade || 1,
          price: it.preco_unitario || it.valor_total,
        }

        if (it.is_avulso) {
          payload.is_avulsa = true
          payload.description = it.descricao
          payload.cost_category = it.cost_category || 'CMV'
          // Item avulso não tem produto vinculado; fornecedor pode ser opcional
          if (finalSupplierId) {
            payload.supplier_id = finalSupplierId
          }
        } else {
          payload.product_id = it.product_id
          if (finalSupplierId) {
            payload.supplier_id = finalSupplierId
          }
          payload.is_avulsa = false
        }

        await createCompra(payload)

        // Se tiver produto vinculado, atualizar preço médio ponderado
        if (!it.is_avulso && it.product_id) {
          try {
            const product = products.find((p) => p.id === it.product_id)
            if (product) {
              const productLevels = allLevels.filter((l) => l.product_id === product.id)
              const volumeAntigo = productLevels.reduce((sum, l) => sum + (l.quantity || 0), 0)
              const precoAntigo = product.price || 0
              const compraPrice = it.preco_unitario || it.valor_total / (it.quantidade || 1)
              const compraQtd = it.quantidade || 1

              let weightedPrice = compraPrice
              if (volumeAntigo > 0 && precoAntigo > 0) {
                weightedPrice =
                  (precoAntigo * volumeAntigo + compraPrice * compraQtd) /
                  (volumeAntigo + compraQtd)
              }
              weightedPrice = Math.round(weightedPrice * 100) / 100
              await updateProduct(product.id, { price: weightedPrice })
            }
          } catch (pe) {
            console.warn('Erro ao atualizar preço médio ponderado de item:', pe)
          }
        }
      }

      toast.success(
        `${itens.length} ${itens.length === 1 ? 'item salvo' : 'itens salvos'} com sucesso!`,
      )
      handleClose()
      onSuccess()
    } catch (err: any) {
      console.error('Erro ao salvar compras:', err)
      toast.error('Erro ao salvar compras: ' + (err.message || 'Verifique os campos obrigatórios.'))
    } finally {
      setIsSaving(false)
    }
  }

  const valorTotalGeral = itens.reduce((sum, it) => sum + (it.valor_total || 0), 0)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-zinc-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-serif text-emerald-950">
                  Leitura de Nota com IA
                </DialogTitle>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Extração automática de itens e valores para o Espelho da Compra
                </p>
              </div>
            </div>
            {step === 'mirror' && (
              <Badge
                variant="secondary"
                className="bg-emerald-50 text-emerald-800 border-emerald-200"
              >
                Espelho Editável
              </Badge>
            )}
          </div>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-6">
            {isProcessing ? (
              <div className="flex flex-col items-center space-y-4 text-center py-10">
                <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-zinc-800 text-base">
                    Analisando documento com IA...
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Identificando fornecedor, data, produtos, quantidades e preços unitários.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-zinc-800">
                    Selecione ou fotografe sua nota fiscal ou recibo
                  </p>
                  <p className="text-xs text-zinc-500">
                    Formatos suportados: Fotos (JPG, PNG), PDF, XML (NF-e) ou Planilha Excel (XLSX).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                  {/* Câmera em mobile/tablet */}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-28 flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:border-emerald-500 hover:bg-emerald-50/50"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="w-7 h-7 text-emerald-600" />
                    <span className="font-medium text-sm text-zinc-800">Tirar Foto</span>
                    <span className="text-[11px] text-zinc-400">Usar câmera do aparelho</span>
                  </Button>

                  {/* Upload de arquivo */}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-28 flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:border-emerald-500 hover:bg-emerald-50/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-7 h-7 text-emerald-600" />
                    <span className="font-medium text-sm text-zinc-800">Anexar Arquivo</span>
                    <span className="text-[11px] text-zinc-400">PDF, XML, XLSX ou foto</span>
                  </Button>
                </div>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) processFile(file)
                  }}
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.xml,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) processFile(file)
                  }}
                />

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 max-w-md space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Conferência obrigatória</span>
                  </div>
                  <p className="leading-relaxed">
                    A IA auxilia na digitação, mas <strong>nada é gravado automaticamente</strong>.
                    Você poderá conferir e ajustar cada item antes de salvar.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ESPELHO DA COMPRA */
          <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
            {confiancaGeral !== 'alta' && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Atenção na conferência</span>
                  <p>
                    A IA identificou alguns dados com nível de confiança{' '}
                    <strong>{confiancaGeral}</strong>. Revise cuidadosamente os itens destacados em
                    amarelo.
                  </p>
                  {observacaoIA && <p className="text-amber-800 italic mt-1">"{observacaoIA}"</p>}
                </div>
              </div>
            )}

            {/* Cabeçalho do Espelho: Fornecedor, Data, NF */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-semibold">Fornecedor</Label>
                <Select
                  value={selectedSupplierId || '__none__'}
                  onValueChange={(val) => {
                    setSelectedSupplierId(val)
                    if (val === '__new__') {
                      // Mantém o nome extraído
                    } else if (val !== '__none__') {
                      const sup = suppliers.find((s) => s.id === val)
                      if (sup) setSupplierName(sup.name)
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem fornecedor (Avulso)</SelectItem>
                    {supplierName && (
                      <SelectItem value="__new__">Criar novo: "{supplierName}"</SelectItem>
                    )}
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSupplierId === '__new__' && (
                  <Input
                    className="h-8 text-xs mt-1"
                    placeholder="Nome do novo fornecedor"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Data da Nota</Label>
                <Input
                  type="date"
                  className="h-8 text-xs bg-white"
                  value={dataNota}
                  onChange={(e) => setDataNota(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nº Nota Fiscal</Label>
                <Input
                  className="h-8 text-xs bg-white"
                  placeholder="Ex: 12345"
                  value={notaFiscal}
                  onChange={(e) => setNotaFiscal(e.target.value)}
                />
              </div>
            </div>

            {/* Tabela de Itens do Espelho */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-zinc-700">
                  Itens da Nota ({itens.length})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={addItem}
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Item
                </Button>
              </div>

              <div className="space-y-2.5">
                {itens.map((it, idx) => {
                  const isLowConfidence = it.confianca === 'baixa' || it.confianca === 'media'

                  return (
                    <div
                      key={it.id}
                      className={`p-3 rounded-lg border text-xs space-y-2.5 transition-colors ${
                        isLowConfidence
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-white border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-500 text-[11px]">#{idx + 1}</span>
                          {isLowConfidence && (
                            <Badge
                              variant="secondary"
                              className="bg-amber-200 text-amber-900 border-amber-300 text-[10px] py-0 px-1.5 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-800" />
                              Revisão sugerida
                            </Badge>
                          )}
                          {it.inactive_match_warning && !it.product_id && (
                            <Badge
                              variant="secondary"
                              className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] py-0 px-1.5 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-700" />
                              Sugeriu produto inativo (requer seleção)
                            </Badge>
                          )}
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-zinc-700">
                            <Checkbox
                              checked={it.is_avulso}
                              onCheckedChange={(c) => updateItem(it.id, { is_avulso: Boolean(c) })}
                            />
                            <span>Marcar como avulso (sem produto)</span>
                          </label>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-700"
                          onClick={() => removeItem(it.id)}
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Alerta de variação de preço se o item estiver vinculado a produto */}
                      {(() => {
                        if (it.is_avulso || !it.product_id) return null
                        const prod = products.find((p) => p.id === it.product_id)
                        const variation = checkPriceVariation(it.preco_unitario, prod, priceHistory)
                        if (!variation.hasVariation) return null

                        return (
                          <PriceVariationAlert
                            check={variation}
                            unit={prod?.unit || it.unidade}
                            compact={true}
                            className="mt-1"
                          />
                        )
                      })()}

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                        {/* Se for avulso, descrição livre + fonte de custo; senão, autocomplete/select de produto */}
                        {!it.is_avulso ? (
                          <div className="sm:col-span-5 space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] text-zinc-500">
                                Vincular a Produto
                              </Label>
                              {it.inactive_match_warning && !it.product_id && (
                                <span className="text-[10px] text-rose-600 font-medium truncate max-w-[220px]">
                                  Sugerido inativo
                                </span>
                              )}
                            </div>
                            <ProductSearchCombobox
                              products={products}
                              value={it.product_id || ''}
                              onChange={(val) => {
                                const p = products.find((prod) => prod.id === val)
                                updateItem(it.id, {
                                  product_id: val,
                                  descricao: p ? p.name : it.descricao,
                                  unidade: (p?.unit || it.unidade) as any,
                                  inactive_match_warning: undefined,
                                })
                              }}
                              placeholder="Buscar produto ativo por nome..."
                              onlyActive={true}
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="sm:col-span-3 space-y-1">
                              <Label className="text-[11px] text-zinc-500">Descrição do Item</Label>
                              <Input
                                className="h-8 text-xs bg-white"
                                placeholder="Descrição livre"
                                value={it.descricao}
                                onChange={(e) => updateItem(it.id, { descricao: e.target.value })}
                              />
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                              <Label className="text-[11px] text-zinc-500">Fonte de Custo</Label>
                              <Select
                                value={it.cost_category}
                                onValueChange={(val) =>
                                  updateItem(it.id, { cost_category: val as CostCategory })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COST_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}

                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-[11px] text-zinc-500">Qtd</Label>
                          <Input
                            type="number"
                            step="any"
                            className="h-8 text-xs bg-white text-right"
                            value={it.quantidade ?? ''}
                            onChange={(e) =>
                              updateItem(it.id, {
                                quantidade: e.target.value === '' ? 0 : Number(e.target.value),
                              })
                            }
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-[11px] text-zinc-500">Unidade</Label>
                          <Select
                            value={it.unidade}
                            onValueChange={(val) => updateItem(it.id, { unidade: val as any })}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="litro">litro</SelectItem>
                              <SelectItem value="unidade">unidade</SelectItem>
                              <SelectItem value="fração">fração</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="sm:col-span-3 space-y-1">
                          <Label className="text-[11px] text-zinc-500">Total (R$)</Label>
                          <Input
                            type="number"
                            step="any"
                            className="h-8 text-xs bg-white text-right font-semibold text-emerald-800"
                            value={it.valor_total ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value)
                              const unitPrice =
                                (it.quantidade || 1) > 0 ? val / (it.quantidade || 1) : val
                              updateItem(it.id, {
                                valor_total: val,
                                preco_unitario: Math.round(unitPrice * 100) / 100,
                              })
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}

                {itens.length === 0 && (
                  <div className="text-center py-8 text-zinc-400 border border-dashed rounded-lg">
                    Nenhum item na nota. Clique em "Adicionar Item".
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-zinc-100 flex items-center justify-between sm:justify-between shrink-0">
          {step === 'upload' ? (
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('upload')}
                  disabled={isSaving}
                >
                  Voltar / Enviar outro
                </Button>
                <div className="text-xs text-zinc-600">
                  Total da nota:{' '}
                  <strong className="text-emerald-800 text-sm">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(valorTotalGeral)}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                  onClick={handleSaveCompra}
                  disabled={isSaving || itens.length === 0}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar compra
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
