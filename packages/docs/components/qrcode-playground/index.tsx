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

export const QRCodePlayground = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef('');
  const renderVersionRef = useRef(0);
  const hasRenderedOnceRef = useRef(false);
  const currentScanVersionRef = useRef(0);
  const uploadScanVersionRef = useRef(0);
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

    import('@ikenxuan/qrcode/browser')
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

    const renderVersion = ++renderVersionRef.current;
    let cancelled = false;
    let nextUrl = '';
    let committed = false;
    setIsRendering(true);
    setError('');

    const render = async () => {
      try {
        let nextByteLength = 0;

        if (state.format === 'svg') {
          const svg = await qr.generateSvg(options);
          nextUrl = URL.createObjectURL(new Blob([svg], { type: mimeType }));
          nextByteLength = new TextEncoder().encode(svg).length;
        }
        else if (state.encoding === 'base64') {
          const image = await qr.generate(options, state.format, 'base64');
          nextUrl = `data:${mimeType};base64,${image}`;
          nextByteLength = base64ByteLength(image);
        }
        else {
          const image = await qr.generate(options, state.format, 'binary');
          nextUrl = URL.createObjectURL(new Blob([image], { type: mimeType }));
          nextByteLength = image.length;
        }

        if (cancelled || renderVersion !== renderVersionRef.current) {
          revokeObjectUrl(nextUrl);
          return;
        }

        setByteLength(nextByteLength);
        previewUrlRef.current = nextUrl;
        committed = true;
        hasRenderedOnceRef.current = true;
        setPreviewUrl((current) => {
          revokeObjectUrl(current);
          return nextUrl;
        });
      }
      catch (reason) {
        if (!cancelled && renderVersion === renderVersionRef.current) {
          setError(reason instanceof Error ? reason.message : '生成失败');
        }
      }
      finally {
        if (!cancelled && renderVersion === renderVersionRef.current) {
          setIsRendering(false);
        }
      }
    };

    const renderDelay = window.setTimeout(() => {
      void render();
    }, hasRenderedOnceRef.current ? 32 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(renderDelay);
      if (!committed) revokeObjectUrl(nextUrl);
    };
  }, [mimeType, options, qr, state.encoding, state.format]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      revokeObjectUrl(logo.previewUrl);
    };
  }, [logo.previewUrl]);

  const scanCurrent = async () => {
    if (!qr) return;

    setScanResult('扫描中...');

    const scanVersion = ++currentScanVersionRef.current;

    try {
      const image = await qr.generate(options, 'png', 'binary');
      const result = await qr.scan(image);
      if (scanVersion === currentScanVersionRef.current) {
        setScanResult(result ?? '未识别到二维码');
      }
    }
    catch (reason) {
      if (scanVersion === currentScanVersionRef.current) {
        setScanResult(reason instanceof Error ? reason.message : '扫描失败');
      }
    }
  };

  const scanUpload = async (file: File | undefined) => {
    if (!file || !qr) return;

    setUploadResult('扫描中...');

    const scanVersion = ++uploadScanVersionRef.current;

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await qr.scan(bytes);
      if (scanVersion === uploadScanVersionRef.current) {
        setUploadResult(result ?? '未识别到二维码');
      }
    }
    catch (reason) {
      if (scanVersion === uploadScanVersionRef.current) {
        setUploadResult(reason instanceof Error ? reason.message : '扫描失败');
      }
    }
  };

  const pickLogo = async (file: File | undefined) => {
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
  };

  const removeLogo = () => {
    setLogo((current) => {
      revokeObjectUrl(current.previewUrl);
      return { bytes: null, name: '', previewUrl: '' };
    });
  };

  const downloadPreview = () => {
    if (!previewUrl) return;

    const anchor = document.createElement('a');
    anchor.href = previewUrl;
    anchor.download = `ikenxuan-qrcode.${fileExtensions[state.format]}`;
    anchor.click();
  };

  const copySample = async (sample: CodeSample) => {
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
  };

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
};
