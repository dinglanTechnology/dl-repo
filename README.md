# DL Repo - Monorepo

这是一个 monorepo 项目，每个包都可以独立发布到 GitHub Packages。使用 git commit hash 作为版本号。

## 项目结构

```
dl-repo/
├── packages/          # 可发布的 npm 包
│   ├── common/       # 通用工具包（使用 lodash）
│   ├── tracing/      # NestJS 链路追踪模块
│   ├── data-sync/    # 数据库数据同步工具包
│   └── docker-build/  # Docker 镜像构建工具包
├── .github/workflows/ # GitHub Actions 工作流
├── package.json      # 根 package.json
├── pnpm-workspace.yaml  # pnpm workspace 配置
└── tsconfig.json     # TypeScript 配置
```

## 安装依赖

```bash
pnpm install
```

## 开发

### 构建所有包

```bash
pnpm build
```

构建后会生成：

- `dist/*.js` - CommonJS 格式的 JavaScript 文件
- `dist/*.d.ts` - TypeScript 类型定义文件
- `dist/*.js.map` - Source map 文件
- `dist/*.d.ts.map` - 类型定义 Source map 文件

### 构建单个包

```bash
cd packages/common
pnpm build
```

### 开发模式（监听文件变化）

```bash
pnpm dev
```

### Git Hooks

项目配置了 pre-commit hook，在提交前会自动：

- 对 staged 的文件运行 eslint 检查并自动修复
- 对 staged 的文件运行 prettier 格式化

**跳过 hook（不推荐）：**

```bash
git commit --no-verify
```

## 版本管理

本项目使用 **git commit hash** 作为版本标识，格式为 `0.0.0-<commit-hash>`。

### 版本格式

- **格式**：`0.0.0-<short-commit-hash>`
- **示例**：`0.0.0-a1b2c3d`
- **说明**：符合 npm pre-release 版本规范，版本号直接对应 git commit，可追溯

### 更新版本号

```bash
# 使用当前 commit hash 更新所有包版本
node scripts/update-versions.js

# 或指定 commit hash
node scripts/update-versions.js <commit-hash>
```

**注意**: 通常不需要手动更新，GitHub CI 会自动处理。

### 发布包

#### 自动发布（推荐 - GitHub Actions）

当代码推送到 `main` 或 `master` 分支时，GitHub Actions 会自动：

1. 获取当前 commit hash
2. 更新所有包的版本号
3. 构建所有包
4. 发布到 GitHub Packages
5. 创建 git tag

**无需额外配置**：GitHub Actions 会自动使用 `GITHUB_TOKEN`。

#### 手动发布（仅用于测试）

如果需要本地测试发布流程：

1. 配置 GitHub Personal Access Token：

   ```bash
   npm config set @dinglanTechnology:registry https://npm.pkg.github.com
   npm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_TOKEN
   ```

2. 更新版本号并构建：

   ```bash
   node scripts/update-versions.js
   pnpm build
   ```

3. 发布单个包：
   ```bash
   cd packages/<package-name>
   npm publish
   ```

当代码推送到 `main` 或 `master` 分支时，GitHub Actions 会自动：

1. 获取当前 commit hash
2. 更新所有包的版本号
3. 构建所有包
4. 发布到 GitHub Packages
5. 创建 git tag

**无需额外配置**：GitHub Actions 会自动使用 `GITHUB_TOKEN`。

## 安装发布的包

### 配置 npm 使用 GitHub Packages

创建或编辑 `~/.npmrc` 文件：

```
@dinglanTechnology:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

### 安装包

```bash
# 安装最新版本
npm install @dinglanTechnology/common

# 安装特定 commit 版本
npm install @dinglanTechnology/common@0.0.0-a1b2c3d

# 或使用 commit tag
npm install @dinglanTechnology/common@commit-a1b2c3d
```

### 在 package.json 中使用

```json
{
  "dependencies": {
    "@dinglanTechnology/common": "^0.0.0-a1b2c3d"
  }
}
```

## 包说明

### @dinglanTechnology/common

通用工具包，使用 lodash 提供常用工具函数。

### @dinglanTechnology/tracing

NestJS 链路追踪模块，零配置、无侵入的分布式链路追踪。

### @dinglanTechnology/data-sync

数据库数据同步工具包，支持 PostgreSQL 和 MySQL 的数据同步、备份和恢复。

### @dinglanTechnology/docker-build

Docker 镜像构建工具包，支持本地 Docker 镜像构建和推送。

## 创建新包

1. 在 `packages/` 目录下创建新文件夹
2. 创建 `package.json`，设置包名（格式：`@dinglanTechnology/<name>`）和版本（版本会在发布时自动更新）
3. 在 `package.json` 中添加 `publishConfig`：
   ```json
   {
     "publishConfig": {
       "registry": "https://npm.pkg.github.com"
     }
   }
   ```
4. 创建 `src/index.ts` 作为入口文件
5. 创建 `tsconfig.json` 继承根配置
6. 添加构建脚本：`"build": "tsc"`

## 包配置说明

每个包需要包含：

- `package.json` - 包配置，包含 `main`, `types`, `publishConfig`
- `tsconfig.json` - TypeScript 配置
- `src/index.ts` - 入口文件
- `README.md` - 包说明文档

## 包之间互相引用

包之间可以互相引用，但需要注意避免循环依赖。详见 [包之间互相引用指南](./docs/packages-interdependency.md)。

## 技术栈

- **包管理**: pnpm workspaces
- **构建工具**: TypeScript Compiler (tsc)
- **输出格式**: CommonJS (CJS)
- **类型检查**: TypeScript
- **代码规范**: ESLint + Prettier
- **CI/CD**: GitHub Actions
- **版本管理**: Git commit hash
- **包仓库**: GitHub Packages

## GitHub Actions

### CI 工作流

- 在 push 和 PR 时运行
- 执行 lint、build、test

### Publish 工作流

- 在 push 到 main/master 分支时运行
- 自动更新版本号（使用 commit hash）
- 构建并发布所有包到 GitHub Packages
- 使用 `GITHUB_TOKEN` 自动认证（无需额外配置）

## GitHub Packages 访问

发布的包可以在以下位置查看：

- `https://github.com/<owner>/<repo>/packages`

包的安装地址：

- `https://npm.pkg.github.com/@dinglanTechnology/<package-name>`
