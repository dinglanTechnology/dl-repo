module.exports = {
  // TypeScript 文件：eslint 修复 + prettier 格式化
  // eslint --fix 会自动修复可修复的问题，无法修复的错误会阻止提交
  '**/*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  // JavaScript、JSON、Markdown 文件：prettier 格式化
  '**/*.{js,jsx,json,md}': ['prettier --write'],
}
