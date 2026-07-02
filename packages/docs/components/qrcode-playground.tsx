'use client';

import type { Key } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Description,
  Form,
  Label,
  ListBox,
  NumberField,
  Select,
  Tabs,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import {
  FiCheckCircle,
  FiCopy,
  FiDownload,
  FiGithub,
  FiUpload,
  FiZap,
} from 'react-icons/fi';
import { SiRust } from 'react-icons/si';

type QRCodeModule = typeof import('@ikenxuan/qrcode');
type QRCodeOptions = import('@ikenxuan/qrcode').QRCodeOptions;
type OutputFormat = 'png' | 'jpeg' | 'webp' | 'svg';
type DotType = 'square' | 'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded';
type ShapeType = 'square' | 'circle';

const dotTypes: Array<{ description: string; label: string; value: DotType }> = [
  { label: 'Square', value: 'square', description: '方形点阵，边缘清晰，适合通用业务码' },
  { label: 'Dots', value: 'dots', description: '圆点点阵，视觉更轻，适合品牌展示' },
  { label: 'Rounded', value: 'rounded', description: '圆角方块，兼顾识别稳定和柔和观感' },
  { label: 'Classy', value: 'classy', description: '经典切角样式，点阵更有装饰感' },
  {
    label: 'Classy Rounded',
    value: 'classy-rounded',
    description: '经典圆角样式，适合更精致的卡片或海报',
  },
  {
    label: 'Extra Rounded',
    value: 'extra-rounded',
    description: '超圆角点阵，风格最强，建议搭配高对比配色',
  },
];

const formats: Array<{ label: string; value: OutputFormat }> = [
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'SVG', value: 'svg' },
];

const colorPresets = ['#b7410e', '#dea584', '#5f2614', '#fff7ed', '#111827', '#ffffff'];

const installCommands = [
  { label: 'pnpm', value: 'pnpm', command: 'pnpm add @ikenxuan/qrcode' },
  { label: 'npm', value: 'npm', command: 'npm install @ikenxuan/qrcode' },
  { label: 'yarn', value: 'yarn', command: 'yarn add @ikenxuan/qrcode' },
  { label: 'bun', value: 'bun', command: 'bun add @ikenxuan/qrcode' },
];

const tokenPattern =
  /(\/\/.*|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:import|from|const|let|var|if|else|return|true|false|null|undefined)\b|\b(?:generate|generateSvg|scan)\b|\b\d+(?:\.\d+)?\b|[{}()[\].,;:])/g;

const keywordPattern = /^(?:import|from|const|let|var|if|else|return|true|false|null|undefined)$/;

function escapeCodeString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function highlightTypeScript(code: string) {
  const tokens: Array<{ className?: string; value: string }> = [];
  let lastIndex = 0;

  for (const match of code.matchAll(tokenPattern)) {
    const value = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) tokens.push({ value: code.slice(lastIndex, index) });

    if (value.startsWith('//')) tokens.push({ value, className: 'text-[#8f786b]' });
    else if (value.startsWith("'") || value.startsWith('`')) {
      tokens.push({ value, className: 'text-[#f6a46f]' });
    }
    else if (keywordPattern.test(value)) tokens.push({ value, className: 'text-[#dea584]' });
    else if (/^(?:generate|generateSvg|scan)$/.test(value)) {
      tokens.push({ value, className: 'text-[#ffd7a8]' });
    }
    else if (/^\d/.test(value)) tokens.push({ value, className: 'text-[#f7c59f]' });
    else tokens.push({ value, className: 'text-[#bfa08d]' });

    lastIndex = index + value.length;
  }

  if (lastIndex < code.length) tokens.push({ value: code.slice(lastIndex) });

  return tokens;
}

export function QRCodePlayground() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qr, setQr] = useState<QRCodeModule | null>(null);
  const [content, setContent] = useState('https://github.com/ikenxuan/qrcode');
  const [format, setFormat] = useState<OutputFormat>('png');
  const [shape, setShape] = useState<ShapeType>('square');
  const [dotType, setDotType] = useState<DotType>('rounded');
  const [size, setSize] = useState(320);
  const [margin, setMargin] = useState(12);
  const [dotColor, setDotColor] = useState('#b7410e');
  const [gradientTo, setGradientTo] = useState('#dea584');
  const [backgroundColor, setBackgroundColor] = useState('#fff7ed');
  const [useGradient, setUseGradient] = useState(true);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [byteLength, setByteLength] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState('尚未扫描');
  const [uploadResult, setUploadResult] = useState('等待上传图片');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const mimeType = useMemo(() => {
    if (format === 'svg') return 'image/svg+xml';
    if (format === 'jpeg') return 'image/jpeg';
    if (format === 'webp') return 'image/webp';
    return 'image/png';
  }, [format]);

  const featureSelection = useMemo(() => {
    const selected: string[] = [];

    if (useGradient) selected.push('gradient');
    if (transparentBackground) selected.push('transparent');
    if (shape === 'circle') selected.push('circle');

    return selected;
  }, [shape, transparentBackground, useGradient]);

  const options = useMemo<QRCodeOptions>(() => {
    const data = content.trim() || 'https://github.com/ikenxuan/qrcode';

    return {
      data,
      size,
      margin,
      shape,
      dotsOptions: {
        dotType,
        ...(useGradient
          ? { gradient: { colorFrom: dotColor, colorTo: gradientTo } }
          : { color: dotColor }),
      },
      cornersSquareOptions: {
        cornerType: 'extra-rounded',
        color: '#5f2614',
      },
      cornersDotOptions: {
        cornerType: 'dot',
        color: '#5f2614',
      },
      backgroundOptions: transparentBackground
        ? { transparent: true }
        : { color: backgroundColor, round: shape === 'circle' ? 0.5 : 0.08 },
    };
  }, [
    backgroundColor,
    content,
    dotColor,
    dotType,
    gradientTo,
    margin,
    shape,
    size,
    transparentBackground,
    useGradient,
  ]);

  const codeSample = useMemo(() => {
    const colorLine = useGradient
      ? `gradient: { colorFrom: '${dotColor}', colorTo: '${gradientTo}' }`
      : `color: '${dotColor}'`;
    const backgroundLine = transparentBackground
      ? 'transparent: true'
      : `color: '${backgroundColor}', round: ${shape === 'circle' ? '0.5' : '0.08'}`;
    const generator = format === 'svg' ? 'generateSvg' : 'generate';
    const output = format === 'svg'
      ? `const svg = generateSvg(options);`
      : `const image = generate(options, '${format}');\nconst text = scan(image);`;

    return `import { ${generator}${format === 'svg' ? '' : ', scan'} } from '@ikenxuan/qrcode';

const options = {
  data: '${escapeCodeString(options.data)}',
  size: ${size},
  margin: ${margin},
  shape: '${shape}',
  dotsOptions: {
    dotType: '${dotType}',
    ${colorLine},
  },
  cornersSquareOptions: {
    cornerType: 'extra-rounded',
    color: '#5f2614',
  },
  backgroundOptions: {
    ${backgroundLine},
  },
};

${output}`;
  }, [
    backgroundColor,
    dotColor,
    dotType,
    format,
    gradientTo,
    margin,
    options.data,
    shape,
    size,
    transparentBackground,
    useGradient,
  ]);

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
      if (format === 'svg') {
        const svg = qr.generateSvg(options);
        nextUrl = URL.createObjectURL(new Blob([svg], { type: mimeType }));
        setByteLength(svg.length);
      }
      else {
        const bytes = qr.generate(options, format);
        nextUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        setByteLength(bytes.length);
      }

      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
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
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [format, mimeType, options, qr]);

  async function scanCurrent() {
    if (!qr) return;

    setScanResult('扫描中...');

    try {
      const image = qr.generate(options, 'png');
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

  function downloadPreview() {
    if (!previewUrl) return;

    const anchor = document.createElement('a');
    anchor.href = previewUrl;
    anchor.download = `ikenxuan-qrcode.${format === 'jpeg' ? 'jpg' : format}`;
    anchor.click();
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeSample);
      setCopyState('copied');
      toast.success('调用代码已复制', {
        description: '可以粘贴到浏览器或 Node.js ESM 项目中使用。',
      });
    }
    catch {
      setCopyState('failed');
      toast.danger('复制失败', {
        description: '浏览器没有授予剪贴板写入权限。',
      });
    }
  }

  function updateFeatureSelection(selected: string[]) {
    const next = new Set(selected);

    setUseGradient(next.has('gradient'));
    setTransparentBackground(next.has('transparent'));
    setShape(next.has('circle') ? 'circle' : 'square');
  }

  return (
    <section className="mx-auto grid min-w-0 w-full max-w-6xl gap-5 px-3 py-6 sm:px-6 sm:py-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
      <Card className="min-w-0 gap-5 border border-border/70 bg-surface/90 p-4 shadow-surface sm:p-5">
        <Card.Header className="gap-2">
          <Card.Title className="text-xl">实时配置</Card.Title>
          <Card.Description>
            直接调用当前 workspace 的 @ikenxuan/qrcode，调整后即时生成。
          </Card.Description>
        </Card.Header>

        <Card.Content>
          <Form className="grid gap-5" onSubmit={(event) => event.preventDefault()}>
            <TextField
              fullWidth
              name="content"
              value={content}
              onChange={setContent}
            >
              <Label>二维码内容</Label>
              <TextArea rows={4} />
              <Description>{content.length.toLocaleString()} 个字符</Description>
            </TextField>

            <div className="grid gap-4 sm:grid-cols-2">
              <OptionSelect
                label="输出格式"
                options={formats}
                value={format}
                onChange={(value) => setFormat(value as OutputFormat)}
              />
              <OptionSelect
                label="点阵样式"
                options={dotTypes}
                value={dotType}
                onChange={(value) => setDotType(value as DotType)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberSetting
                label="尺寸"
                maxValue={640}
                minValue={180}
                step={20}
                value={size}
                onChange={setSize}
              />
              <NumberSetting
                label="外边距"
                maxValue={40}
                minValue={0}
                step={2}
                value={margin}
                onChange={setMargin}
              />
            </div>

            <CheckboxGroup
              name="render-options"
              value={featureSelection}
              onChange={updateFeatureSelection}
            >
              <Label>生成选项</Label>
              <Description>可多选。透明背景开启后会禁用背景色设置。</Description>
              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                <Checkbox value="gradient">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    点阵渐变
                  </Checkbox.Content>
                  <Description>渐变点阵</Description>
                </Checkbox>
                <Checkbox value="transparent">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    透明背景
                  </Checkbox.Content>
                  <Description>透明底色</Description>
                </Checkbox>
                <Checkbox value="circle">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    圆形外轮廓
                  </Checkbox.Content>
                  <Description>圆形轮廓</Description>
                </Checkbox>
              </div>
            </CheckboxGroup>

            <div className="grid min-w-0 gap-4 sm:grid-cols-3">
              <ColorPickerControl label="点阵色" value={dotColor} onChange={setDotColor} />
              <ColorPickerControl
                isDisabled={!useGradient}
                label="渐变末端"
                value={gradientTo}
                onChange={setGradientTo}
              />
              <ColorPickerControl
                isDisabled={transparentBackground}
                label="背景色"
                value={backgroundColor}
                onChange={setBackgroundColor}
              />
            </div>
          </Form>
        </Card.Content>
      </Card>

      <div className="grid min-w-0 gap-5">
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
            <div className="grid min-h-[260px] place-items-center rounded-lg border border-dashed border-border bg-rust-soft/55 p-4 sm:min-h-[340px] sm:p-6">
              {previewUrl ? (
                // eslint-disable-next-line next/no-img-element -- The preview URL is a browser-created blob.
                <img
                  alt="实时生成的二维码"
                  className="h-auto max-h-[240px] w-full max-w-[240px] object-contain sm:max-h-[300px] sm:max-w-[300px]"
                  src={previewUrl}
                />
              ) : (
                <span className="text-sm text-muted">等待 WASM 模块加载</span>
              )}
            </div>

            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Button className="w-full sm:w-auto" onPress={downloadPreview}>
                <FiDownload aria-hidden />
                下载
              </Button>
              <Button className="w-full sm:w-auto" onPress={scanCurrent}>
                <FiZap aria-hidden />
                扫描当前预览
              </Button>
              <Button className="w-full sm:w-auto" onPress={copyCode}>
                {copyState === 'copied' ? <FiCheckCircle aria-hidden /> : <FiCopy aria-hidden />}
                {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制代码'}
              </Button>
            </div>

            <ResultBlock label="当前预览识别结果" value={scanResult} />
          </Card.Content>
        </Card>

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
                void scanUpload(event.currentTarget.files?.[0]);
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
      </div>

      <Card className="min-w-0 border border-[#6f301a]/60 bg-[#150906] text-[#fff7ed] lg:col-span-2">
        <Card.Header className="flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="grid min-w-0 gap-1">
            <Card.Title className="text-lg text-[#fff7ed]">当前 TypeScript 调用</Card.Title>
            <Card.Description className="text-[#eec9aa]">
              可复制到浏览器或 Node.js ESM 项目中使用。
            </Card.Description>
          </div>
          <Button className="w-full sm:w-auto" onPress={copyCode}>
            <FiCopy aria-hidden />
            复制
          </Button>
        </Card.Header>
        <Card.Content className="min-w-0 p-0">
          <pre className="max-w-full overflow-x-auto border-t border-white/10 bg-[#0f0604] p-4 text-sm leading-7 sm:p-5">
            <code className="block min-w-max text-[#fff7ed]">
              {highlightTypeScript(codeSample).map((token, index) => (
                <span key={`${token.value}-${index}`} className={token.className}>
                  {token.value}
                </span>
              ))}
            </code>
          </pre>
        </Card.Content>
      </Card>
    </section>
  );
}

function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ description?: string; label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      fullWidth
      name={label}
      placeholder={label}
      value={value}
      onChange={(nextValue: Key | null) => {
        if (nextValue !== null) onChange(String(nextValue));
      }}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((item) => (
            <ListBox.Item
              key={item.value}
              id={item.value}
              textValue={item.description ? `${item.label} ${item.description}` : item.label}
            >
              <span className="grid gap-0.5">
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <Description className="text-xs leading-5">{item.description}</Description>
                ) : null}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function NumberSetting({
  label,
  value,
  minValue,
  maxValue,
  step,
  onChange,
}: {
  label: string;
  value: number;
  minValue: number;
  maxValue: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <NumberField
      fullWidth
      maxValue={maxValue}
      minValue={minValue}
      name={label}
      step={step}
      value={value}
      onChange={(nextValue) => {
        if (typeof nextValue === 'number') onChange(nextValue);
      }}
    >
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input className="w-full" />
        <NumberField.IncrementButton />
      </NumberField.Group>
      <Description>{value}px</Description>
    </NumberField>
  );
}

function ColorPickerControl({
  isDisabled,
  label,
  value,
  onChange,
}: {
  isDisabled?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ColorPicker
      className={`w-full ${isDisabled ? 'pointer-events-none opacity-50' : ''}`}
      value={value}
      onChange={(color) => {
        if (!isDisabled) onChange(color.toString('hex'));
      }}
    >
      <ColorPicker.Trigger className="w-full justify-start">
        <ColorSwatch color={value} size="lg" />
        <span className="grid gap-0.5 text-left">
          <Label>{label}</Label>
          <span className="font-mono text-xs text-muted">{value}</span>
        </span>
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="gap-3">
        <ColorSwatchPicker className="justify-center px-1" size="xs">
          {colorPresets.map((preset) => (
            <ColorSwatchPicker.Item key={preset} color={preset}>
              <ColorSwatchPicker.Swatch />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
        <ColorArea
          aria-label={`${label} 色域`}
          className="max-w-full"
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
        >
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider aria-label={`${label} 色相`} channel="hue" className="gap-1 px-1" colorSpace="hsb">
          <Label>色相</Label>
          <ColorSlider.Output className="text-muted" />
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
        <ColorField aria-label={`${label} 颜色值`}>
          <ColorField.Group>
            <ColorField.Prefix>
              <ColorSwatch size="xs" />
            </ColorField.Prefix>
            <ColorField.Input />
          </ColorField.Group>
        </ColorField>
      </ColorPicker.Popover>
    </ColorPicker>
  );
}

function ResultBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-rust-soft/45 p-3">
      <span className="text-xs font-semibold uppercase text-muted">{label}</span>
      <output className="break-words font-mono text-sm text-foreground">{value}</output>
    </div>
  );
}

export function HomeHero() {
  const [copiedManager, setCopiedManager] = useState('');

  async function copyCommand(command: string, manager: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedManager(manager);
      toast.success(`${manager} 安装命令已复制`);
    }
    catch {
      setCopiedManager('');
      toast.danger('复制安装命令失败');
    }
  }

  return (
    <section className="mx-auto grid min-w-0 w-full max-w-6xl gap-8 px-3 pb-5 pt-10 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pt-16">
      <div className="grid min-w-0 content-center gap-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-rust">
          <SiRust aria-hidden className="size-5" />
          <span>Rust + WebAssembly</span>
        </div>
        <div className="grid gap-4">
          <h1 className="max-w-3xl break-words text-3xl font-semibold tracking-normal text-foreground sm:text-5xl">
            @ikenxuan/qrcode
          </h1>
          <p className="max-w-2xl text-base leading-8 text-muted sm:text-lg">
            高性能二维码生成与扫码工具。支持多种样式、透明背景、SVG/PNG/JPEG/WebP 输出，
            并且 WASM 内联，浏览器和 Node.js 都能直接 import 使用。
          </p>
        </div>
        <div className="grid gap-3 sm:flex sm:flex-wrap sm:gap-4">
          <Button className="w-full sm:min-w-36 sm:w-auto" size="lg" onPress={() => window.location.assign('/docs')}>
            <FiCheckCircle aria-hidden />
            阅读文档
          </Button>
          <Button
            className="w-full sm:min-w-36 sm:w-auto"
            size="lg"
            onPress={() =>
              window.open('https://github.com/ikenxuan/qrcode', '_blank', 'noreferrer')
            }
          >
            <FiGithub aria-hidden />
            GitHub
          </Button>
        </div>
        <div className="grid min-w-0 max-w-xl gap-3">
          <Tabs defaultSelectedKey="pnpm">
            <Tabs.ListContainer className="max-w-full overflow-x-auto">
              <Tabs.List aria-label="安装命令" className="w-fit">
                {installCommands.map((item) => (
                  <Tabs.Tab key={item.value} id={item.value}>
                    {item.label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {installCommands.map((item) => (
              <Tabs.Panel key={item.value} className="pt-2" id={item.value}>
                <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[#6f301a]/60 bg-[#150906] p-2 text-[#fff7ed]">
                  <pre className="min-w-0 flex-1 overflow-x-auto px-2 py-1 text-sm">
                    <code>{item.command}</code>
                  </pre>
                  <Button
                    isIconOnly
                    aria-label={`复制 ${item.label} 安装命令`}
                    className="shrink-0"
                    size="sm"
                    variant="secondary"
                    onPress={() => void copyCommand(item.command, item.value)}
                  >
                    {copiedManager === item.value ? <FiCheckCircle aria-hidden /> : <FiCopy aria-hidden />}
                  </Button>
                </div>
              </Tabs.Panel>
            ))}
          </Tabs>
        </div>
      </div>

      <Card className="min-w-0 border border-border/70 bg-surface/90 p-4 shadow-surface sm:p-5">
        <Card.Header className="gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-rust text-rust-foreground">
            <SiRust aria-hidden className="size-6" />
          </div>
          <Card.Title>核心能力</Card.Title>
          <Card.Description>
            一个包覆盖生成、样式化、下载与二维码识别。
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3">
          {[
            ['生成', '点阵、定位角、渐变、透明背景、Logo 嵌入'],
            ['输出', 'PNG、JPEG、WebP、SVG，支持 Uint8Array 或 base64'],
            ['扫码', 'PNG/JPEG/WebP 图片识别，未识别返回 null'],
          ].map(([title, text]) => (
            <div key={title} className="rounded-lg border border-border bg-rust-soft/45 p-4">
              <div className="text-sm font-semibold text-foreground">{title}</div>
              <div className="mt-1 text-sm leading-6 text-muted">{text}</div>
            </div>
          ))}
        </Card.Content>
      </Card>
    </section>
  );
}
