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
   * 将可手动执行的命令输出到终端，方便用户复制使用
   */
  private logManualCommands(context: {
    type: 'dump' | 'restore'
    dbConfig: DatabaseConfig
    dumpFile?: string
    dumpFileName?: string
  }) {
    const c = context.dbConfig
    const dbType = this.detectDatabaseType(c)
    const pwd = '***' // 不输出真实密码

    console.log(chalk.yellow('\n--- 可手动执行以下命令 ---'))
    if (context.type === 'dump') {
      const outFile = context.dumpFileName ?? `${c.database}.dump`
      if (dbType === DatabaseType.POSTGRESQL) {
        console.log(
          chalk.gray(
            `# PostgreSQL 备份\nexport PGPASSWORD="${pwd}" && pg_dump -h ${c.host} -p ${c.port} -U ${c.username} -Fc -f ${outFile} ${c.database}`
          )
        )
      } else {
        console.log(
          chalk.gray(
            `# MySQL 备份\nmysqldump ${c.database} --result-file=${outFile} --user=${c.username} --host=${c.host} --port=${c.port} --password=${pwd} --set-gtid-purged=OFF --single-transaction --routines --triggers`
          )
        )
      }
    } else {
      const dumpFile = context.dumpFile!
      if (dbType === DatabaseType.POSTGRESQL) {
        console.log(
          chalk.gray(
            `# PostgreSQL 恢复\nexport PGPASSWORD="${pwd}" && pg_restore -h ${c.host} -p ${c.port} -U ${c.username} -d ${c.database} --clean --if-exists --no-owner "${dumpFile}"`
          )
        )
        console.log(chalk.gray('# 如需强制删除并重建数据库后恢复，可依次执行：'))
        console.log(
          chalk.gray(
            `# 1. 终止连接\nexport PGPASSWORD="${pwd}" && psql -h ${c.host} -p ${c.port} -U ${c.username} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${c.database}' AND pid <> pg_backend_pid();"`
          )
        )
        console.log(
          chalk.gray(
            `# 2. 删除数据库\nexport PGPASSWORD="${pwd}" && psql -h ${c.host} -p ${c.port} -U ${c.username} -d postgres -c "DROP DATABASE IF EXISTS \\"${c.database}\\";"`
          )
        )
        console.log(
          chalk.gray(
            `# 3. 创建数据库\nexport PGPASSWORD="${pwd}" && psql -h ${c.host} -p ${c.port} -U ${c.username} -d postgres -c "CREATE DATABASE \\"${c.database}\\";"`
          )
        )
        console.log(
          chalk.gray(
            `# 4. 恢复数据\nexport PGPASSWORD="${pwd}" && pg_restore -h ${c.host} -p ${c.port} -U ${c.username} -d ${c.database} --clean --if-exists --no-owner "${dumpFile}"`
          )
        )
      } else {
        console.log(
          chalk.gray(
            `# MySQL 恢复\nmysql --user=${c.username} --host=${c.host} --port=${c.port} --password=${pwd} ${c.database} < "${dumpFile}"`
          )
        )
        console.log(chalk.gray('# 如需强制删除并重建数据库后恢复，可依次执行：'))
        console.log(
          chalk.gray(
            `# 1. 删除数据库\nmysql --user=${c.username} --host=${c.host} --port=${c.port} --password=${pwd} -e "DROP DATABASE IF EXISTS ${c.database};"`
          )
        )
        console.log(
          chalk.gray(
            `# 2. 创建数据库\nmysql --user=${c.username} --host=${c.host} --port=${c.port} --password=${pwd} -e "CREATE DATABASE IF NOT EXISTS ${c.database} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`
          )
        )
        console.log(
          chalk.gray(
            `# 3. 恢复数据\nmysql --user=${c.username} --host=${c.host} --port=${c.port} --password=${pwd} ${c.database} < "${dumpFile}"`
          )
        )
      }
    }
    console.log(chalk.yellow('---\n'))
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
        case 'restore': {
          const dumpFile = (options as { restoreDumpFile: string }).restoreDumpFile
          this.restoreData(targetConfig, dumpFile, {
            dryRun,
            verbose: options.verbose,
          })
          break
        }
        case 'sync':
        default:
          this.performSync(sourceConfig, targetConfig, {
            dryRun,
            verbose: options.verbose,
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
   *
   * 如需手动执行备份命令，可参考以下示例：
   *
   * PostgreSQL:
   *   export PGPASSWORD="password" && pg_dump -h host -p 5432 -U username -Fc -f dump_file.dump database
   *
   * MySQL:
   *   mysqldump database --result-file=dump_file.sql --user=username --host=host --port=3306 --password=password --set-gtid-purged=OFF --single-transaction --routines --triggers
   */
  dumpData(
    sourceConfig: DatabaseConfig,
    options: { dryRun?: boolean; verbose?: boolean; dumpFolder?: string; dumpFileName?: string } = {}
  ) {
    const { dryRun = false, verbose = false, dumpFolder = './dumps', dumpFileName } = options

    const fileName = dumpFileName ?? `${sourceConfig.database}.dump`
    const dumpFile = path.resolve(dumpFolder, fileName)

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

      this.logManualCommands({ type: 'dump', dbConfig: sourceConfig, dumpFileName: fileName })

      return dumpFile
    } catch (error) {
      this.spinner.fail(`❌ 数据备份失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * 恢复数据（必须传入 dump 文件路径）
   *
   * 如需手动执行恢复命令，可参考以下示例：
   *
   * PostgreSQL:
   *   export PGPASSWORD="password" && pg_restore -h host -p 5432 -U username -d database --clean --if-exists --no-owner dump_file.dump
   *
   * MySQL:
   *   mysql --user=username --host=host --port=3306 --password=password database < dump_file.sql
   */

  restoreData(
    targetConfig: DatabaseConfig,
    dumpFile: string,
    options: {
      dryRun?: boolean
      verbose?: boolean
    } = {}
  ) {
    const { dryRun = false, verbose = false } = options

    const resolvedDumpFile = path.isAbsolute(dumpFile) ? dumpFile : path.resolve(dumpFile)

    if (dryRun) {
      console.log(chalk.blue(`🔍 [预览模式] 将从 ${resolvedDumpFile} 恢复数据`))
      if (verbose) {
        console.log(chalk.gray(`  目标数据库: ${targetConfig.database}`))
        console.log(chalk.gray(`  目标主机: ${targetConfig.host}:${targetConfig.port}`))
      }
      return
    }

    if (!existsSync(resolvedDumpFile)) {
      throw new Error(`备份文件不存在: ${resolvedDumpFile}`)
    }

    this.spinner.start(`📥 正在恢复数据...`)

    try {
      // 执行恢复
      this.executeRestore(resolvedDumpFile, targetConfig, { verbose })

      this.spinner.succeed(`✅ 数据恢复完成`)

      if (verbose) {
        console.log(chalk.gray(`  恢复来源: ${path.relative(process.cwd(), resolvedDumpFile)}`))
        console.log(chalk.gray(`  目标数据库: ${targetConfig.database}`))
      }

      this.logManualCommands({ type: 'restore', dbConfig: targetConfig, dumpFile: resolvedDumpFile })
    } catch (error) {
      this.spinner.fail(`❌ 数据恢复失败: ${error instanceof Error ? error.message : String(error)}`)
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
      dumpFolder?: string
    }
  ) {
    const { dryRun = false, verbose = false, dumpFolder = './dumps' } = options

    if (dryRun) {
      console.log(chalk.blue('🔍 [预览模式] 同步操作流程:'))
      console.log(chalk.blue(`  1. 备份源数据库`))
      console.log(chalk.blue(`  2. 恢复数据到目标数据库`))
      return
    }

    // 步骤1: 备份源环境数据到 {source}-to-{target}.sync
    const syncFileName = `${sourceConfig.database}-to-${targetConfig.database}.sync`
    this.dumpData(sourceConfig, { dryRun, verbose, dumpFolder, dumpFileName: syncFileName })

    // 步骤2: 恢复到目标环境（使用步骤1生成的 .sync 文件）
    const dumpFile = path.resolve(dumpFolder, syncFileName)
    this.restoreData(targetConfig, dumpFile, {
      dryRun,
      verbose,
    })
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
  private executeRestore(dumpFile: string, dbConfig: DatabaseConfig, options: { verbose?: boolean } = {}) {
    const { verbose = false } = options

    if (!existsSync(dumpFile)) {
      throw new Error(`备份文件不存在: ${dumpFile}`)
    }

    const dbType = this.detectDatabaseType(dbConfig)

    if (dbType === DatabaseType.MYSQL) {
      this.executeMySQLRestore(dumpFile, dbConfig, { verbose })
    } else {
      this.executePostgreSQLRestore(dumpFile, dbConfig, {
        verbose,
      })
    }
  }

  /**
   * 执行 PostgreSQL 数据库恢复
   *
   * 如需手动执行，命令格式：
   *   export PGPASSWORD="password" && pg_restore -h host -p 5432 -U username -d database --clean --if-exists --no-owner dump_file.dump
   *
   * 如需删除并重建数据库（手动执行）：
   *   1. 终止连接: export PGPASSWORD="password" && psql -h host -p 5432 -U username -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'database' AND pid <> pg_backend_pid();"
   *   2. 删除数据库: export PGPASSWORD="password" && psql -h host -p 5432 -U username -d postgres -c "DROP DATABASE IF EXISTS \"database\";"
   *   3. 创建数据库: export PGPASSWORD="password" && psql -h host -p 5432 -U username -d postgres -c "CREATE DATABASE \"database\";"
   *   4. 恢复数据: export PGPASSWORD="password" && pg_restore -h host -p 5432 -U username -d database --clean --if-exists --no-owner dump_file.dump
   */
  private executePostgreSQLRestore(dumpFile: string, dbConfig: DatabaseConfig, options: { verbose?: boolean } = {}) {
    const { verbose = false } = options

    // 检查 pg_restore 是否存在
    try {
      execSync('which pg_restore', { stdio: 'pipe' })
    } catch {
      throw new Error('pg_restore 命令不存在，请安装 PostgreSQL 客户端工具')
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
   *
   * 如需手动执行，命令格式：
   *   mysql --user=username --host=host --port=3306 --password=password database < dump_file.sql
   *
   * 如需删除并重建数据库（手动执行）：
   *   1. 删除数据库: mysql --user=username --host=host --port=3306 --password=password -e "DROP DATABASE IF EXISTS database;"
   *   2. 创建数据库: mysql --user=username --host=host --port=3306 --password=password -e "CREATE DATABASE IF NOT EXISTS database DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   *   3. 恢复数据: mysql --user=username --host=host --port=3306 --password=password database < dump_file.sql
   */
  private executeMySQLRestore(dumpFile: string, dbConfig: DatabaseConfig, options: { verbose?: boolean } = {}) {
    const { verbose = false } = options

    // 检查 mysql 是否存在
    try {
      execSync('which mysql', { stdio: 'pipe' })
    } catch {
      throw new Error('mysql 命令不存在，请安装 MySQL 客户端工具')
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
}
