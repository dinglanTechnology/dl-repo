# @dinglanTechnology/tracing

零配置、无侵入的 NestJS 链路追踪模块。

## Installation

```bash
npm install @dinglanTechnology/tracing nest-winston winston
```

## Usage

### 基本使用

```typescript
import { TracingModule } from '@dinglanTechnology/tracing'
import { WinstonModule } from 'nest-winston'
import * as winston from 'winston'

@Module({
  imports: [
    // 配置 winston（必须）
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
      ],
    }),
    // 导入追踪模块
    TracingModule.forRoot(),
  ],
})
export class AppModule {}
```

### 使用自定义 winston 格式化器（添加 traceId）

```typescript
import { TracingModule, createTraceFormat } from '@dinglanTechnology/tracing'
import { WinstonModule } from 'nest-winston'
import * as winston from 'winston'

@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            createTraceFormat(), // ✨ 自动添加 traceId
            winston.format.json()
          ),
        }),
      ],
    }),
    TracingModule.forRoot(),
  ],
})
export class AppModule {}
```

## 重要说明

### Winston 配置

**tracing 包会使用项目中配置的 winston logger**：

- 通过 `@Inject(WINSTON_MODULE_PROVIDER)` 注入项目中配置的 logger
- **会使用项目的 winston 配置**（格式、传输方式、日志级别等）
- 所有日志都会通过项目配置的 winston 实例输出
- 如果使用 `createTraceFormat()`，会自动在日志中添加 traceId

### 日志输出

所有日志都会使用项目中配置的 winston 样式输出，包括：

- 请求日志（HTTP Request/Response）
- 错误日志（HTTP Error）
- 出站请求日志（Outbound HTTP Request/Response）

## API

### TracingModule.forRoot(options?)

配置链路追踪模块。

### createTraceFormat()

创建 winston 格式化器，自动在日志中添加 traceId。

### getTraceId()

获取当前请求的 traceId。
