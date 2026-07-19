const fs = require('fs');
const data = JSON.parse(fs.readFileSync('history/2026-06-03T02-54-14.json', 'utf8'));
const groups = data.groups || [];
const cd = data.collectedData || {};

// 돌파일 (KST 기준)
const breakthroughDates = {
  '0': '2026-01-22',
  '1': '2026-02-25',
  '2': '2026-05-06',
  '3': '2026-05-15'
};

const rowLabels = ['-3일','-2일','-1일','D-Day','+1일','+2일','+3일'];
const result = {};

for (const gi of Object.keys(cd)) {
  const label = groups[gi]?.label || `그룹${gi}`;
  const d = cd[gi];
  const bDate = new Date(breakthroughDates[gi] + 'T00:00:00+09:00');

  // 돌파일 기준 Day -3 ~ Day +3 (7행 × 24열)
  const cmtHeat = Array.from({length:7}, () => Array(24).fill(0));
  for (const c of (d.comments || [])) {
    if (!c.publishedAt) continue;
    const kst = new Date(new Date(c.publishedAt).getTime() + 9 * 60 * 60 * 1000);
    const kstDate = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
    const bDateOnly = new Date(Date.UTC(bDate.getUTCFullYear(), bDate.getUTCMonth(), bDate.getUTCDate()));
    const dayDiff = Math.round((kstDate - bDateOnly) / 86400000);
    const row = dayDiff + 3;
    if (row >= 0 && row < 7) {
      cmtHeat[row][kst.getUTCHours()]++;
    }
  }

  const upHeat = Array.from({length:7}, () => Array(24).fill(0));
  for (const v of (d.youtube || [])) {
    if (!v.publishedAt) continue;
    const kst = new Date(new Date(v.publishedAt).getTime() + 9 * 60 * 60 * 1000);
    const kstDate = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
    const bDateOnly = new Date(Date.UTC(bDate.getUTCFullYear(), bDate.getUTCMonth(), bDate.getUTCDate()));
    const dayDiff = Math.round((kstDate - bDateOnly) / 86400000);
    const row = dayDiff + 3;
    if (row >= 0 && row < 7) {
      upHeat[row][kst.getUTCHours()]++;
    }
  }

  result[gi] = { label, cmtHeat, upHeat, rowLabels };

  console.log(`${label} (돌파일: ${breakthroughDates[gi]}):`);
  console.log(`  댓글 총: ${cmtHeat.flat().reduce((a,b)=>a+b,0)}건`);
  console.log(`  영상 총: ${upHeat.flat().reduce((a,b)=>a+b,0)}건`);
  cmtHeat.forEach((row, i) => {
    const total = row.reduce((a,b)=>a+b,0);
    if (total > 0) console.log(`  ${rowLabels[i]}: ${total}건`);
  });
}

fs.writeFileSync('heatmap_data.json', JSON.stringify(result, null, 2));
console.log('\nheatmap_data.json 저장 완료');
