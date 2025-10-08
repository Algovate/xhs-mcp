# Tests

This directory contains test scripts and fixtures for xhs-mcp.

## 📁 Directory Structure

```
tests/
├── integration/              # Integration test scripts
│   ├── image-downloader.test.js    # Image URL download tests
│   └── title-validation.test.js    # Title validation tests
├── fixtures/                 # Test data and fixtures
│   └── Bert.jpg             # Sample image for testing
└── README.md                # This file
```

## 🧪 Running Tests

### Run All Tests

```bash
npm test
```

### Run Individual Tests

```bash
# Test image downloader
node tests/integration/image-downloader.test.js

# Test title validation
node tests/integration/title-validation.test.js
```

### Enable Debug Logging

```bash
XHS_ENABLE_LOGGING=true node tests/integration/image-downloader.test.js
```

## 📋 Test Coverage

### Integration Tests

#### 1. Image Downloader Tests (`image-downloader.test.js`)

Tests the image URL download and caching functionality:

- ✅ Download single image from URL
- ✅ Download multiple images concurrently
- ✅ Process mixed paths (URLs + local files)
- ✅ Cache mechanism (avoid duplicate downloads)
- ✅ URL detection and validation

**Expected Output:**
```
🚀 Testing image URL download feature...

✅ ImageDownloader created

📥 Test 1: Downloading single image...
✅ Downloaded: ./temp_images/img_abc123_1234567890.jpg
   File size: 45.67 KB
   Cached: false

...

🎉 All tests passed!
```

#### 2. Title Validation Tests (`title-validation.test.js`)

Tests the title width validation according to Xiaohongshu's display rules:

- ✅ English-only titles
- ✅ Chinese-only titles
- ✅ Mixed language titles
- ✅ Emoji handling
- ✅ Width calculation (CJK: 2 units, ASCII: 1 unit)
- ✅ Title truncation
- ✅ Detailed character breakdown
- ✅ Edge cases

**Expected Output:**
```
🧪 Testing Title Width Validation

XHS Title Constraints: Max 40 units

📊 Test Results:

Test 1: English only
────────────────────────────────────────────────────────────
Title: "Hello World"
Length: 11 characters
Width: 11 units (max: 40)
Remaining: 29 units
Status: ✅ Valid

...
```

## 🔧 Test Fixtures

### fixtures/Bert.jpg

Sample image file used for testing mixed path processing (URL + local file).

- **Format**: JPEG
- **Usage**: Integration tests for image downloader
- **Purpose**: Verify local file handling alongside URL downloads

## 📝 Writing Tests

When adding new tests:

1. Place integration tests in `tests/integration/`
2. Add test data to `tests/fixtures/`
3. Follow the naming convention: `*.test.js`
4. Include clear test descriptions and expected outputs
5. Update this README with test coverage information

### Test Template

```javascript
#!/usr/bin/env node
/**
 * Test script for [feature name]
 * 
 * Usage:
 *   node tests/integration/[test-name].test.js
 *   npm test
 */

async function testFeature() {
  console.log('🚀 Testing [feature]...\n');
  
  try {
    // Test setup
    
    // Test 1
    console.log('📥 Test 1: [description]...');
    // ... test code ...
    console.log('✅ Passed\n');
    
    // Test 2
    console.log('📥 Test 2: [description]...');
    // ... test code ...
    console.log('✅ Passed\n');
    
    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFeature().catch(console.error);
```

## ⚙️ Test Configuration

Tests rely on:

- **Built artifacts**: Tests run against `dist/` directory
- **Dependencies**: All dependencies from `package.json`
- **Environment**: Node.js runtime

Make sure to build the project before running tests:

```bash
npm run build
npm test
```

## 🐛 Troubleshooting

### Test Fails with Module Not Found

Make sure to build the project first:

```bash
npm run build
```

### Image Download Test Fails

Check your internet connection and ensure the test URLs are accessible:

```bash
curl -I https://picsum.photos/800/600
```

### Title Validation Test Fails

Ensure `string-width` package is installed:

```bash
npm install
```

## 🔗 Related Documentation

- [Usage Guide](../docs/USAGE_GUIDE.md) - How to use xhs-mcp
- [Project Structure](../docs/PROJECT_STRUCTURE.md) - Code organization
- [README](../README.md) - Main project documentation

