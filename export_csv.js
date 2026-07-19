const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('history/2026-06-03T02-54-14.json', 'utf8'));
const groups = data.groups || [];
const cd = data.collectedData || {};
const outDir = 'dataset_csv';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

function csvEscape(v) {
  if (v == null) return '';
  let s = String(v).replace(/"/g, '""');
  if (s.includes(',') || s.includes('\n') || s.includes('"')) s = `"${s}"`;
  return s;
}

function writeCsv(filename, headers, rows) {
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => csvEscape(r[h])).join(',')));
  fs.writeFileSync(path.join(outDir, filename), '\uFEFF' + lines.join('\n'), 'utf8');
  console.log(`  ${filename}: ${rows.length}건`);
}

// 1. 뉴스 데이터
const newsRows = [];
Object.keys(cd).forEach(gi => {
  const label = groups[gi]?.label || `그룹${gi}`;
  (cd[gi].news || []).forEach(item => {
    newsRows.push({
      그룹: label,
      제목: (item.title || '').replace(/<[^>]+>/g, ''),
      설명: (item.description || '').replace(/<[^>]+>/g, ''),
      링크: item.link || item.originallink || '',
      게시일: item.pubDate || '',
      출처: item.bloggername || '',
    });
  });
});
console.log('뉴스 데이터:');
writeCsv('01_뉴스_전체.csv', ['그룹', '제목', '설명', '링크', '게시일', '출처'], newsRows);

// 2. 유튜브 영상 메타데이터
const ytRows = [];
Object.keys(cd).forEach(gi => {
  const label = groups[gi]?.label || `그룹${gi}`;
  (cd[gi].youtube || []).forEach(v => {
    ytRows.push({
      그룹: label,
      videoId: v.videoId || '',
      제목: v.title || '',
      채널: v.channelTitle || '',
      조회수: v.viewCount || 0,
      좋아요: v.likeCount || 0,
      댓글수: v.commentCount || 0,
      영상길이: v.duration || '',
      게시일: v.publishedAt || '',
      썸네일: v.thumbnail || '',
    });
  });
});
console.log('유튜브 영상:');
writeCsv('02_유튜브_영상.csv', ['그룹', 'videoId', '제목', '채널', '조회수', '좋아요', '댓글수', '영상길이', '게시일', '썸네일'], ytRows);

// 3. 유튜브 댓글
const cmtRows = [];
Object.keys(cd).forEach(gi => {
  const label = groups[gi]?.label || `그룹${gi}`;
  (cd[gi].comments || []).forEach(c => {
    cmtRows.push({
      그룹: label,
      videoId: c.videoId || '',
      작성자: c.author || '',
      댓글: c.text || '',
      좋아요: c.likeCount || 0,
      작성시간: c.publishedAt || '',
    });
  });
});
console.log('유튜브 댓글:');
writeCsv('03_유튜브_댓글.csv', ['그룹', 'videoId', '작성자', '댓글', '좋아요', '작성시간'], cmtRows);

// 4. 통합 데이터 (모든 텍스트)
const allRows = [];
newsRows.forEach(r => allRows.push({ 그룹: r.그룹, 소스: '뉴스', 텍스트: r.제목 + ' ' + r.설명, 좋아요: '', 작성시간: r.게시일 }));
cmtRows.forEach(r => allRows.push({ 그룹: r.그룹, 소스: '유튜브댓글', 텍스트: r.댓글, 좋아요: r.좋아요, 작성시간: r.작성시간 }));
console.log('통합 데이터:');
writeCsv('04_통합_텍스트.csv', ['그룹', '소스', '텍스트', '좋아요', '작성시간'], allRows);

// 5. 분석 결과 요약
const summaryRows = [];
Object.keys(cd).forEach(gi => {
  const label = groups[gi]?.label || `그룹${gi}`;
  const d = cd[gi];
  const yt = d.youtube || [];
  summaryRows.push({
    그룹: label,
    뉴스건수: (d.news || []).length,
    영상수: yt.length,
    댓글수: (d.comments || []).length,
    총조회수: yt.reduce((s, v) => s + (v.viewCount || 0), 0),
    총좋아요: yt.reduce((s, v) => s + (v.likeCount || 0), 0),
    총댓글수: yt.reduce((s, v) => s + (v.commentCount || 0), 0),
  });
});
console.log('수집 요약:');
writeCsv('05_수집_요약.csv', ['그룹', '뉴스건수', '영상수', '댓글수', '총조회수', '총좋아요', '총댓글수'], summaryRows);

console.log(`\n완료! ${outDir}/ 폴더에 5개 CSV 파일 생성`);
