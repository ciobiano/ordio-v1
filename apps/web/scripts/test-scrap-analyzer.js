#!/usr/bin/env node
/**
 * SCRAP-inspired test code analyzer - simplified regex version
 * Analyzes test files for complexity and smell patterns
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const TEST_DIR = 'src/__tests__';

function findTestFiles(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      findTestFiles(fullPath, files);
    } else if (entry.isFile() && /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function analyzeTestFile(filePath) {
  const code = readFileSync(filePath, 'utf-8');
  const lines = code.split('\n').length;
  
  // Count constructs
  const itCount = (code.match(/(?<![\w])it\(/g) || []).length;
  const describeCount = (code.match(/(?<![\w])describe\(/g) || []).length;
  const contextCount = (code.match(/(?<![\w])context\(/g) || []).length;
  const beforeEachCount = (code.match(/beforeEach\(/g) || []).length;
  const beforeAllCount = (code.match(/beforeAll\(/g) || []).length;
  const expectCount = (code.match(/expect\(/g) || []).length;
  const toMatchCount = (code.match(/\.to/g) || []).length;
  const notCount = (code.match(/\.not\./g) || []).length;
  
  // Calculate complexity (cyclomatic approximation)
  let complexity = 1;
  complexity += (code.match(/\bif\b/g) || []).length;
  complexity += (code.match(/\bfor\b/g) || []).length;
  complexity += (code.match(/\bwhile\b/g) || []).length;
  complexity += (code.match(/\bcase\b/g) || []).length;
  complexity += (code.match(/&&/g) || []).length;
  complexity += (code.match(/\|\|/g) || []).length;
  complexity += (code.match(/\?\s*[^:]/g) || []).length;
  
  // Smell detection
  const smells = [];
  
  // Too many expects in one test
  if (expectCount > itCount * 3 && itCount > 0) {
    smells.push('heavy-assertions');
  }
  
  // No assertions
  if (expectCount === 0 && itCount > 0) {
    smells.push('zero-assertions');
  }
  
  // High complexity
  if (complexity > 30) {
    smells.push('high-complexity');
  }
  
  // Too many tests in one file
  if (itCount > 20) {
    smells.push('too-many-tests');
  }
  
  return {
    file: filePath,
    lines,
    itCount,
    describeCount: describeCount + contextCount,
    beforeEachCount,
    beforeAllCount,
    expectCount,
    complexity,
    smells
  };
}

function generateRecommendations(analysis) {
  const recs = [];
  
  if (analysis.smells.includes('zero-assertions')) {
    recs.push({ type: 'HIGH', msg: 'No assertions found - add expect statements' });
  }
  if (analysis.smells.includes('high-complexity')) {
    recs.push({ type: 'MEDIUM', msg: `Complexity ${analysis.complexity} - split test cases` });
  }
  if (analysis.smells.includes('too-many-tests')) {
    recs.push({ type: 'MEDIUM', msg: `${analysis.itCount} tests - consider splitting file` });
  }
  if (analysis.smells.includes('heavy-assertions')) {
    recs.push({ type: 'MEDIUM', msg: 'Many assertions - extract helper or use table-driven' });
  }
  
  return recs;
}

function getAIActionability(analysis) {
  const recs = generateRecommendations(analysis);
  const hasHigh = recs.some(r => r.type === 'HIGH');
  const hasMedium = recs.some(r => r.type === 'MEDIUM');
  
  if (!recs.length) return 'LEAVE_ALONE';
  if (hasHigh) return 'MANUAL_SPLIT';
  if (hasMedium) return 'AUTO_REFACTOR';
  return 'AUTO_TABLE_DRIVE';
}

function main() {
  console.log('\n=== SCRAP Test Analyzer ===\n');
  
  const testFiles = findTestFiles(TEST_DIR);
  let totalComplexity = 0;
  let needsRefactor = [];
  
  for (const file of testFiles) {
    const analysis = analyzeTestFile(file);
    const recs = generateRecommendations(analysis);
    const actionability = getAIActionability(analysis);
    
    if (actionability !== 'LEAVE_ALONE') {
      needsRefactor.push({ analysis, recs, actionability });
      console.log(`\n📁 ${analysis.file}`);
      console.log(`   Lines: ${analysis.lines} | it: ${analysis.itCount} | describe: ${analysis.describeCount} | expect: ${analysis.expectCount}`);
      console.log(`   Complexity: ${analysis.complexity} | AI Action: ${actionability}`);
      
      if (recs.length > 0) {
        console.log(`   Recs: ${recs.map(r => `[${r.type}] ${r.msg}`).join(', ')}`);
      }
    }
    
    totalComplexity += analysis.complexity;
  }
  
  const avgComplexity = testFiles.length > 0 ? Math.round(totalComplexity / testFiles.length) : 0;
  const needsCount = needsRefactor.length;
  
  console.log('\n=== Summary ===');
  console.log(`Total test files: ${testFiles.length}`);
  console.log(`Total complexity: ${totalComplexity}`);
  console.log(`Average complexity: ${avgComplexity}`);
  console.log(`Files needing refactor: ${needsCount}`);
  
  if (needsCount > testFiles.length * 0.5) {
    console.log('\n⚠️  OVERALL: SPLIT - Break files by responsibility');
  } else if (needsCount > 0) {
    console.log('\n✓ OVERALL: LOCAL - Clean up individual files');
  } else {
    console.log('\n✓ OVERALL: STABLE - Tests well structured');
  }
  
  // Show worst offenders
  if (needsRefactor.length > 0) {
    const worst = needsRefactor.sort((a, b) => b.analysis.complexity - a.analysis.complexity).slice(0, 3);
    console.log('\n🔥 Worst files by complexity:');
    for (const w of worst) {
      console.log(`   ${w.analysis.complexity} - ${w.analysis.file.split('/').pop()}`);
    }
  }
}

main();