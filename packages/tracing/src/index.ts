/**
 * @dinglan/nestjs-tracing
 *
 * 零配置、无侵入的 NestJS 链路追踪模块
 * 一键接入分布式链路追踪
 *
 * @example
 * ```typescript
 * import { TracingModule } from '@dinglan/nestjs-tracing';
 *
 * @Module({
 *   imports: [
 *     TracingModule.forRoot(), // 就这一行！
 *   ]
 * })
 * export class AppModule {}
 * ```
 */

export { TracingModule } from './tracing.module'
export { DEFAULT_TRACING_OPTIONS } from './tracing.options'
export type { TracingOptions } from './tracing.options'
export {
  getContextValue,
  getRequestContext,
  getTraceId,
  getUserId,
  getUserName,
  setContextValue,
} from './tracing.utils'

// ✨ 核心功能：Winston 格式化器（自动添加 traceId）
export { createTraceFormat } from './winston-trace.format'

// 全局 Axios 工具（支持在 class 外部使用）
export { createTracedAxios } from './global-axios'
