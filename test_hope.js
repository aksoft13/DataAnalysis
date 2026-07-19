const { chromium } = require('playwright');

const BASE = 'http://localhost:3007';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1400,900'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');

  console.log('=== 나홍진 호프 개봉 전후 대중 반응 비교 테스트 ===\n');

  // 1. 주제 입력
  console.log('[1] 주제 입력...');
  await page.fill('#researchQuestion', '나홍진 감독 영화 호프 개봉 전후 대중 반응 비교');

  // 2. 그룹 설정
  console.log('[2] 그룹 설정...');
  await page.evaluate(() => {
    groups[0] = {
      label: '개봉 전', keyword: '나홍진 호프',
      dateFrom: '2026-07-08', dateTo: '2026-07-14',
      sources: { gnews: true, youtube: true },
      ytKeyword: '', ytMaxResults: 10, ytMaxComments: 100, newsDisplay: 200,
    };
    groups.push({
      label: '개봉 후', keyword: '나홍진 호프',
      dateFrom: '2026-07-15', dateTo: '2026-07-21',
      sources: { gnews: true, youtube: true },
      ytKeyword: '', ytMaxResults: 10, ytMaxComments: 100, newsDisplay: 200,
    });
    renderGroups();
  });

  // 3. 수집 시작 (async 함수이므로 page.evaluate에서 await)
  console.log('[3] 데이터 수집 시작...');
  await page.evaluate(() => window._collectDone = false);
  page.evaluate(async () => {
    await startCollection();
    window._collectDone = true;
  });

  // 수집 완료 대기
  console.log('    수집 중...');
  await page.waitForFunction(() => window._collectDone === true, { timeout: 180000 });
  console.log('    수집 완료!');

  // 수집 결과 출력
  const collectResult = await page.evaluate(() => {
    const out = {};
    for (const [gi, data] of Object.entries(window.collectedData || {})) {
      const g = window.groups[gi];
      out[g?.label || gi] = { news: data.news?.length || 0, youtube: data.youtube?.length || 0, comments: data.comments?.length || 0 };
    }
    return out;
  });
  console.log('    수집 결과:');
  for (const [label, d] of Object.entries(collectResult)) {
    console.log(`      ${label}: 뉴스 ${d.news}건, 영상 ${d.youtube}건, 댓글 ${d.comments}건`);
  }

  // 4. 분석 실행
  console.log('\n[4] 분석 실행...');
  await page.evaluate(() => window._analyzeDone = false);
  page.evaluate(async () => {
    await runAnalysis();
    window._analyzeDone = true;
  });

  await page.waitForFunction(() => window._analyzeDone === true, { timeout: 120000 });
  console.log('    분석 완료!');
  await page.waitForTimeout(1000);

  // 5. 결과 추출
  console.log('\n[5] 결과 확인...');
  const results = await page.evaluate(() => {
    const sw = window.stopwords;
    function getTop(wf, n) {
      return Object.entries(wf || {})
        .filter(([w]) => !sw.has(w) && !sw.has(w.toLowerCase()))
        .sort((a, b) => b[1] - a[1]).slice(0, n);
    }
    const output = { keywords: {}, newsKeywords: {}, ytKeywords: {} };
    for (const [gi, r] of Object.entries(window.analysisResults || {})) {
      output.keywords[window.groups[gi]?.label || gi] = getTop(r.wordFreq, 20);
    }
    for (const [gi, r] of Object.entries(window.newsAnalysis || {})) {
      output.newsKeywords[window.groups[gi]?.label || gi] = getTop(r.wordFreq, 15);
    }
    for (const [gi, r] of Object.entries(window.youtubeAnalysis || {})) {
      output.ytKeywords[window.groups[gi]?.label || gi] = getTop(r.wordFreq, 15);
    }
    return output;
  });

  // 출력
  console.log('\n' + '='.repeat(60));
  console.log(' 통합 상위 키워드 (개봉 전 vs 후)');
  console.log('='.repeat(60));
  for (const [label, words] of Object.entries(results.keywords)) {
    console.log(`\n  [${label}]`);
    if (!words.length) console.log('    (데이터 없음)');
    words.forEach(([w, f], i) => console.log(`    ${String(i + 1).padStart(2)}. ${w} (${f})`));
  }

  console.log('\n' + '='.repeat(60));
  console.log(' 뉴스 상위 키워드');
  console.log('='.repeat(60));
  for (const [label, words] of Object.entries(results.newsKeywords)) {
    console.log(`\n  [${label}]`);
    if (!words.length) console.log('    (데이터 없음)');
    words.forEach(([w, f], i) => console.log(`    ${String(i + 1).padStart(2)}. ${w} (${f})`));
  }

  console.log('\n' + '='.repeat(60));
  console.log(' 유튜브 댓글 상위 키워드');
  console.log('='.repeat(60));
  for (const [label, words] of Object.entries(results.ytKeywords)) {
    console.log(`\n  [${label}]`);
    if (!words.length) console.log('    (데이터 없음)');
    words.forEach(([w, f], i) => console.log(`    ${String(i + 1).padStart(2)}. ${w} (${f})`));
  }

  // 불용어 검사
  const bad = new Set(['the','to','and','this','in','of','it','that','is','was','are','for','with','on','at','by','from','as','an','href','http','https','www','com']);
  let found = false;
  for (const section of [results.keywords, results.newsKeywords, results.ytKeywords]) {
    for (const [, words] of Object.entries(section)) {
      for (const [w] of words) {
        if (bad.has(w.toLowerCase())) { console.log(`  [WARNING] 불용어: "${w}"`); found = true; }
      }
    }
  }
  if (!found) console.log('\n  [OK] 영어 불용어 필터링 정상!');

  console.log('\n=== 테스트 완료 (브라우저 열림) ===');
})();
