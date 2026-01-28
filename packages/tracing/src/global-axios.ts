import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios'
import { ClsServiceManager } from 'nestjs-cls'

/**
 * 创建一个增强的 axios 实例，自动包含 traceId
 *
 * 特点：
 * 1. 可以在任何地方使用，不需要依赖注入
 * 2. 自动为所有请求添加 traceId
 * 3. 支持函数式调用（基于 nestjs-cls）
 *
 * @example
 * ```typescript
 * // 在工具函数中使用
 * import { createTracedAxios } from '@dinglan/nestjs-tracing';
 *
 * const axios = createTracedAxios();
 *
 * export async function fetchUser(userId: string) {
 *   // 自动包含 traceId
 *   const response = await axios.get(`/api/users/${userId}`);
 *   return response.data;
 * }
 * ```
 */
export function createTracedAxios(config?: CreateAxiosDefaults): AxiosInstance {
  const instance = axios.create(config)

  // 请求拦截器：自动添加 traceId
  instance.interceptors.request.use(
    (config) => {
      // 使用 ClsServiceManager 获取当前上下文
      const cls = ClsServiceManager.getClsService()
      const traceId = cls?.getId()

      if (traceId) {
        // 获取配置的 header 名称
        const options = cls?.get('_tracing_options') || {
          outgoingHeaders: ['x-request-id', 'req_id'],
        }

        // 添加 traceId 到请求头
        config.headers = config.headers || {}
        for (const headerName of options.outgoingHeaders) {
          config.headers[headerName] = traceId
        }
      }

      return config
    },
    (error) => Promise.reject(error),
  )

  return instance
}
