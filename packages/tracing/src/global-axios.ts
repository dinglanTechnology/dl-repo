import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios'
import { ClsServiceManager } from 'nestjs-cls'
import { applyTraceHeaders, getTracingOptions } from './tracing.options'

/**
 * 创建一个增强的 axios 实例，自动包含 traceId
 *
 * 1. 可以在任何地方使用，不需要依赖注入
 * 2. 自动为所有请求添加 traceId
 * 3. 基于 nestjs-cls 的隐式上下文
 *
 * @example
 * ```typescript
 * import { createTracedAxios } from '@dinglanTechnology/tracing';
 *
 * const http = createTracedAxios();
 *
 * export async function fetchUser(userId: string) {
 *   const response = await http.get(`/api/users/${userId}`);
 *   return response.data;
 * }
 * ```
 */
export function createTracedAxios(config?: CreateAxiosDefaults): AxiosInstance {
  const instance = axios.create(config)

  instance.interceptors.request.use(
    config => {
      const traceId = ClsServiceManager.getClsService()?.getId()

      if (traceId) {
        const { outgoingHeaders } = getTracingOptions()
        config.headers = config.headers || {}
        applyTraceHeaders(
          (name, value) => {
            ;(config.headers as Record<string, string>)[name] = value
          },
          traceId,
          outgoingHeaders
        )
      }

      return config
    },
    error => Promise.reject(error instanceof Error ? error : new Error(String(error)))
  )

  return instance
}
