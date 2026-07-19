const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9555;
const HTML_FILE = path.join(__dirname, '2026.1H.MCN614.기말고사_이성훈_2025481004.html');
const OUT_PPTX = path.join(__dirname, '2026.1H.MCN614.기말고사_이성훈_2025481004.pptx');

function cdpConnect(wsUrl) {
  const ws = new (require('ws'))(wsUrl);
  let id = 1;
  const send = (m, p) => new Promise(r => {
    const myId = id++;
    const handler = raw => { const msg = JSON.parse(raw.toString()); if (msg.id === myId) { ws.removeListener('message', handler); r(msg.result); } };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: myId, method: m, params: p }));
  });
  return new Promise(r => ws.on('open', () => r({ send, ws })));
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=/tmp/chrome_exam_ppt',
    'file://' + HTML_FILE
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 3000));

  try {
    const targets = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${PORT}/json/list`, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
    const target = targets.find(t => t.type === 'page');
    const { send, ws } = await cdpConnect(target.webSocketDebuggerUrl);

    // 780px 너비로 렌더링 (HTML content max-width)
    await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1200, deviceScaleFactor: 2, mobile: false });
    await new Promise(r => setTimeout(r, 4000)); // D3 + Chart.js 렌더링 대기

    // 전체 페이지 높이 구하기
    const { result: { value: pageHeight } } = await send('Runtime.evaluate', {
      expression: 'document.body.scrollHeight'
    });
    console.log('Page height:', pageHeight);

    // 슬라이드당 캡처 높이 (A4 비율 기준: 820 x 1060 정도)
    const captureW = 820;
    const slideH = 1060;
    const numSlides = Math.ceil(pageHeight / slideH);
    console.log('Slides:', numSlides);

    const images = [];
    for (let i = 0; i < numSlides; i++) {
      const y = i * slideH;
      const h = Math.min(slideH, pageHeight - y);
      const result = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y, width: captureW, height: h, scale: 2 }
      });
      const imgPath = path.join(__dirname, `_slide${i}.png`);
      fs.writeFileSync(imgPath, Buffer.from(result.data, 'base64'));
      images.push({ path: imgPath, h });
      console.log(`  Slide ${i + 1}: y=${y} h=${h}`);
    }

    ws.close();

    // PPT 생성
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
    pptx.author = '이성훈';
    pptx.title = '기말고사 — SNA 네트워크 분석';

    for (let i = 0; i < images.length; i++) {
      const s = pptx.addSlide();
      s.background = { color: 'FFFFFF' };
      const b64 = fs.readFileSync(images[i].path, 'base64');
      const imgRatio = captureW / images[i].h;
      // 슬라이드에 꽉 채우되 비율 유지
      const sW = 13.33;
      const sH = sW / imgRatio;
      const fitH = Math.min(sH, 7.5);
      const fitW = fitH * imgRatio;
      const x = (13.33 - fitW) / 2;
      const y = (7.5 - fitH) / 2;
      s.addImage({ data: 'image/png;base64,' + b64, x, y, w: fitW, h: fitH });
    }

    await pptx.writeFile({ fileName: OUT_PPTX });
    console.log('PPTX saved:', OUT_PPTX);

    // Cleanup
    images.forEach(img => { try { fs.unlinkSync(img.path); } catch {} });

  } finally {
    chrome.kill();
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
