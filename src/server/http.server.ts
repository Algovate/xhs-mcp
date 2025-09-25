/**
 * HTTP Server with SSE and Streamable HTTP Transport Support
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from '../lib/shared/config.js';
import { ToolHandlers } from './handlers/tool.handlers.js';
import { ResourceHandlers } from './handlers/resource.handlers.js';
import { XHS_TOOL_SCHEMAS, XHS_RESOURCE_SCHEMAS } from './schemas/tool.schemas.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export class XHSHTTPMCPServer {
  private app: express.Application;
  private config: ReturnType<typeof getConfig>;
  private toolHandlers: ToolHandlers;
  private resourceHandlers: ResourceHandlers;
  private transports: Map<string, SSEServerTransport | StreamableHTTPServerTransport> = new Map();
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.config = getConfig();
    this.toolHandlers = new ToolHandlers();
    this.resourceHandlers = new ResourceHandlers();
    this.app = express();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Configure CORS to expose Mcp-Session-Id header for browser-based clients
    this.app.use(cors({
      origin: '*', // Allow all origins - adjust as needed for production
      exposedHeaders: ['Mcp-Session-Id']
    }));
  }

  private setupRoutes(): void {
    // Streamable HTTP Transport (Protocol version 2025-03-26)
    this.app.all('/mcp', this.handleStreamableHTTP.bind(this));
    
    // Deprecated HTTP+SSE Transport (Protocol version 2024-11-05)
    this.app.get('/sse', this.handleSSEConnection.bind(this));
    this.app.post('/messages', this.handleSSEMessage.bind(this));
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        server: this.config.server.name,
        version: this.config.server.version,
        transports: ['streamable-http', 'sse']
      });
    });
  }

  private async handleStreamableHTTP(req: express.Request, res: express.Response): Promise<void> {
    console.log(`Received ${req.method} request to /mcp`);
    
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string;
      let transport: StreamableHTTPServerTransport | undefined;
      
      if (sessionId && this.transports.has(sessionId)) {
        const existingTransport = this.transports.get(sessionId);
        if (existingTransport instanceof StreamableHTTPServerTransport) {
          transport = existingTransport;
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Session exists but uses a different transport protocol',
            },
            id: null,
          });
          return;
        }
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // Create new Streamable HTTP transport
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            console.log(`StreamableHTTP session initialized with ID: ${sessionId}`);
            this.transports.set(sessionId, transport!);
          },
          onsessionclosed: (sessionId) => {
            console.log(`StreamableHTTP session closed: ${sessionId}`);
            this.transports.delete(sessionId);
          }
        });

        // Set up onclose handler to clean up transport when closed
        transport.onclose = () => {
          const sid = transport!.sessionId;
          if (sid && this.transports.has(sid)) {
            console.log(`Transport closed for session ${sid}, removing from transports map`);
            this.transports.delete(sid);
          }
        };

        // Connect the transport to the MCP server
        const server = this.createMCPServer();
        await server.connect(transport);
      } else {
        // Invalid request - no session ID or not initialization request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      // Handle the request with the transport
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling Streamable HTTP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  }

  private async handleSSEConnection(req: express.Request, res: express.Response): Promise<void> {
    console.log('Received GET request to /sse (deprecated SSE transport)');
    
    try {
      const transport = new SSEServerTransport('/messages', res);
      this.transports.set(transport.sessionId, transport);
      
      res.on('close', () => {
        this.transports.delete(transport.sessionId);
      });

      const server = this.createMCPServer();
      await server.connect(transport);
    } catch (error) {
      console.error('Error handling SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  }

  private async handleSSEMessage(req: express.Request, res: express.Response): Promise<void> {
    const sessionId = req.query.sessionId as string;
    
    try {
      const transport = this.transports.get(sessionId);
      
      if (!transport || !(transport instanceof SSEServerTransport)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Session exists but uses a different transport protocol',
          },
          id: null,
        });
        return;
      }

      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Error handling SSE message:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  }

  private createMCPServer(): Server {
    const server = new Server(
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

    // Setup tool handlers
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await this.toolHandlers.handleToolRequest(name, args);
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: XHS_TOOL_SCHEMAS,
      };
    });

    // Setup resource handlers
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: XHS_RESOURCE_SCHEMAS,
      };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      return await this.resourceHandlers.handleResourceRequest(uri);
    });

    return server;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.port, (error?: Error) => {
        if (error) {
          console.error('Failed to start HTTP server:', error);
          reject(error);
          return;
        }
        
        console.log(`XHS MCP HTTP Server listening on port ${this.port}`);
        console.log(`
==============================================
SUPPORTED TRANSPORT OPTIONS:

1. Streamable HTTP (Protocol version: 2025-03-26)
   Endpoint: /mcp
   Methods: GET, POST, DELETE
   Usage: 
     - Initialize with POST to /mcp
     - Establish SSE stream with GET to /mcp
     - Send requests with POST to /mcp
     - Terminate session with DELETE to /mcp

2. HTTP + SSE (Protocol version: 2024-11-05)
   Endpoints: /sse (GET) and /messages (POST)
   Usage:
     - Establish SSE stream with GET to /sse
     - Send requests with POST to /messages?sessionId=<id>

3. Health Check
   Endpoint: /health
   Method: GET
   Usage: Check server status and supported transports
==============================================
`);
        resolve();
      });

      // Handle server shutdown
      process.on('SIGINT', async () => {
        console.log('Shutting down HTTP server...');
        
        // Close all active transports to properly clean up resources
        for (const [sessionId, transport] of this.transports) {
          try {
            console.log(`Closing transport for session ${sessionId}`);
            await transport.close();
          } catch (error) {
            console.error(`Error closing transport for session ${sessionId}:`, error);
          }
        }
        
        this.transports.clear();
        server.close(() => {
          console.log('HTTP server shutdown complete');
          process.exit(0);
        });
      });

      process.on('SIGTERM', async () => {
        console.log('Shutting down HTTP server...');
        
        // Close all active transports to properly clean up resources
        for (const [sessionId, transport] of this.transports) {
          try {
            console.log(`Closing transport for session ${sessionId}`);
            await transport.close();
          } catch (error) {
            console.error(`Error closing transport for session ${sessionId}:`, error);
          }
        }
        
        this.transports.clear();
        server.close(() => {
          console.log('HTTP server shutdown complete');
          process.exit(0);
        });
      });
    });
  }

  async stop(): Promise<void> {
    // Close all active transports
    for (const [sessionId, transport] of this.transports) {
      try {
        await transport.close();
      } catch (error) {
        console.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }
    this.transports.clear();
  }
}
