import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common'
import { WINSTON_MODULE_PROVIDER } from 'nest-winston'
import { ClsService } from 'nestjs-cls'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { Logger } from 'winston'
import { getTracingOptions } from './tracing.options'

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken']

/**
 * 链路追踪拦截器
 *
 * 1. 自动记录请求开始/结束日志
 * 2. 计算请求耗时
 * 3. 日志中自动包含 traceId（依赖 winston-trace.format）
 * 4. 从 req.user 提取用户信息写入 CLS
 * 5. 捕获异常并记录
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()

    const user = request.user
    if (user) {
      if (user.id !== undefined) this.cls.set('userId', user.id)
      if (user.name !== undefined) this.cls.set('userName', user.name)
      if (user.phone !== undefined) this.cls.set('userPhone', user.phone)
    }

    const options = getTracingOptions()
    const startTime = Date.now()

    const logData: Record<string, unknown> = {
      type: 'http_request',
      path: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    }

    if (options.logRequestBody && request.body) {
      logData.body = this.sanitizeBody(request.body)
    }

    this.logger.info('HTTP Request', logData)

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.info('HTTP Response', {
            type: 'http_response',
            path: request.url,
            method: request.method,
            statusCode: response.statusCode,
            duration: `${Date.now() - startTime}ms`,
          })
        },
        error: error => {
          this.logger.error('HTTP Error', {
            type: 'http_error',
            path: request.url,
            method: request.method,
            duration: `${Date.now() - startTime}ms`,
            error: error.message,
            stack: error.stack,
            statusCode: error.status || 500,
          })
        },
      })
    )
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body
    }
    const sanitized = { ...body }
    for (const field of SENSITIVE_FIELDS) {
      if (field in sanitized) {
        sanitized[field] = '***'
      }
    }
    return sanitized
  }
}
