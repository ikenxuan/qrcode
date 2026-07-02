'use client';

import type { Key } from 'react';
import { Button, Card, Tabs } from '@heroui/react';
import { FiCheckCircle, FiCopy } from 'react-icons/fi';
import type { CodeSample, CodeSampleKey } from './types';
import { highlightCode } from './utils';

export function CodeSamplePanel({
  samples,
  selectedKey,
  copiedKey,
  onSelect,
  onCopy,
}: {
  samples: CodeSample[];
  selectedKey: CodeSampleKey;
  copiedKey: CodeSampleKey | '';
  onSelect: (key: CodeSampleKey) => void;
  onCopy: (sample: CodeSample) => void;
}) {
  const selectedSample = samples.find((sample) => sample.key === selectedKey) ?? samples[0];

  return (
    <Card className="min-w-0 border border-[#6f301a]/60 bg-[#150906] text-[#fff7ed]">
      <Card.Header className="flex-col items-start gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="grid min-w-0 gap-1">
          <Card.Title className="text-lg text-[#fff7ed]">多端调用示例</Card.Title>
          <Card.Description className="text-[#eec9aa]">
            默认展示 Node，用 Tabs 切换 React、Vue 3 和原生浏览器写法。
          </Card.Description>
        </div>
        <Button className="w-full sm:w-auto" onPress={() => onCopy(selectedSample)}>
          {copiedKey === selectedSample.key ? <FiCheckCircle aria-hidden /> : <FiCopy aria-hidden />}
          {copiedKey === selectedSample.key ? '已复制' : '复制当前示例'}
        </Button>
      </Card.Header>

      <Card.Content className="min-w-0 p-0">
        <Tabs
          className="min-w-0 px-4 pb-4 sm:px-5"
          selectedKey={selectedKey}
          onSelectionChange={(key: Key) => onSelect(String(key) as CodeSampleKey)}
        >
          <Tabs.ListContainer className="max-w-full overflow-x-auto">
            <Tabs.List
              aria-label="代码示例类型"
              className="w-fit bg-[#0f0604] *:whitespace-nowrap *:text-[#eec9aa]"
            >
              {samples.map((sample) => (
                <Tabs.Tab key={sample.key} id={sample.key}>
                  {sample.label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>

          {samples.map((sample) => (
            <Tabs.Panel key={sample.key} className="pt-4" id={sample.key}>
              <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-sm leading-6 text-[#eec9aa]">{sample.description}</p>
                <span className="w-fit shrink-0 rounded-md border border-[#6f301a]/70 px-2 py-1 font-mono text-xs text-[#ffd7a8]">
                  {sample.language}
                </span>
              </div>
              <pre className="max-w-full overflow-x-auto rounded-lg border border-[#6f301a]/70 bg-[#0f0604] p-4 text-sm leading-7 shadow-inner sm:p-5">
                <code className="block min-w-max text-[#fff7ed]">
                  {highlightCode(sample.code).map((token, index) => (
                    <span key={`${token.value}-${index}`} className={token.className}>
                      {token.value}
                    </span>
                  ))}
                </code>
              </pre>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Card.Content>
    </Card>
  );
}
