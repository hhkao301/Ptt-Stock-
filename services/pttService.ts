import { PttPost, PttComment } from '../types';

const PROXIES = [
  {
    name: 'CorsProxy',
    fetch: async (url: string) => {
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      return await res.text();
    }
  },
  {
    name: 'AllOrigins',
    fetch: async (url: string) => {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}&disableCache=true`);
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const data = await res.json();
      return data.contents; 
    }
  },
  {
    name: 'CodeTabs',
    fetch: async (url: string) => {
      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      return await res.text();
    }
  }
];

// Parser for Raw Text (Copy-pasted from Gmail or Terminals)
const parsePttText = (text: string): PttPost => {
  // 1. Clean up the text (Normalize newlines)
  let cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // 2. STRIP ANSI CODES (Critical for Gmail/Term copy-paste)
  // Logic: Match ESC[...m or literal [...m
  // \x1B is Escape char. \[ is literal bracket.
  // (?:\d+(?:;\d+)*)? matches "1;33" or "1" or empty string (for [m)
  cleanText = cleanText.replace(/(\x1B\[|\[)(?:\d+(?:;\d+)*)?m/g, '');
  
  // Also strip standalone Escape characters if any remain
  cleanText = cleanText.replace(/\x1B/g, '');

  // 3. Extract Meta
  let title = '無標題';
  let author = '未知';
  let date = '未知';

  // Match standard PTT text headers
  // We use a slightly specific regex to avoid matching Gmail headers (e.g. "收件者:")
  // PTT headers usually appear in a block.
  const titleMatch = cleanText.match(/^標題[:\s]+(.+)/m);
  if (titleMatch) title = titleMatch[1].trim();

  const authorMatch = cleanText.match(/^作者[:\s]+([^\s]+)/m);
  if (authorMatch) author = authorMatch[1].trim();

  const dateMatch = cleanText.match(/^時間[:\s]+(.+)/m);
  if (dateMatch) date = dateMatch[1].trim();

  // 4. Extract Content
  let mainContent = cleanText;
  
  // Try to find where headers end (Date line is usually the last header)
  const headerEndMatch = cleanText.match(/^時間[:\s]+.+\n/m);
  const contentEndMatch = cleanText.match(/※ 發信站/);

  if (headerEndMatch) {
    const startIndex = headerEndMatch.index! + headerEndMatch[0].length;
    const endIndex = contentEndMatch ? contentEndMatch.index! : cleanText.length;
    
    if (endIndex > startIndex) {
        mainContent = cleanText.substring(startIndex, endIndex).trim();
    }
  } else {
    // Fallback: If no headers found, maybe user pasted just the body + comments
    // Try to cut off at "※ 發信站"
    if (contentEndMatch) {
        mainContent = cleanText.substring(0, contentEndMatch.index).trim();
    }
  }

  // Remove footer junk and Gmail quoted text indicators if present
  mainContent = mainContent
    .replace(/───────────────────────────────────────/g, '')
    .replace(/^> /gm, '') // Remove email quote markers
    .trim();

  // 5. Extract Comments
  const comments: PttComment[] = [];
  
  // Regex explanation:
  // (推|噓|→)  -> Type
  // \s+         -> Spaces
  // ([a-zA-Z0-9_]+) -> UserID
  // \s*         -> Optional spaces
  // :?          -> Optional colon (sometimes stripped or malformed in paste)
  // \s*         -> Spaces
  // (.+?)       -> Content (non-greedy)
  // \s*         -> Arbitrary spaces (padding) before time
  // (\d{2}\/\d{2}\s\d{2}:\d{2})? -> Time (Optional)
  // We relaxed the colon requirement and spacing to handle stripped ANSI artifacts.
  const commentRegex = /(推|噓|→)\s+([a-zA-Z0-9_]+)\s*:?\s*(.+?)\s*(\d{2}\/\d{2}\s\d{2}:\d{2})?$/gm;
  
  let match;
  let index = 0;
  let pushCount = 0;
  let booCount = 0;
  let arrowCount = 0;

  while ((match = commentRegex.exec(cleanText)) !== null) {
    const typeChar = match[1];
    const user = match[2];
    const content = match[3].trim();
    const time = match[4] || '';

    // Filter: Content shouldn't be absurdly long (false positive check)
    if (content.length > 150) continue; 
    // Filter: Skip "Footer" links that might look like comments if regex is loose
    if (content.includes("文章網址:")) continue;
    // Filter: Skip empty content
    if (!content) continue;

    let type: '推' | '噓' | '→' = '→';
    if (typeChar === '推') {
      type = '推';
      pushCount++;
    } else if (typeChar === '噓') {
      type = '噓';
      booCount++;
    } else {
      type = '→';
      arrowCount++;
    }

    comments.push({
      id: `c-txt-${index++}`,
      type,
      user,
      content,
      time
    });
  }

  // Fallback: If Main Regex failed or returned very few comments compared to line count, 
  // try strict line split method which is sometimes safer for pasted text.
  if (comments.length === 0) {
      const lines = cleanText.split('\n');
      lines.forEach(line => {
          // Simple line regex
          const lineMatch = line.match(/^\s*(推|噓|→)\s+([a-zA-Z0-9_]+)\s*:?\s*(.+)/);
          if (lineMatch) {
              if(lineMatch[3].includes("文章網址:")) return;

              const typeChar = lineMatch[1];
              let type: '推' | '噓' | '→' = '→';
              if (typeChar === '推') { type = '推'; pushCount++; }
              else if (typeChar === '噓') { type = '噓'; booCount++; }
              else { arrowCount++; }

              // Try to extract time from end of content if possible
              let content = lineMatch[3].trim();
              let time = '';
              const timeMatch = content.match(/(\d{2}\/\d{2}\s\d{2}:\d{2})$/);
              if (timeMatch) {
                  time = timeMatch[1];
                  content = content.substring(0, content.length - time.length).trim();
              }

              comments.push({
                  id: `c-txt-fb-${index++}`,
                  type,
                  user: lineMatch[2],
                  content,
                  time
              });
          }
      });
  }

  return {
    title,
    author,
    date,
    url: 'Text Import / Gmail',
    mainContent: mainContent.substring(0, 2000), 
    comments,
    stats: {
      push: pushCount,
      boo: booCount,
      arrow: arrowCount,
      total: comments.length
    }
  };
};

// DOM Parser (for fetched HTML)
const parsePttHtml = (html: string, url: string): PttPost => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (doc.title.includes('404') || doc.body.textContent?.includes('404 Not Found')) {
    throw new Error('文章不存在 (404 Not Found)，請確認網址是否正確。');
  }
  if (doc.querySelector('.over18-notice') || doc.querySelector('input[name="yes"]')) {
    throw new Error('此文章位於限制級看板 (Over 18)，請直接將網頁內容複製貼上到輸入框即可解析。');
  }
    
  const mainContentEl = doc.getElementById('main-content');
  if (!mainContentEl) {
    // Try text parsing fallback if HTML structure is broken but text exists
    if (doc.body.textContent && (doc.body.textContent.includes('作者') || doc.body.textContent.includes('推'))) {
        return parsePttText(doc.body.textContent);
    }
    throw new Error('無法解析 PTT 文章結構。');
  }

  // Meta
  const metas = Array.from(doc.querySelectorAll('.article-metaline'));
  let author = '未知';
  let title = '無標題';
  let date = '未知';

  metas.forEach(meta => {
    const tag = meta.querySelector('.article-meta-tag')?.textContent;
    const val = meta.querySelector('.article-meta-value')?.textContent;
    if (tag === '作者') author = val || author;
    if (tag === '標題') title = val || title;
    if (tag === '時間') date = val || date;
  });

  // Comments
  const comments: PttComment[] = [];
  const pushElements = doc.querySelectorAll('.push');
  let pushCount = 0, booCount = 0, arrowCount = 0;

  pushElements.forEach((el, index) => {
    const tag = el.querySelector('.push-tag')?.textContent?.trim();
    const user = el.querySelector('.push-userid')?.textContent?.trim() || '';
    const content = el.querySelector('.push-content')?.textContent?.replace(/^:/, '').trim() || '';
    const time = el.querySelector('.push-ipdatetime')?.textContent?.trim() || '';

    let type: '推' | '噓' | '→' = '→';
    if (tag === '推') { type = '推'; pushCount++; }
    else if (tag === '噓') { type = '噓'; booCount++; }
    else { type = '→'; arrowCount++; }

    comments.push({ id: `c-${index}`, type, user, content, time });
  });

  // Clean content
  const clonedMain = mainContentEl.cloneNode(true) as HTMLElement;
  clonedMain.querySelectorAll('.article-metaline, .article-metaline-right, .push').forEach(e => e.remove());
  
  return {
    title,
    author,
    date,
    url,
    mainContent: clonedMain.textContent?.trim() || '',
    comments,
    stats: { push: pushCount, boo: booCount, arrow: arrowCount, total: comments.length }
  };
};

export const fetchAndParsePtt = async (input: string): Promise<PttPost> => {
  const trimmedInput = input.trim();

  // 1. Identify if input is a Target URL to fetch or Raw Text to parse
  const pttUrlMatch = trimmedInput.match(/ptt\.cc\/bbs\/[\w-]+\/M\.\d+\.A\.\w+\.html/);
  const hasNewlines = trimmedInput.includes('\n');
  // It is a URL ONLY if it looks like a URL, has no newlines, and is short.
  const isFetchableUrl = pttUrlMatch && !hasNewlines && trimmedInput.length < 250;

  if (isFetchableUrl) {
      // Attempt to fetch via proxy
      const targetUrl = trimmedInput.startsWith('http') ? trimmedInput : `https://${pttUrlMatch[0]}`;

      let html = '';
      let lastError;

      for (const proxy of PROXIES) {
        try {
          const result = await proxy.fetch(targetUrl);
          if (result && (result.includes('main-content') || result.includes('over18-notice') || result.includes('404'))) {
            html = result;
            break; 
          }
        } catch (e) {
          console.warn(`Proxy ${proxy.name} failed:`, e);
          lastError = e;
        }
      }

      if (!html) {
        throw new Error('無法連接至 PTT (代理伺服器無回應)。請檢查網址，或建議：直接複製網頁/Email內容貼上到輸入框即可。');
      }
      return parsePttHtml(html, targetUrl);

  } else {
      // 2. Treat as Raw Text (Paste)
      
      // If it's a Gmail URL but very short (user just pasted the gmail link), warn them.
      // But if the length is long, user likely pasted the content CONTAINING the link, so we proceed.
      if (trimmedInput.includes('mail.google.com') && trimmedInput.length < 200 && !hasNewlines) {
         throw new Error('無法直接讀取 Gmail 網址。請在郵件頁面按下 Ctrl+A (全選) -> Ctrl+C (複製)，然後直接貼上到下方的輸入框。');
      }

      if (trimmedInput.length < 10) {
          throw new Error('輸入內容過短，請輸入 PTT 網址或貼上文章完整內容。');
      }
      return parsePttText(trimmedInput);
  }
};

export const exportToCsv = (post: PttPost) => {
  const bom = '\uFEFF';
  const header = '類型,使用者,內容,時間\n';
  const rows = post.comments.map(c => `${c.type},${c.user},"${c.content.replace(/"/g, '""')}",${c.time}`).join('\n');
  
  const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `ptt_stock_${(post.date || 'export').replace(/[:\s\/]/g, '_')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};