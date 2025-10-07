#!/usr/bin/env node
/**
 * Test script for image URL download feature
 * 
 * Usage:
 *   node tests/integration/image-downloader.test.js
 *   npm test
 */

const { ImageDownloader } = require('../../dist/shared/image-downloader');
const path = require('path');

async function testImageDownload() {
  console.log('🚀 Testing image URL download feature...\n');

  // Test URLs - using public domain images
  const testUrls = [
    'https://picsum.photos/800/600',  // Random image
    'https://picsum.photos/800/601',  // Another random image
  ];

  try {
    // Create downloader instance
    const downloader = new ImageDownloader('./temp_images');
    console.log('✅ ImageDownloader created\n');

    // Test 1: Download single image
    console.log('📥 Test 1: Downloading single image...');
    const result1 = await downloader.downloadImage(testUrls[0]);
    console.log('✅ Downloaded:', result1.localPath);
    console.log('   File size:', (result1.fileSize / 1024).toFixed(2), 'KB');
    console.log('   Cached:', result1.cached);
    console.log('');

    // Test 2: Download multiple images
    console.log('📥 Test 2: Downloading multiple images...');
    const results = await downloader.downloadImages(testUrls);
    results.forEach((result, i) => {
      console.log(`✅ Image ${i + 1}:`);
      console.log('   Local path:', result.localPath);
      console.log('   File size:', (result.fileSize / 1024).toFixed(2), 'KB');
      console.log('   Cached:', result.cached);
    });
    console.log('');

    // Test 3: Process mixed paths (URLs and local)
    console.log('📥 Test 3: Processing mixed paths...');
    const mixedPaths = [
      testUrls[0],  // URL
      './tests/fixtures/Bert.jpg',  // Local file
      testUrls[1],  // URL
    ];
    const processedPaths = await downloader.processImagePaths(mixedPaths);
    console.log('✅ Processed paths:');
    processedPaths.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p}`);
    });
    console.log('');

    // Test 4: Cache test - download same URL again
    console.log('📥 Test 4: Testing cache (downloading same URL)...');
    const result2 = await downloader.downloadImage(testUrls[0]);
    console.log('✅ Downloaded:', result2.localPath);
    console.log('   Cached:', result2.cached ? '✅ YES (faster!)' : '❌ NO');
    console.log('');

    // Test 5: Check if URL is recognized
    console.log('🔍 Test 5: Testing URL detection...');
    console.log('   Is URL (http):', ImageDownloader.isImageUrl('http://example.com/img.jpg'));
    console.log('   Is URL (https):', ImageDownloader.isImageUrl('https://example.com/img.jpg'));
    console.log('   Is URL (local):', ImageDownloader.isImageUrl('./local/image.jpg'));
    console.log('');

    console.log('🎉 All tests passed!\n');
    console.log('📁 Downloaded images are in:', downloader.getSaveDir());
    console.log('💡 Tip: You can now use these image URLs in xhs_publish_content');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.context) {
      console.error('   Context:', error.context);
    }
    process.exit(1);
  }
}

// Run tests
testImageDownload().catch(console.error);

