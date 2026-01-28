import { v4 as uuidv4 } from 'uuid'

/**
 * 链路追踪配置选项
 */
export interface TracingOptions {
  /** 自定义 traceId 生成函数 */
  idGenerator: (req: any) => string

  /** 是否记录请求体（默认 false，避免日志过多） */
  logRequestBody: boolean

  /** 入站请求的 header 名称（支持多个，按优先级） */
  incomingHeaders: string[]

  /** 出站请求的 header 名称 */
  outgoingHeaders: string[]

  /** HTTP 请求超时时间（毫秒） */
  httpTimeout?: number
}

/**
 * 默认配置
 */
export const DEFAULT_TRACING_OPTIONS: TracingOptions = {
  logRequestBody: false,
  incomingHeaders: ['req_id', 'x-request-id', 'traceparent'],
  outgoingHeaders: ['x-request-id', 'req_id'],
  httpTimeout: 30000,
  idGenerator: (req: any) => {
    const headers = req.headers
    // 按优先级提取 traceId
    for (const headerName of DEFAULT_TRACING_OPTIONS.incomingHeaders) {
      const value = headers[headerName]
      if (typeof value === 'string' && value) {
        return value
      }
    }
    // 生成新的 UUID（去掉短横线）
    return uuidv4().replace(/-/g, '')
  },
}
