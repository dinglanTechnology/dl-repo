import { HttpModule } from '@nestjs/axios'
import { DynamicModule, Global, Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ClsModule } from 'nestjs-cls'
import { AxiosTracingSetup } from './axios-tracing.setup'
import { TracingInterceptor } from './tracing.interceptor'
import { DEFAULT_TRACING_OPTIONS, TracingOptions } from './tracing.options'

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
 * 使用方式：
 * 只需在 AppModule 中导入即可，无需在业务代码中做任何修改
 *
 * @example
 * ```typescript
 * import { TracingModule } from '@dinglan/nestjs-tracing';
 *
 * @Module({
 *   imports: [
 *     TracingModule.forRoot(),
 *     // ... 其他模块
 *   ]
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

    return {
      module: TracingModule,
      imports: [
        // CLS 模块配置
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            generateId: true,
            idGenerator: mergedOptions.idGenerator,
            setup: (cls, req, res) => {
              const traceId = cls.getId()
              // 设置响应头
              res.setHeader('x-request-id', traceId)
              // 设置请求上下文
              cls.set('method', req.method)
              cls.set('url', req.originalUrl || req.url)
              cls.set('startTime', Date.now())
              cls.set('_tracing_options', mergedOptions)
            },
          },
        }),
        // HttpModule 配置
        HttpModule.registerAsync({
          useFactory: () => ({
            timeout: mergedOptions.httpTimeout || 60000,
          }),
        }),
      ],
      providers: [
        // 全局拦截器：自动记录请求日志
        {
          provide: APP_INTERCEPTOR,
          useClass: TracingInterceptor,
        },
        // Axios 拦截器设置：自动传播 traceId
        AxiosTracingSetup,
      ],
      exports: [ClsModule],
    }
  }
}
