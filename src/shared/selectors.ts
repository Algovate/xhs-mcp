/**
 * Shared CSS selectors and constants for XHS operations
 * Centralized location for all selector definitions to improve maintainability
 */

/**
 * Common button selectors used across different services
 */
export const COMMON_BUTTON_SELECTORS = {
  CONFIRM: [
    '.confirm-btn',
    'button.confirm-btn',
    'button[class*="confirm"]',
    '.ok-btn',
    'button:contains("确认")',
    'button:contains("确定")',
    'button:contains("confirm")',
    'button:contains("ok")',
    '[aria-label*="确认"]',
    '[aria-label*="确定"]',
  ],
  CANCEL: [
    'button[class*="cancel"]',
    '.cancel-btn',
    'button:contains("取消")',
    'button:contains("cancel")',
    '[aria-label*="取消"]',
  ],
  DELETE: [
    'button[class*="delete"]',
    '.delete-btn',
    '[class*="remove"]',
    '.remove-btn',
    'button[title*="删除"]',
    'button[title*="delete"]',
    '[aria-label*="删除"]',
    '[aria-label*="delete"]',
    'button:contains("删除")',
    'button:contains("delete")',
  ],
  MORE_OPTIONS: [
    'button[class*="more"]',
    '.more-btn',
    '[class*="menu"]',
    '.menu-btn',
    'button[class*="action"]',
    '.action-btn',
    'button[class*="option"]',
    '.option-btn',
    'button[title*="更多"]',
    'button[title*="more"]',
    '[aria-label*="更多"]',
    '[aria-label*="more"]',
    'button:contains("⋯")',
    'button:contains("...")',
    '.three-dots',
    '.ellipsis',
  ],
} as const;

/**
 * Common modal and dialog selectors
 */
export const COMMON_MODAL_SELECTORS = {
  CONFIRM: [
    '.modal button[class*="confirm"]',
    '.dialog button[class*="confirm"]',
    '[class*="modal"] button[class*="confirm"]',
    '.ant-modal button[class*="confirm"]',
    '.el-dialog button[class*="confirm"]',
  ],
  CANCEL: [
    '.modal button[class*="cancel"]',
    '.dialog button[class*="cancel"]',
    '[class*="modal"] button[class*="cancel"]',
    '.ant-modal button[class*="cancel"]',
    '.el-dialog button[class*="cancel"]',
  ],
  DROPDOWN_MENU: [
    '.dropdown-menu',
    '.menu-list',
    '[class*="dropdown"]',
    '.context-menu',
    '.action-menu',
    '.options-menu',
    '[role="menu"]',
    '.popover-menu',
  ],
} as const;

/**
 * Common status and indicator selectors
 */
export const COMMON_STATUS_SELECTORS = {
  SUCCESS: [
    '.success-message',
    '.publish-success',
    '[data-testid="publish-success"]',
    '.toast-success',
    '.upload-success',
    '.video-upload-success',
    '.video-processing-complete',
    '.upload-complete',
  ],
  ERROR: [
    '.error-message',
    '.publish-error',
    '[data-testid="publish-error"]',
    '.toast-error',
    '.error-toast',
    '.upload-error',
    '.video-upload-error',
  ],
  PROCESSING: [
    '.video-processing',
    '.upload-progress',
    '.processing-indicator',
    '[class*="processing"]',
    '[class*="uploading"]',
    '.progress-bar',
    '.upload-status',
  ],
  TOAST: ['.toast', '.message', '.notification', '[role="alert"]', '.ant-message', '.el-message'],
} as const;

/**
 * Common text patterns for status detection
 */
export const COMMON_TEXT_PATTERNS = {
  SUCCESS: ['成功', 'success', '完成'],
  ERROR: ['失败', 'error', '错误'],
  PROCESSING: ['处理中', '上传中', 'processing', 'uploading', '进度'],
} as const;

/**
 * Common file input selectors
 */
export const COMMON_FILE_SELECTORS = {
  FILE_INPUT: [
    'input[type=file]',
    '.upload-input',
    'input[accept*="video"]',
    'input[accept*="mp4"]',
    'input[class*="upload"]',
    'input[class*="file"]',
  ],
} as const;
