'use client';

import { Toast } from '@heroui/react';

export function ToastProvider() {
  return <Toast.Provider placement="bottom end" width="min(420px, calc(100vw - 24px))" />;
}
