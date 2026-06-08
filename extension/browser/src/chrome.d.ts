/**
 * Chrome Extension API 类型声明（简化版）
 * 后续可用 @types/chrome 替代
 */

declare namespace chrome {
  namespace runtime {
    const lastError: { message?: string } | undefined;
    function sendMessage(message: unknown, callback: (response: unknown) => void): void;
    function getURL(path: string): string;
    const onMessage: {
      addListener(callback: (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => boolean | void): void;
    };
  }

  namespace bookmarks {
    function getTree(): Promise<unknown[]>;
  }

  namespace tabs {
    function create(properties: { url: string }): void;
  }
}


/**
 * xterm.js 全局类型声明（UMD 方式加载）
 */
declare class Terminal {
  constructor(options?: Record<string, unknown>);
  loadAddon(addon: unknown): void;
  open(element: HTMLElement): void;
  write(data: string): void;
  writeln(data: string): void;
  dispose(): void;
  focus(): void;
  onData(callback: (data: string) => void): void;
}

declare namespace FitAddon {
  class FitAddon {
    fit(): void;
    proposeDimensions(): { cols: number; rows: number } | undefined;
  }
}
