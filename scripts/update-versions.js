#!/usr/bin/env node

/**
 * 更新所有包的版本号为 0.0.0-<commit-hash>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const commitHash =
  process.argv[2] ||
  execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const version = `0.0.0-${commitHash}`;

console.log(`Updating all packages to version: ${version}\n`);

const packagesDir = path.join(__dirname, '..', 'packages');
const packages = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);

packages.forEach((pkgName) => {
  const pkgPath = path.join(packagesDir, pkgName, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✓ ${pkg.name} -> ${version}`);
  }
});

console.log(`\nDone!`);
