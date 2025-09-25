---
noteId: "aa57c8c098f311f0a8e11dcb3e2fc94e"
tags: []
---
# HTTP Transports Support

XHS MCP Server now supports both SSE (Server-Sent Events) and Streamable HTTP transports, in addition to the traditional stdio transport.

## Transport Options

### 1. Streamable HTTP (Recommended)

- **Protocol Version**: 2025-03-26
- **Endpoint**: `/mcp`
- **Methods**: GET, POST, DELETE
- **Features**:
  - Unified endpoint for all operations
  - Session management with resumability
  - On-demand streaming
  - Stateless server support

### 2. HTTP + SSE (Legacy)

- **Protocol Version**: 2024-11-05
- **Endpoints**:
  - `/sse` (GET) - Establish SSE stream
  - `/messages` (POST) - Send messages
- **Features**:
  - Traditional SSE implementation
  - Backward compatibility

### 3. Stdio (Default)

- **Protocol**: Standard MCP stdio transport
- **Usage**: Direct process communication
- **Features**:
  - Zero configuration
  - Process-based communication

## Usage

### Starting the HTTP Server

```bash
# Start HTTP server on default port 3000
npm run start:http

# Start HTTP server on custom port
npm run start:http -- --port 8080

# Development mode with HTTP server
npm run dev:http

# Development mode with custom port
npm run dev:http -- --port 8080
```

### Command Line Options

```bash
# Show help
node dist/index.js --help

# Start in stdio mode (default)
node dist/index.js --mode stdio

# Start in HTTP mode
node dist/index.js --mode http --port 3000
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server status and supported transports.

**Response:**

```json
{
  "status": "healthy",
  "server": "xhs-mcp",
  "version": "0.2.10",
  "transports": ["streamable-http", "sse"]
}
```

### Streamable HTTP Transport

#### Initialize Session

```
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {},
    "clientInfo": {
      "name": "client-name",
      "version": "1.0.0"
    }
  }
}
```

**Response Headers:**

```
Mcp-Session-Id: <session-id>
```

#### Send Requests

```
POST /mcp
Content-Type: application/json
Mcp-Session-Id: <session-id>

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

#### Establish SSE Stream

```
GET /mcp
Mcp-Session-Id: <session-id>
```

#### Terminate Session

```
DELETE /mcp
Mcp-Session-Id: <session-id>
```

### SSE Transport (Legacy)

#### Establish SSE Stream

```
GET /sse
```

#### Send Messages

```
POST /messages?sessionId=<session-id>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "client-name",
      "version": "1.0.0"
    }
  }
}
```

## Testing

A test script is provided to verify the HTTP server functionality:

```bash
# Start the HTTP server in one terminal
npm run dev:http

# Run tests in another terminal
node test-http-server.js
```

## Configuration

### Environment Variables

- `XHS_ENABLE_LOGGING=true` - Enable detailed logging
- `PORT` - HTTP server port (default: 3000)

### CORS Configuration

The HTTP server is configured with permissive CORS settings for development:

```javascript
app.use(cors({
  origin: '*', // Allow all origins
  exposedHeaders: ['Mcp-Session-Id']
}));
```

For production, you should restrict the `origin` to specific domains.

## Security Considerations

### DNS Rebinding Protection

Both SSE and Streamable HTTP transports support DNS rebinding protection:

```javascript
const transport = new SSEServerTransport('/messages', res, {
  allowedHosts: ['localhost', '127.0.0.1'],
  allowedOrigins: ['http://localhost:3000'],
  enableDnsRebindingProtection: true
});
```

### Session Management

- Session IDs are generated using cryptographically secure UUIDs
- Sessions are automatically cleaned up when connections close
- Invalid session IDs are rejected with appropriate error responses

## Migration Guide

### From Stdio to HTTP

1. **Update client configuration** to use HTTP endpoints instead of stdio
2. **Handle session management** for stateful operations
3. **Implement proper error handling** for HTTP-specific errors
4. **Consider CORS requirements** for browser-based clients

### From SSE to Streamable HTTP

1. **Update protocol version** from `2024-11-05` to `2025-03-26`
2. **Use unified `/mcp` endpoint** instead of separate `/sse` and `/messages`
3. **Implement session ID handling** in request headers
4. **Update client to handle** both streaming and direct responses

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the port using `--port` option
2. **CORS errors**: Configure allowed origins in production
3. **Session not found**: Ensure session ID is properly included in headers
4. **Connection timeouts**: Check network configuration and firewall 

### Debug Mode

Enable detailed logging:

```bash
XHS_ENABLE_LOGGING=true npm run dev:http
```

### Health Check

Always verify server status:

```bash
curl http://localhost:3000/health
```
