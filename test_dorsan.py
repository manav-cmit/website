from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False
    )

    page = browser.new_page()

    page.goto(
        "https://www.dorsanfiltration.com/en/products/products-by-type/",
        wait_until="networkidle",
        timeout=120000
    )

    print(page.title())

    input("Press Enter after page loads...")

    html = page.content()

    with open("real_page.html", "w", encoding="utf-8") as f:
        f.write(html)

    browser.close()