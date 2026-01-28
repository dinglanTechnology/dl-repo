import { ClsServiceManager } from 'nestjs-cls'
import * as winston from 'winston'

/**
 * Winston 自定义格式化器
 * 自动添加 traceId 到每条日志
 * 使用 CLS（Continuation Local Storage）实现链路追踪
 *
 * @example
 * ```typescript
 * import { WinstonModule } from 'nest-winston';
 * import { createTraceFormat } from '@dinglanTechnology/tracing';
 *
 * WinstonModule.forRoot({
 *   transports: [
 *     new winston.transports.Console({
 *       format: winston.format.combine(
 *         winston.format.timestamp(),
 *         createTraceFormat(), // ✨ 添加这一行
 *         winston.format.json(),
 *       ),
 *     }),
 *   ],
 * });
 * ```
 */
export const createTraceFormat = () => {
  return winston.format((info: any) => {
    // 使用 ClsServiceManager 获取当前 CLS 上下文
    const cls = ClsServiceManager.getClsService()

    if (cls) {
      // 添加 traceId 到日志（CLS ID 就是我们的 traceId）
      const traceId = cls.getId()
      if (traceId) {
        info.traceId = traceId
      }

      // 添加请求相关信息
      const method = cls.get('method')
      const url = cls.get('url')
      if (method) info.method = method
      if (url) info.url = url

      // 添加用户信息
      const userId = cls.get('userId')
      const userName = cls.get('userName')
      const userPhone = cls.get('userPhone')
      if (userId) info.userId = userId
      if (userName) info.userName = userName
      if (userPhone) info.userPhone = userPhone
    }

    return info
  })()
}
