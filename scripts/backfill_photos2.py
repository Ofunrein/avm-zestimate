#!/usr/bin/env python3
"""
Backfill photo_url for ALL predictions rows that still have dead _p_f.jpg images.
Retries with 'Austin TX' suffix; falls back to Google Street View embed URL.
"""
import os, time, urllib.parse, requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://lisforfokxoibdlmtkag.supabase.co")
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
APIFY_TOKEN  = os.environ["APIFY_API_TOKEN"]

ACTOR_URL = (
    "https://api.apify.com/v2/acts/maxcopell~zillow-detail-scraper"
    f"/run-sync-get-dataset-items?token={APIFY_TOKEN}&timeout=60&memory=1024"
)
SB_HDR = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

STREETVIEW = "https://maps.googleapis.com/maps/api/streetview?size=640x400&location={loc}&fov=90&heading=235&pitch=10"


def fetch_all_dead():
    """Paginate through all predictions rows with dead _p_f.jpg URLs."""
    dead = []
    offset = 0
    while True:
        rows = requests.get(
            f"{SUPABASE_URL}/rest/v1/predictions"
            f"?select=address,photo_url&photo_url=like.*_p_f.jpg"
            f"&address=not.is.null&limit=200&offset={offset}&order=id",
            headers=SB_HDR,
        ).json()
        if not rows:
            break
        dead.extend(rows)
        if len(rows) < 200:
            break
        offset += 200
    return dead


def apify_scrape(address: str):
    for query in [address, f"{address}, Austin TX"]:
        for status in ("FOR_SALE", "RECENTLY_SOLD"):
            try:
                r = requests.post(
                    ACTOR_URL,
                    json={"addresses": [query], "propertyStatus": status},
                    timeout=75,
                )
                items = r.json()
                if not isinstance(items, list) or not items:
                    continue
                item = items[0]
                img = (
                    (item.get("responsivePhotos") or [{}])[0].get("url")
                    or item.get("hiResImageLink")
                    or item.get("imgSrc")
                )
                if img and isinstance(img, str) and img.startswith("http"):
                    return img
            except Exception as e:
                print(f"    [{status}] {e}")
    return None


def streetview_url(address: str) -> str:
    loc = urllib.parse.quote(f"{address}, Austin TX")
    return STREETVIEW.format(loc=loc)


def patch(address: str, photo_url: str):
    enc = urllib.parse.quote(address, safe="")
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/predictions?address=eq.{enc}",
        json={"photo_url": photo_url},
        headers={**SB_HDR, "Prefer": "return=minimal"},
    )


def main():
    dead = fetch_all_dead()
    print(f"{len(dead)} rows with dead _p_f.jpg to fix")

    for i, row in enumerate(dead):
        addr = row["address"]
        print(f"[{i+1}/{len(dead)}] {addr}")

        img = apify_scrape(addr)
        if img:
            patch(addr, img)
            print(f"  → zillow: {img[:80]}")
        else:
            sv = streetview_url(addr)
            patch(addr, sv)
            print(f"  → streetview fallback")
        time.sleep(0.4)

    print("Done.")


if __name__ == "__main__":
    main()
