const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9223;

async function slidesToPdf(htmlPath, pdfPath) {
  const fileUrl = 'file://' + path.resolve(htmlPath);

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--no-default-browser-check',
    '--window-size=1920,1080',
    fileUrl
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 3000));

  try {
    const targets = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${PORT}/json/list`, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const target = targets.find(t => t.type === 'page');
    if (!target) throw new Error('No page target found');

    const ws = new (require('ws'))(target.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      let id = 1;
      const send = (m, p) => new Promise(r => {
        const myId = id++;
        const handler = (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.id === myId) { ws.removeListener('message', handler); r(msg.result); }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id: myId, method: m, params: p }));
      });

      ws.on('open', async () => {
        // Chart.js 렌더링 대기
        await new Promise(r => setTimeout(r, 3000));

        // 슬라이드 개수 파악
        const countResult = await send('Runtime.evaluate', {
          expression: 'document.querySelectorAll(".slide").length'
        });
        const total = countResult.result.value;
        console.log(`슬라이드 ${total}장 감지`);

        const pages = [];

        for (let i = 0; i < total; i++) {
          // 현재 슬라이드만 활성화
          await send('Runtime.evaluate', {
            expression: `
              document.querySelectorAll('.slide').forEach((s,j) => {
                s.style.opacity = j === ${i} ? '1' : '0';
                s.style.pointerEvents = j === ${i} ? 'auto' : 'none';
                s.style.transform = 'none';
                s.classList.toggle('active', j === ${i});
              });
              // 네비게이션 숨기기
              document.querySelectorAll('.nav-l,.nav-r,.nav-dots').forEach(e => e.style.display='none');
              // 페이지번호 숨기기 (PDF에서 불필요)
              document.querySelectorAll('.pg').forEach(e => e.style.display='none');
            `
          });

          await new Promise(r => setTimeout(r, 500));

          // 스크린샷 캡처 (PNG)
          const screenshot = await send('Page.captureScreenshot', {
            format: 'png',
            clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 2 }
          });

          pages.push(screenshot.data);
          process.stdout.write(`  ${i + 1}/${total}\r`);
        }

        console.log(`\n${total}장 캡처 완료, PDF 생성 중...`);

        // 각 슬라이드를 이미지로 포함한 HTML 생성 → PDF 변환
        // 대신 CDP의 Page.printToPDF를 활용: 모든 슬라이드를 block으로 펼침
        await send('Runtime.evaluate', {
          expression: `
            // 슬라이드를 인쇄용 레이아웃으로 변환
            const frame = document.querySelector('.frame');
            frame.style.width = '100%';
            frame.style.height = 'auto';
            frame.style.overflow = 'visible';
            frame.style.position = 'relative';

            document.querySelectorAll('.slide').forEach(s => {
              s.style.position = 'relative';
              s.style.opacity = '1';
              s.style.pointerEvents = 'auto';
              s.style.transform = 'none';
              s.style.width = '100%';
              s.style.height = '100vh';
              s.style.pageBreakAfter = 'always';
              s.style.display = 'flex';
            });

            document.querySelectorAll('.nav-l,.nav-r,.nav-dots,.pg').forEach(e => e.style.display='none');
            document.body.style.overflow = 'visible';
            document.body.style.height = 'auto';
            document.documentElement.style.overflow = 'visible';
            document.documentElement.style.height = 'auto';
          `
        });

        await new Promise(r => setTimeout(r, 1000));

        const result = await send('Page.printToPDF', {
          displayHeaderFooter: false,
          printBackground: true,
          preferCSSPageSize: false,
          landscape: true,
          paperWidth: 13.33,
          paperHeight: 7.5,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        });

        const buffer = Buffer.from(result.data, 'base64');
        fs.writeFileSync(pdfPath, buffer);
        console.log(`${path.basename(pdfPath)} ✓ (${(buffer.length / 1024 / 1024).toFixed(1)}MB, ${total}페이지)`);

        ws.close();
        resolve();
      });

      ws.on('error', reject);
    });
  } finally {
    chrome.kill();
    await new Promise(r => setTimeout(r, 500));
  }
}

const htmlFile = process.argv[2];
if (!htmlFile) {
  console.log('Usage: node html2pdf_slides.js slides.html');
  process.exit(1);
}
const pdfFile = htmlFile.replace(/\.html$/, '.pdf');
slidesToPdf(htmlFile, pdfFile).catch(e => console.error(e.message));
