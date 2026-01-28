module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist', 'node_modules', '*.js'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn', // 使用 any 类型时显示警告，但不阻止提交
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
}
