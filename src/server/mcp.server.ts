/**
 * MCP Server for XiaoHongShu Operations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from '../lib/shared/config.js';
import { ToolHandlers } from './handlers/tool.handlers.js';
import { ResourceHandlers } from './handlers/resource.handlers.js';
import { XHS_TOOL_SCHEMAS, XHS_RESOURCE_SCHEMAS } from './schemas/tool.schemas.js';

export class XHSMCPServer {
  private server: Server;
  private toolHandlers: ToolHandlers;
  private resourceHandlers: ResourceHandlers;
  private config: ReturnType<typeof getConfig>;
  private static instance: XHSMCPServer | null = null;

  constructor() {
    this.config = getConfig();
    this.toolHandlers = new ToolHandlers();
    this.resourceHandlers = new ResourceHandlers();
    this.server = new Server(
      {
        name: this.config.server.name,
        version: this.config.server.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await this.toolHandlers.handleToolRequest(name, args);
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: XHS_TOOL_SCHEMAS,
      };
    });
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: XHS_RESOURCE_SCHEMAS,
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      return await this.resourceHandlers.handleResourceRequest(uri);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // Don't log to stderr in stdio mode to avoid interfering with MCP protocol
  }
}
