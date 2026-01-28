import { HttpService } from '@nestjs/axios'
import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { WINSTON_MODULE_PROVIDER } from 'nest-winston'
import { ClsService } from 'nestjs-cls'
import { Logger } from 'winston'

/**
 * Axios 链路追踪设置
 
 * 功能：
 * 1. 自动为所有出站 HTTP 请求添加 traceId
 * 2. 自动记录出站请求日志
 * 3. 自动记录请求耗时
 * 4. 自动捕获请求错误
 * 
 * 完全自动化，不需要在业务代码中做任何修改
 */
@Injectable()
export class AxiosTracingSetup implements OnModuleInit {
  constructor(
    private readonly httpService: HttpService,
    private readonly cls: ClsService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  onModuleInit() {
    this.setupRequestInterceptor()
    this.setupResponseInterceptor()
  }

  /**
   * 设置请求拦截器：自动添加 traceId 和记录日志
   */
  private setupRequestInterceptor() {
    this.httpService.axiosRef.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // 获取当前请求的 traceId
        const traceId = this.cls.getId()

        if (traceId) {
          // 自动添加 traceId 到请求头
          const options = this.cls.get('_tracing_options') || {
            outgoingHeaders: ['x-request-id', 'req_id'],
          }

          for (const headerName of options.outgoingHeaders) {
            config.headers.set(headerName, traceId)
          }
        }

        // 记录出站请求日志
        this.logger.debug('Outbound HTTP Request', {
          type: 'http_outbound_request',
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          timeout: config.timeout,
        })

        // 在 config 中保存开始时间，用于计算耗时
        ;(config as any)._startTime = Date.now()

        return config
      },
      (error) => {
        this.logger.error('Outbound HTTP Request Error', {
          type: 'http_outbound_request_error',
          error: error.message,
        })
        return Promise.reject(error)
      },
    )
  }

  /**
   * 设置响应拦截器：记录响应日志和耗时
   */
  private setupResponseInterceptor() {
    this.httpService.axiosRef.interceptors.response.use(
      (response: AxiosResponse) => {
        // 计算请求耗时
        const startTime = (response.config as any)._startTime
        const duration = startTime ? Date.now() - startTime : undefined

        // 记录响应日志
        this.logger.debug('Outbound HTTP Response', {
          type: 'http_outbound_response',
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          statusCode: response.status,
          duration: duration ? `${duration}ms` : undefined,
        })

        return response
      },
      (error: AxiosError) => {
        // 计算请求耗时
        const startTime = (error.config as any)?._startTime
        const duration = startTime ? Date.now() - startTime : undefined

        // 记录错误日志
        this.logger.error('Outbound HTTP Error', {
          type: 'http_outbound_error',
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          statusCode: error.response?.status,
          duration: duration ? `${duration}ms` : undefined,
          error: error.message,
        })

        return Promise.reject(error)
      },
    )
  }
}
