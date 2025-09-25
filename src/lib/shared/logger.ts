/**
 * Logger for XHS MCP Server
 * Avoids logging to stderr in stdio mode to prevent interference with MCP protocol
 */

export class Logger {
  private static instance: Logger;
  private enabled: boolean = false;

  private constructor() {
    // Only enable logging if not in stdio mode
    // In stdio mode, we suppress all logging to avoid interfering with MCP protocol
    this.enabled = process.env.XHS_ENABLE_LOGGING === 'true';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public debug(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.error(`[INFO] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.error(`[WARN] ${message}`, ...args);
    }
  }

  public error(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export const logger = Logger.getInstance();
