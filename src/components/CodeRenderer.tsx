import React, { useMemo } from 'react';
import hljs from 'highlight.js';
import { renderHighlightedText } from '../lib/highlightText';

interface CodeRendererProps {
  code: string;
  language?: string;
  isDark?: boolean;
  searchQuery?: string;
}

/**
 * Normalizes programming language aliases to highlight.js canonical identifiers.
 */
export function normalizeLanguage(lang?: string): string {
  if (!lang) return 'text';
  const l = lang.trim().toLowerCase();
  const aliasMap: Record<string, string> = {
    'c#': 'csharp',
    'cs': 'csharp',
    'csharp': 'csharp',
    'c++': 'cpp',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'pascal': 'delphi',
    'delphi': 'delphi',
    'dpr': 'delphi',
    'sh': 'bash',
    'shell': 'bash',
    'zsh': 'bash',
    'bash': 'bash',
    'py': 'python',
    'python': 'python',
    'js': 'javascript',
    'javascript': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'ts': 'typescript',
    'typescript': 'typescript',
    'tsx': 'typescript',
    'html': 'xml',
    'xhtml': 'xml',
    'htm': 'xml',
    'xml': 'xml',
    'svg': 'xml',
    'css': 'css',
    'scss': 'scss',
    'sql': 'sql',
    'pgsql': 'sql',
    'mysql': 'sql',
    'json': 'json',
    'jsonc': 'json',
    'php': 'php',
    'java': 'java',
    'c': 'c',
    'yaml': 'yaml',
    'yml': 'yaml',
    'rust': 'rust',
    'rs': 'rust',
    'go': 'go',
    'golang': 'go',
  };
  return aliasMap[l] || l;
}

/**
 * Escapes plain text for fallback rendering
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Recursively converts DOM nodes from parsed highlight.js HTML into safe React elements,
 * applying search keyword highlights to text nodes when a search query is active.
 */
function renderDomNodes(
  childNodes: NodeList,
  isDark: boolean,
  searchQuery?: string,
  keyPrefix = 'n'
): React.ReactNode[] {
  const result: React.ReactNode[] = [];

  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    const key = `${keyPrefix}-${i}`;

    if (node.nodeType === 3) {
      // TEXT_NODE
      const text = node.textContent || '';
      if (searchQuery && searchQuery.trim()) {
        result.push(
          <React.Fragment key={key}>
            {renderHighlightedText(text, searchQuery, isDark, { isCode: true })}
          </React.Fragment>
        );
      } else {
        result.push(text);
      }
    } else if (node.nodeType === 1) {
      // ELEMENT_NODE
      const el = node as HTMLElement;
      const children = renderDomNodes(el.childNodes, isDark, searchQuery, key);
      result.push(
        <span key={key} className={el.className}>
          {children}
        </span>
      );
    }
  }

  return result;
}

export const CodeRenderer: React.FC<CodeRendererProps> = ({
  code,
  language = 'text',
  isDark = true,
  searchQuery,
}) => {
  const renderedContent = useMemo(() => {
    if (!code) return null;

    const normalizedLang = normalizeLanguage(language);
    let highlightedHtml = '';

    try {
      if (normalizedLang !== 'text' && hljs.getLanguage(normalizedLang)) {
        highlightedHtml = hljs.highlight(code, {
          language: normalizedLang,
          ignoreIllegals: true,
        }).value;
      } else if (code.trim().length > 0 && normalizedLang !== 'text') {
        highlightedHtml = hljs.highlightAuto(code).value;
      } else {
        highlightedHtml = escapeHtml(code);
      }
    } catch {
      highlightedHtml = escapeHtml(code);
    }

    // Safely parse into DOM nodes and convert to React nodes
    try {
      if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<pre>${highlightedHtml}</pre>`, 'text/html');
        const container = doc.body.firstElementChild;
        if (container) {
          return renderDomNodes(container.childNodes, isDark, searchQuery);
        }
      }
    } catch {
      // fallback
    }

    // Fallback if DOMParser fails
    if (searchQuery && searchQuery.trim()) {
      return renderHighlightedText(code, searchQuery, isDark, { isCode: true });
    }
    return code;
  }, [code, language, isDark, searchQuery]);

  return <>{renderedContent}</>;
};
