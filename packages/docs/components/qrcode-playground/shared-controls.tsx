'use client';

import type { Key, ReactNode } from 'react';
import {
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
import { colorPresets } from './constants';
import type { SelectOption } from './types';

export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
}) {
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
}

export function NumberSetting({
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
      <Description>{describe ? describe(value) : `${value}px`}</Description>
    </NumberField>
  );
}

export function ColorPickerControl({
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
      <ColorPicker.Trigger className="min-h-14 w-full min-w-0 justify-start">
        <ColorSwatch className="shrink-0" color={value} size="lg" />
        <span className="grid min-w-0 gap-0.5 text-left">
          <Label className="truncate">{label}</Label>
          <span className="truncate whitespace-nowrap font-mono text-xs text-muted">{value}</span>
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

export function ResultBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-2 rounded-lg border border-border bg-rust-soft/45 p-3">
      <span className="text-xs font-semibold uppercase text-muted">{label}</span>
      <output className="break-words font-mono text-sm text-foreground">{value}</output>
    </div>
  );
}

export function FieldSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 gap-4 rounded-lg border border-border/80 bg-rust-soft/30 p-4">
      <div className="grid min-w-0 gap-1">
        <Label>{title}</Label>
        {description ? <Description>{description}</Description> : null}
      </div>
      {children}
    </section>
  );
}
