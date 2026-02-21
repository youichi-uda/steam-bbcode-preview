/**
 * Steam BBCode Preview - App Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const clearBtn = document.getElementById('clear-btn');

  // Sample BBCode to show on first load
  const sampleBBCode = `[h1]Welcome to Steam BBCode Preview[/h1]
This tool lets you preview [b]Steam-flavored BBCode[/b] in real time.

[h2]Text Formatting[/h2]
[b]Bold text[/b], [i]italic text[/i], [u]underlined text[/u], and [strike]strikethrough[/strike].

[h3]Links[/h3]
[url=https://store.steampowered.com]Visit Steam Store[/url]
Auto-link: [url]https://steamcommunity.com[/url]

[h2]Lists[/h2]
Unordered list:
[list]
[*]First item
[*]Second item
[*]Third item
[/list]

Ordered list:
[olist]
[*]Step one
[*]Step two
[*]Step three
[/olist]

[h2]Quote & Code[/h2]
[quote=Gabe Newell]The easiest way to stop piracy is to offer a better service than the pirates.[/quote]

[code]function helloSteam() {
  console.log("Hello, Steam!");
}[/code]

[h2]Spoiler[/h2]
The secret is: [spoiler]Hover to reveal this hidden text![/spoiler]

[h2]Table[/h2]
[table]
[tr]
[th]Game[/th]
[th]Hours[/th]
[th]Rating[/th]
[/tr]
[tr]
[td]Half-Life 2[/td]
[td]45[/td]
[td]10/10[/td]
[/tr]
[tr]
[td]Portal 2[/td]
[td]32[/td]
[td]10/10[/td]
[/tr]
[/table]

[hr]
[i]Try editing this text to see live preview![/i]`;

  function updatePreview() {
    preview.innerHTML = SteamBBCode.parse(editor.value);
    initSpoilers();
  }

  function initSpoilers() {
    preview.querySelectorAll('.spoiler').forEach(el => {
      el.addEventListener('click', () => {
        el.classList.toggle('revealed');
      });
    });
  }

  // Real-time preview
  editor.addEventListener('input', updatePreview);

  // Clear button
  clearBtn.addEventListener('click', () => {
    editor.value = '';
    updatePreview();
    editor.focus();
  });

  // Tag insertion buttons
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (!tag) return;

      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const selected = editor.value.substring(start, end);
      const before = editor.value.substring(0, start);
      const after = editor.value.substring(end);

      // Self-closing tags
      if (tag === '[hr]' || tag === '[*]') {
        editor.value = before + tag + after;
        const pos = start + tag.length;
        editor.setSelectionRange(pos, pos);
      } else {
        const closeTag = tag.replace('[', '[/').replace(/=.*?\]/, ']');
        editor.value = before + tag + selected + closeTag + after;
        if (selected) {
          editor.setSelectionRange(start, start + tag.length + selected.length + closeTag.length);
        } else {
          const pos = start + tag.length;
          editor.setSelectionRange(pos, pos);
        }
      }

      editor.focus();
      updatePreview();
    });
  });

  // Tab key support in editor
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 4;
      updatePreview();
    }
  });

  // Load sample on first visit
  editor.value = sampleBBCode;
  updatePreview();
});
