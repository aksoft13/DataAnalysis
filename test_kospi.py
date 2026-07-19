#!/usr/bin/env python3
"""Playwright 자동 테스트: 코스피 5000/6000/7000"""
import asyncio
from playwright.async_api import async_playwright
import os

URL = "http://localhost:3007"
SSDIR = os.path.join(os.path.dirname(__file__), "screenshot")
os.makedirs(SSDIR, exist_ok=True)

GROUPS = [
    {"label": "코스피 5000", "keyword": "코스피 5000", "dateFrom": "2026-01-15", "dateTo": "2026-02-05"},
    {"label": "코스피 6000", "keyword": "코스피 6000", "dateFrom": "2026-02-18", "dateTo": "2026-03-11"},
    {"label": "코스피 7000", "keyword": "코스피 7000", "dateFrom": "2026-04-29", "dateTo": "2026-05-20"},
]

async def ss(page, name):
    await page.screenshot(path=os.path.join(SSDIR, f"{name}.png"), full_page=True)
    print(f"  📸 {name}.png")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        print("1. 앱 열기...")
        await page.goto(URL)
        await page.wait_for_timeout(1000)
        await ss(page, "01_메인화면")

        print("2. 연구 질문 입력...")
        await page.fill("#researchQuestion",
            "코스피 5,000 / 6,000 / 7,000 돌파 시점에서 뉴스와 유튜브에서의 대중 반응은 어떻게 달라지는가?")
        await ss(page, "02_연구질문")

        print("3. 비교 그룹 설정 (JS로 직접 설정)...")
        await page.click("text=다음: 비교 그룹 설정")
        await page.wait_for_timeout(500)

        # JS로 직접 그룹 데이터 설정
        await page.evaluate("""() => {
            groups = [
                { label: '코스피 5000', keyword: '코스피 5000', dateFrom: '2026-01-15', dateTo: '2026-02-05',
                  sources: { gnews: true, youtube: true }, ytKeyword: '', ytMaxResults: 5, ytMaxComments: 50 },
                { label: '코스피 6000', keyword: '코스피 6000', dateFrom: '2026-02-18', dateTo: '2026-03-11',
                  sources: { gnews: true, youtube: true }, ytKeyword: '', ytMaxResults: 5, ytMaxComments: 50 },
                { label: '코스피 7000', keyword: '코스피 7000', dateFrom: '2026-04-29', dateTo: '2026-05-20',
                  sources: { gnews: true, youtube: true }, ytKeyword: '', ytMaxResults: 5, ytMaxComments: 50 },
            ];
            renderGroups();
        }""")
        await page.wait_for_timeout(500)
        await ss(page, "03_그룹설정")

        print("4. 데이터 수집 시작...")
        await page.click("text=데이터 수집 시작")

        print("   수집 중... (최대 4분 대기)")
        for _ in range(240):
            await page.wait_for_timeout(1000)
            log_text = await page.text_content("#collectLog") or ""
            if "모든 그룹 수집 완료" in log_text:
                print("   수집 완료!")
                break

        await page.wait_for_timeout(2000)
        await ss(page, "04_수집완료")

        # 프리뷰 스크롤
        await page.evaluate("document.getElementById('collectPreview')?.scrollIntoView()")
        await page.wait_for_timeout(500)
        await ss(page, "05_수집프리뷰")

        print("5. 분석 실행...")
        btn = page.locator("text=다음: 분석 실행")
        if await btn.count() > 0:
            await btn.click()
        else:
            await page.evaluate("runAnalysis()")

        print("   분석 중...")
        for _ in range(90):
            await page.wait_for_timeout(1000)
            content = await page.text_content("#resultPanels") or ""
            if len(content) > 200:
                break

        await page.wait_for_timeout(3000)
        await ss(page, "06_분석결과_개요")

        print("6. 결과 탭 스크린샷...")
        tabs = page.locator(".r-tab")
        count = await tabs.count()
        tab_names = ["개요", "시계열", "유튜브", "EDA", "코스피5000_키워드", "코스피6000_키워드", "코스피7000_키워드", "SNA_네트워크"]

        for i in range(count):
            name = tab_names[i] if i < len(tab_names) else f"탭{i}"
            await tabs.nth(i).click()
            await page.wait_for_timeout(2000)
            # 차트 강제 리사이즈 + 재생성
            await page.evaluate("""() => {
                try { Object.values(chartInstances).forEach(c => { try{c.resize()}catch{} }); } catch{}
                try { drawOverviewCharts(); } catch{}
                try { drawEdaCharts(); } catch{}
            }""")
            await page.wait_for_timeout(5000)
            await ss(page, f"07_{i+1}_{name}")

        print("7. AI 프롬프트...")
        step_tabs = page.locator(".step-tab")
        await step_tabs.nth(4).click()
        await page.wait_for_timeout(2000)
        await ss(page, "08_AI프롬프트")

        print("\n✅ 테스트 완료! screenshot/ 폴더를 확인하세요.")
        await browser.close()

asyncio.run(main())
