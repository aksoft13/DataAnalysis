const axios = require('axios');
const fs = require('fs');
const BASE = 'http://localhost:3007';

const data = JSON.parse(fs.readFileSync('history/2026-06-03T02-54-14.json', 'utf8'));
const groups = data.groups || [];
const cd = data.collectedData || {};

function cleanText(t) { return (t || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim(); }

async function analyzeGroup(gi) {
  const d = cd[gi];
  if (!d) return null;
  const texts = [];
  for (const it of (d.news || [])) texts.push(cleanText(it.title) + ' ' + cleanText(it.description));
  for (const c of (d.comments || [])) texts.push(c.text || '');
  if (!texts.length) return null;

  const stopwords = ['href','target','blank','nbsp','font','color','daum','net','news','naver','com','www','http','https','lta','ltfont','ltagt','gtlt','vdaumnet','v.daum.net','targetblankgt','targetblankgt코스피','color6f6f6f','color6f6f6fgt','color6f6f6fgt연합뉴스ltfontgt','color6f6f6fgtvdaumnetltfontgt','뉴스','연합뉴스','머니투데이','중앙일보'];
  const resp = await axios.post(`${BASE}/api/analyze`, { texts, stopwords, minLen: 2 }, { timeout: 120000 });
  return resp.data;
}

function buildCoMatrix(docWords, topWordSet) {
  const co = {};
  for (const words of docWords) {
    const unique = [...new Set(words)].filter(w => topWordSet.has(w));
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = [unique[i], unique[j]].sort().join('\0');
        co[key] = (co[key] || 0) + 1;
      }
    }
  }
  return co;
}

function assignCommunities(nodes, edges) {
  // 간이 Louvain: 연결 강도 기반 허브 그룹핑
  const neighbors = {};
  nodes.forEach(n => neighbors[n.id] = {});
  edges.forEach(e => {
    neighbors[e.source][e.target] = (neighbors[e.source][e.target] || 0) + e.weight;
    neighbors[e.target][e.source] = (neighbors[e.target][e.source] || 0) + e.weight;
  });

  const community = {};
  let cid = 0;
  const assigned = new Set();
  const sorted = [...nodes].sort((a, b) => b.freq - a.freq);

  for (const n of sorted) {
    if (assigned.has(n.id)) continue;
    community[n.id] = cid;
    assigned.add(n.id);
    const nbs = Object.entries(neighbors[n.id] || {}).sort((a, b) => b[1] - a[1]);
    let count = 0;
    for (const [nb] of nbs) {
      if (!assigned.has(nb) && count < 3) {
        community[nb] = cid;
        assigned.add(nb);
        count++;
      }
    }
    cid++;
  }
  return community;
}

async function main() {
  const snaData = {};
  for (const gi of Object.keys(cd)) {
    const label = groups[gi]?.label || `그룹${gi}`;
    console.log(`${label} 형태소 분석 중...`);
    const result = await analyzeGroup(gi);
    if (!result) continue;

    const topWords = Object.entries(result.wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const topWordSet = new Set(topWords.map(([w]) => w));
    const nodes = topWords.map(([id, freq]) => ({ id, freq }));

    console.log(`  동시출현 매트릭스 생성 중... (문서 ${result.docWords.length}건)`);
    const co = buildCoMatrix(result.docWords, topWordSet);

    const edges = [];
    for (const [key, weight] of Object.entries(co)) {
      if (weight >= 3) {
        const [source, target] = key.split('\0');
        edges.push({ source, target, weight });
      }
    }
    edges.sort((a, b) => b.weight - a.weight);

    const community = assignCommunities(nodes, edges);
    nodes.forEach(n => n.community = community[n.id] || 0);

    const maxEdges = nodes.length * (nodes.length - 1) / 2;
    const density = maxEdges > 0 ? edges.length / maxEdges : 0;

    snaData[gi] = { label, nodes, edges: edges.slice(0, 80), density };
    console.log(`  ${label}: 노드 ${nodes.length}, 엣지 ${edges.length}, 밀도 ${density.toFixed(3)}`);
  }

  fs.writeFileSync('sna_data.json', JSON.stringify(snaData, null, 2));
  console.log('\nsna_data.json 저장 완료');
}

main().catch(e => console.error(e.message));
