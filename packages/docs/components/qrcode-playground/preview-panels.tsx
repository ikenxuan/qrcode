'use client';

import type { RefObject } from 'react';
import { Button, Card } from '@heroui/react';
import { FiCheckCircle, FiCopy, FiDownload, FiUpload, FiZap } from 'react-icons/fi';
import { SiRust } from 'react-icons/si';
import { ResultBlock } from './shared-controls';
import type { OutputFormat } from './types';
import { formatMegabytes } from './utils';

export function PreviewPanel({
  format,
  size,
  byteLength,
  previewUrl,
  isRendering,
  error,
  scanResult,
  copied,
  onDownload,
  onScanCurrent,
  onCopyCode,
}: {
  format: OutputFormat;
  size: number;
  byteLength: number;
  previewUrl: string;
  isRendering: boolean;
  error: string;
  scanResult: string;
  copied: boolean;
  onDownload: () => void;
  onScanCurrent: () => void;
  onCopyCode: () => void;
}) {
  return (
    <Card className="min-w-0 border border-border/70 bg-surface/90 p-4 shadow-surface sm:p-5">
      <Card.Header className="flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <div className="grid min-w-0 gap-1">
          <Card.Title className="flex items-center gap-2 text-xl">
            <SiRust aria-hidden className="text-rust" />
            生成预览
          </Card.Title>
          <Card.Description>
            {format.toUpperCase()} · {size}px · {formatMegabytes(byteLength)}
          </Card.Description>
        </div>
        <span
          className={`max-w-full break-words text-xs font-medium ${
            error ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
          }`}
        >
          {error || (isRendering ? '生成中' : '已同步')}
        </span>
      </Card.Header>

      <Card.Content className="gap-4">
        <div className="grid min-h-[260px] min-w-0 place-items-center rounded-lg border border-dashed border-border bg-rust-soft/55 p-4 sm:min-h-[340px] sm:p-6">
          {previewUrl ? (
            // eslint-disable-next-line next/no-img-element -- Preview URL is generated in browser state.
            <img
              alt="实时生成的二维码"
              className="h-auto max-h-[240px] w-full max-w-[240px] object-contain sm:max-h-[300px] sm:max-w-[300px]"
              src={previewUrl}
            />
          ) : (
            <span className="text-sm text-muted">等待 WASM 模块加载</span>
          )}
        </div>

        <div className="grid min-w-0 gap-3 sm:flex sm:flex-wrap">
          <Button className="w-full sm:w-auto" onPress={onDownload}>
            <FiDownload aria-hidden />
            下载
          </Button>
          <Button className="w-full sm:w-auto" onPress={onScanCurrent}>
            <FiZap aria-hidden />
            扫描当前预览
          </Button>
          <Button className="w-full sm:w-auto" onPress={onCopyCode}>
            {copied ? <FiCheckCircle aria-hidden /> : <FiCopy aria-hidden />}
            {copied ? '已复制' : '复制代码'}
          </Button>
        </div>

        <ResultBlock label="当前预览识别结果" value={scanResult} />
      </Card.Content>
    </Card>
  );
}

export function UploadScanPanel({
  fileInputRef,
  uploadResult,
  onScanUpload,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploadResult: string;
  onScanUpload: (file: File | undefined) => void;
}) {
  return (
    <Card className="min-w-0 border border-border/70 bg-surface/90 p-4 shadow-surface sm:p-5">
      <Card.Header className="gap-2">
        <Card.Title className="text-lg">上传图片扫码</Card.Title>
        <Card.Description>支持 PNG、JPEG、WebP 图片二进制扫码。</Card.Description>
      </Card.Header>
      <Card.Content className="gap-4">
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            onScanUpload(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        <Button className="w-full sm:w-auto" onPress={() => fileInputRef.current?.click()}>
          <FiUpload aria-hidden />
          选择图片
        </Button>
        <ResultBlock label="上传图片识别结果" value={uploadResult} />
      </Card.Content>
    </Card>
  );
}
