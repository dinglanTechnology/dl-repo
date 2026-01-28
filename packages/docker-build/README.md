# @dinglanTechnology/docker-build

Docker 镜像构建工具包。

## Installation

```bash
npm install @dinglanTechnology/docker-build
```

## Usage

```typescript
import { BuildManager } from '@dinglanTechnology/docker-build'

const buildManager = new BuildManager()

await buildManager.buildImage({
  dockerConfig: {
    registry: 'registry.example.com',
    namespace: 'my-namespace',
    appName: 'my-app',
    buildContext: '.',
    buildPlatform: 'linux/amd64',
  },
  tag: 'latest',
  push: false,
  registryUser: 'username',
  registryPassword: 'password',
})
```

## API

### BuildManager

#### buildImage(options: BuildOptions)

构建 Docker 镜像。

#### getImageInfo(imageName: string)

获取镜像信息。

#### listImages(repository?: string)

列出本地镜像。

#### removeImage(imageName: string, force?: boolean)

删除镜像。

#### getBuildStats()

获取构建统计信息。
