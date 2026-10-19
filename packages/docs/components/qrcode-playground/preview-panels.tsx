'use client';

import { useEffect, type RefObject } from 'react';
import { Button, Card } from '@heroui/react';
import { FiCheckCircle, FiCopy, FiDownload, FiUpload, FiZap } from 'react-icons/fi';
import { SiRust } from 'react-icons/si';
import { topToastQueue } from '@/components/toast-provider';
import { getOverlayShape } from './annotate';
import { ResultBlock } from './shared-controls';
import type { OutputFormat, ScanDetails } from './types';
import { formatMegabytes } from './utils';

const supportedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** 在原图上叠加识别到的二维码范围。 */
function ScanOverlay({ details }: { details: ScanDetails }) {
  const { width, height } = details;
  const shape = getOverlayShape(details);
  if (!width || !height || !shape) return null;

  const strokeWidth = Math.max(2, Math.max(width, height) * 0.007);
  const shapeProps = {
    fill: 'rgba(34, 197, 94, 0.12)',
    stroke: '#22c55e',
    strokeLinejoin: 'round' as const,
    strokeWidth,
    style: { filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.55))' },
  };

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      {shape.kind === 'circle' ? (
        <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...shapeProps} />
      ) : (
        <polygon
          points={shape.points.map((point) => `${point.x},${point.y}`).join(' ')}
          {...shapeProps}
        />
      )}
    </svg>
  );
}

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
          className={`max-w-full wrap-break-word text-xs font-medium ${
            error ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
          }`}
        >
          {error || (isRendering ? '生成中' : '已同步')}
        </span>
      </Card.Header>

      <Card.Content className="gap-4">
        <div className="grid min-h-65 min-w-0 place-items-center rounded-lg border border-dashed border-border bg-rust-soft/55 p-4 sm:min-h-85 sm:p-6">
          {previewUrl ? (
            // eslint-disable-next-line next/no-img-element -- Preview URL is generated in browser state.
            <img
              alt="实时生成的二维码"
              className="h-auto max-h-60 w-full max-w-60 object-contain sm:max-h-75 sm:max-w-75"
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
  previewUrl,
  details,
  uploadResult,
  onScanUpload,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  previewUrl: string;
  details: ScanDetails | null;
  uploadResult: string;
  onScanUpload: (file: File | undefined) => void;
}) {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target;

      // 输入框内的粘贴交给浏览器处理，避免把文本粘贴误判成扫码操作。
      if (
        target instanceof HTMLElement
        && (target.isContentEditable
          || target instanceof HTMLInputElement
          || target instanceof HTMLTextAreaElement
          || target instanceof HTMLSelectElement)
      ) {
        return;
      }

      const clipboard = event.clipboardData;
      if (!clipboard) return;

      const imageFile = Array.from(clipboard.items)
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile()
        ?? Array.from(clipboard.files).find((file) => file.type.startsWith('image/'));

      if (!imageFile) {
        topToastQueue.add({
          title: '剪贴板中没有图片',
          description: '请先复制 PNG、JPEG 或 WebP 图片，再回到页面粘贴。',
          variant: 'danger',
        });
        return;
      }

      if (!supportedImageTypes.has(imageFile.type)) {
        topToastQueue.add({
          title: '不支持的图片格式',
          description: '目前仅支持 PNG、JPEG、WebP 图片。',
          variant: 'warning',
        });
        return;
      }

      event.preventDefault();
      onScanUpload(imageFile);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onScanUpload]);

  return (
    <Card className="min-w-0 border border-border/70 bg-surface/90 p-4 shadow-surface sm:p-5">
      <Card.Header className="flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="grid min-w-0 gap-1">
          <Card.Title className="text-lg">上传图片扫码</Card.Title>
          <Card.Description>
            支持点击选择或直接粘贴 PNG、JPEG、WebP 图片，识别后会标出二维码位置。
          </Card.Description>
        </div>
        <Button
          isDisabled={!previewUrl}
          size="sm"
          variant="secondary"
          onPress={() => fileInputRef.current?.click()}
        >
          <FiUpload aria-hidden />
          重新上传
        </Button>
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
        {previewUrl ? null : (
          <button
            type="button"
            className="group flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-rust-soft/25 px-4 text-center transition-colors hover:border-rust/50 hover:bg-rust-soft/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="grid size-10 place-items-center rounded-full bg-surface text-rust shadow-sm transition-transform group-hover:-translate-y-0.5">
              <FiUpload aria-hidden className="size-5" />
            </span>
            <span className="grid gap-0.5">
              <span className="text-sm font-medium text-foreground">点击选择图片</span>
              <span className="text-xs text-muted">也可以直接粘贴 PNG / JPEG / WebP</span>
            </span>
          </button>
        )}
        {previewUrl ? (
          <div className="flex justify-center">
            <a
              aria-label="在新标签页打开标注后的图片"
              className="relative inline-block max-w-full cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
              href={previewUrl}
              rel="noreferrer"
              target="_blank"
              title="在新标签页打开标注后的图片"
            >
              {/* eslint-disable-next-line next/no-img-element -- Preview URL is created from a local file. */}
              <img
                alt="待扫描图片"
                className="block h-auto max-h-70 w-auto max-w-full rounded-lg border border-border object-contain"
                src={previewUrl}
              />
              {details ? <ScanOverlay details={details} /> : null}
            </a>
          </div>
        ) : null}
        <ResultBlock label="上传图片识别结果" value={uploadResult} />
      </Card.Content>
    </Card>
  );
}
