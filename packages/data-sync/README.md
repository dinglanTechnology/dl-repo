# @dinglanTechnology/data-sync

数据库数据同步工具包，支持 PostgreSQL 和 MySQL。

## Installation

```bash
npm install @dinglanTechnology/data-sync
```

## Usage

```typescript
import { DataSyncManager, parseDatabaseUrl } from '@dinglanTechnology/data-sync'

const syncManager = new DataSyncManager()

// 使用数据库 URL
const sourceConfig = parseDatabaseUrl('postgresql://user:pass@host:5432/dbname')
const targetConfig = parseDatabaseUrl('postgresql://user:pass@host:5432/dbname')

await syncManager.syncData({
  sourceConfig,
  targetConfig,
  action: 'sync',
  dumpFolder: './dumps',
})
```

## API

### DataSyncManager

#### syncData(options: DataSyncOptions)

同步数据，支持 `dump`、`restore`、`sync` 操作。`restore` 时必须传 `restoreDumpFile`（dump 文件路径）。

#### dumpData(sourceConfig: DatabaseConfig, options?)

备份数据库数据。

#### restoreData(targetConfig: DatabaseConfig, dumpFile: string, options?)

恢复数据库数据，必须传入 dump 文件路径。

### parseDatabaseUrl(url: string)

解析数据库 URL 字符串为 DatabaseConfig 对象。
