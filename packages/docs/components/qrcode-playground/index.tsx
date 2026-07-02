'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, toast } from '@heroui/react';
import { buildCodeSamples } from './code-samples';
import { defaultPlaygroundState, fileExtensions, mimeTypes } from './constants';
import { HomeHero } from './home-hero';
import { buildQRCodeOptions } from './options';
import { PlaygroundControls } from './playground-controls';
import { CodeSamplePanel } from './code-sample-panel';
import { PreviewPanel, UploadScanPanel } from './preview-panels';
import type { CodeSample, CodeSampleKey, LogoState, QRCodeModule } from './types';
import { base64ByteLength, revokeObjectUrl } from './utils';

export { HomeHero };

export function QRCodePlayground() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [qr, setQr] = useState<QRCodeModule | null>(null);
  const [state, setState] = useState(defaultPlaygroundState);
  const [logo, setLogo] = useState<LogoState>({ bytes: null, name: '', previewUrl: '' });
  const [previewUrl, setPreviewUrl] = useState('');
  const [byteLength, setByteLength] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState('尚未扫描');
  const [uploadResult, setUploadResult] = useState('等待上传图片');
  const [selectedCodeKey, setSelectedCodeKey] = useState<CodeSampleKey>('node');
  const [copiedCodeKey, setCopiedCodeKey] = useState<CodeSampleKey | ''>('');

  const hasLogo = logo.bytes !== null;
  const options = useMemo(() => buildQRCodeOptions(state, logo.bytes), [logo.bytes, state]);
  const codeSamples = useMemo(() => buildCodeSamples(state, hasLogo), [hasLogo, state]);
  const selectedSample = codeSamples.find((sample) => sample.key === selectedCodeKey) ?? codeSamples[0];
  const mimeType = mimeTypes[state.format];

  useEffect(() => {
    let active = true;

    import('@ikenxuan/qrcode')
      .then((module) => {
        if (active) setQr(module);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : '加载二维码模块失败');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!qr) return;

    let nextUrl = '';
    setIsRendering(true);
    setError('');

    try {
      if (state.format === 'svg') {
        const svg = qr.generateSvg(options);
        nextUrl = URL.createObjectURL(new Blob([svg], { type: mimeType }));
        setByteLength(new TextEncoder().encode(svg).length);
      }
      else if (state.encoding === 'base64') {
        const image = qr.generate(options, state.format, 'base64');
        nextUrl = `data:${mimeType};base64,${image}`;
        setByteLength(base64ByteLength(image));
      }
      else {
        const image = qr.generate(options, state.format, 'binary');
        nextUrl = URL.createObjectURL(new Blob([image], { type: mimeType }));
        setByteLength(image.length);
      }

      setPreviewUrl((current) => {
        revokeObjectUrl(current);
        return nextUrl;
      });
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '生成失败');
    }
    finally {
      setIsRendering(false);
    }

    return () => {
      revokeObjectUrl(nextUrl);
    };
  }, [mimeType, options, qr, state.encoding, state.format]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(logo.previewUrl);
    };
  }, [logo.previewUrl]);

  async function scanCurrent() {
    if (!qr) return;

    setScanResult('扫描中...');

    try {
      const image = qr.generate(options, 'png', 'binary');
      setScanResult(qr.scan(image) ?? '未识别到二维码');
    }
    catch (reason) {
      setScanResult(reason instanceof Error ? reason.message : '扫描失败');
    }
  }

  async function scanUpload(file: File | undefined) {
    if (!file || !qr) return;

    setUploadResult('扫描中...');

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setUploadResult(qr.scan(bytes) ?? '未识别到二维码');
    }
    catch (reason) {
      setUploadResult(reason instanceof Error ? reason.message : '扫描失败');
    }
  }

  async function pickLogo(file: File | undefined) {
    if (!file) return;

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const preview = URL.createObjectURL(file);

      setLogo((current) => {
        revokeObjectUrl(current.previewUrl);
        return { bytes, name: file.name, previewUrl: preview };
      });
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取 Logo 失败');
    }
  }

  function removeLogo() {
    setLogo((current) => {
      revokeObjectUrl(current.previewUrl);
      return { bytes: null, name: '', previewUrl: '' };
    });
  }

  function downloadPreview() {
    if (!previewUrl) return;

    const anchor = document.createElement('a');
    anchor.href = previewUrl;
    anchor.download = `ikenxuan-qrcode.${fileExtensions[state.format]}`;
    anchor.click();
  }

  async function copySample(sample: CodeSample) {
    try {
      await navigator.clipboard.writeText(sample.code);
      setCopiedCodeKey(sample.key);
      toast.success(`${sample.label} 示例已复制`, {
        description: '代码会跟随当前工作台配置同步更新。',
      });
    }
    catch {
      setCopiedCodeKey('');
      toast.danger('复制失败', {
        description: '浏览器没有授予剪贴板写入权限。',
      });
    }
  }

  return (
    <section className="mx-auto flex min-w-0 w-full max-w-7xl flex-col gap-5 px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[0.96fr_1.04fr] lg:items-start">
        <Card className="min-w-0 gap-5 border border-border/70 bg-surface/90 p-4 shadow-surface sm:p-5">
          <Card.Header className="gap-2">
            <Card.Title className="text-xl">实时配置</Card.Title>
            <Card.Description>
              直接调用当前 workspace 的 @ikenxuan/qrcode，调整后即时生成。
            </Card.Description>
          </Card.Header>

          <Card.Content>
            <PlaygroundControls
              hasLogo={hasLogo}
              logoInputRef={logoInputRef}
              logoName={logo.name}
              logoPreviewUrl={logo.previewUrl}
              setState={setState}
              state={state}
              onPickLogo={(file) => void pickLogo(file)}
              onRemoveLogo={removeLogo}
            />
          </Card.Content>
        </Card>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="grid min-w-0 gap-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            <PreviewPanel
              byteLength={byteLength}
              copied={copiedCodeKey === selectedSample.key}
              error={error}
              format={state.format}
              isRendering={isRendering}
              previewUrl={previewUrl}
              scanResult={scanResult}
              size={state.size}
              onCopyCode={() => void copySample(selectedSample)}
              onDownload={downloadPreview}
              onScanCurrent={() => void scanCurrent()}
            />
            <UploadScanPanel
              fileInputRef={fileInputRef}
              uploadResult={uploadResult}
              onScanUpload={(file) => void scanUpload(file)}
            />
          </div>
        </aside>
      </div>

      <CodeSamplePanel
        copiedKey={copiedCodeKey}
        samples={codeSamples}
        selectedKey={selectedCodeKey}
        onCopy={(sample) => void copySample(sample)}
        onSelect={setSelectedCodeKey}
      />
    </section>
  );
}
