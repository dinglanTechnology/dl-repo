import { randomUUID } from 'crypto'

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
 * 构造默认 idGenerator——闭包绑定 incomingHeaders，
 * 使用户覆盖 incomingHeaders 时仍按预期工作。
 */
export function createDefaultIdGenerator(incomingHeaders: string[]) {
  return (req: any): string => {
    const headers = req?.headers ?? {}
    for (const headerName of incomingHeaders) {
      const value = headers[headerName]
      if (typeof value === 'string' && value) {
        return value
      }
    }
    return randomUUID().replace(/-/g, '')
  }
}

/**
 * 默认配置
 */
export const DEFAULT_TRACING_OPTIONS: TracingOptions = {
  logRequestBody: false,
  incomingHeaders: ['req_id', 'x-request-id', 'traceparent'],
  outgoingHeaders: ['x-request-id', 'req_id'],
  httpTimeout: 30000,
  idGenerator: createDefaultIdGenerator(['req_id', 'x-request-id', 'traceparent']),
}

/**
 * 模块级 options 注册表：
 * TracingModule.forRoot() 调用时写入，
 * 其它模块（拦截器、axios setup、global-axios）按需读取。
 *
 * 避免把静态配置塞进 CLS 反复读写。
 */
let activeOptions: TracingOptions = DEFAULT_TRACING_OPTIONS

export function setTracingOptions(options: TracingOptions): void {
  activeOptions = options
}

export function getTracingOptions(): TracingOptions {
  return activeOptions
}

/**
 * 将 traceId 写入 outgoingHeaders 列出的所有 header 名上。
 * setter 抽象同时兼容 axios v1 的 AxiosHeaders 与普通对象。
 */
export function applyTraceHeaders(
  setter: (name: string, value: string) => void,
  traceId: string,
  outgoingHeaders: string[]
): void {
  for (const headerName of outgoingHeaders) {
    setter(headerName, traceId)
  }
}
