#!/usr/bin/env node

/**
 * 基于 CLI 调用的小红书发布功能验证脚本
 * 避免模块导入问题，直接使用现有的 CLI 工具
 */

const { spawn, exec } = require('child_process');
const { existsSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

class CLIValidationTester {
  constructor() {
    this.testResults = [];
    this.testNoteId = null;
    this.testTitle = null;
    this.cliPath = 'npx tsx src/cli/cli.ts';
  }

  /**
   * 运行完整的验证测试
   */
  async runValidationTest() {
    console.log('🚀 开始小红书发布功能验证测试...');

    const startTime = Date.now();

    try {
      // 1. 发布内容
      await this.testPublishContent();

      // 2. 验证发布成功
      await this.testVerifyPublish();

      // 3. 删除内容
      await this.testDeleteContent();

      // 4. 验证删除成功
      await this.testVerifyDelete();

    } catch (error) {
      console.error(`验证测试过程中发生错误: ${error}`);
      this.addResult('error', false, `测试过程中发生错误: ${error}`, Date.now());
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log(`✅ 验证测试完成，总耗时: ${totalDuration}ms`);

    return this.generateReport();
  }

  /**
   * 测试发布内容
   */
  async testPublishContent() {
    const startTime = Date.now();
    console.log('📝 开始测试发布内容...');

    try {
      // 使用测试图片
      const testImagePath = this.getTestImagePath();
      if (!testImagePath) {
        throw new Error('未找到测试图片');
      }

      const title = `验证测试-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;
      const content = '这是一个自动化验证测试的内容，用于测试发布功能是否正常工作。';

      // 构建发布命令
      const publishCommand = [
        'publish',
        '-t', 'image',
        '--title', title,
        '--content', content,
        '-m', testImagePath,
        '--tags', '测试,验证,自动化'
      ];

      console.log(`执行发布命令: ${this.cliPath} ${publishCommand.join(' ')}`);

      const result = await this.executeCLICommand(publishCommand);

      if (result.success) {
        // 尝试从输出中提取笔记ID
        this.testNoteId = this.extractNoteIdFromOutput(result.output);
        this.testTitle = title;
        const duration = Date.now() - startTime;

        this.addResult(
          'publish',
          true,
          `发布成功: ${result.output}`,
          Date.now(),
          duration,
          this.testNoteId,
          this.testTitle
        );

        console.log(`✅ 发布成功 - Note ID: ${this.testNoteId}`);
      } else {
        throw new Error(`发布失败: ${result.error}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult(
        'publish',
        false,
        `发布失败: ${error}`,
        Date.now(),
        duration,
        undefined,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 测试验证发布成功
   */
  async testVerifyPublish() {
    const startTime = Date.now();
    console.log('🔍 开始验证发布成功...');

    try {
      if (!this.testNoteId) {
        throw new Error('没有可验证的笔记ID');
      }

      // 获取用户笔记列表
      const userNotesCommand = ['usernote', 'list'];
      const result = await this.executeCLICommand(userNotesCommand);

      if (result.success) {
        // 检查输出中是否包含刚发布的笔记
        const hasPublishedNote = result.output.includes(this.testNoteId) ||
                                result.output.includes(this.testTitle);

        if (hasPublishedNote) {
          const duration = Date.now() - startTime;
          this.addResult(
            'verify_publish',
            true,
            `验证发布成功: 找到笔记 "${this.testTitle}"`,
            Date.now(),
            duration,
            this.testNoteId,
            this.testTitle
          );

          console.log(`✅ 验证发布成功 - 找到笔记: ${this.testTitle}`);
        } else {
          throw new Error('在笔记列表中未找到刚发布的笔记');
        }
      } else {
        throw new Error('无法获取用户笔记列表');
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult(
        'verify_publish',
        false,
        `验证发布失败: ${error}`,
        Date.now(),
        duration,
        this.testNoteId,
        this.testTitle,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 测试删除内容
   */
  async testDeleteContent() {
    const startTime = Date.now();
    console.log('🗑️ 开始测试删除内容...');

    try {
      if (!this.testNoteId) {
        throw new Error('没有可删除的笔记ID');
      }

      // 删除笔记
      const deleteCommand = ['usernote', 'delete', '--note-id', this.testNoteId];
      const result = await this.executeCLICommand(deleteCommand);

      if (result.success) {
        const duration = Date.now() - startTime;
        this.addResult(
          'delete',
          true,
          `删除成功: ${result.output}`,
          Date.now(),
          duration,
          this.testNoteId,
          this.testTitle
        );

        console.log(`✅ 删除成功 - Note ID: ${this.testNoteId}`);
      } else {
        throw new Error(`删除失败: ${result.error}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult(
        'delete',
        false,
        `删除失败: ${error}`,
        Date.now(),
        duration,
        this.testNoteId,
        this.testTitle,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 测试验证删除成功
   */
  async testVerifyDelete() {
    const startTime = Date.now();
    console.log('🔍 开始验证删除成功...');

    try {
      if (!this.testNoteId) {
        throw new Error('没有可验证的笔记ID');
      }

      // 等待一段时间让删除操作生效
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 获取用户笔记列表
      const userNotesCommand = ['usernote', 'list'];
      const result = await this.executeCLICommand(userNotesCommand);

      if (result.success) {
        // 检查输出中是否还包含刚删除的笔记
        const hasDeletedNote = result.output.includes(this.testNoteId) ||
                               result.output.includes(this.testTitle);

        if (!hasDeletedNote) {
          const duration = Date.now() - startTime;
          this.addResult(
            'verify_delete',
            true,
            `验证删除成功: 笔记已从列表中移除`,
            Date.now(),
            duration,
            this.testNoteId,
            this.testTitle
          );

          console.log(`✅ 验证删除成功 - 笔记已从列表中移除`);
        } else {
          throw new Error('笔记仍然存在于笔记列表中');
        }
      } else {
        throw new Error('无法获取用户笔记列表');
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult(
        'verify_delete',
        false,
        `验证删除失败: ${error}`,
        Date.now(),
        duration,
        this.testNoteId,
        this.testTitle,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 执行 CLI 命令
   */
  async executeCLICommand(args) {
    return new Promise((resolve) => {
      const command = `${this.cliPath} ${args.join(' ')}`;
      console.log(`执行命令: ${command}`);

      exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            output: stdout,
            error: stderr || error.message
          });
        } else {
          resolve({
            success: true,
            output: stdout,
            error: null
          });
        }
      });
    });
  }

  /**
   * 从输出中提取笔记ID
   */
  extractNoteIdFromOutput(output) {
    // 尝试从输出中提取笔记ID
    const noteIdMatch = output.match(/note[_-]?id[:\s]+([a-f0-9]+)/i) ||
                       output.match(/id[:\s]+([a-f0-9]{20,})/i) ||
                       output.match(/([a-f0-9]{20,})/);

    return noteIdMatch ? noteIdMatch[1] : null;
  }

  /**
   * 获取测试图片路径
   */
  getTestImagePath() {
    const possiblePaths = [
      'examples/images/circle.png',
      'examples/images/geometric.png',
      'examples/images/wave.png',
      'examples/images/circle.svg',
      'examples/images/geometric.svg',
      'examples/images/wave.svg'
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return null;
  }

  /**
   * 添加测试结果
   */
  addResult(step, success, message, timestamp, duration, noteId, title, error) {
    this.testResults.push({
      step,
      success,
      message,
      timestamp,
      duration,
      noteId,
      title,
      error
    });
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    const summary = {
      publishSuccess: this.testResults.find(r => r.step === 'publish')?.success || false,
      verifyPublishSuccess: this.testResults.find(r => r.step === 'verify_publish')?.success || false,
      deleteSuccess: this.testResults.find(r => r.step === 'delete')?.success || false,
      verifyDeleteSuccess: this.testResults.find(r => r.step === 'verify_delete')?.success || false,
    };

    const report = {
      testDate: new Date().toISOString(),
      totalTests,
      passedTests,
      failedTests,
      results: this.testResults,
      summary
    };

    return report;
  }

  /**
   * 保存测试报告到文件
   */
  async saveReport(report) {
    const reportsDir = 'reports';
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    // 保存 JSON 报告
    const jsonFilename = `cli-validation-test-${timestamp}.json`;
    const jsonFilepath = join(reportsDir, jsonFilename);
    writeFileSync(jsonFilepath, JSON.stringify(report, null, 2), 'utf8');
    
    // 生成并保存 HTML 报告
    const htmlFilename = `cli-validation-test-${timestamp}.html`;
    const htmlFilepath = join(reportsDir, htmlFilename);
    const htmlContent = this.generateHTMLReport(report);
    writeFileSync(htmlFilepath, htmlContent, 'utf8');
    
    console.log(`📊 JSON 报告已保存到: ${jsonFilepath}`);
    console.log(`📊 HTML 报告已保存到: ${htmlFilepath}`);
    return { jsonFilepath, htmlFilepath };
  }

  /**
   * 生成 HTML 格式的测试报告
   */
  generateHTMLReport(report) {
    const allPassed = Object.values(report.summary).every(Boolean);
    const successRate = ((report.passedTests / report.totalTests) * 100).toFixed(1);
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小红书发布功能验证测试报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .content {
            padding: 30px;
        }
        
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            border-left: 4px solid #007bff;
        }
        
        .card.success {
            border-left-color: #28a745;
            background: #d4edda;
        }
        
        .card.error {
            border-left-color: #dc3545;
            background: #f8d7da;
        }
        
        .card h3 {
            font-size: 1.5em;
            margin-bottom: 10px;
        }
        
        .card .value {
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }
        
        .card.success .value {
            color: #28a745;
        }
        
        .card.error .value {
            color: #dc3545;
        }
        
        .test-steps {
            margin-bottom: 30px;
        }
        
        .test-steps h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.8em;
        }
        
        .step-item {
            display: flex;
            align-items: center;
            padding: 15px;
            margin-bottom: 10px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        
        .step-item.success {
            border-left-color: #28a745;
            background: #d4edda;
        }
        
        .step-item.error {
            border-left-color: #dc3545;
            background: #f8d7da;
        }
        
        .step-icon {
            font-size: 1.5em;
            margin-right: 15px;
        }
        
        .step-content {
            flex: 1;
        }
        
        .step-title {
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 5px;
        }
        
        .step-message {
            color: #666;
            font-size: 0.9em;
        }
        
        .step-duration {
            color: #999;
            font-size: 0.8em;
        }
        
        .function-summary {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .function-summary h2 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.8em;
        }
        
        .function-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .function-item {
            display: flex;
            align-items: center;
            padding: 10px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid #007bff;
        }
        
        .function-item.success {
            border-left-color: #28a745;
        }
        
        .function-item.error {
            border-left-color: #dc3545;
        }
        
        .function-icon {
            font-size: 1.2em;
            margin-right: 10px;
        }
        
        .overall-status {
            text-align: center;
            padding: 30px;
            background: ${allPassed ? 'linear-gradient(135deg, #28a745, #20c997)' : 'linear-gradient(135deg, #dc3545, #fd7e14)'};
            color: white;
            border-radius: 8px;
        }
        
        .overall-status h2 {
            font-size: 2em;
            margin-bottom: 10px;
        }
        
        .overall-status .status-text {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            border-top: 1px solid #eee;
        }
        
        @media (max-width: 768px) {
            .summary-cards {
                grid-template-columns: 1fr;
            }
            
            .function-grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 小红书发布功能验证测试报告</h1>
            <div class="subtitle">CLI 版本 - ${report.testDate}</div>
        </div>
        
        <div class="content">
            <div class="summary-cards">
                <div class="card">
                    <h3>📈 总测试数</h3>
                    <div class="value">${report.totalTests}</div>
                </div>
                <div class="card success">
                    <h3>✅ 通过测试</h3>
                    <div class="value">${report.passedTests}</div>
                </div>
                <div class="card ${report.failedTests > 0 ? 'error' : ''}">
                    <h3>❌ 失败测试</h3>
                    <div class="value">${report.failedTests}</div>
                </div>
                <div class="card ${successRate >= 100 ? 'success' : 'error'}">
                    <h3>📊 成功率</h3>
                    <div class="value">${successRate}%</div>
                </div>
            </div>
            
            <div class="test-steps">
                <h2>📋 测试步骤详情</h2>
                ${report.results.map((result, index) => `
                    <div class="step-item ${result.success ? 'success' : 'error'}">
                        <div class="step-icon">${result.success ? '✅' : '❌'}</div>
                        <div class="step-content">
                            <div class="step-title">${index + 1}. ${result.step}</div>
                            <div class="step-message">${result.message}</div>
                            ${result.duration ? `<div class="step-duration">耗时: ${result.duration}ms</div>` : ''}
                            ${result.error ? `<div class="step-message" style="color: #dc3545; margin-top: 5px;">错误: ${result.error}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="function-summary">
                <h2>📊 功能验证摘要</h2>
                <div class="function-grid">
                    <div class="function-item ${report.summary.publishSuccess ? 'success' : 'error'}">
                        <div class="function-icon">📝</div>
                        <div>发布功能: ${report.summary.publishSuccess ? '✅ 正常' : '❌ 异常'}</div>
                    </div>
                    <div class="function-item ${report.summary.verifyPublishSuccess ? 'success' : 'error'}">
                        <div class="function-icon">🔍</div>
                        <div>发布验证: ${report.summary.verifyPublishSuccess ? '✅ 正常' : '❌ 异常'}</div>
                    </div>
                    <div class="function-item ${report.summary.deleteSuccess ? 'success' : 'error'}">
                        <div class="function-icon">🗑️</div>
                        <div>删除功能: ${report.summary.deleteSuccess ? '✅ 正常' : '❌ 异常'}</div>
                    </div>
                    <div class="function-item ${report.summary.verifyDeleteSuccess ? 'success' : 'error'}">
                        <div class="function-icon">🔍</div>
                        <div>删除验证: ${report.summary.verifyDeleteSuccess ? '✅ 正常' : '❌ 异常'}</div>
                    </div>
                </div>
            </div>
            
            <div class="overall-status">
                <h2>🎯 整体状态</h2>
                <div class="status-text">${allPassed ? '✅ 所有功能正常' : '❌ 存在问题'}</div>
            </div>
        </div>
        
        <div class="footer">
            <p>报告生成时间: ${new Date().toLocaleString('zh-CN')}</p>
            <p>小红书发布功能验证脚本 - CLI 版本</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * 打印测试报告摘要
   */
  printReportSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 小红书发布功能验证测试报告 (CLI版本)');
    console.log('='.repeat(60));
    console.log(`📅 测试时间: ${report.testDate}`);
    console.log(`📈 总测试数: ${report.totalTests}`);
    console.log(`✅ 通过测试: ${report.passedTests}`);
    console.log(`❌ 失败测试: ${report.failedTests}`);
    console.log(`📊 成功率: ${((report.passedTests / report.totalTests) * 100).toFixed(1)}%`);

    console.log('\n📋 测试步骤详情:');
    report.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`  ${index + 1}. ${status} ${result.step}: ${result.message}${duration}`);
      if (result.error) {
        console.log(`     错误: ${result.error}`);
      }
    });

    console.log('\n📊 功能验证摘要:');
    console.log(`  📝 发布功能: ${report.summary.publishSuccess ? '✅ 正常' : '❌ 异常'}`);
    console.log(`  🔍 发布验证: ${report.summary.verifyPublishSuccess ? '✅ 正常' : '❌ 异常'}`);
    console.log(`  🗑️ 删除功能: ${report.summary.deleteSuccess ? '✅ 正常' : '❌ 异常'}`);
    console.log(`  🔍 删除验证: ${report.summary.verifyDeleteSuccess ? '✅ 正常' : '❌ 异常'}`);

    const allPassed = Object.values(report.summary).every(Boolean);
    console.log(`\n🎯 整体状态: ${allPassed ? '✅ 所有功能正常' : '❌ 存在问题'}`);
    console.log('='.repeat(60));
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const tester = new CLIValidationTester();

    // 运行验证测试
    const report = await tester.runValidationTest();

    // 保存报告
    const reportPaths = await tester.saveReport(report);

    // 打印摘要
    tester.printReportSummary(report);

    // 根据测试结果设置退出码
    const allPassed = Object.values(report.summary).every(Boolean);
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error(`❌ 验证测试失败: ${error}`);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { CLIValidationTester };
