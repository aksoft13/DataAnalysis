const axios = require('axios');
const BASE = 'http://localhost:3007';

// 감성사전 (앱과 동일)
const SENT_POS = new Set(['좋다','좋아','좋은','최고','대박','축하','감사','행복','기쁘','희망','성공','훌륭','멋지','잘했','존경','응원','자랑','대단','사랑','기대','축복','환호','감동','보람','수익','이익','상승','돌파','성장','발전','번영','풍요','긍정','흥분','신나','즐겁','만족','감격','영광','위대','혁명','역사','기적','놀랍','든든','뿌듯','고맙','찬성','지지','공감','ㅋㅋ','ㅎㅎ','굿','짱','개꿀','레전드','킹','갓','존버','승리','화이팅','파이팅','개이득','떡상']);
const SENT_NEG = new Set(['나쁘','싫다','싫어','최악','망했','실패','불안','걱정','위험','폭락','손실','손해','거품','버블','폭망','사기','거짓','기만','무능','분노','화나','짜증','절망','고통','슬프','비참','후회','한심','답답','어이없','황당','실망','개소리','쓰레기','쓰래기','지옥','조롱','욕심','탐욕','폭망','곱버스','물려','물렸','떡락','개미','호구','양아치','도둑','매국','종말','파산','파멸','공포','헬','ㅅㅂ','ㅈㄹ','ㅂㅅ','미친','개빡','존나','씹']);

function analyzeSentiment(text) {
  if (!text) return { score: 0, pos: 0, neg: 0, label: '중립' };
  let pos = 0, neg = 0;
  for (const w of SENT_POS) { if (text.includes(w)) pos++; }
  for (const w of SENT_NEG) { if (text.includes(w)) neg++; }
  const score = pos - neg;
  return { score, pos, neg, label: score > 0 ? '긍정' : score < 0 ? '부정' : '중립' };
}

// 4개 구간 정의
const PERIODS = [
  { label: '코스피 5000', query: '코스피 5000', dateFrom: '2026-01-19', dateTo: '2026-01-25', ytAfter: '2026-01-19T00:00:00Z', ytBefore: '2026-01-25T23:59:59Z' },
  { label: '코스피 6000', query: '코스피 6000', dateFrom: '2026-02-22', dateTo: '2026-02-28', ytAfter: '2026-02-22T00:00:00Z', ytBefore: '2026-02-28T23:59:59Z' },
  { label: '코스피 7000', query: '코스피 7000', dateFrom: '2026-05-03', dateTo: '2026-05-09', ytAfter: '2026-05-03T00:00:00Z', ytBefore: '2026-05-09T23:59:59Z' },
  { label: '코스피 8000', query: '코스피 8000', dateFrom: '2026-05-12', dateTo: '2026-05-18', ytAfter: '2026-05-12T00:00:00Z', ytBefore: '2026-05-18T23:59:59Z' },
];

async function collectNews(period) {
  try {
    const resp = await axios.get(`${BASE}/api/search`, {
      params: { type: 'gnews', query: period.query, display: 100, dateFrom: period.dateFrom, dateTo: period.dateTo },
      timeout: 30000,
    });
    return resp.data.items || [];
  } catch (e) { console.log(`  [뉴스 수집 실패] ${period.label}: ${e.message}`); return []; }
}

async function collectYouTube(period) {
  try {
    const resp = await axios.get(`${BASE}/api/youtube/search`, {
      params: { query: period.query, maxResults: 20, publishedAfter: period.ytAfter, publishedBefore: period.ytBefore, order: 'relevance' },
      timeout: 15000,
    });
    return resp.data.items || [];
  } catch (e) { console.log(`  [유튜브 수집 실패] ${period.label}: ${e.message}`); return []; }
}

async function collectComments(videoId) {
  try {
    const resp = await axios.get(`${BASE}/api/youtube/comments`, {
      params: { videoId, maxResults: 100 },
      timeout: 15000,
    });
    return resp.data.comments || [];
  } catch (e) { return []; }
}

// 뉴스 제목+설명 감성 분석
function analyzeNewsTexts(items) {
  let posCount = 0, negCount = 0, neuCount = 0;
  const details = items.map(item => {
    const text = (item.title || '') + ' ' + (item.description || '');
    const s = analyzeSentiment(text);
    if (s.label === '긍정') posCount++;
    else if (s.label === '부정') negCount++;
    else neuCount++;
    return { title: item.title, sentiment: s.label, score: s.score };
  });
  return { posCount, negCount, neuCount, total: items.length, details };
}

// 유튜브 댓글 감성 분석
function analyzeComments(comments) {
  let posCount = 0, negCount = 0, neuCount = 0;
  let posLikes = 0, negLikes = 0, neuLikes = 0, totalLikes = 0;
  const details = comments.map(c => {
    const s = analyzeSentiment(c.text);
    const likes = c.likeCount || 0;
    totalLikes += likes;
    if (s.label === '긍정') { posCount++; posLikes += likes; }
    else if (s.label === '부정') { negCount++; negLikes += likes; }
    else { neuCount++; neuLikes += likes; }
    return { text: (c.text || '').substring(0, 80), sentiment: s.label, likes };
  });
  return {
    posCount, negCount, neuCount, total: comments.length,
    posLikes, negLikes, neuLikes, totalLikes,
    weightedPos: totalLikes > 0 ? (posLikes / totalLikes * 100) : 0,
    weightedNeg: totalLikes > 0 ? (negLikes / totalLikes * 100) : 0,
    topPos: details.filter(d => d.sentiment === '긍정').sort((a, b) => b.likes - a.likes).slice(0, 3),
    topNeg: details.filter(d => d.sentiment === '부정').sort((a, b) => b.likes - a.likes).slice(0, 3),
  };
}

// 뉴스 키워드 빈도 (간단 추출)
function extractKeywords(items) {
  const freq = {};
  const stopwords = new Set(['코스피','지수','주가','시장','증시','투자','투자자','한국','오늘','현재','기자','뉴스','의','를','을','이','가','에','에서','는','은','도','로','으로','과','와','한','된','인','적','들','것','수','등','및','대','중','년','월','일','만','억','조','원','포인트']);
  for (const item of items) {
    const text = (item.title || '') + ' ' + (item.description || '');
    const words = text.replace(/<[^>]+>/g, '').replace(/[^가-힣a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 2 && !stopwords.has(w));
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
}

async function main() {
  console.log('=== 코스피 돌파 시점별 연구질문 사전 테스트 ===\n');

  const allResults = [];

  for (const period of PERIODS) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[ ${period.label} ] ${period.dateFrom} ~ ${period.dateTo}`);
    console.log('='.repeat(50));

    // 1. 뉴스 수집
    console.log('  뉴스 수집 중...');
    const news = await collectNews(period);
    console.log(`  뉴스 ${news.length}건 수집`);

    // 2. 유튜브 영상 수집
    console.log('  유튜브 영상 수집 중...');
    const videos = await collectYouTube(period);
    console.log(`  유튜브 ${videos.length}건 수집`);

    // 3. 유튜브 댓글 수집
    let allComments = [];
    if (videos.length) {
      console.log('  댓글 수집 중...');
      for (const v of videos.slice(0, 10)) {
        const comments = await collectComments(v.videoId);
        allComments = allComments.concat(comments);
      }
      console.log(`  댓글 ${allComments.length}건 수집`);
    }

    // 4. 분석
    const newsAnalysis = analyzeNewsTexts(news);
    const commentAnalysis = analyzeComments(allComments);
    const keywords = extractKeywords(news);

    const result = { period, newsCount: news.length, videoCount: videos.length, commentCount: allComments.length, newsAnalysis, commentAnalysis, keywords };
    allResults.push(result);

    // 출력
    console.log(`\n  --- 뉴스 감성 (제목+설명 기준) ---`);
    console.log(`  긍정: ${newsAnalysis.posCount}건 (${news.length ? (newsAnalysis.posCount / news.length * 100).toFixed(1) : 0}%)`);
    console.log(`  부정: ${newsAnalysis.negCount}건 (${news.length ? (newsAnalysis.negCount / news.length * 100).toFixed(1) : 0}%)`);
    console.log(`  중립: ${newsAnalysis.neuCount}건 (${news.length ? (newsAnalysis.neuCount / news.length * 100).toFixed(1) : 0}%)`);

    console.log(`\n  --- 유튜브 댓글 감성 ---`);
    console.log(`  긍정: ${commentAnalysis.posCount}건 (${allComments.length ? (commentAnalysis.posCount / allComments.length * 100).toFixed(1) : 0}%)`);
    console.log(`  부정: ${commentAnalysis.negCount}건 (${allComments.length ? (commentAnalysis.negCount / allComments.length * 100).toFixed(1) : 0}%)`);
    console.log(`  중립: ${commentAnalysis.neuCount}건 (${allComments.length ? (commentAnalysis.neuCount / allComments.length * 100).toFixed(1) : 0}%)`);
    if (allComments.length) {
      console.log(`  좋아요 가중: 긍정 ${commentAnalysis.weightedPos.toFixed(1)}% / 부정 ${commentAnalysis.weightedNeg.toFixed(1)}%`);
    }

    console.log(`\n  --- 뉴스 주요 키워드 Top 10 ---`);
    keywords.slice(0, 10).forEach(([w, c], i) => console.log(`  ${i + 1}. ${w} (${c})`));
  }

  // 종합 비교
  console.log(`\n\n${'#'.repeat(60)}`);
  console.log('# 종합 비교 요약');
  console.log('#'.repeat(60));

  console.log('\n[ RQ1: 돌파 시점별 감성 변화 ]');
  console.log('구간          | 뉴스긍정% | 뉴스부정% | 댓글긍정% | 댓글부정% | 댓글가중긍정%');
  console.log('-'.repeat(80));
  for (const r of allResults) {
    const np = r.newsCount ? (r.newsAnalysis.posCount / r.newsCount * 100).toFixed(1) : '-';
    const nn = r.newsCount ? (r.newsAnalysis.negCount / r.newsCount * 100).toFixed(1) : '-';
    const cp = r.commentCount ? (r.commentAnalysis.posCount / r.commentCount * 100).toFixed(1) : '-';
    const cn = r.commentCount ? (r.commentAnalysis.negCount / r.commentCount * 100).toFixed(1) : '-';
    const wcp = r.commentCount ? r.commentAnalysis.weightedPos.toFixed(1) : '-';
    console.log(`${r.period.label.padEnd(14)}| ${String(np).padEnd(10)}| ${String(nn).padEnd(10)}| ${String(cp).padEnd(10)}| ${String(cn).padEnd(10)}| ${wcp}`);
  }

  console.log('\n[ RQ2: 뉴스 vs 유튜브 프레임 차이 ]');
  for (const r of allResults) {
    console.log(`\n  ${r.period.label}:`);
    console.log(`    뉴스 키워드: ${r.keywords.slice(0, 7).map(([w]) => w).join(', ')}`);
    if (r.commentAnalysis.topPos.length) {
      console.log(`    유튜브 긍정 대표: "${r.commentAnalysis.topPos[0].text.substring(0, 50)}..." (좋아요 ${r.commentAnalysis.topPos[0].likes})`);
    }
    if (r.commentAnalysis.topNeg.length) {
      console.log(`    유튜브 부정 대표: "${r.commentAnalysis.topNeg[0].text.substring(0, 50)}..." (좋아요 ${r.commentAnalysis.topNeg[0].likes})`);
    }
  }

  console.log('\n[ RQ3: 담론 구조 변화 - 키워드 비교 ]');
  const allKwSets = allResults.map(r => new Set(r.keywords.slice(0, 15).map(([w]) => w)));
  for (let i = 0; i < allResults.length; i++) {
    for (let j = i + 1; j < allResults.length; j++) {
      const common = [...allKwSets[i]].filter(w => allKwSets[j].has(w));
      const onlyI = [...allKwSets[i]].filter(w => !allKwSets[j].has(w));
      const onlyJ = [...allKwSets[j]].filter(w => !allKwSets[i].has(w));
      console.log(`\n  ${allResults[i].period.label} vs ${allResults[j].period.label}:`);
      console.log(`    공통: ${common.join(', ') || '없음'}`);
      console.log(`    ${allResults[i].period.label}만: ${onlyI.join(', ') || '없음'}`);
      console.log(`    ${allResults[j].period.label}만: ${onlyJ.join(', ') || '없음'}`);
    }
  }

  console.log('\n\n=== 테스트 완료 ===');
}

main().catch(e => console.error('오류:', e.message));
