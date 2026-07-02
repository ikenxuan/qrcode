const tokenPattern =
  /(\/\/.*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\b(?:as|async|await|const|else|export|false|from|function|if|import|interface|let|new|null|return|true|type|undefined|var)\b|\b(?:Blob|Buffer|QRCodeOptions|GenerateResult|Uint8Array|URL|generate|generateSvg|scan|fetch|ref|onMounted|onBeforeUnmount|useEffect|useState)\b|\b\d+(?:\.\d+)?\b|[{}()[\].,;:<>/=+-])/g;

const keywordPattern =
  /^(?:as|async|await|const|else|export|false|from|function|if|import|interface|let|new|null|return|true|type|undefined|var)$/;

export function escapeCodeString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function base64ByteLength(value: string) {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;

  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

export function revokeObjectUrl(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function indentBlock(code: string, spaces: number) {
  const indentation = ' '.repeat(spaces);

  return code
    .split('\n')
    .map((line) => (line ? `${indentation}${line}` : line))
    .join('\n');
}

export function highlightCode(code: string) {
  const tokens: Array<{ className?: string; value: string }> = [];
  let lastIndex = 0;

  for (const match of code.matchAll(tokenPattern)) {
    const value = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) tokens.push({ value: code.slice(lastIndex, index) });

    if (value.startsWith('//') || value.startsWith('/*')) tokens.push({ value, className: 'text-[#9b8172]' });
    else if (value.startsWith("'") || value.startsWith('"') || value.startsWith('`')) {
      tokens.push({ value, className: 'text-[#ffb47f]' });
    }
    else if (keywordPattern.test(value)) tokens.push({ value, className: 'text-[#dea584]' });
    else if (/^(?:Blob|Buffer|QRCodeOptions|GenerateResult|Uint8Array|URL)$/.test(value)) {
      tokens.push({ value, className: 'text-[#ffd7a8]' });
    }
    else if (/^(?:generate|generateSvg|scan|fetch|ref|onMounted|onBeforeUnmount|useEffect|useState)$/.test(value)) {
      tokens.push({ value, className: 'text-[#f6d2b0]' });
    }
    else if (/^\d/.test(value)) tokens.push({ value, className: 'text-[#f7c59f]' });
    else tokens.push({ value, className: 'text-[#bfa08d]' });

    lastIndex = index + value.length;
  }

  if (lastIndex < code.length) tokens.push({ value: code.slice(lastIndex) });

  return tokens;
}
