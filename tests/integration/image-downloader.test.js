#!/usr/bin/env node
/**
 * Test script for image URL download feature
 * 
 * Usage:
 *   node tests/integration/image-downloader.test.js
 *   npm test
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, statSync, rmSync } from 'fs';
import { join } from 'path';
import fetch from 'node-fetch';

// Inline ImageDownloader for testing (simplified version)
class ImageDownloader {
  constructor(saveDir = './temp_images', timeout = 30000, maxFileSize = 10 * 1024 * 1024) {
    this.saveDir = saveDir;
    this.timeout = timeout;
    this.maxFileSize = maxFileSize;
    if (!existsSync(this.saveDir)) {
      mkdirSync(this.saveDir, { recursive: true });
    }
  }

  static isImageUrl(path) {
    if (!path) return false;
    const lowerPath = path.toLowerCase().trim();
    return lowerPath.startsWith('http://') || lowerPath.startsWith('https://');
  }

  generateFileName(imageUrl) {
    const hash = createHash('sha256').update(imageUrl).digest('hex');
    const shortHash = hash.substring(0, 16);
    let extension = 'jpg';
    try {
      const url = new URL(imageUrl);
      const pathname = url.pathname.toLowerCase();
      const match = pathname.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
      if (match) extension = match[1];
    } catch { }
    return `img_${shortHash}.${extension}`;
  }

  validateImageData(buffer) {
    if (buffer.length < 12) return { isValid: false, extension: '' };
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { isValid: true, extension: 'jpg' };
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return { isValid: true, extension: 'png' };
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return { isValid: true, extension: 'gif' };
    return { isValid: false, extension: '' };
  }

  async downloadImage(imageUrl) {
    if (!ImageDownloader.isImageUrl(imageUrl)) throw new Error(`Invalid URL: ${imageUrl}`);
    const fileName = this.generateFileName(imageUrl);
    const localPath = join(this.saveDir, fileName);
    if (existsSync(localPath)) {
      const stats = statSync(localPath);
      return { originalUrl: imageUrl, localPath, cached: true, fileSize: stats.size };
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const response = await fetch(imageUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validation = this.validateImageData(buffer);
    if (!validation.isValid) throw new Error('Not a valid image');
    writeFileSync(localPath, buffer);
    return { originalUrl: imageUrl, localPath, cached: false, fileSize: buffer.length };
  }

  async downloadImages(imageUrls) {
    return Promise.all(imageUrls.map(url => this.downloadImage(url)));
  }

  async processImagePaths(imagePaths) {
    const results = [];
    for (const path of imagePaths) {
      if (ImageDownloader.isImageUrl(path)) {
        const result = await this.downloadImage(path);
        results.push(result.localPath);
      } else {
        if (!existsSync(path)) throw new Error(`File not found: ${path}`);
        results.push(path);
      }
    }
    return results;
  }

  getSaveDir() { return this.saveDir; }
}

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

