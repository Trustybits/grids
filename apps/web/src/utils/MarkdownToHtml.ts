const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderInline = (input: string): string => {
  // We escape the entire string exactly once up front and then re-introduce a
  // limited set of HTML tags. This prevents arbitrary HTML injection via the
  // Markdown files. The captured groups below are already-escaped substrings,
  // so they must NOT be escaped again — doing so double-encodes entities
  // (e.g. turning "<" into "&amp;lt;" instead of "&lt;").
  let out = escapeHtml(input);

  // Inline code — content is already escaped.
  out = out.replace(/`([^`]+?)`/g, (_, code) => `<code>${code}</code>`);

  // Links — text/href are already escaped; the href additionally needs
  // backticks neutralized so they can't break out of the quoted attribute.
  out = out.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (_, text, href) => {
    const safeHref = String(href).replace(/`/g, '&#96;');
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // Bold then italics
  out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+?)\*/g, '<em>$1</em>');

  return out;
};

type ListType = 'ul' | 'ol';

const closeLists = (stack: ListType[]): string => {
  let out = '';
  // Each open list also has an open <li> (its last item, kept open so nested
  // lists can sit inside it). Close the item, then the list, for every level.
  while (stack.length > 0) {
    out += `</li></${stack.pop()}>`;
  }
  return out;
};

const parseMarkdown = (markdown: string): string => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  let html = '';
  let paragraphBuffer: string[] = [];
  const listStack: ListType[] = [];
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

      // Close any lists deeper than the target level. Each level closes its
      // open <li> first, then the list tag.
      while (listStack.length > level + 1) {
        html += `</li></${listStack.pop()}>`;
      }

      if (listStack.length === level + 1) {
        const current = listStack[listStack.length - 1];
        if (current === type) {
          // Sibling at the same level: close the previous item, open a new one.
          html += `</li><li>`;
        } else {
          // Same level but different list type: close and reopen as the new
          // type (the parent <li> we reopen into is the one above this list).
          html += `</li></${listStack.pop()}>`;
          listStack.push(type);
          html += `<${type}><li>`;
        }
      } else {
        // Deeper than the current depth: open missing levels. The new list
        // nests inside the current open <li>, so that <li> stays open.
        while (listStack.length < level + 1) {
          listStack.push(type);
          html += `<${type}><li>`;
        }
      }

      // Append the item content. The <li> opened above stays open until a
      // sibling, a de-nest, or closeLists/flushAll closes it.
      html += renderInline(itemText.trim());
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
