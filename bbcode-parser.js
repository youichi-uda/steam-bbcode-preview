/**
 * Steam BBCode Parser
 * Converts Steam-flavored BBCode to HTML with XSS protection.
 */
const SteamBBCode = (() => {
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Extract [noparse] blocks before processing
  function extractNoparse(text) {
    const blocks = [];
    const replaced = text.replace(/\[noparse\]([\s\S]*?)\[\/noparse\]/gi, (_, content) => {
      const id = `\x00NOPARSE_${blocks.length}\x00`;
      blocks.push(escapeHtml(content));
      return id;
    });
    return { text: replaced, blocks };
  }

  function restoreNoparse(html, blocks) {
    return html.replace(/\x00NOPARSE_(\d+)\x00/g, (_, i) => blocks[i]);
  }

  function sanitizeUrl(url) {
    const trimmed = url.trim();
    if (/^(https?:\/\/|\/\/)/i.test(trimmed)) {
      return trimmed;
    }
    // Block javascript: and data: URIs
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
      return '#';
    }
    return trimmed;
  }

  function parseLists(html) {
    // Process [olist] → <ol>
    html = html.replace(/\[olist\]([\s\S]*?)\[\/olist\]/gi, (_, content) => {
      const items = content
        .split(/\[\*\]/)
        .filter(item => item.trim() !== '')
        .map(item => `<li>${item.trim()}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    });

    // Process [list] → <ul>
    html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, content) => {
      const items = content
        .split(/\[\*\]/)
        .filter(item => item.trim() !== '')
        .map(item => `<li>${item.trim()}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    });

    return html;
  }

  function parseTables(html) {
    html = html.replace(/\[table\]([\s\S]*?)\[\/table\]/gi, (_, content) => {
      let inner = content;
      inner = inner.replace(/\[tr\]([\s\S]*?)\[\/tr\]/gi, (_, row) => {
        let cells = row;
        cells = cells.replace(/\[th\]([\s\S]*?)\[\/th\]/gi, (_, c) => `<th>${c.trim()}</th>`);
        cells = cells.replace(/\[td\]([\s\S]*?)\[\/td\]/gi, (_, c) => `<td>${c.trim()}</td>`);
        return `<tr>${cells}</tr>`;
      });
      return `<table>${inner}</table>`;
    });
    return html;
  }

  function parse(bbcode) {
    if (!bbcode) return '';

    // 1. Extract noparse blocks
    const { text, blocks } = extractNoparse(bbcode);

    // 2. HTML-escape everything (XSS protection)
    let html = escapeHtml(text);

    // 3. Simple tag replacements
    const simpleTags = [
      [/\[b\]([\s\S]*?)\[\/b\]/gi, '<b>$1</b>'],
      [/\[i\]([\s\S]*?)\[\/i\]/gi, '<i>$1</i>'],
      [/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>'],
      [/\[strike\]([\s\S]*?)\[\/strike\]/gi, '<del>$1</del>'],
      [/\[h1\]([\s\S]*?)\[\/h1\]/gi, '<h1>$1</h1>'],
      [/\[h2\]([\s\S]*?)\[\/h2\]/gi, '<h2>$1</h2>'],
      [/\[h3\]([\s\S]*?)\[\/h3\]/gi, '<h3>$1</h3>'],
      [/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre><code>$1</code></pre>'],
      [/\[hr\]\[\/hr\]/gi, '<hr>'],
      [/\[hr\]/gi, '<hr>'],
    ];

    for (const [pattern, replacement] of simpleTags) {
      html = html.replace(pattern, replacement);
    }

    // 4. URL tags
    // [url=http://...]text[/url]
    html = html.replace(/\[url=(&quot;|&#039;)?([\s\S]*?)\1?\]([\s\S]*?)\[\/url\]/gi, (_, _q, url, text) => {
      return `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });
    // [url]http://...[/url]
    html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_, url) => {
      return `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    // 5. Quote
    html = html.replace(/\[quote=([\s\S]*?)\]([\s\S]*?)\[\/quote\]/gi, (_, author, content) => {
      return `<blockquote><div class="quote-author">${author} said:</div>${content}</blockquote>`;
    });
    html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, (_, content) => {
      return `<blockquote>${content}</blockquote>`;
    });

    // 6. Spoiler
    html = html.replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, (_, content) => {
      return `<span class="spoiler">${content}</span>`;
    });

    // 7. Image
    html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_, src) => {
      const safeSrc = sanitizeUrl(src);
      return `<img src="${safeSrc}" alt="user image" loading="lazy">`;
    });

    // 8. Lists
    html = parseLists(html);

    // 9. Tables
    html = parseTables(html);

    // 10. Convert newlines to <br> (but not inside pre/code)
    html = convertNewlines(html);

    // 11. Restore noparse blocks
    html = restoreNoparse(html, blocks);

    return html;
  }

  function convertNewlines(html) {
    // Split by <pre>...</pre> and only convert newlines outside pre blocks
    const parts = html.split(/(<pre[\s\S]*?<\/pre>)/gi);
    return parts.map((part, i) => {
      if (i % 2 === 1) return part; // Inside <pre>, keep as-is
      let result = part.replace(/\n/g, '<br>');
      // Remove <br> inside table/list structure (between tags like <table><br><tr>)
      result = result.replace(/(<table>)(\s*<br>\s*)*/gi, '$1');
      result = result.replace(/(\s*<br>\s*)*(<\/table>)/gi, '$2');
      result = result.replace(/(<tr>)(\s*<br>\s*)*/gi, '$1');
      result = result.replace(/(\s*<br>\s*)*(<\/tr>)/gi, '$2');
      result = result.replace(/(<\/tr>)(\s*<br>\s*)*/gi, '$1');
      result = result.replace(/(<\/th>)(\s*<br>\s*)*(<th>)/gi, '$1$3');
      result = result.replace(/(<\/td>)(\s*<br>\s*)*(<td>)/gi, '$1$3');
      // Remove <br> directly before/after block elements
      const blocks = 'table|thead|tbody|tr|th|td|ul|ol|li|blockquote|h[1-6]|hr|pre';
      result = result.replace(new RegExp(`(<br>\\s*)+(<(?:${blocks})[\\s>])`, 'gi'), '$2');
      result = result.replace(new RegExp(`(<\\/(?:${blocks})>)(\\s*<br>)+`, 'gi'), '$1');
      return result;
    }).join('');
  }

  return { parse };
})();
