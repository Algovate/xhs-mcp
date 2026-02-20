const { execSync } = require('child_process');
const path = require('path');

// Get the path to the CLI executable
const cliPath = path.resolve(__dirname, '../../dist/xhs-mcp.js');

// 3 test images created from the fixture
const images = [
    path.resolve(__dirname, 'test1.jpg'),
    path.resolve(__dirname, 'test2.jpg'),
    path.resolve(__dirname, 'test3.jpg')
];

const title = "测试批量上传多图功能";
const content = "这是一条通过自动化脚本测试的小红书笔记，如果该笔记包含了三张图片，则说明我们的修复是成功的。";
const tags = "测试,自动化";

console.log("准备测试 XHS MCP 多图上传功能...");
console.log(`执行 CLI: ${cliPath}`);
console.log(`图片: \n- ${images.join('\n- ')}`);

// Construct the command
const cmd = `node "${cliPath}" publish \
  --title "${title}" \
  --content "${content}" \
  --images "${images.join(',')}" \
  --tags "${tags}"`;

console.log("\n正在执行发布...");
try {
    // Pass stdio so we can see the console logs from puppeteer
    execSync(cmd, { stdio: 'inherit' });
    console.log("\n✅ 测试执行完毕。请检查小红书创作者平台的草稿箱或主页，确认是否成功上传了多张图片。");
} catch (error) {
    console.error("\n❌ 测试执行失败:", error.message);
    process.exit(1);
}
