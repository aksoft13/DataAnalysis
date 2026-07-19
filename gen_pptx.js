const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();

pptx.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"
pptx.author = '이성훈, 김성희';
pptx.title = '코스피 돌파시점 대중반응 비교분석';

// 디자인 시스템 색상
const BG = 'FFFFFF';
const PRIMARY = '4F46E5';
const PRIMARY_LT = 'E0E7FF';
const TEXT = '1E293B';
const TEXT2 = '334155';
const SUB = '64748B';
const BORDER = 'CBD5E1';
const HL_BG = 'E0E7FF'; const HL_TEXT = '3730A3';
const WARN_BG = 'FFFBEB'; const WARN_TEXT = '92400E';
const DISC_BG = 'EEF2FF';
const COVER_BG = '4F46E5';

// 기본 폰트 설정
const FONT = 'Apple SD Gothic Neo';

// 레이아웃 상수 (여백 0.6")
const M = 0.6;           // 좌우 여백
const CW = 13.33 - M*2;  // 콘텐츠 너비 12.13
const GAP = 0.4;
const HALF = (CW - GAP) / 2; // 5.87
const X2 = M + HALF + GAP;   // 6.87 (오른쪽 컬럼 시작)
const Y_CONTENT = 1.75;      // 콘텐츠 시작 y
const Y_BOTTOM = 6.7;        // 하단 여백

function addTopbar(s) {
  s.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.05, fill: { color: PRIMARY } });
}
function addNum(s, num) {
  s.addText(num, { x: M, y: 0.35, w: 0.6, h: 0.3, fontSize: 10, bold: true, color: 'FFFFFF', fill: { color: PRIMARY }, align: 'center', valign: 'middle', fontFace: FONT });
}
function addTitle(s, title) {
  s.addText(title, { x: M, y: 0.7, w: CW, h: 0.5, fontSize: 22, bold: true, color: TEXT, fontFace: FONT });
}
function addDesc(s, desc) {
  s.addText(desc, { x: M, y: 1.25, w: CW, h: 0.3, fontSize: 10, color: SUB, fontFace: FONT });
  s.addShape(pptx.shapes.LINE, { x: M, y: 1.6, w: CW, h: 0, line: { color: PRIMARY_LT, width: 2 } });
}
function addPage(s, n) {
  s.addText(`${n} / 13`, { x: M + CW - 1, y: Y_BOTTOM, w: 1, h: 0.3, fontSize: 8, color: 'A0AEC0', align: 'right', fontFace: FONT });
}
const tblOpt = { fontSize: 10, color: TEXT2, border: { type: 'solid', pt: 0.5, color: BORDER }, align: 'center', valign: 'middle', autoPage: false, fontFace: FONT };

// 0. 표지
let s = pptx.addSlide(); s.background = { fill: COVER_BG };
s.addText('Course Project Presentation', { x: 0, y: 1.2, w: '100%', h: 0.4, fontSize: 11, color: 'C7D2FE', align: 'center', letterSpacing: 5, fontFace: FONT });
s.addText([
  { text: '코스피 5000 / 6000 / 7000 / 8000\n돌파 시점에서 뉴스와 유튜브의\n', options: { fontSize: 30, bold: true, color: 'FFFFFF', fontFace: FONT } },
  { text: '대중 반응', options: { fontSize: 30, bold: true, color: 'C7D2FE', fontFace: FONT } },
  { text: '은 어떻게 달라지는가?', options: { fontSize: 30, bold: true, color: 'FFFFFF', fontFace: FONT } }
], { x: 1, y: 1.8, w: 11.33, h: 2.2, align: 'center', valign: 'middle', lineSpacingMultiple: 1.3, fontFace: FONT });
s.addText('멀티소스 데이터 수집 및 SNA·감성 분석 기반 비교 연구', { x: 0, y: 4.2, w: '100%', h: 0.4, fontSize: 13, color: 'C7D2FE', align: 'center' , fontFace: FONT });
s.addText('과목  데이터 수집 및 분석 프로그래밍     소속  고려대학교 미디어대학원 6조     조원  이성훈 · 김성희     2026. 06. 03', { x: 0, y: 5.2, w: '100%', h: 0.4, fontSize: 10, color: 'A5B4FC', align: 'center' , fontFace: FONT });

// 1. 연구 배경
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '01'); addTitle(s, '연구 배경 & 연구 질문'); addDesc(s, '5개월 만에 4번 돌파 — 지수는 올라가는데, 사람들은 정말 기뻐했을까?');
s.addTable([['이정표','돌파일','소요'],['5,000','01-22','60거래일'],['6,000','02-25','21거래일'],['7,000','05-06','47거래일'],['8,000','05-15','7거래일']], { x: M, y: Y_CONTENT, w: HALF, ...tblOpt, colW: [1.8, 2.0, 2.07] });
s.addText([{ text: 'RQ-a', options: { bold: true, color: PRIMARY } }, { text: ': 돌파 시점마다 유튜브 댓글의 감성은 어떻게 달라지는가?', options: { color: HL_TEXT } }], { x: X2, y: Y_CONTENT, w: HALF, h: 0.6, fontSize: 11, fill: { color: HL_BG }, align: 'center', valign: 'middle' , fontFace: FONT });
s.addText([{ text: 'RQ-b', options: { bold: true, color: PRIMARY } }, { text: ': 뉴스의 담론 구조와 유튜브의 감성 프레임은 어떤 차이가 있는가?', options: { color: HL_TEXT } }], { x: X2, y: Y_CONTENT + 0.75, w: HALF, h: 0.6, fontSize: 11, fill: { color: HL_BG }, align: 'center', valign: 'middle' , fontFace: FONT });
s.addText('돌파 간격이 60일 → 7일로 가속화', { x: M, y: 4.2, w: CW, h: 0.5, fontSize: 12, bold: true, color: PRIMARY, fill: { color: HL_BG }, align: 'center', valign: 'middle' , fontFace: FONT });
addPage(s, 1);

// 2. 앱 + 수집
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '02'); addTitle(s, '분석 도구 & 수집 설계'); addDesc(s, 'myDataAnalysis 앱 — 21,201건 다층적 분석');
s.addTable([['계층','기술'],['프론트엔드','HTML + Chart.js + D3.js'],['백엔드','Node.js + Express'],['형태소 분석','Python kiwipiepy'],['감성 분석','자체 감성사전 (120어)']], { x: M, y: Y_CONTENT, w: HALF, ...tblOpt, colW: [2.0, 3.87] });
s.addTable([['그룹','기간','뉴스','댓글'],['A (5000)','01-19~25','267','8,181'],['B (6000)','02-22~28','282','5,167'],['C (7000)','05-03~09','278','4,709'],['D (8000)','05-12~18','291','3,144'],['합계','','1,118','21,201']], { x: X2, y: Y_CONTENT, w: HALF, ...tblOpt, colW: [1.3, 1.57, 1.2, 1.8] });
s.addText('형태소 + SNA: 뉴스 + 유튜브 모두  |  감성 분석: 유튜브 댓글에만 적용', { x: M, y: 4.8, w: CW, h: 0.5, fontSize: 11, bold: true, color: HL_TEXT, fill: { color: HL_BG }, align: 'center', valign: 'middle' , fontFace: FONT });
s.addText('돌파일 ±3일(7일) 균등 수집 — 반복 횡단면 + 시계열 비교 = 준실험적 접근', { x: M, y: 5.45, w: CW, h: 0.45, fontSize: 10, color: WARN_TEXT, fill: { color: WARN_BG }, align: 'center', valign: 'middle', fontFace: FONT });
addPage(s, 2);

// 차트 공통 옵션
const chartColors = { 정치: '818CF8', 경제: '22C55E', 공포: 'EF4444', 긍정: '22C55E', 부정: 'EF4444', 중립: '94A3B8', 인디고: '6366F1', 앰버: 'F59E0B' };
const CAT = ['5000','6000','7000','8000'];
const chartOpt = { x: M, w: HALF, h: 2.8, showValue: true, dataLabelFontSize: 9, dataLabelColor: TEXT2, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9 };

// 3. 수집 결과
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '03'); addTitle(s, '수집 결과 — 뉴스는 일정, 대중 관심은 급감'); addDesc(s, '뉴스 267~291건 균등 vs 유튜브 조회수 83% 감소, 댓글 91% 감소');
s.addChart(pptx.charts.BAR, [
  {name:'뉴스(건)',labels:CAT,values:[267,282,278,291]}
], { ...chartOpt, y: Y_CONTENT, barDir:'col', showValue:true, dataLabelFontSize:10, valAxisMinVal:200, chartColors:[chartColors.인디고] });
s.addChart(pptx.charts.LINE, [
  {name:'조회수(M)',labels:CAT,values:[21.8,8.54,9.75,3.71]},
  {name:'좋아요(만)',labels:CAT,values:[65.1,28.1,28.5,10.9]},
  {name:'댓글(천)',labels:CAT,values:[8.18,5.17,4.71,3.14]}
], { x: X2, y: Y_CONTENT, w: HALF, h: 2.8, showValue:true, dataLabelFontSize:9, catAxisLabelFontSize:10, valAxisLabelFontSize:9, lineDataSymbolSize:8, chartColors:[chartColors.인디고, chartColors.긍정, chartColors.앰버] });
s.addText('언론 보도량은 일정한데, 대중의 자발적 관심은 "첫 돌파"에 집중되고 이후 급감하는 비대칭 구조', { x: M, y: 5.0, w: CW, h: 0.5, fontSize: 12, color: HL_TEXT, fill: { color: HL_BG }, align: 'center', valign: 'middle', fontFace: FONT });
addPage(s, 3);

// 4. 키워드 분석
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '04'); addTitle(s, '키워드 분석 — 정치에서 위기로'); addDesc(s, '정치·경제·공포 3그룹으로 묶으면 전체 흐름이 한눈에');
s.addChart(pptx.charts.BAR, [
  {name:'정치 키워드',labels:CAT,values:[1394,1032,884,115]},
  {name:'경제 키워드',labels:CAT,values:[1073,1056,1137,1104]},
  {name:'공포 키워드',labels:CAT,values:[180,207,132,515]}
], { x: M, y: Y_CONTENT, w: CW, h: 3.2, barDir:'col', showValue:true, dataLabelFontSize:10, catAxisLabelFontSize:12, valAxisLabelFontSize:10, chartColors:[chartColors.정치, chartColors.경제, chartColors.공포] });
s.addText("'정치 논쟁 → 경제 공포' 전환이 명확", { x: M, y: 5.2, w: CW, h: 0.5, fontSize: 14, bold: true, color: HL_TEXT, fill: { color: HL_BG }, align: 'center', valign: 'middle', fontFace: FONT });
addPage(s, 4);

// 5. SNA 분석
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '05'); addTitle(s, 'SNA 네트워크 분석 — 키워드 관계 구조의 변화'); addDesc(s, '상위 40개 키워드 동시 출현 네트워크 — 밀도 변화로 담론 수렴/분산 측정');
s.addChart(pptx.charts.LINE, [
  {name:'네트워크 밀도',labels:CAT,values:[0.727,0.694,0.627,0.699]}
], { x: M, y: Y_CONTENT, w: HALF, h: 2.5, showValue:true, dataLabelFontSize:12, lineDataSymbolSize:10, catAxisLabelFontSize:11, valAxisMinVal:0.55, valAxisMaxVal:0.78, chartColors:[chartColors.인디고] });
s.addTable([['구간','밀도','핵심 특징'],['5000','0.727','정치 중심 고밀도, "대통령-이재명" 233건'],['6000','0.694','정치+경제 이원 구조, "돌파-코스피" 98건'],['7000','0.627','담론 다변화, 밀도 최저'],['8000','0.699','하락 공포 수렴, "급락·조정" 클러스터']], { x: X2, y: Y_CONTENT, w: HALF, ...tblOpt, fontSize: 9, colW: [0.8, 0.8, 4.27] });
s.addText('정치 중심 → 담론 분산 → 경제 공포 재수렴 — 네트워크 구조 자체가 전환', { x: M, y: 5.0, w: CW, h: 0.5, fontSize: 12, color: HL_TEXT, fill: { color: HL_BG }, align: 'center', valign: 'middle', fontFace: FONT });
addPage(s, 5);

// 6. 감성 분석
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '06'); addTitle(s, '감성 분석 — 건수 vs 가중의 결정적 차이'); addDesc(s, '건수만 보면 8000이 최고 긍정(30.2%). 가중으로 보면 7000이 최고(28.3%).');
s.addChart(pptx.charts.BAR, [
  {name:'긍정',labels:CAT,values:[29.4,27.3,28.5,30.2]},
  {name:'부정',labels:CAT,values:[7.9,9.8,8.0,9.6]},
  {name:'중립',labels:CAT,values:[62.8,62.8,63.6,60.2]}
], { x: M, y: Y_CONTENT, w: HALF, h: 2.2, barDir:'col', barGrouping:'stacked', showValue:true, dataLabelFontSize:8, dataLabelColor:'FFFFFF', catAxisLabelFontSize:10, valAxisMaxVal:100, chartColors:[chartColors.긍정, chartColors.부정, chartColors.중립] });
s.addChart(pptx.charts.BAR, [
  {name:'가중 긍정',labels:CAT,values:[19.5,22.1,28.3,23.4]},
  {name:'가중 부정',labels:CAT,values:[12.8,11.7,8.3,9.1]},
  {name:'가중 중립',labels:CAT,values:[67.8,66.2,63.4,67.5]}
], { x: X2, y: Y_CONTENT, w: HALF, h: 2.2, barDir:'col', barGrouping:'stacked', showValue:true, dataLabelFontSize:8, dataLabelColor:'FFFFFF', catAxisLabelFontSize:10, valAxisMaxVal:100, chartColors:[chartColors.긍정, chartColors.부정, chartColors.중립] });
s.addTable([['구간','건수 긍정','가중 긍정','가중 부정','해석'],['5000','29.4%','19.5%','12.8%','환호 속 냉소 (6.7%p)'],['6000','27.3%','22.1%','11.7%','부정 최고, "너무 빠르다"'],['7000','28.5%','28.3%','8.3%','유일한 진심 긍정'],['8000','30.2%','23.4%','9.1%','피로한 긍정']], { x: M, y: 4.3, w: CW, ...tblOpt, fontSize: 9, colW: [1.5, 1.5, 1.5, 1.5, 6.13] });
s.addText('좋아요 가중을 적용해야 실제 대중 심리가 보인다', { x: M, y: 5.5, w: CW, h: 0.45, fontSize: 11, bold: true, color: HL_TEXT, fill: { color: HL_BG }, align: 'center', valign: 'middle', fontFace: FONT });
addPage(s, 6);

// 7. 괴리 1
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '07'); addTitle(s, '괴리 1 — 감성 피로(Sentiment Fatigue)'); addDesc(s, '코스피 60% 상승 vs 인기 댓글 좋아요 95% 감소');
s.addChart(pptx.charts.LINE, [
  {name:'인기 긍정 좋아요',labels:CAT,values:[6636,7826,4040,339]},
  {name:'인기 부정 좋아요',labels:CAT,values:[6271,1800,1733,270]}
], { x: M, y: Y_CONTENT, w: HALF, h: 2.5, showValue:true, dataLabelFontSize:10, lineDataSymbolSize:8, catAxisLabelFontSize:11, chartColors:[chartColors.긍정, chartColors.부정] });
s.addText('감성 피로(Sentiment Fatigue)\n인기 긍정 1위: 6,636 → 339 (95%↓)\n반복되는 이정표에 감정적 반응이 둔화', { x: X2, y: Y_CONTENT, w: HALF, h: 1.2, fontSize: 12, color: HL_TEXT, fill: { color: HL_BG }, align: 'center', valign: 'middle', lineSpacingMultiple: 1.6, fontFace: FONT });
s.addText('연구 한계\n4번의 돌파가 5개월이라는 짧은 기간에 연속 발생\n동일 간격 분산 시 결과가 달라졌을 가능성', { x: X2, y: Y_CONTENT + 1.4, w: HALF, h: 1.1, fontSize: 11, color: WARN_TEXT, fill: { color: WARN_BG }, align: 'center', valign: 'middle', lineSpacingMultiple: 1.6, fontFace: FONT });
addPage(s, 7);

// 8. 괴리 2
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '08'); addTitle(s, '괴리 2 — 언론은 축하하는데, 대중은 불안하다'); addDesc(s, '뉴스 경고 키워드 22→160건(7배) 폭증 시 미디어 간 공명 발생');
s.addChart(pptx.charts.BAR, [
  {name:'뉴스 긍정(건)',labels:CAT,values:[246,351,360,216]},
  {name:'뉴스 경고(건)',labels:CAT,values:[28,30,22,160]}
], { x: M, y: Y_CONTENT, w: CW, h: 2.5, barDir:'col', showValue:true, dataLabelFontSize:10, catAxisLabelFontSize:11, chartColors:[chartColors.인디고, chartColors.부정] });
s.addText('5000~7000: 뉴스 축하 프레이밍 유지\n유튜브 가중 긍정 19.5%, 간격 6.7%p\n→ 언론과 대중 사이 온도차', { x: M, y: 4.6, w: HALF, h: 1.0, fontSize: 11, color: HL_TEXT, fill: { color: HL_BG }, align: 'center', valign: 'middle', lineSpacingMultiple: 1.5, fontFace: FONT });
s.addText('8000: 두 미디어가 같은 방향으로 전환\n경고 22→160건(7배) 폭증 → 미디어 간 공명\n인과관계는 후속 연구 과제', { x: X2, y: 4.6, w: HALF, h: 1.0, fontSize: 11, color: WARN_TEXT, fill: { color: WARN_BG }, align: 'center', valign: 'middle', lineSpacingMultiple: 1.5, fontFace: FONT });
addPage(s, 8);

// 9. 괴리 3
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '09'); addTitle(s, '괴리 3 — "누구의 공인가" → "내 돈은 어떻게 되는가"'); addDesc(s, '정치 키워드 1,394→115 (92%↓) vs 투자 키워드 519→699 — 역전');
s.addChart(pptx.charts.LINE, [
  {name:'정치 키워드',labels:CAT,values:[1394,1032,884,115]},
  {name:'투자 키워드',labels:CAT,values:[519,277,432,699]}
], { x: M, y: Y_CONTENT, w: CW, h: 2.5, showValue:true, dataLabelFontSize:11, lineDataSymbolSize:8, catAxisLabelFontSize:12, chartColors:[chartColors.정치, chartColors.부정] });
s.addText('"누구의 공인가" → "내 돈은 어떻게 되는가"\n대중이 경제적으로 해석하려면 정치적 프레임이 먼저 소진되거나 직접적 충격이 필요', { x: M, y: 4.6, w: CW, h: 0.8, fontSize: 12, color: TEXT2, fill: { color: DISC_BG }, align: 'center', valign: 'middle', lineSpacingMultiple: 1.5, fontFace: FONT });
addPage(s, 9);

// 10. 그룹별 비교
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '10'); addTitle(s, '그룹별 비교 분석 — 다섯 가지 관점'); addDesc(s, '학술적·사회적·문화적·콘텐츠 소비 패턴·비즈니스 관점에서 종합');
s.addTable([
  ['관점','5000','6000','7000','8000'],
  ['학술적','첫 이벤트 최고 참여\n(손실 회피 기준점)','감각 둔화 시작\n(21일 만에 달성)','기대감 재축적\n(47일 간격)','손실 회피 폭발\n(행동 전환)'],
  ['사회적','정치 프레임 지배\n("우리편 vs 저쪽편")','"너무 빠르다"\n불안감 표출','담론 다변화\n정치 소음 감소','정치→경제 체감\n투자 손실 목소리'],
  ['문화적','정치 풍자 콘텐츠\n바이럴','정치 풍자\n유튜버 부상','콘텐츠 유형\n다양화','장편 전문가 분석\n("오락→정보")'],
  ['콘텐츠\n소비 패턴 변화','장편 34%, 숏폼 18%\n실시간 반응 (13시)','야간 소비 전환\n(21시 피크)','참여율 유지\n(3.29%)','장편 70%, 숏폼 12%\n경제 전문 유튜버 독점'],
  ['비즈니스','뉴스 긍정≠여론\n(간격 6.7%p)','반복 이벤트\n관심 피로 시작','1개월+ 간격\n재축적 가능','경고=긍정 동수\n= 위기 조기 경보']
], { x: M, y: Y_CONTENT, w: CW, ...tblOpt, fontSize: 9, colW: [1.5, 2.5, 2.5, 2.5, 3.13], rowH: [0.3, 0.65, 0.55, 0.55, 0.55, 0.55] });
addPage(s, 10);

// 11. 8가지 인사이트
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '11'); addTitle(s, '데이터에서 발견한 8가지 추가 인사이트'); addDesc(s, '세 가지 괴리 외에 발견된 추가 패턴');
s.addTable([
  ['#','인사이트','근거'],
  ['1','"긍정"의 내용이 달랐다','5000~7000 긍정은 정치 공격 도구. 8000 좋아요 339개 소멸'],
  ['2','부정 공감이 긍정에 근접','5000 긍정1위 6,636 vs 부정1위 6,271 (차이 5.5%)'],
  ['3','뉴스 경고 전환 = 조기 경보','"급락(106)"이 "돌파(108)"와 동수 진입 → 미디어 간 공명'],
  ['4','참여율의 역설','조회수 83%↓ 인데 참여율(2.92~3.29%) 불변 → 선별적 관심'],
  ['5','돌파 간격이 반응 결정','21일:60%↓ / 47일:소폭 반등 / 7일:62%↓ — 재축적 최소 1개월'],
  ['6','콘텐츠 공급자 전환','MBCNEWS → 풍자 유튜버 → 경제 전문 유튜버(전인구·삼프로TV) 독점'],
  ['7','장편 분석 영상 급증','10분+ 장편 비율: 5000(34%) → 8000(70%). 숏폼: 18%→12%'],
  ['8','정치 프레임이 체감을 가린다','정치 키워드가 투자의 2배. 폭락 충격 후 "매도·급락"이 "이재명"을 밀어냄']
], { x: M, y: Y_CONTENT, w: CW, ...tblOpt, fontSize: 9, colW: [0.5, 3.0, 8.63] });
addPage(s, 11);

// 12. 결론
s = pptx.addSlide(); s.background = { fill: BG }; addTopbar(s); addNum(s, '12'); addTitle(s, '결론 — 세 가지 괴리와 PR 시사점'); addDesc(s, '21,201건을 다층적으로 분석한 결과');
s.addText('세 가지 괴리', { x: M, y: Y_CONTENT - 0.05, w: HALF, h: 0.35, fontSize: 13, bold: true, color: PRIMARY, align: 'center' , fontFace: FONT });
s.addText('1. 지수 vs 감성\n지수 60%↑, 참여 95%↓ — 감성 피로\n\n2. 뉴스 vs 대중\n축하 → 냉소 → 8000에서 경고 공명\n\n3. 담론 vs 체감\n"누구의 공인가" → "내 돈은 어떻게 되는가"', { x: M, y: 2.2, w: HALF, h: 3.5, fontSize: 11, color: HL_TEXT, fill: { color: HL_BG }, align: 'center', valign: 'middle', lineSpacingMultiple: 1.5 , fontFace: FONT });
s.addText('PR 시사점', { x: X2, y: Y_CONTENT - 0.05, w: HALF, h: 0.35, fontSize: 13, bold: true, color: PRIMARY, align: 'center' , fontFace: FONT });
s.addText('뉴스에서 좋게 나왔다고 여론이 좋은 것이 아니다\n→ 좋아요 가중 공감도를 봐야 한다\n\n뉴스 경고 키워드가 긍정과 동수가 되는 시점\n→ 위기 조기 감지 신호\n\n어떤 이슈든 정치적 프레임을 먼저 걷어내야\n→ 실제 여론이 보인다', { x: X2, y: 2.2, w: HALF, h: 3.5, fontSize: 11, color: WARN_TEXT, fill: { color: WARN_BG }, align: 'center', valign: 'middle', lineSpacingMultiple: 1.5 , fontFace: FONT });
addPage(s, 12);

// 13. 감사합니다
s = pptx.addSlide(); s.background = { fill: COVER_BG };
s.addText('감사합니다', { x: 0, y: 2.5, w: '100%', h: 1.0, fontSize: 36, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' , fontFace: FONT });
s.addText('고려대학교 미디어대학원 6조 | 이성훈 · 김성희', { x: 0, y: 3.8, w: '100%', h: 0.5, fontSize: 13, color: 'C7D2FE', align: 'center', valign: 'middle' , fontFace: FONT });

const outPath = '발표용 자료/발표_슬라이드_10분.pptx';
pptx.writeFile({ fileName: outPath }).then(() => console.log(outPath + ' ✓')).catch(e => console.error(e));
