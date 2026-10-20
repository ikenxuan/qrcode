import {
  codeSampleKinds,
  dyFallbackContent,
  fallbackContent,
  fileExtensions,
  mimeTypes,
} from './constants';
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

function createDyOptionsCode({
  state,
  hasBadge,
  imageExpression,
  centerExpression,
  withType,
}: {
  state: PlaygroundState;
  hasBadge: boolean;
  imageExpression: string;
  centerExpression?: string;
  withType: boolean;
}) {
  const data = escapeCodeString(state.content.trim() || dyFallbackContent);
  const frameUsesCount = (
    ['dashes', 'dots', 'ticks', 'segments', 'spark', 'orbit', 'gear'] as string[]
  ).includes(state.dyFrameStyle);
  const frameHasEnds = state.dyFrameStyle !== 'dots' && state.dyFrameStyle !== 'orbit';
  const lines = [
    withType ? 'const options: DyCodeOptions = {' : 'const options = {',
    `  data: '${data}',`,
    `  size: ${state.dySize},`,
    `  margin: ${state.dyMargin},`,
    `  darkColor: '${state.dyDarkColor}',`,
    `  lightColor: '${state.dyLightColor}',`,
    `  transparent: ${state.dyTransparent},`,
    `  moduleStyle: '${state.dyModuleStyle}',`,
    `  moduleRadius: ${state.dyModuleRadius},`,
    `  frame: ${state.dyFrame},`,
    `  frameStyle: '${state.dyFrameStyle}',`,
    `  frameWidth: ${state.dyFrameWidth},`,
    ...(frameHasEnds ? [`  frameRadius: ${state.dyFrameRadius},`] : []),
    ...(state.dyFrameStyle === 'arcs' ? [`  frameSpan: ${state.dyFrameSpan},`] : []),
    ...(frameUsesCount ? [`  frameCount: ${state.dyFrameCount},`] : []),
    `  logo: ${state.dyLogo},`,
    `  badge: ${state.dyBadge},`,
    `  badgeRadius: ${state.dyBadgeRadius},`,
  ];

  if (hasBadge && state.dyBadge) {
    lines.push(`  badgeImage: ${imageExpression},`);
  }

  if (centerExpression) {
    lines.push(`  centerImage: ${centerExpression},`);
  }

  lines.push('};');

  return lines.join('\n');
}

function createDyNodeSample(state: PlaygroundState, hasBadge: boolean, hasCenter: boolean) {
  const usesBadge = hasBadge && state.dyBadge;
  const optionsCode = createDyOptionsCode({
    state,
    hasBadge,
    imageExpression: 'badge',
    centerExpression: hasCenter ? 'center' : undefined,
    withType: true,
  });
  const fsImports = ['writeFileSync'];

  if (usesBadge || hasCenter) fsImports.push('readFileSync');

  const imageReads = `${usesBadge ? "\nconst badge = readFileSync('./badge.png');\n" : ''}${
    hasCenter ? "\nconst center = readFileSync('./center.png');\n" : ''
  }`;
  const extension = fileExtensions[state.format];

  if (state.format === 'svg') {
    return `import { ${fsImports.join(', ')} } from 'node:fs';
import { generateDySvg } from '@ikenxuan/qrcode';
import type { DyCodeOptions } from '@ikenxuan/qrcode';
${imageReads}
${optionsCode}

const svg = generateDySvg(options);
writeFileSync('douyin.${extension}', svg);`;
  }

  const bufferImport = state.encoding === 'base64' ? "\nimport { Buffer } from 'node:buffer';" : '';
  const scanInput = state.encoding === 'base64' ? "Buffer.from(image, 'base64')" : 'image';
  const writeFile =
    state.encoding === 'base64'
      ? `writeFileSync('douyin.${extension}', image, 'base64');`
      : `writeFileSync('douyin.${extension}', image);`;

  return `import { ${fsImports.join(', ')} } from 'node:fs';${bufferImport}
import { generateDy, scan } from '@ikenxuan/qrcode';
import type { DyCodeOptions, GenerateResult } from '@ikenxuan/qrcode';
${imageReads}
${optionsCode}

const image: GenerateResult<'${state.encoding}'> = await generateDy(options, '${state.format}', '${state.encoding}');
${writeFile}

const text = await scan(${scanInput});
console.log(text);`;
}

function createDyReactSample(state: PlaygroundState, hasBadge: boolean, hasCenter: boolean) {
  const usesBadge = hasBadge && state.dyBadge;
  const optionsCode = indentBlock(
    createDyOptionsCode({
      state,
      hasBadge,
      imageExpression: 'badgeBytes',
      centerExpression: hasCenter ? 'centerBytes' : undefined,
      withType: true,
    }),
    6,
  );

  const assetFetch = `${usesBadge
    ? `      const badgeResponse = await fetch('/badge.png');
      const badgeBytes = new Uint8Array(await badgeResponse.arrayBuffer());

`
    : ''}${hasCenter
    ? `      const centerResponse = await fetch('/center.png');
      const centerBytes = new Uint8Array(await centerResponse.arrayBuffer());

`
    : ''}`;

  const renderCode =
    state.format === 'svg'
      ? `      const svg = await generateDySvg(options);
      setSrc('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));`
      : state.encoding === 'base64'
        ? `      const image = await generateDy(options, '${state.format}', 'base64');
      setSrc('data:${mimeTypes[state.format]};base64,' + image);`
        : `      const image = await generateDy(options, '${state.format}', 'binary');
      objectUrl = URL.createObjectURL(new Blob([image], { type: '${mimeTypes[state.format]}' }));
      setSrc(objectUrl);`;

  return `'use client';

import { useEffect, useState } from 'react';
import { generateDy, generateDySvg } from '@ikenxuan/qrcode/browser';
import type { DyCodeOptions } from '@ikenxuan/qrcode/browser';

export function DyCodePreview() {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let objectUrl = '';

    async function render() {
${assetFetch}${optionsCode}

${renderCode}
    }

    void render();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return src ? <img alt="抖音码" src={src} /> : null;
}`;
}

function createDyVueSample(state: PlaygroundState, hasBadge: boolean, hasCenter: boolean) {
  const usesBadge = hasBadge && state.dyBadge;
  const optionsCode = indentBlock(
    createDyOptionsCode({
      state,
      hasBadge,
      imageExpression: 'badgeBytes',
      centerExpression: hasCenter ? 'centerBytes' : undefined,
      withType: true,
    }),
    2,
  );

  const assetFetch = `${usesBadge
    ? `  const badgeResponse = await fetch('/badge.png');
  const badgeBytes = new Uint8Array(await badgeResponse.arrayBuffer());

`
    : ''}${hasCenter
    ? `  const centerResponse = await fetch('/center.png');
  const centerBytes = new Uint8Array(await centerResponse.arrayBuffer());

`
    : ''}`;

  const renderCode =
    state.format === 'svg'
      ? `  const svg = await generateDySvg(options);
  src.value = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);`
      : state.encoding === 'base64'
        ? `  const image = await generateDy(options, '${state.format}', 'base64');
  src.value = 'data:${mimeTypes[state.format]};base64,' + image;`
        : `  const image = await generateDy(options, '${state.format}', 'binary');
  objectUrl = URL.createObjectURL(new Blob([image], { type: '${mimeTypes[state.format]}' }));
  src.value = objectUrl;`;

  return `<template>
  <img v-if="src" :src="src" alt="抖音码" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { generateDy, generateDySvg } from '@ikenxuan/qrcode/browser';
import type { DyCodeOptions } from '@ikenxuan/qrcode/browser';

const src = ref('');
let objectUrl = '';

onMounted(async () => {
${assetFetch}${optionsCode}

${renderCode}
});

onBeforeUnmount(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
</script>`;
}

function createDyBrowserSample(state: PlaygroundState, hasBadge: boolean, hasCenter: boolean) {
  const usesBadge = hasBadge && state.dyBadge;
  const optionsCode = indentBlock(
    createDyOptionsCode({
      state,
      hasBadge,
      imageExpression: 'badgeBytes',
      centerExpression: hasCenter ? 'centerBytes' : undefined,
      withType: false,
    }),
    2,
  );

  const assetFetch = `${usesBadge
    ? `  const badgeResponse = await fetch('/badge.png');
  const badgeBytes = new Uint8Array(await badgeResponse.arrayBuffer());

`
    : ''}${hasCenter
    ? `  const centerResponse = await fetch('/center.png');
  const centerBytes = new Uint8Array(await centerResponse.arrayBuffer());

`
    : ''}`;

  const renderCode =
    state.format === 'svg'
      ? `  target.innerHTML = await generateDySvg(options);`
      : state.encoding === 'base64'
        ? `  const image = await generateDy(options, '${state.format}', 'base64');
  target.innerHTML = '<img alt="抖音码" src="data:${mimeTypes[state.format]};base64,' + image + '" />';`
        : `  const image = await generateDy(options, '${state.format}', 'binary');
  const url = URL.createObjectURL(new Blob([image], { type: '${mimeTypes[state.format]}' }));
  target.innerHTML = '<img alt="抖音码" src="' + url + '" />';`;

  return `<div id="dycode"></div>

<script type="module">
  import { generateDy, generateDySvg } from 'https://esm.sh/@ikenxuan/qrcode/browser';

  const target = document.querySelector('#dycode');
${assetFetch}${optionsCode}

${renderCode}
</script>`;
}

function createNodeSample(state: PlaygroundState, hasLogo: boolean, hasCenter: boolean) {
  if (state.codeType === 'dy') return createDyNodeSample(state, hasLogo, hasCenter);

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

function createReactSample(state: PlaygroundState, hasLogo: boolean, hasCenter: boolean) {
  if (state.codeType === 'dy') return createDyReactSample(state, hasLogo, hasCenter);

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

function createVueSample(state: PlaygroundState, hasLogo: boolean, hasCenter: boolean) {
  if (state.codeType === 'dy') return createDyVueSample(state, hasLogo, hasCenter);

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

function createBrowserSample(state: PlaygroundState, hasLogo: boolean, hasCenter: boolean) {
  if (state.codeType === 'dy') return createDyBrowserSample(state, hasLogo, hasCenter);

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

const sampleBuilders: Record<
  CodeSampleKey,
  (state: PlaygroundState, hasLogo: boolean, hasCenter: boolean) => string
> = {
  node: createNodeSample,
  react: createReactSample,
  vue3: createVueSample,
  browser: createBrowserSample,
};

export function buildCodeSamples(
  state: PlaygroundState,
  hasLogo: boolean,
  hasCenter: boolean,
): CodeSample[] {
  return codeSampleKinds.map((sample) => ({
    key: sample.value,
    label: sample.label,
    description: sample.description ?? '',
    language: sample.value === 'vue3' ? 'Vue SFC' : sample.value === 'browser' ? 'HTML' : 'TypeScript',
    code: sampleBuilders[sample.value](state, hasLogo, hasCenter),
  }));
}
