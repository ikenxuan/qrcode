'use client';

import { Toast, ToastQueue } from '@heroui/react';

/**
 * 顶部提示使用独立队列，避免和默认的右下角提示混在一起。
 */
export const topToastQueue = new ToastQueue({ maxVisibleToasts: 3 });

export function ToastProvider() {
  return (
    <>
      <Toast.Provider placement="bottom end" width="min(420px, calc(100vw - 24px))" />
      <Toast.Provider
        hotkey={[]}
        placement="top"
        queue={topToastQueue}
        width="min(420px, calc(100vw - 24px))"
      />
    </>
  );
}
