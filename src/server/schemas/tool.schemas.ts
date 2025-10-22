/**
 * Tool schemas for XHS MCP Server
 */

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const XHS_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'xhs_auth_login',
    description: 'Start XiaoHongShu login process.',
    inputSchema: {
      type: 'object',
      properties: {
        browser_path: {
          type: 'string',
          description: 'Optional custom browser binary path',
        },
      },
    },
  },
  {
    name: 'xhs_auth_logout',
    description: 'Logout from XiaoHongShu (clears saved cookies).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'xhs_auth_status',
    description: 'Check XiaoHongShu login status (fast check with browser).',
    inputSchema: {
      type: 'object',
      properties: {
        browser_path: {
          type: 'string',
          description: 'Optional custom browser binary path',
        },
      },
    },
  },
  {
    name: 'xhs_discover_feeds',
    description: 'Get home page feed list.',
    inputSchema: {
      type: 'object',
      properties: {
        browser_path: {
          type: 'string',
          description: 'Optional custom browser binary path',
        },
      },
    },
  },
  {
    name: 'xhs_search_note',
    description: 'Search for notes by keyword.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Search keyword (required)',
        },
        browser_path: {
          type: 'string',
          description: 'Optional custom browser binary path',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'xhs_get_note_detail',
    description: 'Get detailed information about a specific note.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_id: {
          type: 'string',
          description: 'Feed ID (required)',
        },
        xsec_token: {
          type: 'string',
          description: 'Security token for the feed (required)',
        },
        browser_path: {
          type: 'string',
          description: 'Optional custom browser binary path',
        },
      },
      required: ['feed_id', 'xsec_token'],
    },
  },
  {
    name: 'xhs_comment_on_note',
    description: 'Comment on a note.',
    inputSchema: {
      type: 'object',
      properties: {
        feed_id: {
          type: 'string',
          description: 'Feed ID (required)',
        },
        xsec_token: {
          type: 'string',
          description: 'Security token for the feed (required)',
        },
        note: {
          type: 'string',
          description: 'Comment note (required)',
        },
        browser_path: {
          type: 'string',
          description: 'Optional custom browser binary path',
        },
      },
      required: ['feed_id', 'xsec_token', 'note'],
    },
  },
  {
    name: 'xhs_publish_content',
    description: 'Publish content to XiaoHongShu (supports both images and videos).',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['image', 'video'],
          description: 'Content type: "image" for images, "video" for videos (required)',
        },
        title: {
          type: 'string',
          description: 'Content title (required, max 20 characters)',
          maxLength: 20,
        },
        content: {
          type: 'string',
          description: 'Content description (required, max 1000 characters)',
          maxLength: 1000,
        },
        media_paths: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of media file paths (required, non-empty). For images: 1-18 image files. For videos: exactly 1 video file.',
          maxItems: 18,
        },
        tags: {
          type: 'string',
          description: 'Comma-separated tags (optional)',
        },
        browser_path: {
          type: 'string',
          description: 'Optional custom browser binary path',
        },
      },
      required: ['type', 'title', 'content', 'media_paths'],
    },
  },
];

export const XHS_RESOURCE_SCHEMAS = [
  {
    uri: 'xhs://cookies',
    name: 'XHS Authentication Cookies',
    description: 'Current XiaoHongShu authentication cookies and info',
    mimeType: 'application/json',
  },
  {
    uri: 'xhs://config',
    name: 'XHS Server Configuration',
    description: 'XHS MCP server configuration',
    mimeType: 'application/json',
  },
  {
    uri: 'xhs://status',
    name: 'XHS Server Status',
    description: 'Current server and authentication status',
    mimeType: 'application/json',
  },
];
