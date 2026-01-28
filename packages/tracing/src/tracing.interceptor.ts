import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common'
import { WINSTON_MODULE_PROVIDER } from 'nest-winston'
import { ClsService } from 'nestjs-cls'
import { Observable } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { Logger } from 'winston'

/**
 * 链路追踪拦截器
 *
 * 功能：
 * 1. 自动记录请求开始和结束日志
 * 2. 自动计算请求耗时
 * 3. 自动在日志中包含 traceId
 * 4. 自动记录用户信息（如果已认证）
 * 5. 自动捕获异常
 *
 * 完全无侵入，不需要在业务代码中做任何修改
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()

    // 提取用户信息（如果存在）
    if (request.user) {
      this.cls.set('userId', request.user.id)
      this.cls.set('userName', request.user.name)
      this.cls.set('userPhone', request.user.phone)
    }

    // 获取配置选项
    const options = this.cls.get('_tracing_options') || {}
    const startTime = Date.now()

    // 记录请求开始日志
    const logData: any = {
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
          // 请求成功
          const duration = Date.now() - startTime
          this.logger.info('HTTP Response', {
            type: 'http_response',
            path: request.url,
            method: request.method,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
          })
        },
      }),
      catchError((error) => {
        // 请求失败
        const duration = Date.now() - startTime
        this.logger.error('HTTP Error', {
          type: 'http_error',
          path: request.url,
          method: request.method,
          duration: `${duration}ms`,
          error: error.message,
          stack: error.stack,
          statusCode: error.status || 500,
        })
        throw error
      }),
    )
  }

  /**
   * 清理敏感信息
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body
    }

    const sanitized = { ...body }
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken']

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***'
      }
    }

    return sanitized
  }
}
