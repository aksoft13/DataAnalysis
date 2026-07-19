const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9444;
const SNA_DATA = require('./sna_data.json');

// ── CDP helpers ──
function cdpConnect(wsUrl) {
  const ws = new (require('ws'))(wsUrl);
  let id = 1;
  const send = (m, p) => new Promise((resolve) => {
    const myId = id++;
    const handler = raw => {
      const msg = JSON.parse(raw.toString());
      if (msg.id === myId) { ws.removeListener('message', handler); resolve(msg.result); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: myId, method: m, params: p }));
  });
  return new Promise(r => ws.on('open', () => r({ send, ws })));
}

async function captureRegion(send, x, y, w, h, scale = 2) {
  const result = await send('Page.captureScreenshot', {
    format: 'png', clip: { x, y, width: w, height: h, scale }
  });
  return Buffer.from(result.data, 'base64');
}

async function main() {
  // 1. Prepare HTML
  let html = fs.readFileSync(path.join(__dirname, 'exam_sna.html'), 'utf-8');
  html = html.replace('SNADATAPLACHOLDER', JSON.stringify(SNA_DATA));
  const tmpHtml = path.join(__dirname, '_exam_tmp.html');
  fs.writeFileSync(tmpHtml, html);

  // 2. Launch Chrome
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=2400,1000',
    '--user-data-dir=/tmp/chrome_exam',
    'file://' + tmpHtml
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2500));

  try {
    const targets = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${PORT}/json/list`, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
    const target = targets.find(t => t.type === 'page');
    if (!target) throw new Error('No page target');

    const { send, ws } = await cdpConnect(target.webSocketDebuggerUrl);
    await send('Emulation.setDeviceMetricsOverride', { width: 2400, height: 1000, deviceScaleFactor: 2, mobile: false });

    console.log('Waiting for D3 simulation...');
    await new Promise(r => setTimeout(r, 5000));

    // Set viewport taller to include all sections
    await send('Emulation.setDeviceMetricsOverride', { width: 2400, height: 1500, deviceScaleFactor: 2, mobile: false });
    await new Promise(r => setTimeout(r, 1000));

    console.log('Capturing screenshots...');
    const netImg = await captureRegion(send, 0, 0, 2400, 600);
    fs.writeFileSync(path.join(__dirname, '_net.png'), netImg);
    const c4Img = await captureRegion(send, 0, 604, 1198, 500);
    fs.writeFileSync(path.join(__dirname, '_c4.png'), c4Img);
    const c5Img = await captureRegion(send, 1202, 604, 1198, 500);
    fs.writeFileSync(path.join(__dirname, '_c5.png'), c5Img);

    ws.close();
    console.log('Screenshots captured.');
    buildPptx();
  } finally {
    chrome.kill();
    await new Promise(r => setTimeout(r, 500));
    try { fs.unlinkSync(tmpHtml); } catch {}
  }
}

function buildPptx() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = '이성훈';
  pptx.title = '기말고사 - 코스피 돌파시점 SNA 네트워크 분석';

  const F = 'Apple SD Gothic Neo';
  const P = '4F46E5';  // primary
  const T = '1E293B';  // text
  const S = '64748B';  // sub
  const B = 'CBD5E1';  // border
  const BL = 'F8FAFC'; // bg light
  const CC = ['4F46E5','0EA5E9','10B981','F59E0B','EF4444','8B5CF6','EC4899'];

  // 레이아웃 상수
  const M = 0.35;            // 좌우상하 여백
  const CW = 13.33 - M * 2; // 12.63
  const GAP = 0.15;

  const s1 = pptx.addSlide();
  s1.background = { color: 'FFFFFF' };
  s1.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.05, fill: { color: P } });

  // ── 헤더 (0.12 ~ 0.65) ──
  s1.addText('SNA 네트워크 분석', {
    x: M, y: 0.12, w: 5.5, h: 0.35, fontSize: 18, bold: true, color: T, fontFace: F
  });
  s1.addText('코스피 돌파시점별 키워드 동시출현 네트워크 구조 비교', {
    x: M, y: 0.43, w: 8, h: 0.2, fontSize: 9, color: S, fontFace: F
  });
  // 기본 정보
  s1.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 8.3, y: 0.1, w: 4.68, h: 0.55, fill: { color: BL }, line: { color: B, width: 0.5 }, rectRadius: 0.06
  });
  s1.addText([
    { text: '광고PR ', options: { bold: true, fontSize: 8, color: T } },
    { text: '| 2025481004 | 이성훈\n', options: { fontSize: 8, color: S } },
    { text: '키워드: ', options: { bold: true, fontSize: 8, color: T } },
    { text: '코스피, 돌파, 대중반응, SNA   ', options: { fontSize: 8, color: S } },
    { text: '채널: ', options: { bold: true, fontSize: 8, color: T } },
    { text: '뉴스+YouTube | 돌파일±3일', options: { fontSize: 8, color: S } },
  ], { x: 8.42, y: 0.12, w: 4.45, h: 0.5, fontFace: F, lineSpacingMultiple: 1.15 });

  // ── SNA 지표 표 + 해석 (0.7 ~ 1.72) ──
  const tblY = 0.72;
  const tblRows = [
    [
      { text: '지표', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: { color: P } } },
      { text: 'A (5000)', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: { color: P } } },
      { text: 'B (6000)', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: { color: P } } },
      { text: 'C (7000)', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: { color: P } } },
      { text: 'D (8000)', options: { bold: true, fontSize: 8, color: 'FFFFFF', fill: { color: P } } },
    ],
    [{ text: '노드', options: { bold: true, fontSize: 8 } }, ...['40','40','40','40'].map(v=>({ text: v, options: { fontSize: 8 } }))],
    [{ text: '엣지', options: { bold: true, fontSize: 8 } }, ...['567','541','489','545'].map(v=>({ text: v, options: { fontSize: 8 } }))],
    [{ text: '밀도', options: { bold: true, fontSize: 8 } },
      { text: '0.727', options: { fontSize: 8 } }, { text: '0.694', options: { fontSize: 8 } },
      { text: '0.627', options: { fontSize: 8, color: 'EF4444', bold: true } }, { text: '0.699', options: { fontSize: 8 } }],
    [{ text: '커뮤니티', options: { bold: true, fontSize: 8 } }, ...['5','6','7','7'].map(v=>({ text: v, options: { fontSize: 8 } }))],
  ];
  s1.addTable(tblRows, {
    x: M, y: tblY, w: 5.0,
    border: { type: 'solid', pt: 0.5, color: B },
    align: 'center', valign: 'middle', fontFace: F,
    colW: [1.0, 1.0, 1.0, 1.0, 1.0],
    rowH: [0.22, 0.19, 0.19, 0.19, 0.19],
  });

  // 해석 박스
  const boxX = M + 5.0 + GAP;
  const boxW = CW - 5.0 - GAP;
  s1.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: boxX, y: tblY, w: boxW, h: 0.98, fill: { color: 'EEF2FF' }, rectRadius: 0.06
  });
  s1.addText([
    { text: '네트워크 구조 변화\n', options: { bold: true, fontSize: 9, color: P } },
    { text: '5000(0.727): ', options: { bold: true, fontSize: 8, color: T } },
    { text: '"코스피 돌파" 단일 이슈 수렴 → 고밀도\n', options: { fontSize: 8, color: T } },
    { text: '7000(0.627): ', options: { bold: true, fontSize: 8, color: 'EF4444' } },
    { text: '연임·공매도·반도체 다변화 → 밀도 최저\n', options: { fontSize: 8, color: T } },
    { text: '8000(0.699): ', options: { bold: true, fontSize: 8, color: T } },
    { text: '"급락·폭락" 새 수렴점 → 재상승', options: { fontSize: 8, color: T } },
  ], { x: boxX + 0.12, y: tblY + 0.03, w: boxW - 0.24, h: 0.92, fontFace: F, lineSpacingMultiple: 1.3 });

  // ── 4개 네트워크 그래프 (1.78 ~ 4.78) ── 비율 2400:600 = 4:1
  const netY = 1.78;
  const netW = CW;        // 12.63
  const netH = netW / 4;  // 3.16 (비율 정확)
  const netB64 = fs.readFileSync(path.join(__dirname, '_net.png'), 'base64');
  s1.addImage({ data: 'image/png;base64,' + netB64, x: M, y: netY, w: netW, h: netH });

  // ── 그림 4 + 그림 5 (4.98 ~ 7.15) ── 비율 1198:500 = 2.396:1
  const chartY = netY + netH + 0.06;
  const chartH = 7.5 - M - chartY;  // 남은 높이까지
  const chartRatio = 1198 / 500;
  const chartW = Math.min((CW - GAP) / 2, chartH * chartRatio);  // 비율 유지
  const chartH_fit = chartW / chartRatio;
  const chartX1 = M;
  const chartX2 = M + chartW + GAP;

  const c4B64 = fs.readFileSync(path.join(__dirname, '_c4.png'), 'base64');
  const c5B64 = fs.readFileSync(path.join(__dirname, '_c5.png'), 'base64');
  s1.addImage({ data: 'image/png;base64,' + c4B64, x: chartX1, y: chartY, w: chartW, h: chartH_fit });
  s1.addImage({ data: 'image/png;base64,' + c5B64, x: chartX2, y: chartY, w: chartW, h: chartH_fit });


  // Save
  const outPath = path.join(__dirname, '2026.1H.MCN614.기말고사_이성훈_2025481004.pptx');
  pptx.writeFile({ fileName: outPath }).then(() => {
    console.log('PPTX saved: ' + outPath);
    try { fs.unlinkSync(path.join(__dirname, '_net.png')); } catch {}
    try { fs.unlinkSync(path.join(__dirname, '_c4.png')); } catch {}
    try { fs.unlinkSync(path.join(__dirname, '_c5.png')); } catch {}
  });
}

main().catch(e => { console.error(e); process.exit(1); });
