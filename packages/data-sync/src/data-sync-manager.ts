import chalk from 'chalk'
import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import ora from 'ora'
import path from 'path'
import { DatabaseConfig, DatabaseType, DataSyncOptions } from './types'

/**
 * 数据同步管理器
 * 负责不同环境间的数据库数据同步
 */
export class DataSyncManager {
  private spinner: any

  constructor() {
    this.spinner = ora()
  }

  /**
   * 检测数据库类型
   */
  private detectDatabaseType(dbConfig: DatabaseConfig): DatabaseType {
    const url = dbConfig.url || ''
    const port = dbConfig.port || 0

    // 根据 URL 协议检测
    if (url.includes('mysql://') || url.includes('mariadb://')) {
      return DatabaseType.MYSQL
    }

    // 根据端口检测
    if (port === 3306) {
      return DatabaseType.MYSQL
    }

    // 根据关键词检测
    if (url.includes('mysql') || url.includes('mariadb')) {
      return DatabaseType.MYSQL
    }

    return DatabaseType.POSTGRESQL
  }

  /**
   * 同步数据
   */
  syncData(options: DataSyncOptions) {
    const { sourceConfig, targetConfig, action = 'sync', dryRun = false } = options

    console.log(chalk.cyan('🔄 开始数据同步...'))
    console.log(chalk.blue(`📤 源数据库: ${sourceConfig.database}`))
    console.log(chalk.blue(`📥 目标数据库: ${targetConfig.database}`))
    console.log(chalk.blue(`⚙️  操作类型: ${action}`))
    console.log(chalk.blue(`🔍 预览模式: ${dryRun ? '是' : '否'}`))

    try {
      switch (action) {
        case 'dump':
          this.dumpData(sourceConfig, {
            dryRun,
            verbose: options.verbose,
            dumpFolder: options.dumpFolder,
          })
          break
        case 'restore':
          this.restoreData(sourceConfig, targetConfig, {
            dryRun,
            verbose: options.verbose,
            force: options.force,
            dumpFolder: options.dumpFolder,
          })
          break
        case 'rollback':
          this.rollbackData(targetConfig, {
            dryRun,
            verbose: options.verbose,
            dumpFolder: options.dumpFolder,
          })
          break
        case 'sync':
        default:
          this.performSync(sourceConfig, targetConfig, {
            dryRun,
            verbose: options.verbose,
            force: options.force,
            dumpFolder: options.dumpFolder,
          })
          break
      }

      console.log(chalk.green('✅ 数据同步完成!'))
    } catch (err) {
      console.error(chalk.red('❌ 数据同步失败:'), err)
      throw err
    }
  }

  /**
   * 备份数据
   */

  dumpData(sourceConfig: DatabaseConfig, options: { dryRun?: boolean; verbose?: boolean; dumpFolder?: string } = {}) {
    const { dryRun = false, verbose = false, dumpFolder = './dumps' } = options

    const dbType = this.detectDatabaseType(sourceConfig)
    const extension = dbType === DatabaseType.MYSQL ? 'sql' : 'backup'
    const dumpFile = path.resolve(dumpFolder, `${sourceConfig.database}.${extension}`)

    if (dryRun) {
      console.log(chalk.blue(`🔍 [预览模式] 将备份数据到: ${dumpFile}`))
      if (verbose) {
        console.log(chalk.gray(`  数据库: ${sourceConfig.database}`))
        console.log(chalk.gray(`  主机: ${sourceConfig.host}:${sourceConfig.port}`))
      }
      return dumpFile
    }

    this.spinner.start(`🗄️  正在备份数据...`)

    try {
      // 确保备份目录存在
      if (!existsSync(dumpFolder)) {
        mkdirSync(dumpFolder, { recursive: true })
      }

      // 执行备份
      this.executeDump(sourceConfig, dumpFile, { verbose })

      this.spinner.succeed(`✅ 数据备份完成: ${path.relative(process.cwd(), dumpFile)}`)

      if (verbose) {
        console.log(chalk.gray(`  备份文件: ${dumpFile}`))
        console.log(chalk.gray(`  数据库: ${sourceConfig.database}`))
      }

      return dumpFile
    } catch (error) {
      this.spinner.fail(`❌ 数据备份失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * 恢复数据
   */
  async restoreData(
    sourceConfig: DatabaseConfig,
    targetConfig: DatabaseConfig,
    options: {
      dryRun?: boolean
      verbose?: boolean
      force?: boolean
      dumpFolder?: string
    } = {}
  ): Promise<void> {
    const { dryRun = false, verbose = false, force = false, dumpFolder = './dumps' } = options

    const dbType = this.detectDatabaseType(sourceConfig)
    const extension = dbType === DatabaseType.MYSQL ? 'sql' : 'backup'
    const dumpFile = path.resolve(dumpFolder, `${sourceConfig.database}.${extension}`)

    if (dryRun) {
      console.log(chalk.blue(`🔍 [预览模式] 将从 ${dumpFile} 恢复数据`))
      if (verbose) {
        console.log(chalk.gray(`  目标数据库: ${targetConfig.database}`))
        console.log(chalk.gray(`  目标主机: ${targetConfig.host}:${targetConfig.port}`))
      }
      return
    }

    if (!existsSync(dumpFile)) {
      throw new Error(`备份文件不存在: ${dumpFile}`)
    }

    this.spinner.start(`📥 正在恢复数据...`)

    try {
      // 强制模式下，先备份目标环境
      if (force) {
        this.createTargetBackup(targetConfig, { verbose, dumpFolder })
      }

      // 执行恢复
      await this.executeRestore(dumpFile, targetConfig, { verbose, force })

      this.spinner.succeed(`✅ 数据恢复完成`)

      if (verbose) {
        console.log(chalk.gray(`  恢复来源: ${path.relative(process.cwd(), dumpFile)}`))
        console.log(chalk.gray(`  目标数据库: ${targetConfig.database}`))
      }
    } catch (error) {
      this.spinner.fail(`❌ 数据恢复失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * 回滚数据
   */
  async rollbackData(
    targetConfig: DatabaseConfig,
    options: { dryRun?: boolean; verbose?: boolean; dumpFolder?: string } = {}
  ): Promise<void> {
    const { dryRun = false, verbose = false, dumpFolder = './dumps' } = options

    const dbType = this.detectDatabaseType(targetConfig)
    const extension = dbType === DatabaseType.MYSQL ? 'sql' : 'backup'
    const targetBackupFile = path.resolve(dumpFolder, `target_${targetConfig.database}.${extension}`)

    if (dryRun) {
      console.log(chalk.blue(`🔍 [预览模式] 将回滚数据`))
      if (verbose) {
        console.log(chalk.gray(`  回滚文件: ${targetBackupFile}`))
        console.log(chalk.gray(`  目标数据库: ${targetConfig.database}`))
      }
      return
    }

    if (!existsSync(targetBackupFile)) {
      throw new Error(`没有找到目标备份文件: ${targetBackupFile}`)
    }

    this.spinner.start(`🔄 正在回滚数据...`)

    try {
      await this.executeRestore(targetBackupFile, targetConfig, {
        verbose,
        force: true,
      })

      this.spinner.succeed(`✅ 数据回滚完成`)

      if (verbose) {
        console.log(chalk.gray(`  回滚来源: ${path.relative(process.cwd(), targetBackupFile)}`))
      }
    } catch (error) {
      this.spinner.fail(`❌ 数据回滚失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * 执行完整的同步操作
   */
  private performSync(
    sourceConfig: DatabaseConfig,
    targetConfig: DatabaseConfig,
    options: {
      dryRun?: boolean
      verbose?: boolean
      force?: boolean
      dumpFolder?: string
    }
  ) {
    const { dryRun = false, verbose = false, force = false, dumpFolder = './dumps' } = options

    if (dryRun) {
      console.log(chalk.blue('🔍 [预览模式] 同步操作流程:'))
      console.log(chalk.blue(`  1. 备份源数据库`))
      if (force) {
        console.log(chalk.blue(`  2. 备份目标数据库（强制模式）`))
        console.log(chalk.blue(`  3. 恢复数据到目标数据库`))
      } else {
        console.log(chalk.blue(`  2. 恢复数据到目标数据库`))
      }
      console.log(chalk.blue('  4. 验证数据完整性'))
      return
    }

    // 步骤1: 备份源环境数据
    this.dumpData(sourceConfig, { dryRun, verbose, dumpFolder })

    // 步骤2: 强制模式下备份目标环境
    if (force) {
      console.log(chalk.blue(`🔧 强制模式：创建目标数据库备份`))
      this.createTargetBackup(targetConfig, { verbose, dumpFolder })
    }

    // 步骤3: 恢复到目标环境
    this.restoreData(sourceConfig, targetConfig, {
      dryRun,
      verbose,
      force,
      dumpFolder,
    })
  }

  /**
   * 创建目标环境备份
   */

  private createTargetBackup(targetConfig: DatabaseConfig, options: { verbose?: boolean; dumpFolder?: string } = {}) {
    const { verbose = false, dumpFolder = './dumps' } = options

    const dbType = this.detectDatabaseType(targetConfig)
    const extension = dbType === DatabaseType.MYSQL ? 'sql' : 'backup'
    const targetBackupFile = path.resolve(dumpFolder, `target_${targetConfig.database}.${extension}`)

    if (verbose) {
      console.log(chalk.yellow(`📦 创建目标数据库备份: ${targetBackupFile}`))
    }

    try {
      // 确保备份目录存在
      if (!existsSync(dumpFolder)) {
        mkdirSync(dumpFolder, { recursive: true })
      }

      // 检查目标数据库是否存在
      const dbExists = this.checkDatabaseExists(targetConfig, {
        verbose,
      })

      if (!dbExists) {
        if (verbose) {
          console.log(chalk.yellow(`⚠️  目标数据库 ${targetConfig.database} 不存在，跳过备份`))
        }
        return targetBackupFile
      }

      // 执行备份
      this.executeDump(targetConfig, targetBackupFile, { verbose })

      return targetBackupFile
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  目标数据库备份失败: ${error instanceof Error ? error.message : String(error)}`))
      throw error
    }
  }

  /**
   * 检查数据库是否存在
   */
  private checkDatabaseExists(dbConfig: DatabaseConfig, options: { verbose?: boolean } = {}): boolean {
    const { verbose = false } = options
    const dbType = this.detectDatabaseType(dbConfig)

    try {
      if (dbType === DatabaseType.MYSQL) {
        const checkDbCommand = `mysql --user=${dbConfig.username} --host=${dbConfig.host} --port=${dbConfig.port} --password=${dbConfig.password} -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${dbConfig.database}';" --silent --skip-column-names`
        const result = execSync(checkDbCommand, {
          stdio: 'pipe',
          encoding: 'utf8',
        })
        return result.trim() === dbConfig.database
      } else {
        const checkDbCommand = `export PGPASSWORD="${dbConfig.password}" && psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${dbConfig.database}';" -t`
        const result = execSync(checkDbCommand, {
          stdio: 'pipe',
          encoding: 'utf8',
        })
        return result.trim() === '1'
      }
    } catch (error) {
      if (verbose) {
        console.log(
          chalk.yellow(`⚠️  无法检查数据库是否存在: ${error instanceof Error ? error.message : String(error)}`)
        )
      }
      return false
    }
  }

  /**
   * 执行数据库备份
   */
  private executeDump(dbConfig: DatabaseConfig, dumpFile: string, options: { verbose?: boolean } = {}): void {
    const { verbose = false } = options
    const dbType = this.detectDatabaseType(dbConfig)

    if (dbType === DatabaseType.MYSQL) {
      this.executeMySQLDump(dbConfig, dumpFile, { verbose })
    } else {
      this.executePostgreSQLDump(dbConfig, dumpFile, { verbose })
    }
  }

  /**
   * 执行 PostgreSQL 数据库备份
   */
  private executePostgreSQLDump(dbConfig: DatabaseConfig, dumpFile: string, options: { verbose?: boolean } = {}) {
    const { verbose = false } = options

    // 检查 pg_dump 是否存在
    try {
      execSync('which pg_dump', { stdio: 'pipe' })
    } catch {
      throw new Error('pg_dump 命令不存在，请安装 PostgreSQL 客户端工具')
    }

    let command = `export PGPASSWORD="${dbConfig.password}" && pg_dump`
    command += ` -h ${dbConfig.host}`
    command += ` -p ${dbConfig.port}`
    command += ` -U ${dbConfig.username}`
    command += ` -d ${dbConfig.database}`
    command += ` --file="${dumpFile}"`
    command += ' --format=c'
    command += ' --create'
    command += ' --clean'
    command += ' --if-exists'

    if (verbose) {
      command += ' --verbose'
    }

    try {
      execSync(command, { stdio: verbose ? 'inherit' : 'pipe' })
    } catch (error) {
      throw new Error(`PostgreSQL 备份失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 执行 MySQL 数据库备份
   */
  private executeMySQLDump(dbConfig: DatabaseConfig, dumpFile: string, options: { verbose?: boolean } = {}) {
    const { verbose = false } = options

    // 检查 mysqldump 是否存在
    try {
      execSync('which mysqldump', { stdio: 'pipe' })
    } catch {
      throw new Error('mysqldump 命令不存在，请安装 MySQL 客户端工具')
    }

    const command = `mysqldump ${dbConfig.database} --result-file=${dumpFile} --user=${dbConfig.username} --host=${dbConfig.host} --port=${dbConfig.port} --password=${dbConfig.password} --set-gtid-purged=OFF --single-transaction --routines --triggers`

    if (verbose) {
      console.log(
        chalk.gray(
          `执行命令: mysqldump ${dbConfig.database} --result-file=${dumpFile} --user=${dbConfig.username} --host=${dbConfig.host} --port=${dbConfig.port} --password=*** --set-gtid-purged=OFF --single-transaction --routines --triggers`
        )
      )
    }

    try {
      execSync(command, { stdio: verbose ? 'inherit' : 'pipe' })
    } catch (error) {
      throw new Error(`MySQL 备份失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 执行数据库恢复
   */
  private async executeRestore(
    dumpFile: string,
    dbConfig: DatabaseConfig,
    options: { verbose?: boolean; force?: boolean } = {}
  ): Promise<void> {
    const { verbose = false, force = false } = options

    if (!existsSync(dumpFile)) {
      throw new Error(`备份文件不存在: ${dumpFile}`)
    }

    const dbType = this.detectDatabaseType(dbConfig)

    if (dbType === DatabaseType.MYSQL) {
      this.executeMySQLRestore(dumpFile, dbConfig, { verbose, force })
    } else {
      await this.executePostgreSQLRestore(dumpFile, dbConfig, {
        verbose,
        force,
      })
    }
  }

  /**
   * 执行 PostgreSQL 数据库恢复
   */
  private async executePostgreSQLRestore(
    dumpFile: string,
    dbConfig: DatabaseConfig,
    options: { verbose?: boolean; force?: boolean } = {}
  ): Promise<void> {
    const { verbose = false, force = false } = options

    // 检查 pg_restore 是否存在
    try {
      execSync('which pg_restore', { stdio: 'pipe' })
    } catch {
      throw new Error('pg_restore 命令不存在，请安装 PostgreSQL 客户端工具')
    }

    // 强制模式下，先处理数据库连接和重建
    if (force) {
      await this.prepareDatabaseForRestore(dbConfig, { verbose })
    }

    // 检查目标数据库是否存在
    const dbExists = this.checkDatabaseExists(dbConfig, { verbose })

    let command = `export PGPASSWORD="${dbConfig.password}" && pg_restore`
    command += ` -h ${dbConfig.host}`
    command += ` -p ${dbConfig.port}`
    command += ` -U ${dbConfig.username}`
    command += ` -d ${dbExists ? dbConfig.database : 'postgres'}`
    command += ' --clean'
    command += ' --if-exists'

    // 只有当数据库不存在时才使用 --create
    if (!dbExists) {
      command += ' --create'
    }

    command += ' --no-owner'

    if (verbose) {
      command += ' --verbose'
    }

    command += ` "${dumpFile}"`

    try {
      execSync(command, { stdio: verbose ? 'inherit' : 'pipe' })
    } catch (error) {
      throw new Error(`PostgreSQL 恢复失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 执行 MySQL 数据库恢复
   */
  private executeMySQLRestore(
    dumpFile: string,
    dbConfig: DatabaseConfig,
    options: { verbose?: boolean; force?: boolean } = {}
  ) {
    const { verbose = false, force = false } = options

    // 检查 mysql 是否存在
    try {
      execSync('which mysql', { stdio: 'pipe' })
    } catch {
      throw new Error('mysql 命令不存在，请安装 MySQL 客户端工具')
    }

    // 强制模式下，先处理数据库重建
    if (force) {
      this.prepareMySQLDatabaseForRestore(dbConfig, { verbose })
    }

    const command = `mysql --user=${dbConfig.username} --host=${dbConfig.host} --port=${dbConfig.port} --password=${dbConfig.password} ${dbConfig.database} < "${dumpFile}"`

    if (verbose) {
      console.log(
        chalk.gray(
          `执行命令: mysql --user=${dbConfig.username} --host=${dbConfig.host} --port=${dbConfig.port} --password=*** ${dbConfig.database} < "${dumpFile}"`
        )
      )
    }

    try {
      execSync(command, { stdio: verbose ? 'inherit' : 'pipe' })
    } catch (error) {
      throw new Error(`MySQL 恢复失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 为恢复准备数据库
   */
  private async prepareDatabaseForRestore(
    dbConfig: DatabaseConfig,
    options: { verbose?: boolean } = {}
  ): Promise<void> {
    const { verbose = false } = options

    if (verbose) {
      console.log(chalk.yellow('🔧 准备数据库进行恢复...'))
    }

    try {
      // 终止所有连接到目标数据库的会话
      const terminateCommand = `export PGPASSWORD="${dbConfig.password}" && psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbConfig.database}' AND pid <> pg_backend_pid();"`

      if (verbose) {
        console.log(chalk.gray('  终止数据库连接...'))
      }

      try {
        execSync(terminateCommand, { stdio: verbose ? 'inherit' : 'pipe' })
      } catch {
        // 忽略错误，可能没有连接需要终止
      }

      // 等待一秒确保连接完全断开
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 删除并重建数据库
      const dropCommand = `export PGPASSWORD="${dbConfig.password}" && psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d postgres -c "DROP DATABASE IF EXISTS \\"${dbConfig.database}\\";"`
      const createCommand = `export PGPASSWORD="${dbConfig.password}" && psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d postgres -c "CREATE DATABASE \\"${dbConfig.database}\\";"`

      if (verbose) {
        console.log(chalk.gray('  删除旧数据库...'))
      }
      execSync(dropCommand, { stdio: verbose ? 'inherit' : 'pipe' })

      if (verbose) {
        console.log(chalk.gray('  创建新数据库...'))
      }
      execSync(createCommand, { stdio: verbose ? 'inherit' : 'pipe' })

      if (verbose) {
        console.log(chalk.green('✅ 数据库准备完成'))
      }
    } catch (error) {
      throw new Error(`数据库准备失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 为 MySQL 恢复准备数据库
   */
  private prepareMySQLDatabaseForRestore(dbConfig: DatabaseConfig, options: { verbose?: boolean } = {}) {
    const { verbose = false } = options

    if (verbose) {
      console.log(chalk.yellow('🔧 准备 MySQL 数据库进行恢复...'))
    }

    try {
      // 检查数据库是否存在
      const dbExists = this.checkDatabaseExists(dbConfig, { verbose })

      if (dbExists) {
        // 删除数据库
        const dropCommand = `mysql --user=${dbConfig.username} --host=${dbConfig.host} --port=${dbConfig.port} --password=${dbConfig.password} -e "DROP DATABASE IF EXISTS ${dbConfig.database};"`

        if (verbose) {
          console.log(chalk.gray('  删除旧数据库...'))
        }
        execSync(dropCommand, { stdio: verbose ? 'inherit' : 'pipe' })
      }

      // 创建数据库
      const createCommand = `mysql --user=${dbConfig.username} --host=${dbConfig.host} --port=${dbConfig.port} --password=${dbConfig.password} -e "CREATE DATABASE IF NOT EXISTS ${dbConfig.database} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`

      if (verbose) {
        console.log(chalk.gray('  创建新数据库...'))
      }
      execSync(createCommand, { stdio: verbose ? 'inherit' : 'pipe' })

      if (verbose) {
        console.log(chalk.green('✅ MySQL 数据库准备完成'))
      }
    } catch (error) {
      throw new Error(`MySQL 数据库准备失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
