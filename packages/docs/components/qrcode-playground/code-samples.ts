import { codeSampleKinds, fallbackContent, fileExtensions, mimeTypes } from './constants';
import type { CodeSample, CodeSampleKey, PlaygroundState } from './types';
import { escapeCodeString, indentBlock } from './utils';

function styleLine(useGradient: boolean, colorFrom: string, colorTo: string, indent: string) {
  return useGradient
    ? `${indent}gradient: { colorFrom: '${colorFrom}', colorTo: '${colorTo}' },`
    : `${indent}color: '${colorFrom}',`;
}

function backgroundLines(state: PlaygroundState) {
  if (state.transparentBackground) {
    return ['  backgroundOptions: { transparent: true },'];
  }

  return [
    '  backgroundOptions: {',
    state.useBackgroundGradient
      ? `    gradient: { colorFrom: '${state.backgroundColor}', colorTo: '${state.backgroundGradientTo}' },`
      : `    color: '${state.backgroundColor}',`,
    `    round: ${state.backgroundRound},`,
    '  },',
  ];
}

function createOptionsCode({
  state,
  hasLogo,
  imageExpression,
  withType,
}: {
  state: PlaygroundState;
  hasLogo: boolean;
  imageExpression: string;
  withType: boolean;
}) {
  const data = escapeCodeString(state.content.trim() || fallbackContent);
  const lines = [
    withType ? 'const options: QRCodeOptions = {' : 'const options = {',
    `  data: '${data}',`,
    `  size: ${state.size},`,
    `  margin: ${state.margin},`,
    `  shape: '${state.shape}',`,
    '  dotsOptions: {',
    `    dotType: '${state.dotType}',`,
    styleLine(state.useDotGradient, state.dotColor, state.dotGradientTo, '    '),
    '  },',
    '  cornersSquareOptions: {',
    `    cornerType: '${state.cornerSquareType}',`,
    styleLine(
      state.useCornerSquareGradient,
      state.cornerSquareColor,
      state.cornerSquareGradientTo,
      '    ',
    ),
    '  },',
    '  cornersDotOptions: {',
    `    cornerType: '${state.cornerDotType}',`,
    styleLine(state.useCornerDotGradient, state.cornerDotColor, state.cornerDotGradientTo, '    '),
    '  },',
    ...backgroundLines(state),
  ];

  if (hasLogo) {
    lines.push(
      `  image: ${imageExpression},`,
      '  imageOptions: {',
      `    imageSize: ${state.imageSize},`,
      `    margin: ${state.logoMargin},`,
      `    round: ${state.logoRound},`,
      `    hideBackgroundDots: ${state.hideBackgroundDots},`,
      '  },',
    );
  }

  lines.push('};');

  return lines.join('\n');
}

function createNodeSample(state: PlaygroundState, hasLogo: boolean) {
  const extension = fileExtensions[state.format];
  const optionsCode = createOptionsCode({
    state,
    hasLogo,
    imageExpression: 'logo',
    withType: true,
  });
  const fsImports = ['writeFileSync'];

  if (hasLogo) fsImports.push('readFileSync');

  if (state.format === 'svg') {
    return `import { ${fsImports.join(', ')} } from 'node:fs';
import { generateSvg } from '@ikenxuan/qrcode';
import type { QRCodeOptions } from '@ikenxuan/qrcode';
${hasLogo ? "\nconst logo = readFileSync('./logo.png');\n" : ''}
${optionsCode}

const svg = await generateSvg(options);
writeFileSync('qrcode.${extension}', svg);`;
  }

  const bufferImport = state.encoding === 'base64' ? "\nimport { Buffer } from 'node:buffer';" : '';
  const scanInput = state.encoding === 'base64' ? "Buffer.from(image, 'base64')" : 'image';
  const writeFile =
    state.encoding === 'base64'
      ? `writeFileSync('qrcode.${extension}', image, 'base64');`
      : `writeFileSync('qrcode.${extension}', image);`;

  return `import { ${fsImports.join(', ')} } from 'node:fs';${bufferImport}
import { generate, scan } from '@ikenxuan/qrcode';
import type { GenerateResult, QRCodeOptions } from '@ikenxuan/qrcode';
${hasLogo ? "\nconst logo = readFileSync('./logo.png');\n" : ''}
${optionsCode}

const image: GenerateResult<'${state.encoding}'> = await generate(options, '${state.format}', '${state.encoding}');
${writeFile}

const text = await scan(${scanInput});
console.log(text);`;
}

function createReactSample(state: PlaygroundState, hasLogo: boolean) {
  const optionsCode = indentBlock(
    createOptionsCode({
      state,
      hasLogo,
      imageExpression: 'logoBytes',
      withType: true,
    }),
    6,
  );

  const logoFetch = hasLogo
    ? `      const logoResponse = await fetch('/logo.png');
      const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());

`
    : '';

  let renderCode: string;

  if (state.format === 'svg') {
    renderCode = `      const svg = await generateSvg(options);
      setSrc('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));`;
  }
  else if (state.encoding === 'base64') {
    renderCode = `      const image = await generate(options, '${state.format}', 'base64');
      setSrc('data:${mimeTypes[state.format]};base64,' + image);`;
  }
  else {
    renderCode = `      const image = await generate(options, '${state.format}', 'binary');
      objectUrl = URL.createObjectURL(new Blob([image], { type: '${mimeTypes[state.format]}' }));
      setSrc(objectUrl);`;
  }

  return `'use client';

import { useEffect, useState } from 'react';
import { generate, generateSvg } from '@ikenxuan/qrcode/browser';
import type { QRCodeOptions } from '@ikenxuan/qrcode/browser';

export function QRCodePreview() {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let objectUrl = '';

    async function render() {
${logoFetch}${optionsCode}

${renderCode}
    }

    void render();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return src ? <img alt="QR Code" src={src} /> : null;
}`;
}

function createVueSample(state: PlaygroundState, hasLogo: boolean) {
  const optionsCode = indentBlock(
    createOptionsCode({
      state,
      hasLogo,
      imageExpression: 'logoBytes',
      withType: true,
    }),
    2,
  );

  const logoFetch = hasLogo
    ? `  const logoResponse = await fetch('/logo.png');
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());

`
    : '';

  let renderCode: string;

  if (state.format === 'svg') {
    renderCode = `  const svg = await generateSvg(options);
  src.value = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);`;
  }
  else if (state.encoding === 'base64') {
    renderCode = `  const image = await generate(options, '${state.format}', 'base64');
  src.value = 'data:${mimeTypes[state.format]};base64,' + image;`;
  }
  else {
    renderCode = `  const image = await generate(options, '${state.format}', 'binary');
  objectUrl = URL.createObjectURL(new Blob([image], { type: '${mimeTypes[state.format]}' }));
  src.value = objectUrl;`;
  }

  return `<template>
  <img v-if="src" :src="src" alt="QR Code" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { generate, generateSvg } from '@ikenxuan/qrcode/browser';
import type { QRCodeOptions } from '@ikenxuan/qrcode/browser';

const src = ref('');
let objectUrl = '';

onMounted(async () => {
${logoFetch}${optionsCode}

${renderCode}
});

onBeforeUnmount(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
</script>`;
}

function createBrowserSample(state: PlaygroundState, hasLogo: boolean) {
  const optionsCode = indentBlock(
    createOptionsCode({
      state,
      hasLogo,
      imageExpression: 'logoBytes',
      withType: false,
    }),
    2,
  );

  const logoFetch = hasLogo
    ? `  const logoResponse = await fetch('/logo.png');
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());

`
    : '';

  let renderCode: string;

  if (state.format === 'svg') {
    renderCode = `  target.innerHTML = await generateSvg(options);`;
  }
  else if (state.encoding === 'base64') {
    renderCode = `  const image = await generate(options, '${state.format}', 'base64');
  target.innerHTML = '<img alt="QR Code" src="data:${mimeTypes[state.format]};base64,' + image + '" />';`;
  }
  else {
    renderCode = `  const image = await generate(options, '${state.format}', 'binary');
  const url = URL.createObjectURL(new Blob([image], { type: '${mimeTypes[state.format]}' }));
  target.innerHTML = '<img alt="QR Code" src="' + url + '" />';`;
  }

  return `<div id="qrcode"></div>

<script type="module">
  import { generate, generateSvg } from 'https://esm.sh/@ikenxuan/qrcode/browser';

  const target = document.querySelector('#qrcode');
${logoFetch}${optionsCode}

${renderCode}
</script>`;
}

const sampleBuilders: Record<CodeSampleKey, (state: PlaygroundState, hasLogo: boolean) => string> = {
  node: createNodeSample,
  react: createReactSample,
  vue3: createVueSample,
  browser: createBrowserSample,
};

export function buildCodeSamples(state: PlaygroundState, hasLogo: boolean): CodeSample[] {
  return codeSampleKinds.map((sample) => ({
    key: sample.value,
    label: sample.label,
    description: sample.description ?? '',
    language: sample.value === 'vue3' ? 'Vue SFC' : sample.value === 'browser' ? 'HTML' : 'TypeScript',
    code: sampleBuilders[sample.value](state, hasLogo),
  }));
}
