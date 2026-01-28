/**
 * Docker 配置接口
 */
export interface DockerConfig {
  registry: string
  namespace: string
  appName: string
  buildContext: string
  buildPlatform?: string
  buildTarget?: string
}

/**
 * 构建选项接口
 */
export interface BuildOptions {
  dockerConfig: DockerConfig
  tag?: string
  push?: boolean
  platform?: string
  dryRun?: boolean
  verbose?: boolean
  dockerfile?: string
  registryUser?: string
  registryPassword?: string
}

/**
 * 构建结果接口
 */
export interface BuildResult {
  success: boolean
  imageName: string
  imageTag: string
  fullImageName: string
  buildTime: number
  size?: string
  platform?: string
}

/**
 * 镜像信息接口
 */
export interface ImageInfo {
  imageName: string
  imageTag: string
  fullImageName: string
}

/**
 * Docker 镜像详情接口
 */
export interface DockerImageInfo {
  id: string
  created: string
  size: number
  architecture: string
  os: string
  config: Record<string, unknown>
}

/**
 * 镜像列表项接口
 */
export interface ImageListItem {
  repository: string
  tag: string
  id: string
  created: string
  size: string
}

/**
 * 构建统计信息接口
 */
export interface BuildStats {
  imageCount: number
  containerCount: number
  systemInfo: string
}
