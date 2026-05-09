import { useState, useCallback } from 'react';
import {
  FileText,
  FileUp,
  FileDown,
  Maximize2,
  Minimize2,
  Code,
  Eye,
} from 'lucide-react';
import { fs } from '@/os/fs';

// Simple markdown parser to HTML
function markdownToHTML(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langClass = lang ? `language-${lang}` : '';
    const colored = code
      .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|type|interface|new|this|try|catch|throw|async|await|true|false|null|undefined)\b/g, '<span style="color:#c084fc">$1</span>')
      .replace(/(".*?")/g, '<span style="color:#34d399">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color:#fbbf24">$1</span>')
      .replace(/(\/\/.*)/g, '<span style="color:#94a3b8">$1</span>');
    return `<pre class="${langClass}" style="background:#1e293b;padding:12px;border-radius:6px;overflow:auto;margin:8px 0;font-family:monospace;font-size:12px;line-height:1.5"><code>${colored}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#1e293b;padding:2px 5px;border-radius:4px;font-family:monospace;font-size:12px;color:#34d399">$1</code>');

  // Headers
  html = html.replace(/^###### (.*$)/gim, '<h6 style="font-size:13px;font-weight:600;margin:8px 0;color:#94a3b8">$1</h6>');
  html = html.replace(/^##### (.*$)/gim, '<h5 style="font-size:14px;font-weight:600;margin:8px 0;color:#94a3b8">$1</h5>');
  html = html.replace(/^#### (.*$)/gim, '<h4 style="font-size:15px;font-weight:600;margin:10px 0;color:#94a3b8">$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:17px;font-weight:600;margin:12px 0;color:#cbd5e1;border-bottom:1px solid #334155;padding-bottom:4px">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:20px;font-weight:600;margin:14px 0;color:#e2e8f0;border-bottom:1px solid #334155;padding-bottom:6px">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:24px;font-weight:700;margin:16px 0;color:#f1f5f9;border-bottom:2px solid #334155;padding-bottom:8px">$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:600">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em style="font-style:italic">$1</em>');
  html = html.replace(/__(.*?)__/g, '<strong style="font-weight:600">$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em style="font-style:italic">$1</em>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote style="border-left:3px solid #3b82f6;padding-left:12px;margin:8px 0;color:#94a3b8;font-style:italic">$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gim, '<hr style="border:none;border-top:1px solid #334155;margin:16px 0" />');

  // Tables
  html = html.replace(/\|(.+)\|\n\|([-:\|\s]+)\|\n((?:\|.+\|\n?)+)/g, (_match, header, _sep, rows) => {
    const headers = header.split('|').map((h: string) => h.trim()).filter(Boolean);
    const rowLines = rows.trim().split('\n');
    let table = '<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px">';
    table += '<thead><tr>';
    headers.forEach((h: string) => {
      table += `<th style="border:1px solid #334155;padding:6px 10px;text-align:left;background:#1e293b;font-weight:600">${h}</th>`;
    });
    table += '</tr></thead><tbody>';
    rowLines.forEach((line: string) => {
      const cells = line.split('|').map((c: string) => c.trim()).filter(Boolean);
      table += '<tr>';
      cells.forEach((c: string) => {
        table += `<td style="border:1px solid #334155;padding:6px 10px">${c}</td>`;
      });
      table += '</tr>';
    });
    table += '</tbody></table>';
    return table;
  });

  // Lists
  const processLists = (text: string): string => {
    const lines = text.split('\n');
    const out: string[] = [];
    let inUl = false;
    let inOl = false;
    for (const line of lines) {
      const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (ulMatch) {
        if (!inUl) { out.push('<ul style="margin:8px 0;padding-left:20px">'); inUl = true; }
        out.push(`<li style="margin:3px 0">${ulMatch[2]}</li>`);
      } else if (olMatch) {
        if (!inOl) { out.push('<ol style="margin:8px 0;padding-left:20px">'); inOl = true; }
        out.push(`<li style="margin:3px 0">${olMatch[2]}</li>`);
      } else {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (inOl) { out.push('</ol>'); inOl = false; }
        out.push(line);
      }
    }
    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');
    return out.join('\n');
  };
  html = processLists(html);

  // Links and images
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" style="max-width:100%;border-radius:6px;margin:8px 0" />');
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:#3b82f6;text-decoration:none">$1</a>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p style="margin:8px 0;line-height:1.6">');
  html = '<p style="margin:8px 0;line-height:1.6">' + html + '</p>';
  html = html.replace(/<p style="margin:8px 0;line-height:1.6"><\/p>/g, '');

  return html;
}

const sampleMarkdown = `# Markdown Preview

## Features
- **Bold** and *italic* text
- \`inline code\` and code blocks
- [Links](https://example.com)
- Lists and tables

### Code Example
\`\`\`typescript
const greet = (name: string) => {
  return \`Hello, \${name}!\`;
};
\`\`\`

| Name  | Role   | Active |
|-------|--------|--------|
| Alice | Admin  | true   |
| Bob   | User   | false  |

> Blockquote: Markdown is awesome!

---

Enjoy writing in **Markdown**!
`;

export default function MarkdownPreview() {
  const [input, setInput] = useState(sampleMarkdown);
  const [fullscreen, setFullscreen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const loadFile = useCallback(() => {
    const path = prompt('Enter file path:');
    if (!path) return;
    const data = fs.readFile(path);
    if (data && typeof data === 'string') setInput(data);
    else alert('File not found or not text');
  }, []);

  const saveFile = useCallback(() => {
    const path = prompt('Save as (e.g. /home/user/Documents/doc.md):');
    if (!path) return;
    fs.writeFile(path, input, 'text/markdown');
    alert('Saved to ' + path);
  }, [input]);

  const exportHTML = useCallback(() => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export</title><style>body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}</style></head><body>${markdownToHTML(input)}</body></html>`;
    const path = prompt('Save HTML as:');
    if (path) {
      fs.writeFile(path, html, 'text/html');
      alert('Exported to ' + path);
    }
  }, [input]);

  const exportPDF = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Markdown Export</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1a1a}</style></head><body>${markdownToHTML(input)}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }, [input]);

  const previewHTML = markdownToHTML(input);

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-os-text-primary">
      {/* Toolbar */}
      <div className="h-10 flex items-center gap-1 px-2 border-b border-white/[0.08] flex-shrink-0">
        <button onClick={loadFile} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <FileUp className="w-3.5 h-3.5" /> Load
        </button>
        <button onClick={saveFile} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <FileDown className="w-3.5 h-3.5" /> Save
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button onClick={exportHTML} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <Code className="w-3.5 h-3.5" /> Export HTML
        </button>
        <button onClick={exportPDF} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <FileText className="w-3.5 h-3.5" /> Print PDF
        </button>
        <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs ml-auto">
          {showPreview ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
        {showPreview && (
          <button onClick={() => setFullscreen(!fullscreen)} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 flex overflow-hidden">
        {(!fullscreen || !showPreview) && (
          <div className={`flex flex-col border-r border-white/[0.08] min-w-0 ${showPreview && !fullscreen ? 'flex-1' : 'flex-1'}`}>
            <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3" /> Editor
            </div>
            <textarea
              className="flex-1 bg-transparent p-3 font-mono text-xs resize-none outline-none text-os-text-primary leading-relaxed"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}
        {showPreview && (
          <div className={`flex flex-col min-w-0 overflow-hidden ${fullscreen ? 'flex-1' : 'flex-1'}`}>
            <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase tracking-wider flex items-center gap-1">
              <Eye className="w-3 h-3" /> Preview
            </div>
            <div
              className="flex-1 overflow-auto p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: previewHTML }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
