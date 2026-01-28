module.exports = {
  trailingComma: 'all',
  tabWidth: 2,
  semi: false,
  quoteProps: 'as-needed',
  singleQuote: true,
  arrowParens: 'always',
  bracketSpacing: true,
  jsxSingleQuote: true,
  printWidth: 120,

  overrides: [
    {
      files: '*.{ts,tsx}',
      options: {
        parser: 'typescript',
      },
    },
    {
      files: '*.sql',
      options: {
        formatter: 'sql-formatter',
        language: "postgresql",
        keywordCase: 'lower'
      },
    },
    {
      files: '*.js',
      options: {
        parser: 'babel',
      },
    },
    {
      files: '*.{yaml,yml}',
      options: {
        parser: 'yaml',
      },
    },
  ],

  plugins:['prettier-plugin-organize-imports']
}
