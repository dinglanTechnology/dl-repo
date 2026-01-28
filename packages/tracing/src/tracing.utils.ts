import { ClsServiceManager } from 'nestjs-cls'

/**
 * 链路追踪工具函数
 *
 * 提供简单的 API 用于获取追踪信息
 * 在 99% 的场景下，你不需要使用这些函数
 * 因为 traceId 会自动包含在所有日志中
 */

/**
 * 获取当前请求的 traceId
 *
 * @example
 * ```typescript
 * import { getTraceId } from '@dinglan/nestjs-tracing';
 *
 * const traceId = getTraceId();
 * console.log('当前请求 traceId:', traceId);
 * ```
 */
export function getTraceId(): string | undefined {
  const cls = ClsServiceManager.getClsService()
  return cls?.getId()
}

/**
 * 获取当前请求的用户 ID
 */
export function getUserId(): string | undefined {
  const cls = ClsServiceManager.getClsService()
  return cls?.get('userId')
}

/**
 * 获取当前请求的用户名
 */
export function getUserName(): string | undefined {
  const cls = ClsServiceManager.getClsService()
  return cls?.get('userName')
}

/**
 * 获取请求上下文中的值
 */
export function getContextValue<T = any>(key: string): T | undefined {
  const cls = ClsServiceManager.getClsService()
  return cls?.get(key)
}

/**
 * 设置请求上下文中的值
 */
export function setContextValue<T = any>(key: string, value: T): void {
  const cls = ClsServiceManager.getClsService()
  cls?.set(key, value)
}

/**
 * 获取完整的请求上下文信息
 */
export function getRequestContext() {
  const cls = ClsServiceManager.getClsService()
  if (!cls) return undefined

  const startTime = cls.get('startTime')
  return {
    traceId: cls.getId(),
    userId: cls.get('userId'),
    userName: cls.get('userName'),
    userPhone: cls.get('userPhone'),
    method: cls.get('method'),
    url: cls.get('url'),
    startTime,
    duration: startTime ? Date.now() - startTime : undefined,
  }
}
