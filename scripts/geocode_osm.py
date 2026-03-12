import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


def normalize_text(value):
    return " ".join(str(value or "").strip().split())


def parse_tsv(text):
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    headers = [normalize_text(h) for h in lines[0].split("\t")]
    rows = []
    for line in lines[1:]:
        parts = line.split("\t")
        if len(parts) < len(headers):
            continue
        row = {}
        for idx, header in enumerate(headers):
            row[header] = normalize_text(parts[idx])
        rows.append(row)
    return rows


def build_address(row):
    scheme = normalize_text(row.get("Scheme Name/Area"))
    road = normalize_text(row.get("Road Name"))
    mukim = normalize_text(row.get("Mukim"))
    district = normalize_text(row.get("District"))
    parts = [scheme, road, mukim, district, "Malaysia"]
    parts = [p for p in parts if p]
    return ", ".join(parts)


def load_cache(path):
    if not path.exists():
        return {"generated_at": None, "source": "nominatim", "addresses": {}}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_cache(path, cache):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(cache, handle, indent=2)


RATE_LIMITED = object()


def geocode_address(address, email, user_agent, retries=3):
    params = {
        "format": "jsonv2",
        "q": address,
        "limit": 1
    }
    if email:
        params["email"] = email
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, headers={"User-Agent": user_agent})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                payload = response.read().decode("utf-8")
            results = json.loads(payload)
            if not results:
                return None
            hit = results[0]
            return {
                "lat": float(hit["lat"]),
                "lng": float(hit["lon"]),
                "display_name": hit.get("display_name", "")
            }
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                if attempt < retries:
                    time.sleep(20 * (attempt + 1))
                    continue
                return RATE_LIMITED
            raise
        except (KeyError, ValueError, TypeError):
            return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="assets/data/open-transaction-data.csv")
    parser.add_argument("--output", default="assets/data/osm-geocode-cache.json")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of new addresses to geocode")
    parser.add_argument("--sleep", type=float, default=3.0, help="Delay between requests in seconds")
    parser.add_argument("--email", default="", help="Email required by Nominatim usage policy")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    text = input_path.read_text(encoding="utf-16")
    rows = parse_tsv(text)
    addresses = [build_address(row) for row in rows]
    addresses = [addr for addr in addresses if addr]

    cache = load_cache(output_path)
    address_cache = cache.get("addresses", {})

    unique_addresses = []
    seen = set()
    for addr in addresses:
        if addr in seen:
            continue
        seen.add(addr)
        unique_addresses.append(addr)

    pending = [addr for addr in unique_addresses if addr not in address_cache]
    if args.limit and args.limit > 0:
        pending = pending[: args.limit]

    if not pending:
        print("No new addresses to geocode.")
        return

    user_agent = "projetsiteCVPacome/1.0"
    if args.email:
        user_agent = f"{user_agent} ({args.email})"

    for idx, address in enumerate(pending, start=1):
        print(f"[{idx}/{len(pending)}] {address}")
        result = geocode_address(address, args.email, user_agent)
        if result is RATE_LIMITED:
            print("Rate limited by Nominatim. Stopping to avoid blocking. Rerun later.")
            break
        if result:
            address_cache[address] = {
                "lat": result["lat"],
                "lng": result["lng"],
                "display_name": result["display_name"]
            }
        else:
            address_cache[address] = {
                "lat": None,
                "lng": None,
                "display_name": ""
            }
        save_cache(output_path, {
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "source": "nominatim",
            "addresses": address_cache
        })
        time.sleep(args.sleep)

    print(f"Geocoding complete. Cache saved to {output_path}")


if __name__ == "__main__":
    main()
