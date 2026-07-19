const { chromium } = require('playwright');

const BASE = 'http://localhost:3007';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let pass = 0, fail = 0;
  const results = [];

  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, status: 'PASS' });
      pass++;
    } catch (e) {
      results.push({ name, status: 'FAIL', error: e.message });
      fail++;
    }
  }

  // 1. 페이지 로드
  await test('페이지 로드', async () => {
    const res = await page.goto(BASE, { timeout: 10000 });
    if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
  });

  // 2. 타이틀 확인
  await test('타이틀 확인', async () => {
    const title = await page.title();
    if (!title.includes('myDataAnalysis')) throw new Error(`title: "${title}"`);
  });

  // 3. API 상태 확인
  await test('API /api/status', async () => {
    const res = await page.evaluate(() => fetch('/api/status').then(r => r.json()));
    if (!res.running) throw new Error('running=false');
  });

  // 4. 스텝 탭 6개 존재
  await test('스텝 탭 6개 존재', async () => {
    const tabs = await page.$$('.step-tab');
    if (tabs.length !== 6) throw new Error(`탭 ${tabs.length}개`);
  });

  // 5. 스텝 패널 6개 존재
  await test('스텝 패널 6개 존재', async () => {
    const panels = await page.$$('.step-panel');
    if (panels.length !== 6) throw new Error(`패널 ${panels.length}개`);
  });

  // 6. 1단계(연구질문) 기본 활성
  await test('1단계 기본 활성', async () => {
    const active = await page.$('.step-panel.active');
    const id = await active.getAttribute('id');
    if (id !== 'step0') throw new Error(`active: ${id}`);
  });

  // 7. 연구 질문 입력
  await test('연구 질문 입력', async () => {
    await page.fill('#researchQuestion', '테스트 연구 질문');
    const val = await page.$eval('#researchQuestion', el => el.value);
    if (val !== '테스트 연구 질문') throw new Error('입력 실패');
  });

  // 8. 2단계 이동
  await test('2단계 이동', async () => {
    await page.click('.step-tab:nth-child(2)');
    await page.waitForTimeout(300);
    const active = await page.$('.step-panel.active');
    const id = await active.getAttribute('id');
    if (id !== 'step1') throw new Error(`active: ${id}`);
  });

  // 9. 그룹 컨테이너 존재
  await test('그룹 컨테이너 존재', async () => {
    const el = await page.$('#groupsContainer');
    if (!el) throw new Error('groupsContainer 없음');
  });

  // 10. 히스토리 API 확인
  await test('히스토리 목록 API', async () => {
    const res = await page.evaluate(() => fetch('/api/history/list').then(r => r.json()));
    if (!Array.isArray(res)) throw new Error('배열 아님');
  });

  // 11. CDN 리소스 로드 (D3)
  await test('D3.js 로드 확인', async () => {
    const d3 = await page.evaluate(() => typeof d3 !== 'undefined');
    if (!d3) throw new Error('D3 미로드');
  });

  // 12. CDN 리소스 로드 (Chart.js)
  await test('Chart.js 로드 확인', async () => {
    const chart = await page.evaluate(() => typeof Chart !== 'undefined');
    if (!chart) throw new Error('Chart.js 미로드');
  });

  // 13. 설정 모달 열기
  await test('설정 모달 열기', async () => {
    const settingsBtn = await page.$('.h-btn:nth-child(2)');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(300);
      const modal = await page.$('.modal-overlay.show');
      if (!modal) throw new Error('모달 안 열림');
      // 닫기
      const closeBtn = await page.$('.modal-overlay.show .btn-secondary');
      if (closeBtn) await closeBtn.click();
    } else {
      throw new Error('설정 버튼 없음');
    }
  });

  // 14. 6단계(앱 소개) 이동
  await test('6단계(앱 소개) 이동', async () => {
    await page.click('.step-tab:nth-child(6)');
    await page.waitForTimeout(300);
    const active = await page.$('.step-panel.active');
    const id = await active.getAttribute('id');
    if (id !== 'step5') throw new Error(`active: ${id}`);
  });

  // 15. 형태소 분석 API (analyze)
  await test('형태소 분석 API', async () => {
    const res = await page.evaluate(() =>
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: ['코스피 지수 상승'], stopwords: [], minLen: 2 })
      }).then(r => r.json())
    );
    if (!res.wordFreq && !res.error) throw new Error('응답 이상: ' + JSON.stringify(res));
  });

  // 16. 웰컴 모달 동작 확인 (존재 여부)
  await test('웰컴/셋업 모달 요소 존재', async () => {
    const welcome = await page.$('#welcomeModal');
    const setup = await page.$('#setupModal');
    if (!welcome && !setup) throw new Error('모달 요소 없음');
  });

  // 결과 출력
  console.log('\n' + '='.repeat(50));
  console.log(`배포용 프로그램 테스트 결과: ${pass} PASS / ${fail} FAIL`);
  console.log('='.repeat(50));
  for (const r of results) {
    const icon = r.status === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  [${icon}] ${r.name}${r.error ? ' - ' + r.error : ''}`);
  }
  console.log('');

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
