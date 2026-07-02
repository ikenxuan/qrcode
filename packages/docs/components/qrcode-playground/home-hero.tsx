'use client';

import { useState } from 'react';
import { Button, Card, Tabs, toast } from '@heroui/react';
import { FiCheckCircle, FiCopy, FiGithub } from 'react-icons/fi';
import { SiRust } from 'react-icons/si';
import { installCommands } from './constants';

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
        <div className="grid min-w-0 gap-4">
          <h1 className="max-w-3xl break-words text-3xl font-semibold tracking-normal text-foreground sm:text-5xl">
            @ikenxuan/qrcode
          </h1>
          <p className="max-w-2xl text-base leading-8 text-muted sm:text-lg">
            高性能二维码生成与扫码工具。支持多种样式、透明背景、SVG/PNG/JPEG/WebP 输出，
            并且 WASM 内联，浏览器和 Node.js 都能直接 import 使用。
          </p>
        </div>
        <div className="grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:gap-4">
          <Button className="w-full sm:min-w-36 sm:w-auto" size="lg" onPress={() => window.location.assign('/docs')}>
            <FiCheckCircle aria-hidden />
            阅读文档
          </Button>
          <Button
            className="w-full sm:min-w-36 sm:w-auto"
            size="lg"
            onPress={() => window.open('https://github.com/ikenxuan/qrcode', '_blank', 'noreferrer')}
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
          <Card.Description>一个包覆盖生成、样式化、下载与二维码识别。</Card.Description>
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
