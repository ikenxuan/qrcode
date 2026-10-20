'use client';

import { useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Description,
  Form,
  Label,
  TextArea,
  TextField,
} from '@heroui/react';
import {
  Boxes,
  CircleDashed,
  Focus,
  Grid3x3,
  ImagePlus,
  ListChecks,
  PaintBucket,
  QrCode,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Type,
} from 'lucide-react';
import { FiTrash2, FiUpload } from 'react-icons/fi';
import {
  codeTypes,
  cornerDotTypes,
  cornerSquareTypes,
  dotTypes,
  dyDefaults,
  dyFallbackContent,
  dyFrameStyles,
  dyModuleStyles,
  dyPresetOptions,
  encodings,
  fallbackContent,
  formats,
  presetOptions,
  qrDefaults,
  shapeTypes,
} from './constants';
import { ColorPickerControl, FieldSection, NumberSetting, OptionSelect } from './shared-controls';
import type { CodeType, DyPresetKey, PlaygroundState, PresetKey } from './types';

type FeatureKey =
  | 'dots-gradient'
  | 'corner-square-gradient'
  | 'corner-dot-gradient'
  | 'background-gradient'
  | 'transparent-background'
  | 'circle-shape';

function featureSelection(state: PlaygroundState): FeatureKey[] {
  const selected: FeatureKey[] = [];

  if (state.useDotGradient) selected.push('dots-gradient');
  if (state.useCornerSquareGradient) selected.push('corner-square-gradient');
  if (state.useCornerDotGradient) selected.push('corner-dot-gradient');
  if (state.useBackgroundGradient && !state.transparentBackground) selected.push('background-gradient');
  if (state.transparentBackground) selected.push('transparent-background');
  if (state.shape === 'circle') selected.push('circle-shape');

  return selected;
}

function UploadedImageRow({
  changeLabel,
  hasImage,
  imageName,
  previewUrl,
  removeLabel,
  selectLabel,
  onPick,
  onRemove,
}: {
  changeLabel: string;
  hasImage: boolean;
  imageName: string;
  previewUrl: string;
  removeLabel: string;
  selectLabel: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      {previewUrl ? (
        // eslint-disable-next-line next/no-img-element -- Preview is a browser-created object URL.
        <img
          alt="已选图片"
          className="size-12 shrink-0 rounded-md border border-border object-contain"
          src={previewUrl}
        />
      ) : null}
      <Button className="w-full sm:w-auto" variant="secondary" onPress={onPick}>
        <FiUpload aria-hidden />
        {hasImage ? changeLabel : selectLabel}
      </Button>
      {hasImage ? (
        <>
          <span className="min-w-0 max-w-full truncate font-mono text-xs text-muted sm:max-w-48">
            {imageName}
          </span>
          <Button className="w-full sm:w-auto" size="sm" variant="ghost" onPress={onRemove}>
            <FiTrash2 aria-hidden />
            {removeLabel}
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function PlaygroundControls({
  state,
  setState,
  logoInputRef,
  centerImageInputRef,
  hasLogo,
  hasCenterImage,
  logoName,
  logoPreviewUrl,
  centerImageName,
  centerImagePreviewUrl,
  onPickLogo,
  onRemoveLogo,
  onPickCenterImage,
  onRemoveCenterImage,
}: {
  state: PlaygroundState;
  setState: Dispatch<SetStateAction<PlaygroundState>>;
  logoInputRef: RefObject<HTMLInputElement | null>;
  centerImageInputRef: RefObject<HTMLInputElement | null>;
  hasLogo: boolean;
  hasCenterImage: boolean;
  logoName: string;
  logoPreviewUrl: string;
  centerImageName: string;
  centerImagePreviewUrl: string;
  onPickLogo: (file: File | undefined) => void;
  onRemoveLogo: () => void;
  onPickCenterImage: (file: File | undefined) => void;
  onRemoveCenterImage: () => void;
}) {
  const [presetKey, setPresetKey] = useState<PresetKey>('rust');
  const [dyPresetKey, setDyPresetKey] = useState<DyPresetKey>('official');
  const selectedPreset = presetOptions.find((preset) => preset.value === presetKey);
  const selectedDyPreset = dyPresetOptions.find((preset) => preset.value === dyPresetKey);
  const selectedFrameStyle = dyFrameStyles.find((style) => style.value === state.dyFrameStyle);
  const frameHasEnds = state.dyFrameStyle !== 'dots' && state.dyFrameStyle !== 'orbit';
  const frameUsesCount = (
    ['dashes', 'dots', 'ticks', 'segments', 'spark', 'orbit', 'gear'] as string[]
  ).includes(state.dyFrameStyle);
  const isDy = state.codeType === 'dy';
  const contentBytes = new TextEncoder().encode(state.content).length;
  const overDyLimit = isDy && contentBytes > 51;

  function patchState(patch: Partial<PlaygroundState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function updateCodeType(codeType: CodeType) {
    setState((current) => {
      if (current.codeType === codeType) return current;

      const nextFallback = codeType === 'qrcode' ? fallbackContent : dyFallbackContent;
      const content
        = current.content.trim() === ''
          || current.content === fallbackContent
          || current.content === dyFallbackContent
          ? nextFallback
          : current.content;

      return { ...current, codeType, content };
    });
  }

  function resetCurrentDefaults() {
    if (isDy) {
      patchState({ ...dyDefaults });
      setDyPresetKey('official');
      return;
    }

    patchState({ ...qrDefaults });
    setPresetKey('rust');
  }

  function applyDyPreset(nextPreset: DyPresetKey) {
    const preset = dyPresetOptions.find((item) => item.value === nextPreset);
    if (!preset) return;

    setDyPresetKey(nextPreset);
    setState((current) => ({ ...current, ...preset.style }));
  }

  function applyPreset(nextPreset: PresetKey) {
    const preset = presetOptions.find((item) => item.value === nextPreset);
    if (!preset) return;

    setPresetKey(nextPreset);
    setState((current) => ({ ...current, ...preset.style }));
  }

  function updateFeatures(selected: string[]) {
    const next = new Set(selected);
    const transparentBackground = next.has('transparent-background');

    patchState({
      useDotGradient: next.has('dots-gradient'),
      useCornerSquareGradient: next.has('corner-square-gradient'),
      useCornerDotGradient: next.has('corner-dot-gradient'),
      useBackgroundGradient: next.has('background-gradient') && !transparentBackground,
      transparentBackground,
      shape: next.has('circle-shape') ? 'circle' : 'square',
    });
  }

  return (
    <Form className="grid min-w-0 gap-5" onSubmit={(event) => event.preventDefault()}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <span className="text-sm font-semibold text-foreground">外观配置</span>
          <span className="text-xs text-muted">
            {isDy ? '抖音码外观' : '标准二维码外观'} · 不影响内容与输出
          </span>
        </div>
        <Button className="shrink-0" size="sm" variant="ghost" onPress={resetCurrentDefaults}>
          <RotateCcw aria-hidden />
          恢复默认
        </Button>
      </div>

      <input
        ref={logoInputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          onPickLogo(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={centerImageInputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          onPickCenterImage(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      <FieldSection
        description="标准二维码支持完整样式系统；抖音码复刻官方默认版式，支持透明背景与多种输出格式。"
        icon={<QrCode aria-hidden className="size-4" />}
        title="码类型"
      >
        <OptionSelect
          label="生成类型"
          options={codeTypes}
          value={state.codeType}
          onChange={updateCodeType}
        />
      </FieldSection>

      <FieldSection
        description={
          isDy
            ? '抖音码最多承载 51 字节 UTF-8 文本（约 17 个汉字）。38 字节以内使用四环版式，更长时自动改用五环。'
            : '输入要编码的文本或链接。'
        }
        icon={<Type aria-hidden className="size-4" />}
        title="内容"
      >
        <TextField
          fullWidth
          name="content"
          value={state.content}
          onChange={(content) => patchState({ content })}
        >
          <Label>{isDy ? '抖音码内容' : '二维码内容'}</Label>
          <TextArea rows={4} />
          <Description className={overDyLimit ? 'text-red-600 dark:text-red-400' : undefined}>
            {isDy
              ? `${contentBytes} / 51 字节${overDyLimit ? ' · 已超出上限' : ''}`
              : `${state.content.length.toLocaleString()} 个字符`}
          </Description>
        </TextField>
      </FieldSection>

      <FieldSection
        description={
          isDy
            ? '支持 PNG、WebP、JPEG 与 SVG；JPEG 不支持透明，透明区域会填充白色。'
            : '决定最终产物是位图还是矢量，以及 API 返回的数据形态。'
        }
        icon={<SlidersHorizontal aria-hidden className="size-4" />}
        title="输出"
      >
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <OptionSelect
            label="输出格式"
            options={formats}
            value={state.format}
            onChange={(format) => patchState({ format })}
          />
          <OptionSelect
            label="输出编码"
            options={encodings}
            value={state.encoding}
            onChange={(encoding) => patchState({ encoding })}
          />
        </div>
      </FieldSection>

      {isDy ? (
        <>
          <FieldSection
            description="10 套抖音码外观方案，只覆盖视觉配置；内容、输出格式与图片保持不变。"
            icon={<Sparkles aria-hidden className="size-4" />}
            title="风格预设"
          >
            <div className="grid min-w-0 gap-2">
              <OptionSelect
                label="预设方案"
                options={dyPresetOptions}
                value={dyPresetKey}
                onChange={applyDyPreset}
              />
              <p className="min-w-0 text-xs leading-5 text-muted">
                {selectedDyPreset?.description ?? '选择一套预设快速开始。'}
              </p>
            </div>
          </FieldSection>

          <FieldSection
            description="官方默认：深墨前景、纯白背景、圆角数据模块，外圈四段装饰弧与中心播放图标。"
            icon={<Grid3x3 aria-hidden className="size-4" />}
            title="抖音码外观"
          >
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <NumberSetting
                label="尺寸"
                maxValue={720}
                minValue={240}
                step={8}
                value={state.dySize}
                onChange={(dySize) => patchState({ dySize })}
              />
              <NumberSetting
                label="外边距"
                maxValue={48}
                minValue={0}
                step={2}
                value={state.dyMargin}
                onChange={(dyMargin) => patchState({ dyMargin })}
              />
              <ColorPickerControl
                label="前景色"
                value={state.dyDarkColor}
                onChange={(dyDarkColor) => patchState({ dyDarkColor })}
              />
              <ColorPickerControl
                isDisabled={state.dyTransparent}
                label="背景色"
                value={state.dyLightColor}
                onChange={(dyLightColor) => patchState({ dyLightColor })}
              />
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Checkbox
                isSelected={state.dyTransparent}
                onChange={(dyTransparent) => patchState({ dyTransparent })}
              >
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  透明背景
                </Checkbox.Content>
                <Description>PNG / WebP / SVG 保留 alpha</Description>
              </Checkbox>
              <Checkbox
                isDisabled={hasCenterImage}
                isSelected={state.dyLogo}
                onChange={(dyLogo) => patchState({ dyLogo })}
              >
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  中心播放图标
                </Checkbox.Content>
                <Description>
                  {hasCenterImage ? '已由中心图片替代' : '抖音官方中心图形'}
                </Description>
              </Checkbox>
            </div>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <OptionSelect
                label="数据模块"
                options={dyModuleStyles}
                value={state.dyModuleStyle}
                onChange={(dyModuleStyle) => patchState({ dyModuleStyle })}
              />
              <NumberSetting
                describe={(value) =>
                  state.dyModuleStyle === 'rounded'
                    ? `圆角 ${value.toFixed(1)}`
                    : '仅 Rounded 模式生效'
                }
                isDisabled={state.dyModuleStyle !== 'rounded'}
                label="模块圆角"
                maxValue={2.6}
                minValue={0}
                step={0.1}
                value={state.dyModuleRadius}
                onChange={(dyModuleRadius) => patchState({ dyModuleRadius })}
              />
            </div>

            <div className="grid min-w-0 gap-2">
              <Label className="text-sm font-medium">中心图片</Label>
              <Description>
                上传后覆盖整个中心圆盘并替换播放图标，图片会按 cover 方式裁剪成圆形。
              </Description>
              <UploadedImageRow
                changeLabel="更换中心图片"
                hasImage={hasCenterImage}
                imageName={centerImageName}
                previewUrl={centerImagePreviewUrl}
                removeLabel="移除"
                selectLabel="选择中心图片"
                onPick={() => centerImageInputRef.current?.click()}
                onRemove={onRemoveCenterImage}
              />
            </div>
          </FieldSection>

          <FieldSection
            description="数据全部在内圈，外圈可以自由换样式；分段式外圈会自动避开三个定位环和右上角图片。"
            icon={<CircleDashed aria-hidden className="size-4" />}
            title="外圈装饰"
          >
            <Checkbox isSelected={state.dyFrame} onChange={(dyFrame) => patchState({ dyFrame })}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                显示外圈
              </Checkbox.Content>
              <Description>
                {selectedFrameStyle?.description ?? '选择样式后实时生效'}
              </Description>
            </Checkbox>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <OptionSelect
                isDisabled={!state.dyFrame}
                label="外圈样式"
                options={dyFrameStyles}
                value={state.dyFrameStyle}
                onChange={(dyFrameStyle) => patchState({ dyFrameStyle })}
              />
              <NumberSetting
                describe={(value) => `${value}（设计单位）`}
                isDisabled={!state.dyFrame}
                label="外圈粗细"
                maxValue={16}
                minValue={1}
                step={0.5}
                value={state.dyFrameWidth}
                onChange={(dyFrameWidth) =>
                  patchState({
                    dyFrameWidth,
                    ...(state.dyFrameRadius > dyFrameWidth / 2
                      ? { dyFrameRadius: dyFrameWidth / 2 }
                      : {}),
                  })
                }
              />
              <NumberSetting
                describe={(value) => `${value.toFixed(1)}（设计单位）`}
                isDisabled={!state.dyFrame || !frameHasEnds}
                label="外圈圆角"
                maxValue={state.dyFrameWidth / 2}
                minValue={0}
                step={0.1}
                value={state.dyFrameRadius}
                onChange={(dyFrameRadius) => patchState({ dyFrameRadius })}
              />
              {state.dyFrameStyle === 'arcs' ? (
                <NumberSetting
                  describe={(value) => `${value}°`}
                  isDisabled={!state.dyFrame}
                  label="弧段角度"
                  maxValue={120}
                  minValue={4}
                  step={2}
                  value={state.dyFrameSpan}
                  onChange={(dyFrameSpan) => patchState({ dyFrameSpan })}
                />
              ) : null}
              {frameUsesCount ? (
                <NumberSetting
                  describe={(value) => `${value} 个`}
                  isDisabled={!state.dyFrame}
                  label="分段数量"
                  maxValue={72}
                  minValue={4}
                  step={1}
                  value={state.dyFrameCount}
                  onChange={(dyFrameCount) => patchState({ dyFrameCount })}
                />
              ) : null}
            </div>
          </FieldSection>

          <FieldSection
            description="图片会居中裁剪成圆形，放在右上角固定槽位；该槽位不占用有效数据位。"
            icon={<ImagePlus aria-hidden className="size-4" />}
            title="右上角图片"
          >
            <Checkbox isSelected={state.dyBadge} onChange={(dyBadge) => patchState({ dyBadge })}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                显示右上角图片
              </Checkbox.Content>
              <Description>对应官方码的 315° 圆形槽位</Description>
            </Checkbox>

            <UploadedImageRow
              changeLabel="更换图片"
              hasImage={hasLogo}
              imageName={logoName}
              previewUrl={logoPreviewUrl}
              removeLabel="移除"
              selectLabel="选择图片"
              onPick={() => logoInputRef.current?.click()}
              onRemove={onRemoveLogo}
            />

            {state.dyBadge ? (
              <NumberSetting
                describe={(value) => `半径 ${value}（设计单位）`}
                label="图片大小"
                maxValue={26}
                minValue={12}
                step={1}
                value={state.dyBadgeRadius}
                onChange={(dyBadgeRadius) => patchState({ dyBadgeRadius })}
              />
            ) : null}
          </FieldSection>
        </>
      ) : (
        <>
          <FieldSection
            description="20 套完整视觉方案，只覆盖外观配置；内容与输出格式保持不变，套用后仍可继续微调。"
            icon={<Sparkles aria-hidden className="size-4" />}
            title="风格预设"
          >
            <div className="grid min-w-0 gap-2">
              <OptionSelect
                label="预设方案"
                options={presetOptions}
                value={presetKey}
                onChange={applyPreset}
              />
              <p className="min-w-0 text-xs leading-5 text-muted">
                {selectedPreset?.description ?? '选择一套预设快速开始。'}
              </p>
            </div>
          </FieldSection>

          <FieldSection
            description="控制外轮廓、点阵风格、画布尺寸和留白。"
            icon={<Boxes aria-hidden className="size-4" />}
            title="外观与尺寸"
          >
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <OptionSelect
                label="整体形状"
                options={shapeTypes}
                value={state.shape}
                onChange={(shape) => patchState({ shape })}
              />
              <OptionSelect
                label="点阵样式"
                options={dotTypes}
                value={state.dotType}
                onChange={(dotType) => patchState({ dotType })}
              />
              <NumberSetting
                label="尺寸"
                maxValue={640}
                minValue={180}
                step={20}
                value={state.size}
                onChange={(size) => patchState({ size })}
              />
              <NumberSetting
                label="外边距"
                maxValue={40}
                minValue={0}
                step={2}
                value={state.margin}
                onChange={(margin) => patchState({ margin })}
              />
              <NumberSetting
                describe={(value) => `圆角 ${Math.round(value * 100)}%`}
                label="背景圆角"
                maxValue={0.5}
                minValue={0}
                step={0.02}
                value={state.backgroundRound}
                onChange={(backgroundRound) => patchState({ backgroundRound })}
              />
            </div>
          </FieldSection>

          <FieldSection
            description="可多选。透明背景开启后会忽略背景色、背景渐变和背景圆角。"
            icon={<ListChecks aria-hidden className="size-4" />}
            title="生成特性"
          >
            <CheckboxGroup name="render-options" value={featureSelection(state)} onChange={updateFeatures}>
              <Label className="sr-only">生成特性</Label>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Checkbox value="dots-gradient">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    点阵渐变
                  </Checkbox.Content>
                  <Description>dotsOptions.gradient</Description>
                </Checkbox>
                <Checkbox value="corner-square-gradient">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    外框渐变
                  </Checkbox.Content>
                  <Description>cornersSquareOptions.gradient</Description>
                </Checkbox>
                <Checkbox value="corner-dot-gradient">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    内点渐变
                  </Checkbox.Content>
                  <Description>cornersDotOptions.gradient</Description>
                </Checkbox>
                <Checkbox isDisabled={state.transparentBackground} value="background-gradient">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    背景渐变
                  </Checkbox.Content>
                  <Description>backgroundOptions.gradient</Description>
                </Checkbox>
                <Checkbox value="transparent-background">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    透明背景
                  </Checkbox.Content>
                  <Description>backgroundOptions.transparent</Description>
                </Checkbox>
                <Checkbox value="circle-shape">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    圆形轮廓
                  </Checkbox.Content>
                  <Description>shape: circle</Description>
                </Checkbox>
              </div>
            </CheckboxGroup>
          </FieldSection>

          <FieldSection
            description="控制二维码主体模块的样式与颜色。"
            icon={<Grid3x3 aria-hidden className="size-4" />}
            title="点阵"
          >
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <ColorPickerControl label="点阵色" value={state.dotColor} onChange={(dotColor) => patchState({ dotColor })} />
              <ColorPickerControl
                isDisabled={!state.useDotGradient}
                label="点阵渐变末端"
                value={state.dotGradientTo}
                onChange={(dotGradientTo) => patchState({ dotGradientTo })}
              />
            </div>
          </FieldSection>

          <FieldSection
            description="分别控制三个定位角的外框和中心点。"
            icon={<Focus aria-hidden className="size-4" />}
            title="定位角"
          >
            <div className="grid min-w-0 gap-4">
              <OptionSelect
                label="外框样式"
                options={cornerSquareTypes}
                value={state.cornerSquareType}
                onChange={(cornerSquareType) => patchState({ cornerSquareType })}
              />
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <ColorPickerControl
                  label="外框颜色"
                  value={state.cornerSquareColor}
                  onChange={(cornerSquareColor) => patchState({ cornerSquareColor })}
                />
                <ColorPickerControl
                  isDisabled={!state.useCornerSquareGradient}
                  label="外框渐变末端"
                  value={state.cornerSquareGradientTo}
                  onChange={(cornerSquareGradientTo) => patchState({ cornerSquareGradientTo })}
                />
              </div>
              <OptionSelect
                label="内点样式"
                options={cornerDotTypes}
                value={state.cornerDotType}
                onChange={(cornerDotType) => patchState({ cornerDotType })}
              />
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <ColorPickerControl
                  label="内点颜色"
                  value={state.cornerDotColor}
                  onChange={(cornerDotColor) => patchState({ cornerDotColor })}
                />
                <ColorPickerControl
                  isDisabled={!state.useCornerDotGradient}
                  label="内点渐变末端"
                  value={state.cornerDotGradientTo}
                  onChange={(cornerDotGradientTo) => patchState({ cornerDotGradientTo })}
                />
              </div>
            </div>
          </FieldSection>

          <FieldSection
            description="支持纯色、渐变、透明和圆角比例。"
            icon={<PaintBucket aria-hidden className="size-4" />}
            title="背景"
          >
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <ColorPickerControl
                isDisabled={state.transparentBackground}
                label="背景色"
                value={state.backgroundColor}
                onChange={(backgroundColor) => patchState({ backgroundColor })}
              />
              <ColorPickerControl
                isDisabled={state.transparentBackground || !state.useBackgroundGradient}
                label="背景渐变末端"
                value={state.backgroundGradientTo}
                onChange={(backgroundGradientTo) => patchState({ backgroundGradientTo })}
              />
            </div>
          </FieldSection>

          <FieldSection
            description="嵌入 PNG / JPEG / WebP 图片，并同步 imageOptions 的占比、留白、圆角和挖空点阵配置。"
            icon={<ImagePlus aria-hidden className="size-4" />}
            title="中心 Logo"
          >
            <UploadedImageRow
              changeLabel="更换 Logo"
              hasImage={hasLogo}
              imageName={logoName}
              previewUrl={logoPreviewUrl}
              removeLabel="移除"
              selectLabel="选择 Logo"
              onPick={() => logoInputRef.current?.click()}
              onRemove={onRemoveLogo}
            />

            {hasLogo ? (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <NumberSetting
                  describe={(value) => `占比 ${Math.round(value * 100)}%`}
                  label="Logo 占比"
                  maxValue={0.4}
                  minValue={0.05}
                  step={0.01}
                  value={state.imageSize}
                  onChange={(imageSize) => patchState({ imageSize })}
                />
                <NumberSetting
                  label="Logo 留白"
                  maxValue={24}
                  minValue={0}
                  step={1}
                  value={state.logoMargin}
                  onChange={(logoMargin) => patchState({ logoMargin })}
                />
                <NumberSetting
                  describe={(value) => `圆角 ${Math.round(value * 100)}%`}
                  label="Logo 圆角"
                  maxValue={0.5}
                  minValue={0}
                  step={0.02}
                  value={state.logoRound}
                  onChange={(logoRound) => patchState({ logoRound })}
                />
                <Checkbox
                  isSelected={state.hideBackgroundDots}
                  onChange={(hideBackgroundDots) => patchState({ hideBackgroundDots })}
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    挖空 Logo 下方点阵
                  </Checkbox.Content>
                  <Description>imageOptions.hideBackgroundDots</Description>
                </Checkbox>
              </div>
            ) : null}
          </FieldSection>
        </>
      )}
    </Form>
  );
}
