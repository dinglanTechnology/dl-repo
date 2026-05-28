import { HttpModule } from '@nestjs/axios'
import { DynamicModule, Global, Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ClsModule } from 'nestjs-cls'
import { AxiosTracingSetup } from './axios-tracing.setup'
import { TracingInterceptor } from './tracing.interceptor'
import { DEFAULT_TRACING_OPTIONS, TracingOptions, createDefaultIdGenerator, setTracingOptions } from './tracing.options'

/**
 * 无侵入式链路追踪模块
 *
 * 功能：
 * 1. 自动为每个请求生成/提取 traceId
 * 2. 自动为所有出站 HTTP 请求添加 traceId
 * 3. 自动在所有日志中包含 traceId
 * 4. 自动记录请求耗时
 * 5. 支持从 nginx ingress 传入 traceId
 *
 * @example
 * ```typescript
 * import { TracingModule } from '@dinglanTechnology/tracing';
 *
 * @Module({
 *   imports: [TracingModule.forRoot()],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class TracingModule {
  static forRoot(options?: Partial<TracingOptions>): DynamicModule {
    const mergedOptions: TracingOptions = {
      ...DEFAULT_TRACING_OPTIONS,
      ...options,
    }

    // 若用户覆盖了 incomingHeaders 但未提供 idGenerator，
    // 需要重建默认 generator 以读取新的 header 列表。
    if (!options?.idGenerator && options?.incomingHeaders) {
      mergedOptions.idGenerator = createDefaultIdGenerator(mergedOptions.incomingHeaders)
    }

    setTracingOptions(mergedOptions)

    return {
      module: TracingModule,
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            generateId: true,
            idGenerator: mergedOptions.idGenerator,
            setup: (cls, req, res) => {
              const traceId = cls.getId()
              res.setHeader('x-request-id', traceId)
              cls.set('method', req.method)
              cls.set('url', req.originalUrl || req.url)
              cls.set('startTime', Date.now())
            },
          },
        }),
        HttpModule.registerAsync({
          useFactory: () => ({
            timeout: mergedOptions.httpTimeout ?? 60000,
          }),
        }),
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: TracingInterceptor,
        },
        AxiosTracingSetup,
      ],
      exports: [ClsModule],
    }
  }
}
