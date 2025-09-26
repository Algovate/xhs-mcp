---
inclusion: fileMatch
fileMatchPattern: ['src/server/**/*.ts']
---

# MCP Server Development Patterns

## Server Architecture

This project implements Model Context Protocol (MCP) servers with both stdio and HTTP transports.

### Core Components

- **XHSMCPServer**: [src/server/mcp.server.ts](mdc:src/server/mcp.server.ts) - Stdio transport implementation
- **XHSHTTPMCPServer**: [src/server/http.server.ts](mdc:src/server/http.server.ts) - HTTP transport implementation
- **Tool Handlers**: [src/server/handlers/tool.handlers.ts](mdc:src/server/handlers/tool.handlers.ts) - MCP tool implementations
- **Resource Handlers**: [src/server/handlers/resource.handlers.ts](mdc:src/server/handlers/resource.handlers.ts) - MCP resource implementations
- **Schemas**: [src/server/schemas/tool.schemas.ts](mdc:src/server/schemas/tool.schemas.ts) - Tool and resource schemas

## MCP Tool Implementation

### Tool Schema Pattern
```typescript
{
  name: 'xhs_tool_name',
  description: 'Clear description of tool functionality',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' },
      param2: { type: 'number', description: 'Optional parameter' }
    },
    required: ['param1']
  }
}
```

### Tool Handler Pattern
```typescript
async handleToolRequest(name: string, args: any): Promise<CallToolResult> {
  try {
    switch (name) {
      case 'xhs_tool_name':
        return await this.handleXHSTool(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
}
```

## Transport Considerations

### Stdio Mode
- **No stdout/stderr logging** - Only MCP protocol messages to stdout
- **Silent error handling** - Log errors only when XHS_ENABLE_LOGGING=true
- **Graceful shutdown** - Handle SIGINT/SIGTERM without logging

### HTTP Mode
- **Multiple endpoints** - Support /mcp, /sse, /messages, /health
- **CORS enabled** - Allow cross-origin requests
- **Error responses** - Return proper HTTP status codes
- **Logging allowed** - Can log to console in HTTP mode

## Error Handling

- **Always return CallToolResult** - Never throw unhandled exceptions
- **Include error context** - Provide operation details in error messages
- **Use isError flag** - Set isError: true for failed operations
- **Consistent error format** - Use XHSResponse interface for error structure