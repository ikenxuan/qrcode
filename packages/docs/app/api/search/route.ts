import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

const search = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: 'english',
});

// 静态导出：构建期导出索引，浏览器端通过 fumadocs 的 static client 检索。
export const dynamic = 'force-static';

export async function GET() {
  return await search.staticGET();
}
