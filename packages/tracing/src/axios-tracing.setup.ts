import { HttpService } from '@nestjs/axios'
import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { WINSTON_MODULE_PROVIDER } from 'nest-winston'
import { ClsService } from 'nestjs-cls'
import { Logger } from 'winston'
import { applyTraceHeaders, getTracingOptions } from './tracing.options'

/**
 * Axios 链路追踪设置
 *
 * 1. 自动为所有出站 HTTP 请求添加 traceId
 * 2. 自动记录出站请求/响应日志
 * 3. 自动记录请求耗时
 */
@Injectable()
export class AxiosTracingSetup implements OnModuleInit {
  // 用 WeakMap 持有起始时间，避免在 axios config 上挂私有字段
  private readonly startTimes = new WeakMap<object, number>()

  constructor(
    private readonly httpService: HttpService,
    private readonly cls: ClsService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  onModuleInit() {
    this.setupRequestInterceptor()
    this.setupResponseInterceptor()
  }

  private setupRequestInterceptor() {
    this.httpService.axiosRef.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const traceId = this.cls.getId()

        if (traceId) {
          const { outgoingHeaders } = getTracingOptions()
          applyTraceHeaders((name, value) => config.headers.set(name, value), traceId, outgoingHeaders)
        }

        this.logger.debug('Outbound HTTP Request', {
          type: 'http_outbound_request',
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          timeout: config.timeout,
        })

        this.startTimes.set(config, Date.now())
        return config
      },
      error => {
        this.logger.error('Outbound HTTP Request Error', {
          type: 'http_outbound_request_error',
          error: error.message,
        })
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
    )
  }

  private setupResponseInterceptor() {
    this.httpService.axiosRef.interceptors.response.use(
      (response: AxiosResponse) => {
        const duration = this.durationFor(response.config)

        this.logger.debug('Outbound HTTP Response', {
          type: 'http_outbound_response',
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          statusCode: response.status,
          duration,
        })

        return response
      },
      (error: AxiosError) => {
        const duration = error.config ? this.durationFor(error.config) : undefined

        this.logger.error('Outbound HTTP Error', {
          type: 'http_outbound_error',
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          statusCode: error.response?.status,
          duration,
          error: error.message,
        })

        return Promise.reject(error)
      }
    )
  }

  private durationFor(config: object): string | undefined {
    const start = this.startTimes.get(config)
    return start ? `${Date.now() - start}ms` : undefined
  }
}
