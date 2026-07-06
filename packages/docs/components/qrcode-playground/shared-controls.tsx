'use client';

import { useState, type Key, type ReactNode } from 'react';
import type { Color, ColorChannel, ColorSpace } from '@heroui/react';
import {
  Button,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Description,
  Label,
  ListBox,
  NumberField,
  Select,
} from '@heroui/react';
import { Shuffle } from 'lucide-react';
import { colorPresets } from './constants';
import type { SelectOption } from './types';

const colorSpaceOptions: Array<{ value: ColorSpace; label: string }> = [
  { value: 'hsl', label: 'HSL' },
  { value: 'hsb', label: 'HSB' },
  { value: 'rgb', label: 'RGB' },
];

const colorChannelsByColorSpace: Record<ColorSpace, ColorChannel[]> = {
  hsb: ['hue', 'saturation', 'brightness'],
  hsl: ['hue', 'saturation', 'lightness'],
  rgb: ['red', 'green', 'blue'],
};

const colorChannelLabels: Partial<Record<ColorChannel, string>> = {
  hue: 'H',
  saturation: 'S',
  brightness: 'B',
  lightness: 'L',
  red: 'R',
  green: 'G',
  blue: 'B',
  alpha: 'A',
};

const toHexByte = (value: number): string => {
  return Math.round(value).toString(16).padStart(2, '0');
};

const hslToHex = (hue: number, saturation: number, lightness: number): string => {
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const huePrime = hue / 60;
  const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = normalizedLightness - chroma / 2;

  const [red, green, blue] =
    huePrime < 1
      ? [chroma, secondComponent, 0]
      : huePrime < 2
        ? [secondComponent, chroma, 0]
        : huePrime < 3
          ? [0, chroma, secondComponent]
          : huePrime < 4
            ? [0, secondComponent, chroma]
            : huePrime < 5
              ? [secondComponent, 0, chroma]
              : [chroma, 0, secondComponent];

  return `#${toHexByte((red + match) * 255)}${toHexByte((green + match) * 255)}${toHexByte((blue + match) * 255)}`;
};

const createRandomColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 52 + Math.floor(Math.random() * 42);
  const lightness = 34 + Math.floor(Math.random() * 34);

  return hslToHex(hue, saturation, lightness);
};

export const OptionSelect = <T extends string,>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
}) => {
  return (
    <Select
      fullWidth
      name={label}
      placeholder={label}
      value={value}
      onChange={(nextValue: Key | null) => {
        if (nextValue !== null) onChange(String(nextValue) as T);
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
              <span className="grid min-w-0 gap-0.5">
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
};

export const NumberSetting = ({
  label,
  value,
  minValue,
  maxValue,
  step,
  onChange,
  describe,
}: {
  label: string;
  value: number;
  minValue: number;
  maxValue: number;
  step: number;
  onChange: (value: number) => void;
  describe?: (value: number) => string;
}) => {
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
      <Description>{describe ? describe(value) : `${value}px`}</Description>
    </NumberField>
  );
};

export const ColorPickerControl = ({
  isDisabled,
  label,
  value,
  onChange,
}: {
  isDisabled?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const [colorSpace, setColorSpace] = useState<ColorSpace>('hsl');
  const selectedChannels = colorChannelsByColorSpace[colorSpace];

  const handleColorChange = (color: Color) => {
    if (!isDisabled) onChange(color.toString('hex'));
  };

  const handleRandomColor = () => {
    if (!isDisabled) onChange(createRandomColor());
  };

  return (
    <ColorPicker
      className={`w-full ${isDisabled ? 'pointer-events-none opacity-50' : ''}`}
      value={value}
      onChange={handleColorChange}
    >
      <ColorPicker.Trigger className="min-h-14 w-full min-w-0 justify-start">
        <ColorSwatch className="shrink-0" color={value} size="lg" />
        <span className="grid min-w-0 gap-0.5 text-left">
          <Label className="truncate">{label}</Label>
          <span className="truncate whitespace-nowrap font-mono text-xs text-muted">{value}</span>
        </span>
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="max-w-[18rem] gap-3">
        <div className="grid min-w-0 gap-2">
          <ColorSwatchPicker aria-label={`${label} 预设色`} className="justify-center px-1" size="xs">
            {colorPresets.map((preset) => (
              <ColorSwatchPicker.Item key={preset} color={preset}>
                <ColorSwatchPicker.Swatch />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
          <div className="flex items-center gap-2">
            <ColorSlider
              aria-label={`${label} 色相`}
              channel="hue"
              className="min-w-0 flex-1 gap-1 px-1"
              colorSpace="hsb"
            >
              <ColorSlider.Track>
                <ColorSlider.Thumb />
              </ColorSlider.Track>
            </ColorSlider>
            <Button
              isIconOnly
              aria-label={`${label} 随机颜色`}
              size="sm"
              variant="tertiary"
              onPress={handleRandomColor}
            >
              <Shuffle aria-hidden className="size-4" />
            </Button>
          </div>
        </div>

        <ColorArea
          aria-label={`${label} 色域`}
          className="max-w-full"
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
        >
          <ColorArea.Thumb />
        </ColorArea>

        <ColorField aria-label={`${label} 颜色值`}>
          <ColorField.Group variant="secondary">
            <ColorField.Prefix>
              <ColorSwatch size="xs" />
            </ColorField.Prefix>
            <ColorField.Input />
          </ColorField.Group>
        </ColorField>

        <Select
          aria-label={`${label} 颜色通道`}
          value={colorSpace}
          variant="secondary"
          onChange={(nextValue: Key | null) => {
            if (nextValue !== null) setColorSpace(nextValue as ColorSpace);
          }}
        >
          <Select.Trigger>
            <Select.Value className="uppercase" />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {colorSpaceOptions.map((space) => (
                <ListBox.Item
                  key={space.value}
                  className="uppercase"
                  id={space.value}
                  textValue={space.label}
                >
                  {space.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <div className="grid w-full grid-cols-3 items-center gap-2">
          {selectedChannels.map((channel) => (
            <ColorField
              key={channel}
              aria-label={`${label} ${channel}`}
              channel={channel}
              colorSpace={colorSpace}
            >
              <ColorField.Group variant="secondary">
                <ColorField.Prefix>{colorChannelLabels[channel] ?? channel}</ColorField.Prefix>
                <ColorField.Input className="min-w-0" />
              </ColorField.Group>
            </ColorField>
          ))}
        </div>
      </ColorPicker.Popover>
    </ColorPicker>
  );
};

export const ResultBlock = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="grid min-w-0 gap-2 rounded-lg border border-border bg-rust-soft/45 p-3">
      <span className="text-xs font-semibold uppercase text-muted">{label}</span>
      <output className="break-words font-mono text-sm text-foreground">{value}</output>
    </div>
  );
};

export const FieldSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) => {
  return (
    <section className="grid min-w-0 gap-4 rounded-lg border border-border/80 bg-rust-soft/30 p-4">
      <div className="grid min-w-0 gap-1">
        <Label>{title}</Label>
        {description ? <Description>{description}</Description> : null}
      </div>
      {children}
    </section>
  );
};
