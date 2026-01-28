# GitHub Actions Workflows

## CI Workflow

在每次 push 和 pull request 时运行：

- Lint 检查
- 构建所有包
- 运行测试

## Publish Workflow

在 push 到 `main` 或 `master` 分支时自动运行：

1. **获取 commit hash**: 使用 `git rev-parse --short HEAD`
2. **更新版本号**: 将所有包的版本号更新为 `0.0.0-<commit-hash>`
3. **构建**: 构建所有包
4. **发布**: 发布所有包到 **GitHub Packages**，使用 tag `commit-<hash>`
5. **创建 tag**: 在 git 中创建版本 tag

### 配置要求

**无需额外配置！** GitHub Actions 会自动使用 `GITHUB_TOKEN` 进行认证。

### 版本号格式

- 格式: `0.0.0-<short-commit-hash>`
- 示例: `0.0.0-a1b2c3d`
- Tag: `commit-a1b2c3d`

### 查看发布的包

发布的包可以在以下位置查看：

- GitHub Repository > Packages 页面
- URL: `https://github.com/<owner>/<repo>/packages`

### 安装特定版本

#### 配置 npm 使用 GitHub Packages

创建或编辑 `~/.npmrc` 文件：

```
@dinglanTechnology:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

#### 安装包

```bash
# 使用 commit hash tag
npm install @dinglanTechnology/common@commit-a1b2c3d

# 或使用完整版本号
npm install @dinglanTechnology/common@0.0.0-a1b2c3d
```

### GitHub Packages vs npmjs.com

- ✅ **GitHub Packages**: 与代码仓库集成，私有仓库免费
- ✅ **自动认证**: 使用 `GITHUB_TOKEN`，无需配置
- ✅ **版本管理**: 与 git 仓库紧密集成
- ⚠️ **公开访问**: 需要 GitHub 账号和 token 才能安装（即使是公开包）

### 手动发布（本地）

如果需要手动发布，需要配置 GitHub Personal Access Token：

```bash
# 配置 npm
npm config set @dinglanTechnology:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_TOKEN

# 发布
pnpm release
```

Token 需要以下权限：

- `write:packages` - 发布包
- `read:packages` - 读取包（如果需要）
