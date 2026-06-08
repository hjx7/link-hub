/**
 * xterm.js 和 FitAddon 的全局类型声明（UMD）
 */

declare class Terminal {
  constructor(options?: Record<string, unknown>);
  open(element: HTMLElement): void;
  write(data: string): void;
  writeln(data: string): void;
  dispose(): void;
  focus(): void;
  loadAddon(addon: unknown): void;
  onData(callback: (data: string) => void): void;
}

declare namespace FitAddon {
  class FitAddon {
    fit(): void;
    proposeDimensions(): { cols: number; rows: number } | undefined;
  }
}
