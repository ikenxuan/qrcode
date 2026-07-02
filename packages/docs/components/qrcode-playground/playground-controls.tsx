'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
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
import { FiTrash2, FiUpload } from 'react-icons/fi';
import {
  cornerDotTypes,
  cornerSquareTypes,
  dotTypes,
  encodings,
  formats,
  shapeTypes,
} from './constants';
import { ColorPickerControl, FieldSection, NumberSetting, OptionSelect } from './shared-controls';
import type { PlaygroundState } from './types';

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

export function PlaygroundControls({
  state,
  setState,
  logoInputRef,
  hasLogo,
  logoName,
  logoPreviewUrl,
  onPickLogo,
  onRemoveLogo,
}: {
  state: PlaygroundState;
  setState: Dispatch<SetStateAction<PlaygroundState>>;
  logoInputRef: RefObject<HTMLInputElement | null>;
  hasLogo: boolean;
  logoName: string;
  logoPreviewUrl: string;
  onPickLogo: (file: File | undefined) => void;
  onRemoveLogo: () => void;
}) {
  function patchState(patch: Partial<PlaygroundState>) {
    setState((current) => ({ ...current, ...patch }));
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
      <TextField
        fullWidth
        name="content"
        value={state.content}
        onChange={(content) => patchState({ content })}
      >
        <Label>二维码内容</Label>
        <TextArea rows={4} />
        <Description>{state.content.length.toLocaleString()} 个字符</Description>
      </TextField>

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
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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

      <CheckboxGroup
        name="render-options"
        value={featureSelection(state)}
        onChange={updateFeatures}
      >
        <Label>生成特性</Label>
        <Description>可多选。透明背景开启后会忽略背景色、背景渐变和背景圆角。</Description>
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

      <div className="grid min-w-0 gap-4">
        <FieldSection title="点阵" description="控制二维码主体模块的样式与颜色。">
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

        <FieldSection title="定位角" description="分别控制三个定位角的外框和中心点。">
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

        <FieldSection title="背景" description="支持纯色、渐变、透明和圆角比例。">
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
      </div>

      <FieldSection
        title="中心 Logo"
        description="嵌入 PNG / JPEG / WebP 图片，并同步 imageOptions 的占比、留白和挖空点阵配置。"
      >
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

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {logoPreviewUrl ? (
            // eslint-disable-next-line next/no-img-element -- Logo preview is a browser-created object URL.
            <img
              alt="已选 Logo"
              className="size-12 shrink-0 rounded-md border border-border object-contain"
              src={logoPreviewUrl}
            />
          ) : null}
          <Button className="w-full sm:w-auto" variant="secondary" onPress={() => logoInputRef.current?.click()}>
            <FiUpload aria-hidden />
            {hasLogo ? '更换 Logo' : '选择 Logo'}
          </Button>
          {hasLogo ? (
            <>
              <span className="min-w-0 max-w-full truncate font-mono text-xs text-muted sm:max-w-[12rem]">
                {logoName}
              </span>
              <Button className="w-full sm:w-auto" size="sm" variant="ghost" onPress={onRemoveLogo}>
                <FiTrash2 aria-hidden />
                移除
              </Button>
            </>
          ) : null}
        </div>

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
    </Form>
  );
}
