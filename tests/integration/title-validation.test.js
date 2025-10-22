#!/usr/bin/env node
/**
 * Test script for title width validation
 * 
 * Usage:
 *   node tests/integration/title-validation.test.js
 *   npm test
 */

// Import directly from source for testing
const stringWidth = require('string-width').default || require('string-width');

// Inline implementation for testing
const XHS_TITLE_CONSTRAINTS = {
  MAX_WIDTH: 40,
  MAX_LENGTH: 20,
};

function getTitleWidth(title) {
  return stringWidth(title);
}

function calculateRemainingTitleWidth(title) {
  const currentWidth = getTitleWidth(title);
  return Math.max(0, XHS_TITLE_CONSTRAINTS.MAX_WIDTH - currentWidth);
}

function validateTitleWidth(title) {
  if (!title) {
    return {
      valid: false,
      width: 0,
      maxWidth: XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
      message: 'Title cannot be empty',
      suggestion: 'Please provide a valid title',
    };
  }

  const width = stringWidth(title);

  if (width > XHS_TITLE_CONSTRAINTS.MAX_WIDTH) {
    return {
      valid: false,
      width,
      maxWidth: XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
      message: `Title width exceeds limit: ${width} units (max: ${XHS_TITLE_CONSTRAINTS.MAX_WIDTH} units)`,
      suggestion: `Current title is too long. CJK characters count as 2 units, English/numbers as 1 unit. Please shorten your title.`,
    };
  }

  return {
    valid: true,
    width,
    maxWidth: XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
  };
}

function truncateTitleToWidth(title, maxWidth = 40) {
  if (getTitleWidth(title) <= maxWidth) {
    return title;
  }

  let truncated = '';
  let currentWidth = 0;

  for (const char of title) {
    const charWidth = stringWidth(char);
    
    if (currentWidth + charWidth > maxWidth) {
      break;
    }
    
    truncated += char;
    currentWidth += charWidth;
  }

  return truncated;
}

function getTitleWidthBreakdown(title) {
  const totalWidth = getTitleWidth(title);
  const breakdown = [];

  for (const char of title) {
    const charWidth = stringWidth(char);
    let type = 'Other';

    const code = char.charCodeAt(0);
    if (char.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/)) {
      type = 'CJK';
    } else if (code < 128) {
      type = 'ASCII';
    } else if (char.match(/[\u{1F300}-\u{1F9FF}]/u)) {
      type = 'Emoji';
    }

    breakdown.push({ char, width: charWidth, type });
  }

  return {
    title,
    totalWidth,
    totalChars: title.length,
    maxWidth: XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
    remaining: calculateRemainingTitleWidth(title),
    valid: totalWidth <= XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
    breakdown,
  };
}

console.log('🧪 Testing Title Width Validation\n');
console.log(`XHS Title Constraints: Max ${XHS_TITLE_CONSTRAINTS.MAX_WIDTH} units\n`);
console.log('=' .repeat(60));

// Test cases
const testCases = [
  {
    title: 'Hello World',
    description: 'English only',
  },
  {
    title: '你好世界',
    description: 'Chinese only',
  },
  {
    title: 'Hello世界',
    description: 'Mixed English + Chinese',
  },
  {
    title: '👋Hello世界🌍',
    description: 'Emoji + Mixed',
  },
  {
    title: '这是一个很长的标题',
    description: 'Long Chinese title',
  },
  {
    title: '这是一个非常非常非常非常非常长的标题',
    description: 'Too long Chinese title',
  },
  {
    title: 'A'.repeat(50),
    description: 'Very long English title',
  },
  {
    title: '中'.repeat(25),
    description: 'Too many Chinese characters',
  },
];

console.log('\n📊 Test Results:\n');

testCases.forEach((testCase, index) => {
  const { title, description } = testCase;
  const result = validateTitleWidth(title);
  const width = getTitleWidth(title);
  const remaining = calculateRemainingTitleWidth(title);

  console.log(`\nTest ${index + 1}: ${description}`);
  console.log('─'.repeat(60));
  console.log(`Title: "${title}"`);
  console.log(`Length: ${title.length} characters`);
  console.log(`Width: ${width} units (max: ${result.maxWidth})`);
  console.log(`Remaining: ${remaining} units`);
  console.log(`Status: ${result.valid ? '✅ Valid' : '❌ Invalid'}`);
  
  if (!result.valid) {
    console.log(`\n⚠️  ${result.message}`);
    console.log(`💡 ${result.suggestion}`);
    
    // Show truncated version
    const truncated = truncateTitleToWidth(title);
    console.log(`\n✂️  Truncated: "${truncated}"`);
    console.log(`   Width: ${getTitleWidth(truncated)} units`);
  }
});

// Detailed breakdown example
console.log('\n\n' + '='.repeat(60));
console.log('📝 Detailed Width Breakdown Example\n');

const exampleTitle = 'Hello世界👋ABC';
const breakdown = getTitleWidthBreakdown(exampleTitle);

console.log(`Title: "${breakdown.title}"`);
console.log(`Total Characters: ${breakdown.totalChars}`);
console.log(`Total Width: ${breakdown.totalWidth} units`);
console.log(`Remaining: ${breakdown.remaining} units`);
console.log(`Valid: ${breakdown.valid ? '✅' : '❌'}\n`);

console.log('Character Breakdown:');
console.log('─'.repeat(60));
breakdown.breakdown.forEach(({ char, width, type }) => {
  console.log(`  '${char}' → ${width} unit(s) [${type}]`);
});

// Edge cases
console.log('\n\n' + '='.repeat(60));
console.log('🔬 Edge Cases\n');

const edgeCases = [
  { title: '', description: 'Empty string' },
  { title: ' ', description: 'Single space' },
  { title: '   ', description: 'Multiple spaces' },
  { title: '\n\t', description: 'Whitespace characters' },
  { title: '🎉'.repeat(20), description: 'Many emojis' },
];

edgeCases.forEach(({ title, description }) => {
  const result = validateTitleWidth(title);
  console.log(`${description}: ${result.valid ? '✅' : '❌'} (width: ${result.width})`);
});

// Width calculation comparison
console.log('\n\n' + '='.repeat(60));
console.log('📏 Width Calculation Examples\n');

const widthExamples = [
  'A',           // 1 unit
  '中',          // 2 units
  'Hello',       // 5 units
  '你好',        // 4 units (2*2)
  'Hello世界',   // 10 units (5 + 2 + 2 + 1)
  '👋',          // 2 units
  'A中B',        // 4 units (1 + 2 + 1)
];

widthExamples.forEach(text => {
  const width = getTitleWidth(text);
  console.log(`"${text.padEnd(15)}" → ${width.toString().padStart(2)} units`);
});

// Practical examples
console.log('\n\n' + '='.repeat(60));
console.log('💼 Practical Examples\n');

const practicalExamples = [
  '今日美食分享',
  '春天来了🌸',
  'My Travel Diary',
  '2024年终总结报告',
  'iPhone 15 Pro Max开箱',
  '如何在30天内学会编程',
];

practicalExamples.forEach(title => {
  const result = validateTitleWidth(title);
  const icon = result.valid ? '✅' : '❌';
  console.log(`${icon} "${title}" (${result.width}/${result.maxWidth} units)`);
});

console.log('\n' + '='.repeat(60));
console.log('\n✨ All tests completed!\n');
console.log('💡 Tips:');
console.log('  - CJK characters (中文/日文/韓文): 2 units each');
console.log('  - ASCII characters (English/numbers): 1 unit each');
console.log('  - Emojis: typically 2 units');
console.log(`  - Maximum: ${XHS_TITLE_CONSTRAINTS.MAX_WIDTH} units\n`);

