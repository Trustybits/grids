const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeAttribute = (input: string): string => escapeHtml(input).replace(/`/g, '&#96;');

const renderInline = (input: string): string => {
  // We intentionally escape everything first and then re-introduce a limited set of
  // HTML tags. This prevents arbitrary HTML injection via the Markdown files.
  let out = escapeHtml(input);

  // Inline code
  out = out.replace(/`([^`]+?)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);

  // Links
  out = out.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (_, text, href) => {
    const safeHref = escapeAttribute(String(href));
    const safeText = escapeHtml(String(text));
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
  });

  // Bold then italics
  out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+?)\*/g, '<em>$1</em>');

  return out;
};

type ListType = 'ul' | 'ol';

const closeLists = (stack: ListType[]): string => {
  let out = '';
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    out += `</${stack[i]}>`;
  }
  stack.length = 0;
  return out;
};

const parseMarkdown = (markdown: string): string => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  let html = '';
  let paragraphBuffer: string[] = [];
  let listStack: ListType[] = [];
  let blockquoteBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(' ').trim();
    if (text.length === 0) {
      paragraphBuffer = [];
      return;
    }
    html += `<p>${renderInline(text)}</p>`;
    paragraphBuffer = [];
  };

  const flushBlockquote = () => {
    if (blockquoteBuffer.length === 0) return;

    // Strip leading ">" markers, then recursively parse. Since we've removed the blockquote
    // prefix, this won't re-enter blockquote mode.
    const inner = blockquoteBuffer
      .map((l) => l.replace(/^\s*>\s?/, ''))
      .join('\n');

    // Blockquotes in these docs are mostly used for contact blocks. Keep them readable.
    html += `<blockquote>${parseMarkdown(inner)}</blockquote>`;
    blockquoteBuffer = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushBlockquote();
    html += closeLists(listStack);
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const rawLine = lines[idx];
    const line = rawLine ?? '';

    // Blockquotes: accumulate contiguous ">" lines (including blank quoted lines).
    if (/^\s*>/.test(line)) {
      flushParagraph();
      html += closeLists(listStack);
      blockquoteBuffer.push(line);
      continue;
    }

    // If we were in a blockquote, a non-quoted line ends it.
    if (blockquoteBuffer.length > 0) {
      flushBlockquote();
    }

    // Blank line: paragraph/list separation.
    if (line.trim().length === 0) {
      flushParagraph();
      html += closeLists(listStack);
      continue;
    }

    // Horizontal rule
    if (/^\s*---\s*$/.test(line)) {
      flushParagraph();
      html += closeLists(listStack);
      html += '<hr />';
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      flushParagraph();
      html += closeLists(listStack);
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      html += `<h${level}>${renderInline(content)}</h${level}>`;
      continue;
    }

    // Lists (unordered and ordered). We treat indentation as nested lists in steps of 2 spaces.
    const listMatch = line.match(/^(\s*)(-\s+|\*\s+|\d+\.\s+)(.+)$/);
    if (listMatch) {
      flushParagraph();

      const indent = listMatch[1].length;
      const bullet = listMatch[2];
      const itemText = listMatch[3];
      const level = Math.floor(indent / 2);
      const type: ListType = /^\d+\./.test(bullet.trim()) ? 'ol' : 'ul';

      // Adjust nesting
      while (listStack.length > level + 1) {
        html += `</${listStack.pop()}>`;
      }

      if (listStack.length < level + 1) {
        // Open missing levels
        while (listStack.length < level + 1) {
          listStack.push(type);
          html += `<${type}>`;
        }
      } else {
        // Same level: if list type changes, close and reopen
        const current = listStack[listStack.length - 1];
        if (current !== type) {
          html += `</${listStack.pop()}>`;
          listStack.push(type);
          html += `<${type}>`;
        }
      }

      html += `<li>${renderInline(itemText.trim())}</li>`;
      continue;
    }

    // Default: treat as paragraph continuation
    paragraphBuffer.push(line.trim());
  }

  flushAll();
  return html;
};

export const markdownToHtml = (markdown: string): string => {
  // Public API: normalize and parse.
  return parseMarkdown(markdown || '');
};
