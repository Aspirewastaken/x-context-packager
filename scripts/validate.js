#!/usr/bin/env node

/**
 * Validation script for X Context Packager
 * Run with: npm run validate
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];

// Helper functions
function error(message) {
  errors.push(`❌ ${message}`);
}

function warning(message) {
  warnings.push(`⚠️  ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
}

function checkFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    error(`${description} not found: ${filePath}`);
    return false;
  }
  return true;
}

function validateJSON(filePath, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    success(`${description} is valid JSON`);
    return true;
  } catch (e) {
    error(`${description} has invalid JSON: ${e.message}`);
    return false;
  }
}

function validateManifest() {
  console.log('\n📋 Validating manifest.json...');

  if (!checkFileExists('manifest.json', 'Manifest file')) return;

  if (!validateJSON('manifest.json', 'Manifest')) return;

  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

  // Required fields
  const required = ['manifest_version', 'name', 'version', 'description'];
  required.forEach(field => {
    if (!manifest[field]) {
      error(`Manifest missing required field: ${field}`);
    }
  });

  // Chrome extension specific validations
  if (manifest.manifest_version !== 3) {
    error('Manifest version must be 3 for Chrome extensions');
  }

  // Check permissions
  const allowedPermissions = [
    'activeTab', 'scripting', 'clipboardWrite', 'storage'
  ];
  if (manifest.permissions) {
    manifest.permissions.forEach(perm => {
      if (!allowedPermissions.includes(perm)) {
        warning(`Unexpected permission: ${perm}`);
      }
    });
  }

  // Check action configuration
  if (!manifest.action || !manifest.action.default_popup) {
    error('Manifest must specify default_popup in action');
  }

  success('Manifest validation complete');
}

function validateSelectors() {
  console.log('\n🎯 Validating SELECTORS object...');

  if (!checkFileExists('content/content.js', 'Content script')) return;

  const content = fs.readFileSync('content/content.js', 'utf8');

  // Check SELECTORS object exists
  if (!content.includes('const SELECTORS = {')) {
    error('SELECTORS object not found in content.js');
    return;
  }

  // Check for hardcoded selectors outside SELECTORS
  const hardcodedSelectors = content.match(/querySelector\(['"`][^'"`]*\[/g);
  if (hardcodedSelectors && hardcodedSelectors.length > 0) {
    warning('Found potential hardcoded selectors outside SELECTORS object');
    warning('All selectors should be centralized in SELECTORS for maintainability');
  }

  success('SELECTORS validation complete');
}

function validateFileStructure() {
  console.log('\n📁 Validating file structure...');

  const requiredFiles = [
    'manifest.json',
    'popup/popup.html',
    'popup/popup.css',
    'popup/popup.js',
    'content/content.js',
    'README.md',
    'LICENSE'
  ];

  const requiredDirs = [
    'icons',
    'docs'
  ];

  requiredFiles.forEach(file => {
    checkFileExists(file, `Required file: ${file}`);
  });

  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      error(`Required directory not found: ${dir}`);
    } else {
      success(`Required directory exists: ${dir}`);
    }
  });

  // Check icon files
  const iconFiles = ['icon16.png', 'icon48.png', 'icon128.png'];
  iconFiles.forEach(icon => {
    const iconPath = path.join('icons', icon);
    if (!fs.existsSync(iconPath)) {
      warning(`Icon file missing: ${iconPath}`);
    }
  });

  success('File structure validation complete');
}

function validateCodeQuality() {
  console.log('\n💻 Validating code quality...');

  // Check for console.log statements (should be removed in production)
  const files = ['popup/popup.js', 'content/content.js'];
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const consoleLogs = content.match(/console\.\w+\(/g);
      if (consoleLogs) {
        warning(`${file} contains ${consoleLogs.length} console statements`);
      }
    }
  });

  // Check for TODO comments
  const allFiles = ['popup/popup.js', 'content/content.js', 'popup/popup.html'];
  allFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const todos = content.match(/TODO|FIXME|XXX/g);
      if (todos) {
        warning(`${file} contains ${todos.length} TODO comments`);
      }
    }
  });

  success('Code quality validation complete');
}

function validateDocumentation() {
  console.log('\n📚 Validating documentation...');

  const docs = [
    'README.md',
    'DESIGN_PHILOSOPHY.md',
    'IMPLEMENTATION_PLAN.md',
    'CONTRIBUTING.md',
    'CHANGELOG.md'
  ];

  docs.forEach(doc => {
    checkFileExists(doc, `Documentation: ${doc}`);
  });

  // Check docs directory
  const docFiles = fs.readdirSync('docs');
  if (docFiles.length === 0) {
    warning('docs/ directory is empty');
  } else {
    success(`Found ${docFiles.length} files in docs/ directory`);
  }

  success('Documentation validation complete');
}

// Run all validations
function main() {
  console.log('🔍 X Context Packager Validation\n');

  validateManifest();
  validateSelectors();
  validateFileStructure();
  validateCodeQuality();
  validateDocumentation();

  // Summary
  console.log('\n📊 Validation Summary:');
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(e => console.log(`   ${e}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(w => console.log(`   ${w}`));
  }

  if (errors.length === 0) {
    console.log('\n🎉 All validations passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Validation failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };