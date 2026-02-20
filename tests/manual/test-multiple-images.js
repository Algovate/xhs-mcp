import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the path to the CLI source file
const cliPath = path.resolve(__dirname, '../../src/cli/cli.ts');

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
console.log(`执行 CLI: npx tsx ${cliPath}`);
console.log(`图片: \n- ${images.join('\n- ')}`);

// Construct the command using tsx
// Note: Using -t image and -m explicitly for the updated CLI interface
const cmd = `npx tsx "${cliPath}" publish \
  -t image \
  --title "${title}" \
  --content "${content}" \
  -m "${images.join(',')}" \
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
