import chalk from 'chalk'
import { exec, execSync } from 'child_process'
import ora from 'ora'
import { promisify } from 'util'
import { BuildOptions, BuildResult, BuildStats, DockerConfig, DockerImageInfo, ImageInfo, ImageListItem } from './types'

const execAsync = promisify(exec)

/**
 * 构建管理器
 * 支持本地Docker镜像构建
 */
export class BuildManager {
  private spinner: ReturnType<typeof ora>

  constructor() {
    this.spinner = ora()
  }

  /**
   * 构建Docker镜像
   */
  async buildImage(options: BuildOptions): Promise<BuildResult> {
    const startTime = Date.now()
    const { dockerConfig } = options

    console.log(chalk.cyan('🔨 开始构建Docker镜像...'))
    console.log(chalk.blue('🔧 构建模式: LOCAL'))

    // 生成镜像标签
    const imageInfo = this.generateImageInfo(options, dockerConfig)

    console.log(chalk.blue(`📦 镜像名称: ${imageInfo.fullImageName}`))
    console.log(chalk.blue(`🏗️  构建平台: ${options.platform || dockerConfig.buildPlatform || 'linux/amd64'}`))
    console.log(chalk.blue(`🔍 预览模式: ${options.dryRun ? '是' : '否'}`))
    console.log(chalk.blue(`📤 构建后推送: ${options.push ? '是' : '否'}`))

    if (options.dryRun) {
      console.log(chalk.blue('🔍 [预览模式] 构建流程:'))
      console.log(chalk.blue('  1. 验证Docker环境'))
      console.log(chalk.blue('  2. 准备构建上下文'))
      console.log(chalk.blue('  3. 构建Docker镜像'))
      if (options.push) {
        console.log(chalk.blue('  4. 推送镜像到仓库'))
      }
      console.log(chalk.blue('  5. 清理临时文件'))

      return {
        success: true,
        imageName: imageInfo.imageName,
        imageTag: imageInfo.imageTag,
        fullImageName: imageInfo.fullImageName,
        buildTime: 0,
        platform: options.platform || dockerConfig.buildPlatform || 'linux/amd64',
      }
    }

    try {
      // 验证Docker环境
      await this.validateDockerEnvironment()

      // 准备构建上下文
      await this.prepareBuildContext(dockerConfig, options.dockerfile)

      // 构建镜像
      this.performBuild(imageInfo, options, dockerConfig)

      // 推送镜像（如果需要）
      if (options.push) {
        this.pushImage(imageInfo, dockerConfig, options.registryUser, options.registryPassword)
      }

      const buildTime = Date.now() - startTime

      console.log(chalk.green(`\n✅ 构建完成! 耗时: ${Math.round(buildTime / 1000)}s`))
      console.log(chalk.blue(`📦 镜像: ${imageInfo.fullImageName}`))

      return {
        success: true,
        imageName: imageInfo.imageName,
        imageTag: imageInfo.imageTag,
        fullImageName: imageInfo.fullImageName,
        buildTime,
        platform: options.platform || dockerConfig.buildPlatform || 'linux/amd64',
      }
    } catch (error) {
      console.error(chalk.red('❌ 构建失败:'), error)
      throw error
    }
  }

  /**
   * 生成镜像信息
   */
  private generateImageInfo(options: BuildOptions, dockerConfig: DockerConfig): ImageInfo {
    const imageName = `${dockerConfig.registry}/${dockerConfig.namespace}/${dockerConfig.appName}`
    const imageTag = this.generateImageTag(options)

    return {
      imageName,
      imageTag,
      fullImageName: `${imageName}:${imageTag}`,
    }
  }

  /**
   * 生成镜像标签
   */
  private generateImageTag(options: BuildOptions): string {
    if (options.tag) {
      return options.tag
    }

    // 默认使用时间戳
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  }

  /**
   * 验证Docker环境
   */
  private async validateDockerEnvironment(): Promise<void> {
    this.spinner.start('🔍 验证Docker环境...')

    try {
      // 检查Docker是否可用
      await execAsync('docker --version')

      // 检查Docker守护进程是否运行
      await execAsync('docker info')

      this.spinner.succeed('✅ Docker环境验证成功')
    } catch {
      this.spinner.fail('❌ Docker环境验证失败')
      throw new Error('Docker未安装或未运行。请确保Docker已安装并且守护进程正在运行。')
    }
  }

  /**
   * 准备构建上下文
   */
  private async prepareBuildContext(dockerConfig: DockerConfig, dockerfilePath?: string): Promise<void> {
    this.spinner.start('📂 准备构建上下文...')

    try {
      // 检查Dockerfile是否存在
      const dockerfileToCheck = dockerfilePath || `${dockerConfig.buildContext}/Dockerfile`
      const { stdout } = await execAsync(`ls -la ${dockerfileToCheck}`)

      if (!stdout.includes('Dockerfile')) {
        throw new Error(`Dockerfile not found: ${dockerfileToCheck}`)
      }

      this.spinner.succeed('✅ 构建上下文准备完成')
    } catch (error) {
      this.spinner.fail('❌ 构建上下文准备失败')
      throw new Error(`构建上下文准备失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 执行构建
   */
  private performBuild(imageInfo: any, options: BuildOptions, dockerConfig: any): void {
    this.spinner.start(`🔨 构建镜像: ${imageInfo.fullImageName}`)

    try {
      let command = 'docker build'

      // 构建平台
      const platform = options.platform || dockerConfig.buildPlatform || 'linux/amd64'
      if (platform) {
        command += ` --platform ${platform}`
      }

      // 自定义 Dockerfile 路径
      if (options.dockerfile) {
        command += ` -f ${options.dockerfile}`
      }

      // 镜像标签
      command += ` -t ${imageInfo.fullImageName}`

      // 构建上下文
      command += ` ${dockerConfig.buildContext}`

      if (options.verbose) {
        console.log(chalk.gray(`\n执行命令: ${command}`))
      }

      // 使用 execSync 来实时显示构建输出
      execSync(command, { stdio: 'inherit' })

      this.spinner.succeed(`✅ 镜像构建完成: ${imageInfo.fullImageName}`)
    } catch (error) {
      this.spinner.fail(`❌ 镜像构建失败: ${imageInfo.fullImageName}`)
      throw new Error(`构建失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 推送镜像
   */
  private pushImage(imageInfo: any, dockerConfig: any, registryUser?: string, registryPassword?: string): void {
    this.spinner.start(`📤 推送镜像: ${imageInfo.fullImageName}`)

    try {
      // 登录到镜像仓库（如果需要）
      if (registryUser && registryPassword) {
        this.loginToRegistry(dockerConfig.registry, registryUser, registryPassword)
      }

      // 推送镜像
      execSync(`docker push ${imageInfo.fullImageName}`, { stdio: 'inherit' })

      this.spinner.succeed(`✅ 镜像推送完成: ${imageInfo.fullImageName}`)
    } catch (error) {
      this.spinner.fail(`❌ 镜像推送失败: ${imageInfo.fullImageName}`)
      throw new Error(`推送失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 登录到镜像仓库
   */
  private loginToRegistry(registry: string, username: string, password: string): void {
    try {
      const command = `echo "${password}" | docker login ${registry} -u ${username} --password-stdin`
      execSync(command, { stdio: 'inherit' })
      console.log(chalk.green('✅ 镜像仓库登录成功'))
    } catch {
      console.warn(chalk.yellow('⚠️  镜像仓库登录失败，但继续推送'))
    }
  }

  /**
   * 获取镜像信息
   */
  async getImageInfo(imageName: string): Promise<DockerImageInfo> {
    try {
      const { stdout } = await execAsync(`docker inspect ${imageName}`)
      const imageInfo = JSON.parse(stdout)[0]

      return {
        id: imageInfo.Id,
        created: imageInfo.Created,
        size: imageInfo.Size,
        architecture: imageInfo.Architecture,
        os: imageInfo.Os,
        config: imageInfo.Config,
      }
    } catch (error) {
      throw new Error(`获取镜像信息失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 列出本地镜像
   */
  async listImages(repository?: string): Promise<ImageListItem[]> {
    try {
      const filter = repository ? `--filter reference=${repository}` : ''
      const { stdout } = await execAsync(
        `docker images ${filter} --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}\t{{.Size}}"`
      )

      const lines = stdout.split('\n').filter(line => line.trim())
      const images = lines.slice(1).map(line => {
        const [repository, tag, id, created, size] = line.split('\t')
        return { repository, tag, id, created, size }
      })

      return images
    } catch (error) {
      throw new Error(`列出镜像失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 删除镜像
   */
  async removeImage(imageName: string, force: boolean = false): Promise<void> {
    try {
      const forceFlag = force ? '--force' : ''
      await execAsync(`docker rmi ${forceFlag} ${imageName}`)
      console.log(chalk.green(`✅ 镜像删除成功: ${imageName}`))
    } catch (error) {
      throw new Error(`删除镜像失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取构建统计信息
   */
  async getBuildStats(): Promise<BuildStats> {
    try {
      const { stdout: imageCount } = await execAsync('docker images -q | wc -l')
      const { stdout: containerCount } = await execAsync('docker ps -a -q | wc -l')
      const { stdout: systemInfo } = await execAsync(
        'docker system df --format "table {{.Type}}\t{{.Total}}\t{{.Active}}\t{{.Size}}\t{{.Reclaimable}}"'
      )

      return {
        imageCount: parseInt(imageCount.trim()),
        containerCount: parseInt(containerCount.trim()),
        systemInfo: systemInfo.trim(),
      }
    } catch (error) {
      throw new Error(`获取构建统计信息失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 检查Docker环境
   */
  async checkDockerEnvironment(): Promise<boolean> {
    try {
      await this.validateDockerEnvironment()
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取版本信息
   */
  async getVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('docker --version')
      return stdout.trim()
    } catch (error) {
      throw new Error(`获取Docker版本失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 列出本地镜像（别名）
   */
  async listLocalImages(): Promise<
    Array<{
      repository: string
      tag: string
      id: string
      created: string
      size: string
    }>
  > {
    return this.listImages()
  }

  /**
   * 清理旧镜像
   */
  async cleanupOldImages(keepCount: number = 5): Promise<void> {
    try {
      console.log(chalk.cyan(`🧹 清理旧镜像，保留最新 ${keepCount} 个...`))

      const images = await this.listImages()
      if (images.length <= keepCount) {
        console.log(chalk.blue('📦 没有需要清理的镜像'))
        return
      }

      // 按创建时间排序，删除旧镜像
      const imagesToDelete = images.slice(keepCount)
      for (const image of imagesToDelete) {
        await this.removeImage(`${image.repository}:${image.tag}`)
      }

      console.log(chalk.green(`✅ 已清理 ${imagesToDelete.length} 个旧镜像`))
    } catch (error) {
      throw new Error(`清理旧镜像失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
