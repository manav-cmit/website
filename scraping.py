import requests
import json
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "https://www.dorsanfiltration.com"
START_URL = "https://www.dorsanfiltration.com/en/products/products-by-type/"

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0"
})


def clean(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()


def get_product_links():
    links = set()

    html = session.get(START_URL, timeout=30).text
    soup = BeautifulSoup(html, "html.parser")

    for a in soup.find_all("a", href=True):
        href = a["href"]

        if "/en/products/" in href:
            full = urljoin(BASE_URL, href)

            if full != START_URL:
                links.add(full)

    return sorted(list(links))


def extract_text_section(soup, keywords):
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "strong"]):
        title = clean(tag.get_text()).lower()

        if any(k in title for k in keywords):

            texts = []

            current = tag.find_next()

            for _ in range(20):

                if not current:
                    break

                if current.name in ["h1", "h2", "h3", "h4"]:
                    break

                txt = clean(current.get_text())

                if txt:
                    texts.append(txt)

                current = current.find_next()

            return texts

    return []


def extract_specifications(soup):
    specs = {}

    tables = soup.find_all("table")

    for table in tables:

        rows = table.find_all("tr")

        for row in rows:

            cols = row.find_all(["td", "th"])

            if len(cols) >= 2:
                key = clean(cols[0].get_text())
                value = clean(cols[1].get_text())

                if key and value:
                    specs[key] = value

    return specs


def extract_images(soup):
    images = []

    for img in soup.find_all("img"):

        src = img.get("src")

        if src:
            images.append(urljoin(BASE_URL, src))

    return list(set(images))


def extract_downloads(soup):
    files = []

    for a in soup.find_all("a", href=True):

        href = a["href"].lower()

        if (
            ".pdf" in href
            or ".doc" in href
            or ".docx" in href
            or ".xls" in href
            or ".xlsx" in href
        ):
            files.append({
                "title": clean(a.get_text()),
                "url": urljoin(BASE_URL, a["href"])
            })

    return files


def extract_related_products(soup):
    related = []

    for a in soup.find_all("a", href=True):

        href = a["href"]

        if "/en/products/" in href:

            related.append({
                "name": clean(a.get_text()),
                "url": urljoin(BASE_URL, href)
            })

    unique = {}

    for item in related:
        unique[item["url"]] = item

    return list(unique.values())


def scrape_product(url):

    print("Processing:", url)

    html = session.get(url, timeout=30).text

    soup = BeautifulSoup(html, "html.parser")

    title = ""

    h1 = soup.find("h1")

    if h1:
        title = clean(h1.get_text())

    description = ""

    paragraphs = []

    for p in soup.find_all("p"):

        txt = clean(p.get_text())

        if len(txt) > 30:
            paragraphs.append(txt)

    description = "\n".join(paragraphs)

    category = ""

    breadcrumb = soup.select("nav a, .breadcrumb a")

    if breadcrumb:
        category = clean(breadcrumb[-1].get_text())

    meta_desc = ""

    meta = soup.find("meta", attrs={"name": "description"})

    if meta:
        meta_desc = meta.get("content", "")

    keywords = []

    meta_kw = soup.find("meta", attrs={"name": "keywords"})

    if meta_kw:
        keywords = [
            x.strip()
            for x in meta_kw.get("content", "").split(",")
            if x.strip()
        ]

    features = extract_text_section(
        soup,
        ["feature", "benefit", "advantage"]
    )

    applications = extract_text_section(
        soup,
        ["application", "uses"]
    )

    industries = extract_text_section(
        soup,
        ["industry", "industries"]
    )

    specifications = extract_specifications(soup)

    materials = []

    for key, value in specifications.items():

        if any(
            x in key.lower()
            for x in ["material", "membrane"]
        ):
            materials.append(value)

    return {
        "product_name": title,
        "product_category": category,
        "product_description": description,
        "features": features,
        "applications": applications,
        "specifications": specifications,
        "material": list(set(materials)),
        "image_urls": extract_images(soup),
        "product_url": url,
        "downloads": extract_downloads(soup),
        "industries": industries,
        "seo_meta_description": meta_desc,
        "keywords": keywords,
        "related_products": extract_related_products(soup)
    }


def main():

    urls = get_product_links()

    print("Found", len(urls), "product URLs")

    products = []

    for url in urls:

        try:
            product = scrape_product(url)
            products.append(product)

        except Exception as e:
            print("ERROR:", url, e)

    with open(
        "products.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            products,
            f,
            indent=2,
            ensure_ascii=False
        )

    print("Saved products.json")


if __name__ == "__main__":
    main()