#!/usr/bin/env node

/**
 * Main entry point for XHS MCP Server
 */

import { Command } from 'commander';
import { XHSMCPServer } from './server/mcp.server.js';
import { XHSHTTPMCPServer } from './server/http.server.js';
import { getConfig } from './lib/shared/config.js';

async function main(): Promise<void> {
  const config = getConfig();
  const program = new Command();

  program
    .name('xhs-mcp')
    .description(`XHS MCP Server v${config.server.version}`)
    .version(config.server.version)
    .option('-m, --mode <mode>', 'Server mode: stdio or http', 'stdio')
    .option('-p, --port <port>', 'HTTP server port (only for http mode)', '3000')
    .parse();

  const options = program.opts();

  try {
    if (options.mode === 'http') {
      const port = parseInt(options.port, 10);
      const httpServer = new XHSHTTPMCPServer(port);
      await httpServer.start();
    } else {
      // In stdio mode, we must not output anything to stdout/stderr except MCP protocol messages
      // This prevents interference with MCP communication
      const server = new XHSMCPServer();
      await server.start();
    }
  } catch (error) {
    // Only log to stderr if logging is explicitly enabled
    if (process.env.XHS_ENABLE_LOGGING === 'true') {
      process.stderr.write(`Server failed to start: ${error}\n`);
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  // Don't log to stderr in stdio mode to avoid interfering with MCP protocol
  process.exit(0);
});

process.on('SIGTERM', () => {
  // Don't log to stderr in stdio mode to avoid interfering with MCP protocol
  process.exit(0);
});

// Start the server
main().catch((error) => {
  // Only log to stderr if logging is explicitly enabled
  if (process.env.XHS_ENABLE_LOGGING === 'true') {
    process.stderr.write(`Fatal error: ${error}\n`);
  }
  process.exit(1);
});
