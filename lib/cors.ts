import type { NextApiRequest, NextApiResponse } from 'next'

type CorsOptions = {
  methods?: string[]
  allowHeaders?: string[]
  allowCredentials?: boolean
  origins?: string[] | string | '*'
}

function normalizeHeaderValue(value: string | string[] | undefined): string {
  if (!value) {
    return ''
  }
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value
}

function buildAllowedOrigin(origins: CorsOptions['origins'], requestOrigin: string): string {
  if (!origins || origins === '*') {
    return requestOrigin || '*'
  }

  if (Array.isArray(origins)) {
    if (requestOrigin && origins.includes(requestOrigin)) {
      return requestOrigin
    }
    return origins[0] ?? '*'
  }

  if (typeof origins === 'string') {
    if (!origins || origins === '*') {
      return requestOrigin || '*'
    }
    return origins
  }

  return requestOrigin || '*'
}

function mergeAllowedHeaders(defaultHeaders: string[], requestHeadersRaw: string): string[] {
  const headers = new Set<string>()
  for (const header of defaultHeaders) {
    if (header.trim()) {
      headers.add(header.trim())
    }
  }

  for (const part of requestHeadersRaw.split(',')) {
    const trimmed = part.trim()
    if (trimmed) {
      headers.add(trimmed)
    }
  }

  return Array.from(headers)
}

export function applyCors(req: NextApiRequest, res: NextApiResponse, options?: CorsOptions): boolean {
  const requestOrigin = normalizeHeaderValue(req.headers.origin)
  const allowOrigin = buildAllowedOrigin(options?.origins, requestOrigin)
  const requestHeaders = normalizeHeaderValue(req.headers['access-control-request-headers'])
  const requestedMethod = normalizeHeaderValue(req.headers['access-control-request-method'])

  const allowedMethodsSet = new Set<string>([...(options?.methods ?? ['GET', 'POST'])])
  allowedMethodsSet.add('OPTIONS')
  const allowedMethods = Array.from(allowedMethodsSet)

  const defaultAllowedHeaders = options?.allowHeaders ?? ['Authorization', 'Content-Type']
  const allowedHeaders = requestHeaders
    ? mergeAllowedHeaders(defaultAllowedHeaders, requestHeaders)
    : defaultAllowedHeaders

  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(','))
  res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(','))
  res.setHeader('Access-Control-Max-Age', '86400')

  if (options?.allowCredentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  if (req.method === 'OPTIONS') {
    const statusCode = requestedMethod && allowedMethodsSet.has(requestedMethod.toUpperCase()) ? 204 : 405
    res.status(statusCode).end()
    return true
  }

  return false
}
