require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3007;
const BASE_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const IS_WIN = process.platform === 'win32';
const PY_CMDS = IS_WIN ? ['python', 'python3', 'py'] : ['python3', 'python'];

// config.json 로드
const CONFIG_PATH = path.join(BASE_DIR, 'config.json');
try {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (cfg.youtubeApiKey) process.env.YOUTUBE_API_KEY = cfg.youtubeApiKey;
} catch { /* 파일 없으면 무시 */ }

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(BASE_DIR, 'public')));

/* ═══ 서버 상태 ═══ */
app.get('/api/status', (req, res) => res.json({ running: true, port: PORT }));

/* ═══ API 키 저장 ═══ */
app.post('/api/config/save', (req, res) => {
  const { youtubeApiKey, openaiApiKey, geminiApiKey } = req.body;
  try {
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch {}
    if (youtubeApiKey !== undefined) { cfg.youtubeApiKey = youtubeApiKey; process.env.YOUTUBE_API_KEY = youtubeApiKey; }
    if (openaiApiKey !== undefined) { cfg.openaiApiKey = openaiApiKey; process.env.OPENAI_API_KEY = openaiApiKey; }
    if (geminiApiKey !== undefined) { cfg.geminiApiKey = geminiApiKey; process.env.GEMINI_API_KEY = geminiApiKey; }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/config/load', (req, res) => {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    res.json({
      youtubeApiKey: cfg.youtubeApiKey || process.env.YOUTUBE_API_KEY || '',
      openaiApiKey: cfg.openaiApiKey ? '****' : '',
      geminiApiKey: cfg.geminiApiKey ? '****' : '',
      hasYoutube: !!(cfg.youtubeApiKey || process.env.YOUTUBE_API_KEY),
      hasOpenai: !!(cfg.openaiApiKey || process.env.OPENAI_API_KEY),
      hasGemini: !!(cfg.geminiApiKey || process.env.GEMINI_API_KEY),
    });
  } catch {
    res.json({
      youtubeApiKey: '',
      hasYoutube: !!process.env.YOUTUBE_API_KEY,
      hasOpenai: !!process.env.OPENAI_API_KEY,
      hasGemini: !!process.env.GEMINI_API_KEY,
    });
  }
});

/* ═══ 구글 뉴스 RSS 파서 ═══ */
function parseGNewsRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const raw = match[1];
    const getTag = (tag) => {
      const m = raw.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
             || raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
    };
    const title = getTag('title');
    const linkMatch = raw.match(/<link>([^<]+)<\/link>/);
    const link = linkMatch ? linkMatch[1].trim() : '';
    const pubDate = getTag('pubDate');
    const description = getTag('description') || title;
    const srcMatch = raw.match(/<source[^>]*>([^<]*)<\/source>/);
    const sourceName = srcMatch ? srcMatch[1].trim() : '구글뉴스';
    if (title) items.push({ title, link, description, pubDate, originallink: link, bloggername: sourceName });
  }
  return items;
}

/* ═══ 구글 뉴스 RSS ═══ */

app.get('/api/search', async (req, res) => {
  const { type = 'news', query, display = 20, sort = 'date', dateFrom, dateTo } = req.query;
  if (!query) return res.status(400).json({ error: '검색어를 입력해주세요.' });

  // 구글 뉴스 RSS
  if (type === 'gnews') {
    const requested = Math.min(Math.max(parseInt(display) || 20, 1), 1000);
    const rssHeaders = { 'User-Agent': 'Mozilla/5.0 (compatible; DataAnalysis/1.0)' };
    if (dateFrom && dateTo && requested > 100) {
      try {
        const from = new Date(dateFrom), to = new Date(dateTo);
        const totalDays = Math.max(1, Math.ceil((to - from) / 86400000));
        const chunkDays = Math.max(2, Math.ceil(totalDays / Math.min(50, Math.ceil(requested / 10))));
        let allItems = [];
        const seen = new Set();
        for (let d = new Date(from); d <= to && allItems.length < requested; d.setDate(d.getDate() + chunkDays)) {
          const cf = d.toISOString().slice(0, 10);
          const ct = new Date(Math.min(d.getTime() + chunkDays * 86400000, to.getTime())).toISOString().slice(0, 10);
          const q = `${query} after:${cf.replace(/-/g, '/')} before:${ct.replace(/-/g, '/')}`;
          try {
            const resp = await axios.get('https://news.google.com/rss/search', { params: { q, hl: 'ko', gl: 'KR', ceid: 'KR:ko' }, headers: rssHeaders, timeout: 12000 });
            for (const item of parseGNewsRSS(resp.data)) {
              const key = item.title + item.link;
              if (!seen.has(key)) { seen.add(key); allItems.push(item); }
            }
          } catch {}
        }
        return res.json({ items: allItems.slice(0, requested), total: allItems.length, type: 'gnews' });
      } catch (e) { return res.status(500).json({ error: e.message }); }
    }
    let q = query;
    if (dateFrom) q += ` after:${dateFrom.replace(/-/g, '/')}`;
    if (dateTo) q += ` before:${dateTo.replace(/-/g, '/')}`;
    try {
      const resp = await axios.get('https://news.google.com/rss/search', { params: { q, hl: 'ko', gl: 'KR', ceid: 'KR:ko' }, headers: rssHeaders, timeout: 12000 });
      const items = parseGNewsRSS(resp.data);
      return res.json({ items: items.slice(0, requested), total: items.length, type: 'gnews' });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  res.status(400).json({ error: '유효하지 않은 검색 유형입니다.' });
});

/* ═══ 유튜브 검색 ═══ */
app.get('/api/youtube/search', async (req, res) => {
  const { query, maxResults = 10, publishedAfter, publishedBefore, order = 'relevance' } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(401).json({ error: 'YouTube API 키를 설정해주세요.' });
  if (!query) return res.status(400).json({ error: '검색어를 입력해주세요.' });

  try {
    const params = {
      part: 'snippet', q: query, type: 'video', order,
      maxResults: Math.min(parseInt(maxResults) || 10, 50),
      key: apiKey, regionCode: 'KR', relevanceLanguage: 'ko',
    };
    if (publishedAfter) params.publishedAfter = publishedAfter;
    if (publishedBefore) params.publishedBefore = publishedBefore;

    const resp = await axios.get('https://www.googleapis.com/youtube/v3/search', { params, timeout: 10000 });
    const videoIds = (resp.data.items || []).map(i => i.id.videoId).filter(Boolean);

    if (!videoIds.length) return res.json({ items: [], total: 0 });

    // 영상 상세 정보
    const detailResp = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'snippet,statistics,contentDetails', id: videoIds.join(','), key: apiKey },
      timeout: 10000,
    });

    const items = (detailResp.data.items || []).map(item => ({
      videoId: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      viewCount: parseInt(item.statistics?.viewCount || 0),
      likeCount: parseInt(item.statistics?.likeCount || 0),
      commentCount: parseInt(item.statistics?.commentCount || 0),
      duration: item.contentDetails?.duration || '',
      thumbnail: item.snippet.thumbnails?.medium?.url || '',
    }));

    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

/* ═══ 유튜브 댓글 수집 ═══ */
app.get('/api/youtube/comments', async (req, res) => {
  const { videoId, maxResults = 100 } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return res.status(401).json({ error: 'YouTube API 키를 설정해주세요.' });
  if (!videoId) return res.status(400).json({ error: 'videoId를 입력해주세요.' });

  const max = Math.min(parseInt(maxResults) || 100, 500);
  let comments = [], nextPageToken = null;

  try {
    while (comments.length < max) {
      const params = {
        part: 'snippet', videoId, maxResults: Math.min(100, max - comments.length),
        textFormat: 'plainText', order: 'relevance', key: apiKey,
      };
      if (nextPageToken) params.pageToken = nextPageToken;
      const resp = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', { params, timeout: 10000 });
      for (const thread of (resp.data.items || [])) {
        const s = thread.snippet.topLevelComment.snippet;
        comments.push({
          commentId: thread.snippet.topLevelComment.id,
          videoId,
          author: s.authorDisplayName,
          text: s.textDisplay,
          likeCount: s.likeCount || 0,
          publishedAt: s.publishedAt,
        });
      }
      nextPageToken = resp.data.nextPageToken;
      if (!nextPageToken) break;
    }
    res.json({ comments, total: comments.length });
  } catch (e) {
    // 댓글 비활성화 등
    if (e.response?.status === 403) return res.json({ comments: [], total: 0, disabled: true });
    res.status(500).json({ error: e.message });
  }
});

/* ═══ Python 탐색 ═══ */
function findPythonCmd(cb) {
  const cmds = [...PY_CMDS];
  const tryNext = () => {
    if (!cmds.length) return cb(null);
    const cmd = cmds.shift();
    exec(`${cmd} --version`, err => err ? tryNext() : cb(cmd));
  };
  tryNext();
}

/* ═══ 형태소 분석 ═══ */
app.post('/api/analyze', (req, res) => {
  const { texts, stopwords = [], minLen = 2 } = req.body;
  if (!texts || !texts.length) return res.status(400).json({ error: '분석할 텍스트가 없습니다.' });

  findPythonCmd(pyCmd => {
    if (!pyCmd) return res.status(500).json({ error: 'Python이 설치되어 있는지 확인해주세요.' });
    const input = JSON.stringify({ texts, stopwords, minLen });
    const py = spawn(pyCmd, [path.join(BASE_DIR, 'analyze.py')], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    });
    let out = '', err = '';
    py.stdout.on('data', d => out += d.toString());
    py.stderr.on('data', d => err += d.toString());
    py.on('close', code => {
      if (code !== 0) return res.status(500).json({ error: '형태소 분석 실패', detail: err });
      try { res.json(JSON.parse(out)); }
      catch { res.status(500).json({ error: '결과 파싱 오류', detail: out }); }
    });
    py.stdin.write(input);
    py.stdin.end();
  });
});

/* ═══ 설치 확인 ═══ */
app.get('/api/setup/check', (req, res) => {
  findPythonCmd(pyCmd => {
    if (!pyCmd) return res.json({ python: false, pythonVersion: '', kiwipiepy: false });
    exec(`${pyCmd} --version`, (_, stdout1) => {
      const pythonVersion = stdout1?.trim() || '';
      exec(`${pyCmd} -c "import kiwipiepy; print('ok')"`, (err2, stdout2) => {
        res.json({ python: true, pythonVersion, kiwipiepy: !err2 && stdout2?.trim() === 'ok' });
      });
    });
  });
});

/* ═══ Node.js 버전 확인 ═══ */
app.get('/api/setup/node', (req, res) => {
  res.json({ version: process.version, platform: process.platform, arch: process.arch });
});

/* ═══ kiwipiepy 자동 설치 (SSE) ═══ */
app.get('/api/setup/install', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (type, msg) => res.write(`data: ${JSON.stringify({ type, msg })}\n\n`);
  send('log', 'kiwipiepy 설치를 시작합니다...');

  const pipCmds = IS_WIN
    ? [['pip', ['install','kiwipiepy','--quiet']], ['pip3', ['install','kiwipiepy','--quiet']], ['py', ['-m','pip','install','kiwipiepy','--quiet']]]
    : [['pip3', ['install','kiwipiepy','--quiet']], ['pip', ['install','kiwipiepy','--quiet']]];

  const tryNext = (list) => {
    if (!list.length) { send('error', '설치 실패. Python/pip이 설치되어 있는지 확인해주세요.'); return res.end(); }
    const [cmd, args] = list.shift();
    send('log', `${cmd} ${args.join(' ')} 실행 중...`);
    const proc = spawn(cmd, args);
    proc.stdout.on('data', d => { const l = d.toString().trim(); if (l) send('log', l); });
    proc.stderr.on('data', d => { const l = d.toString().trim(); if (l) send('log', l); });
    proc.on('close', code => {
      if (code === 0) { send('done', 'kiwipiepy 설치 완료!'); res.end(); }
      else { send('log', `${cmd} 실패, 다음 방법 시도...`); tryNext(list); }
    });
  };
  tryNext(pipCmds);
});

/* ═══ XLSX 내보내기 ═══ */
app.post('/api/export/xlsx', (req, res) => {
  const { filename, nodes, edges, rawData, matrixRows } = req.body;
  const wb = XLSX.utils.book_new();

  // 원본 데이터 시트
  if (rawData && rawData.length) {
    const ws = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws, 'RawData');
  }

  // 매트릭스 전용 내보내기
  if (matrixRows && matrixRows.length) {
    const ws = XLSX.utils.json_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(wb, ws, 'CoMatrix');
  }

  if (nodes && edges) {
    const words = nodes.map(n => n.id);
    const coMap = {};
    edges.forEach(e => { coMap[`${e.source}\0${e.target}`] = e.weight; coMap[`${e.target}\0${e.source}`] = e.weight; });

    const matrixRows = [['', ...words]];
    words.forEach(rw => matrixRows.push([rw, ...words.map(cw => rw === cw ? 0 : (coMap[`${rw}\0${cw}`] || 0))]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrixRows), 'CoMatrix');

    const edgesData = [['Source', 'Target', 'Weight', 'Type']];
    [...edges].sort((a, b) => b.weight - a.weight).forEach(e => edgesData.push([e.source, e.target, e.weight, 'Undirected']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(edgesData), 'Edges');

    const nodesData = [['Id', 'Label']];
    nodes.forEach(n => nodesData.push([n.id, n.id]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(nodesData), 'Nodes');
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const fname = (filename || 'analysis.xlsx').replace(/[^a-zA-Z0-9가-힣._~-]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

/* ═══ CSV 내보내기 ═══ */
app.post('/api/export/csv', (req, res) => {
  const { filename, rows } = req.body;
  if (!rows || !rows.length) return res.status(400).json({ error: 'no data' });
  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];
  rows.forEach(r => {
    csvLines.push(headers.map(h => {
      let v = String(r[h] || '').replace(/"/g, '""');
      if (v.includes(',') || v.includes('\n') || v.includes('"')) v = `"${v}"`;
      return v;
    }).join(','));
  });
  const fname = (filename || 'data.csv').replace(/[^a-zA-Z0-9가-힣._~-]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + csvLines.join('\n'));
});

/* ═══ CSV ZIP 내보내기 ═══ */
app.post('/api/export/csv-zip', (req, res) => {
  const { files } = req.body;
  if (!files || !files.length) return res.status(400).json({ error: 'no files' });

  function makeCsv(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    rows.forEach(r => {
      lines.push(headers.map(h => {
        let v = String(r[h] || '').replace(/"/g, '""');
        if (v.includes(',') || v.includes('\n') || v.includes('"')) v = `"${v}"`;
        return v;
      }).join(','));
    });
    return '\uFEFF' + lines.join('\n');
  }

  // 간단한 ZIP 생성 (Store 방식, 압축 없이)
  const entries = files.map(f => ({ name: f.filename, data: Buffer.from(makeCsv(f.rows), 'utf8') }));

  const bufs = [];
  const centralDir = [];
  let offset = 0;

  for (const entry of entries) {
    const fnBuf = Buffer.from(entry.name, 'utf8');
    // Local file header
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); // sig
    lh.writeUInt16LE(20, 4); // version
    lh.writeUInt16LE(0x0800, 6); // flags (UTF-8)
    lh.writeUInt16LE(0, 8); // compression (store)
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); // time/date
    // CRC32
    const { crc32 } = (() => {
      let c = 0xFFFFFFFF;
      for (const b of entry.data) { c ^= b; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0); }
      return { crc32: (c ^ 0xFFFFFFFF) >>> 0 };
    })();
    lh.writeUInt32LE(crc32, 14);
    lh.writeUInt32LE(entry.data.length, 18); // compressed
    lh.writeUInt32LE(entry.data.length, 22); // uncompressed
    lh.writeUInt16LE(fnBuf.length, 26);
    lh.writeUInt16LE(0, 28);

    bufs.push(lh, fnBuf, entry.data);
    const localOffset = offset;
    offset += 30 + fnBuf.length + entry.data.length;

    // Central directory entry
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc32, 16);
    cd.writeUInt32LE(entry.data.length, 20);
    cd.writeUInt32LE(entry.data.length, 24);
    cd.writeUInt16LE(fnBuf.length, 28);
    cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(localOffset, 42);
    centralDir.push(cd, fnBuf);
  }

  const cdOffset = offset;
  let cdSize = 0;
  centralDir.forEach(b => { bufs.push(b); cdSize += b.length; offset += b.length; });

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  bufs.push(eocd);

  const zipBuf = Buffer.concat(bufs);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('전체데이터.zip')}`);
  res.setHeader('Content-Type', 'application/zip');
  res.send(zipBuf);
});

/* ═══ 히스토리 저장/로드 ═══ */
const HISTORY_DIR = path.join(BASE_DIR, 'history');
try { fs.mkdirSync(HISTORY_DIR, { recursive: true }); } catch {}

app.get('/api/history/list', (req, res) => {
  try {
    const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort().reverse();
    const list = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8'));
        return { id: f.replace('.json', ''), filename: f, question: data.question || '', groups: (data.groups || []).map(g => g.label), date: data.date || '', order: data.order };
      } catch { return null; }
    }).filter(Boolean);
    res.json(list);
  } catch { res.json([]); }
});

app.post('/api/history/save', (req, res) => {
  const { id, question, groups, collectedData, analysisResults, stopwordsList, date } = req.body;
  const filename = id ? id + '.json' : `${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
  try {
    fs.writeFileSync(path.join(HISTORY_DIR, filename), JSON.stringify({ question, groups, collectedData, analysisResults, stopwordsList, date: date || new Date().toISOString().slice(0, 10) }, null, 0), 'utf8');
    res.json({ success: true, id: filename.replace('.json', '') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/history/load/:id', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, req.params.id + '.json'), 'utf8'));
    res.json(data);
  } catch (e) { res.status(404).json({ error: '히스토리를 찾을 수 없습니다.' }); }
});

app.delete('/api/history/:id', (req, res) => {
  try {
    fs.unlinkSync(path.join(HISTORY_DIR, req.params.id + '.json'));
    res.json({ success: true });
  } catch (e) { res.status(404).json({ error: e.message }); }
});

app.post('/api/history/delete-multiple', (req, res) => {
  const { ids } = req.body;
  let deleted = 0;
  (ids || []).forEach(id => {
    try { fs.unlinkSync(path.join(HISTORY_DIR, id + '.json')); deleted++; } catch {}
  });
  res.json({ success: true, deleted });
});

/* ═══ AI 프롬프트 (선택적 API 호출) ═══ */
app.post('/api/ai/generate', async (req, res) => {
  const { prompt, provider } = req.body;
  if (!prompt) return res.status(400).json({ error: '프롬프트가 없습니다.' });

  // OpenAI
  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(401).json({ error: 'OpenAI API 키를 설정해주세요.' });
    try {
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 2000,
      }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 30000 });
      return res.json({ result: resp.data.choices[0].message.content });
    } catch (e) { return res.status(500).json({ error: e.response?.data?.error?.message || e.message }); }
  }

  // Gemini
  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(401).json({ error: 'Gemini API 키를 설정해주세요.' });
    try {
      const resp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      const text = resp.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.json({ result: text });
    } catch (e) { return res.status(500).json({ error: e.response?.data?.error?.message || e.message }); }
  }

  res.status(400).json({ error: 'provider를 지정해주세요 (openai 또는 gemini)' });
});

/* ═══ 서버 시작 ═══ */
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`myDataAnalysis 서버: ${url}`);
  // 브라우저 열기는 런처 스크립트(start-mac.command / start-windows.bat)가 담당
  if (process.argv.includes('--open')) {
    const openBrowser = () => {
      if (IS_WIN) {
        spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('/usr/bin/open', [url], { detached: true, stdio: 'ignore' }).unref();
      }
    };
    setTimeout(openBrowser, 500);
  }
});
