import { ClientResponseError } from 'pocketbase'

type ApiFieldError = { code?: string; message?: string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/**
 * Traduz o erro real do PocketBase ao gravar um ajuste de estoque em uma
 * mensagem compreensível. A resposta 400 do PB traz o motivo em
 * response.data.<campo>.message (erro de campo) e/ou em response.message;
 * o status 403 indica regra de criação negada e 401 sessão expirada.
 */
export const describeStockAdjustmentError = (error: unknown): string => {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : ''
  }

  const response = isRecord(error.response) ? error.response : {}
  const topLevel = typeof response.message === 'string' ? response.message : ''

  const fieldMsgs: string[] = []
  const data = isRecord(response.data) ? response.data : {}
  for (const [field, detail] of Object.entries(data)) {
    if (isRecord(detail) && typeof detail.message === 'string') {
      fieldMsgs.push(`${field}: ${(detail as ApiFieldError).message}`)
    }
  }

  if (error.status === 401) {
    return 'Sessão expirada. Faça login novamente para registrar o ajuste.'
  }
  if (error.status === 403) {
    return 'Seu usuário não tem permissão para registrar ajustes. Peça acesso a um administrador.'
  }

  if (fieldMsgs.length > 0) {
    return `Não foi possível registrar o ajuste: ${fieldMsgs.join('; ')}`
  }
  if (topLevel && topLevel !== 'Failed to create record.') {
    return `Não foi possível registrar o ajuste: ${topLevel}`
  }
  if (topLevel) {
    return 'Não foi possível registrar o ajuste: o servidor rejeitou os dados enviados (erro de validação). Tente novamente.'
  }
  return ''
}
