import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

// Native Response properties to ignore when extracting field validation errors
const RESPONSE_PROPERTIES_TO_IGNORE = new Set([
  'status',
  'statusText',
  'headers',
  'type',
  'url',
  'ok',
  'redirected',
  'body',
  'bodyUsed',
])

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}

  // PocketBase v0.22+ stores error response body in error.data, fallback to error.response?.data
  const rawData = (error as any).data?.data || (error as any).data || error.response?.data

  if (!rawData || typeof rawData !== 'object') return {}

  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(rawData)) {
    if (RESPONSE_PROPERTIES_TO_IGNORE.has(field)) continue

    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    } else if (typeof detail === 'string') {
      errors[field] = detail
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const fieldErrors = extractFieldErrors(error)
  const fieldEntries = Object.entries(fieldErrors)
  if (fieldEntries.length > 0) {
    return fieldEntries.map(([field, msg]) => `${field}: ${msg}`).join(' ')
  }
  return (
    (error as any).data?.message ||
    error.response?.message ||
    error.message ||
    'An unexpected error occurred.'
  )
}
