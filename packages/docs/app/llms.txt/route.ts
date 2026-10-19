import { source } from '@/lib/source';
import { llms } from 'fumadocs-core/source';
import { basePath } from '@/lib/shared';

export const dynamic = 'force-static';
export const revalidate = false;

export function GET() {
  const body = llms(source).index();
  // llms() 生成的是站内绝对路径；部署在 GitHub Pages 子路径下时补上 basePath。
  return new Response(basePath ? body.replaceAll('](/', `](${basePath}/`) : body);
}
