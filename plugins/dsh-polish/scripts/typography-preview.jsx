import React from 'react';
import { createRoot } from 'react-dom/client';

const P = globalThis.__DSH_NATIVE_MODULES__['@deepseek-ai/dsh-client-ui-primitives'];
const media = matchMedia('(prefers-color-scheme: dark)');
const appearance = () => document.body.toggleAttribute('data-ds-dark-theme', media.matches);
appearance(); media.addEventListener('change', appearance);
const inputClass = 'JZLxKW_input'; // Checked against inspectTypography().classes.input.
const sample = [
  '## 让 `settings.css` 更容易阅读',
  '排版的任务是让内容清楚。界面文字保持紧凑，长对话保留足够的行距；中文、English 和 1280 × 960 这样的数字可以自然地放在一起。',
  '### 清楚的层级，稳定的阅读节奏',
  '标题紧接内容，正文保持原有字号。**需要强调的部分**通过字重区分，说明、时间和代码各有自己的位置。',
  '- 导航与表单标签使用一致的界面字号。\n- 正文中的 `font-size` 保留独立代码字体。\n- 终端继续使用自己的字体与字号设置。',
  '```javascript\nconst settings = {\n  fontSize: 16,\n  codeFontSize: 13,\n}; // 0O 1Il {} [] =>\n```',
  '这段较长的说明用来核对连续阅读：当内容从标题进入正文，再从正文进入列表和代码时，每一层都应容易分辨，同时保持同一段对话的连贯感。',
].join('\n\n');
const labels = { copy: '复制', copied: '已复制', expand: '展开', collapse: '收起', code: '代码', copyCode: '复制代码' };
const css = `
  .type-preview {max-width:1000px;min-height:100vh;margin:auto;padding:28px 40px 32px;box-sizing:border-box}
  .type-preview>header {display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;font-size:14px;line-height:20px}
  .type-preview main {max-width:760px;margin:auto;min-width:0}
  .type-preview .type-user {width:max-content;max-width:85%;margin:0 0 24px auto;padding:10px 14px;border-radius:12px;background:var(--dsw-alias-bg-module-platform)}
  .type-preview .type-meta {display:flex;gap:14px;margin-top:20px}
  .type-preview .type-composer {margin-top:28px;padding:14px 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px}
  .type-preview [data-composer-input] {outline:none;min-height:28px}
  .type-preview .type-switch {display:flex;gap:4px}
  .type-preview .type-switch button {font:inherit;color:var(--dsw-alias-label-secondary);padding:4px 10px;background:transparent;border:0;border-radius:6px;cursor:pointer}
  .type-preview .type-switch button[aria-pressed=true] {background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
  .type-terminal-probe {display:none;font-family:var(--dsh-font-family-terminal,var(--dsh-font-family-code-default));font-size:var(--dsh-terminal-font-size);line-height:1.2}
  @media(max-width:640px){.type-preview{padding:20px}.type-preview>header{margin-bottom:20px}}
`;
document.body.style.cssText += ';--dsh-content-font-size:16px;--dsh-content-font-delta:2px;--dsh-code-font-size:13px;--dsh-code-font-delta:2px;--dsh-font-family-code:Menlo;--dsh-terminal-font-size:20px';
// The native app owns this canvas; the isolated preview supplies its theme token.
document.body.style.backgroundColor = 'var(--dsw-alias-bg-base)';
window.setTypePolish = mode => {
  window.__polishEffects.splice(0).reverse().forEach(dispose => dispose?.());
  (mode === 'before' ? window.__beforePolish : window.__afterPolish)().apply({ effect(fn) { window.__polishEffects.push(fn()); } });
  document.querySelectorAll('[data-type-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.typeMode === mode)));
};
function App() {
  React.useEffect(() => { window.setTypePolish(new URLSearchParams(location.search).get('polish') || 'after'); }, []);
  return <div className="type-preview"><style>{css}</style><header><span>字体与阅读体验</span><div className="type-switch">
    <button data-type-mode="before" onClick={() => window.setTypePolish('before')}>改前</button><button data-type-mode="after" onClick={() => window.setTypePolish('after')}>改后</button>
  </div></header><main>
    <div data-conversation-content>
      <div className="type-user" data-message-bubble>优化 dsh 的字体。</div>
      <P.MarkdownText text={sample} labels={labels} />
      <div className="type-meta ZITbJG_endInfo"><span className="ZITbJG_timeStart">已完成，用时 2 秒</span><span className="ZITbJG_timeEnd">15:30</span></div>
    </div>
    <div className="type-composer"><div data-composer-input className={inputClass} contentEditable suppressContentEditableWarning role="textbox" aria-label="消息输入框"><p>继续输入消息，或用 / 调用指令</p></div></div>
    <div className="type-terminal-probe">Terminal 20px</div>
  </main></div>;
}
createRoot(document.getElementById('settings-preview')).render(<App />);
