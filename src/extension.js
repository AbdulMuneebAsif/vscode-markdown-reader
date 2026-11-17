const vscode = require('vscode');
const MarkdownIt = require('markdown-it');

const panels = new Map();

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownDocumentReader.openPreview', (uri) => {
      openPreview(context, resolveDocumentUri(uri), vscode.ViewColumn.Active);
    }),
    vscode.commands.registerCommand('markdownDocumentReader.openPreviewToSide', (uri) => {
      openPreview(context, resolveDocumentUri(uri), vscode.ViewColumn.Beside);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const entry = panels.get(event.document.uri.toString());
      if (entry) {
        updatePanelContent(entry.panel, event.document);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('markdownDocumentReader')) return;
      for (const entry of panels.values()) {
        updatePanel(entry.panel, entry.document, context);
      }
    })
  );
}

function resolveDocumentUri(uri) {
  if (uri instanceof vscode.Uri) return uri;
  return vscode.window.activeTextEditor?.document.uri;
}

async function openPreview(context, uri, column) {
  if (!uri) {
    vscode.window.showInformationMessage('Open a Markdown file first.');
    return;
  }

  let document;
  try {
    document = await vscode.workspace.openTextDocument(uri);
  } catch {
    vscode.window.showErrorMessage('The selected Markdown file could not be opened.');
    return;
  }

  if (document.languageId !== 'markdown' && !document.fileName.toLowerCase().endsWith('.md')) {
    vscode.window.showInformationMessage('Markdown Document Reader works with .md files.');
    return;
  }

  const key = document.uri.toString();
  const existing = panels.get(key);
  if (existing) {
    existing.panel.reveal(column, true);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'markdownDocumentReader.preview',
    previewTitle(document),
    { viewColumn: column, preserveFocus: column === vscode.ViewColumn.Beside },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'media'),
        vscode.Uri.file(vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || vscode.Uri.joinPath(document.uri, '..').fsPath)
      ]
    }
  );

  const entry = { panel, document };
  panels.set(key, entry);
  panel.onDidDispose(() => panels.delete(key), null, context.subscriptions);
  panel.webview.onDidReceiveMessage((message) => {
    if (message?.type === 'ready') updatePanelContent(panel, document);
  }, null, context.subscriptions);

  updatePanel(panel, document, context);
}

function updatePanel(panel, document, context) {
  panel.title = previewTitle(document);
  panel.webview.html = getWebviewHtml(panel.webview, document, context);
}

function updatePanelContent(panel, document) {
  panel.title = previewTitle(document);
  const content = renderMarkdownDocument(document.getText());
  panel.webview.postMessage({
    type: 'update',
    html: content.html || '<p class="empty-state">This document is empty.</p>',
    tocHtml: renderTocLinks(content.headings),
    title: previewTitle(document).replace(/^Reading: /, '')
  });
}

function previewTitle(document) {
  const fileName = document.uri.path.split('/').pop() || 'Markdown';
  return `Reading: ${fileName.replace(/\.md$/i, '')}`;
}

function getWebviewHtml(webview, document, context) {
  const config = vscode.workspace.getConfiguration('markdownDocumentReader', document.uri);
  const width = config.get('defaultWidth', 'comfortable');
  const fontSize = config.get('defaultFontSize', 17);
  const showToc = config.get('showTableOfContents', true);
  const nonce = createNonce();
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'reader.css'));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'reader.js'));
  const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(document.uri, '..'));

  const content = renderMarkdownDocument(document.getText());
  const toc = showToc ? renderToc(content.headings) : '';
  const title = escapeHtml(previewTitle(document).replace(/^Reading: /, ''));

  return `<!doctype html>
<html lang="en" data-show-toc="${showToc}" data-width="${escapeHtml(width)}" style="--reader-font-size:${Number(fontSize)}px">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base href="${baseUri.toString(true)}/">
  <title>${title}</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <header class="reader-toolbar" aria-label="Reading controls">
    <div id="file-title" class="file-title" title="${escapeHtml(document.fileName)}">${title}</div>
    <div class="toolbar-actions">
      <button id="toc-toggle" class="icon-button${showToc && content.headings.length > 0 ? '' : ' hidden'}" type="button" title="Toggle table of contents" aria-label="Toggle table of contents">☰</button>
      <span class="separator"></span>
      <button id="font-down" class="icon-button text-button" type="button" title="Decrease text size" aria-label="Decrease text size">A−</button>
      <button id="font-up" class="icon-button text-button" type="button" title="Increase text size" aria-label="Increase text size">A+</button>
      <button id="width-toggle" class="icon-button" type="button" title="Change page width" aria-label="Change page width">↔</button>
    </div>
  </header>
  <div class="reading-shell">
    ${toc}
    <main id="document" class="document-page" tabindex="-1">
      <article id="markdown-body" class="markdown-body">${content.html || '<p class="empty-state">This document is empty.</p>'}</article>
      <footer class="document-footer">End of document</footer>
    </main>
  </div>
  <button id="back-to-top" type="button" aria-label="Back to top" title="Back to top">↑</button>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function renderMarkdownDocument(source) {
  const renderer = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false
  });
  const headings = [];
  const slugCounts = new Map();
  const originalHeadingOpen = renderer.renderer.rules.heading_open;
  renderer.renderer.rules.heading_open = (tokens, index, options, env, self) => {
    const inline = tokens[index + 1];
    const label = inline?.content || 'Section';
    const baseSlug = slugify(label);
    const count = slugCounts.get(baseSlug) || 0;
    slugCounts.set(baseSlug, count + 1);
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    tokens[index].attrSet('id', slug);
    headings.push({ level: Number(tokens[index].tag.slice(1)), label, slug });
    return originalHeadingOpen
      ? originalHeadingOpen(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options);
  };

  return { html: renderer.render(source), headings };
}

function renderToc(headings) {
  return `<aside id="toc" class="toc-panel" aria-label="Table of contents"><div class="toc-heading">On this page</div><nav id="toc-links">${renderTocLinks(headings)}</nav></aside>`;
}

function renderTocLinks(headings) {
  return headings
    .map((heading) => `<a class="toc-link level-${heading.level}" href="#${escapeHtml(heading.slug)}">${escapeHtml(heading.label)}</a>`)
    .join('');
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');
  return slug || 'section';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i += 1) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function deactivate() {
  panels.clear();
}

module.exports = { activate, deactivate };
