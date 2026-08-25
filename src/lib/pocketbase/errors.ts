import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!error) return {}

  let rawData: any = null

  if (error instanceof ClientResponseError) {
    // PocketBase JS SDK v0.22+ stores the parsed response body in `error.data`
    // Legacy / fetch response fallback: `error.response?.data`
    rawData = error.data ?? (error.response as any)?.data
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as any
    rawData = errObj.data ?? errObj.response?.data
  }

  if (!rawData || typeof rawData !== 'object') return {}

  // PocketBase errors can be `{ data: { fieldName: { code, message } } }`
  // or directly `{ fieldName: { code, message } }`
  const fieldsSource =
    rawData.data && typeof rawData.data === 'object' && !Array.isArray(rawData.data)
      ? rawData.data
      : rawData

  const errors: FieldErrors = {}

  // Forbidden keys that are standard HTTP response properties and NOT form fields
  const ignoredKeys = new Set([
    'status',
    'statusText',
    'type',
    'url',
    'ok',
    'headers',
    'redirected',
    'body',
    'bodyUsed',
    'code',
    'message',
  ])

  for (const [field, detail] of Object.entries(fieldsSource)) {
    if (ignoredKeys.has(field)) continue

    if (typeof detail === 'string' && detail.trim() !== '') {
      errors[field] = detail
    } else if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string' &&
      (detail as { message: string }).message.trim() !== ''
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }

  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado.'

  if (error instanceof ClientResponseError) {
    const msgs = Object.values(extractFieldErrors(error))
    if (msgs.length > 0) {
      return msgs.join(' ')
    }
    const rawData = error.data ?? (error.response as any)?.data
    if (
      rawData &&
      typeof rawData === 'object' &&
      typeof rawData.message === 'string' &&
      rawData.message.trim() !== ''
    ) {
      return rawData.message
    }
    return error.message || 'Ocorreu um erro ao processar a requisição.'
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Ocorreu um erro inesperado.'
}
