const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

async function cdpSend(method, params = {}) {
  // Get WebSocket debugger URL
  const res = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/json/version`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const wsUrl = res.webSocketDebuggerUrl;
  const WebSocket = require('ws') || null;
  if (!WebSocket) throw new Error('ws module needed');

  return new Promise((resolve, reject) => {
    const ws = new (require('ws'))(wsUrl);
    let id = 1;
    const send = (m, p) => new Promise(r => {
      const myId = id++;
      ws.on('message', function handler(raw) {
        const msg = JSON.parse(raw);
        if (msg.id === myId) { ws.removeListener('message', handler); r(msg.result); }
      });
      ws.send(JSON.stringify({ id: myId, method: m, params: p }));
    });
    ws.on('open', async () => {
      const result = await send(method, params);
      resolve(result);
      ws.close();
    });
  });
}

async function htmlToPdf(htmlPath, pdfPath) {
  const fileUrl = 'file://' + path.resolve(htmlPath);

  // Launch Chrome with remote debugging
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--no-default-browser-check',
    fileUrl
  ], { stdio: 'ignore' });

  // Wait for Chrome to start
  await new Promise(r => setTimeout(r, 2000));

  try {
    // Get target
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
        // Wait for page load + Chart.js rendering
        await new Promise(r => setTimeout(r, 3000));

        // Print to PDF with page number footer only
        const result = await send('Page.printToPDF', {
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate: '<div style="width:100%;text-align:center;font-size:9px;color:#94a3b8;font-family:sans-serif;padding-bottom:4px"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
          printBackground: true,
          preferCSSPageSize: true,
          marginTop: 0,
          marginBottom: 0.6,
          marginLeft: 0,
          marginRight: 0,
        });

        // Save PDF
        const buffer = Buffer.from(result.data, 'base64');
        fs.writeFileSync(pdfPath, buffer);
        console.log(`${path.basename(pdfPath)} ✓ (${(buffer.length/1024/1024).toFixed(1)}MB)`);

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

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.log('Usage: node html2pdf.js file1.html file2.html ...');
    return;
  }
  for (const f of files) {
    const pdf = f.replace(/\.html$/, '.pdf');
    await htmlToPdf(f, pdf);
  }
}

main().catch(e => console.error(e.message));
