/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  url: string
  host: string
  port: number
  username: string
  password: string
  database: string
}

/**
 * 数据同步选项接口
 */
export interface DataSyncOptions {
  sourceConfig: DatabaseConfig
  targetConfig: DatabaseConfig
  action?: 'dump' | 'restore' | 'sync' | 'rollback'
  dryRun?: boolean
  verbose?: boolean
  skipTables?: string[]
  onlyTables?: string[]
  backup?: boolean
  force?: boolean
  dumpFolder?: string
}

/**
 * 数据库类型枚举
 */
export enum DatabaseType {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
}

/**
 * 解析数据库 URL 的工具函数
 */
export function parseDatabaseUrl(url: string): DatabaseConfig {
  try {
    const urlObj = new URL(url)

    // 根据协议确定默认端口
    let defaultPort = '5432' // PostgreSQL 默认端口
    if (urlObj.protocol === 'mysql:' || urlObj.protocol === 'mariadb:') {
      defaultPort = '3306' // MySQL 默认端口
    }

    return {
      url,
      host: urlObj.hostname,
      port: parseInt(urlObj.port || defaultPort),
      username: urlObj.username,
      password: urlObj.password,
      database: urlObj.pathname.slice(1), // 移除开头的 '/'
    }
  } catch (error: any) {
    throw new Error(`无效的数据库 URL: ${url} ${error.message}`)
  }
}
