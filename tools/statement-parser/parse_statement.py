#!/usr/bin/env python3
"""
Local Bank Statement Parser (Privacy-First)

Parses bank statements, categorizes locally, and outputs anonymized data.
Merchant names never leave your machine.

Usage:
    python parse_statement.py <statement.csv>
    python parse_statement.py <statement.csv> --csv  # Also generate CSV for import

Output: Creates <statement>.json with categorized transactions.

Features:
- Auto-detects statement format (Amex, CommBank, Pocketbook)
- Fetches valid categories from server
- Uses Apple Foundation Models for ALL categorization
- Searches the web for context on unknown merchants
- Excludes transfers/income from expense output
"""

import argparse
import csv
import json
import re
import subprocess
import sys
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Set


# Known statement formats
FORMATS = {
    "amex": {
        "date_col": "Date",
        "amount_col": "Amount",
        "description_col": "Description",
        "date_format": "%d/%m/%Y",
        "cardholder_col": "Card Member",
    },
    "commbank": {
        "date_col": "Date",
        "amount_col": "Amount",
        "description_col": "Description",
        "date_format": "%d/%m/%Y",
    },
    "pocketbook": {
        "date_col": "Transaction Date",
        "debit_col": "Debit",
        "credit_col": "Credit",
        "description_col": "Details",
        "category_col": "Category",
        "subcategory_col": "Subcategory",
        "date_format": "%d %b %Y",  # "11 Dec 2025"
    },
}


def fetch_categories_from_server(server_url: str) -> List[str]:
    """Fetch valid categories from the server's REST API."""
    try:
        req = urllib.request.Request(
            server_url,
            headers={'Accept': 'application/json'},
            method='GET'
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get('categories', [])

    except Exception as e:
        print(f"Warning: Could not fetch categories from server: {e}", file=sys.stderr)
        return []


def search_merchant_info(merchant: str) -> Optional[str]:
    """Search the web for information about a merchant using DuckDuckGo."""
    try:
        # Use DuckDuckGo's lite/html version - no API key needed
        query = urllib.parse.quote(f"{merchant} business store company")
        url = f"https://html.duckduckgo.com/html/?q={query}"

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')

            # Extract snippets from DuckDuckGo results
            # Look for result snippets in the HTML
            snippets = []

            # Extract result snippets (text between result-snippet class)
            snippet_matches = re.findall(r'class="result__snippet"[^>]*>([^<]+)<', html)
            for snippet in snippet_matches[:3]:  # Take top 3 results
                # Clean up HTML entities
                snippet = snippet.replace('&amp;', '&').replace('&quot;', '"')
                snippet = snippet.replace('&#x27;', "'").replace('&lt;', '<').replace('&gt;', '>')
                snippets.append(snippet.strip())

            if snippets:
                return " | ".join(snippets)

            return None

    except Exception as e:
        # Silently fail - web search is optional enhancement
        return None


def categorize_with_afm(descriptions: Set[str], valid_categories: List[str],
                        use_web_search: bool = False) -> Dict[str, str]:
    """Use Apple Foundation Models (via afm CLI) to categorize unknown merchants."""
    # Check if afm is available
    try:
        result = subprocess.run(['which', 'afm'], capture_output=True, text=True)
        if result.returncode != 0:
            print("Error: afm not found. Install with: brew tap scouzi1966/afm && brew install afm", file=sys.stderr)
            return {}
    except Exception as e:
        print(f"Error checking for afm: {e}", file=sys.stderr)
        return {}

    results = {}
    categories_list = ", ".join(c for c in valid_categories if c != "Uncategorized")

    print(f"Categorizing {len(descriptions)} unknown merchants with Apple Foundation Models...")

    # Batch all descriptions into a single prompt for efficiency
    if len(descriptions) > 1:
        # For multiple items, batch them
        batch_prompt = f"""Categorize each merchant into exactly one category from this list:
{categories_list}

Merchants to categorize:
"""
        for i, desc in enumerate(descriptions, 1):
            batch_prompt += f"{i}. {desc}\n"

        batch_prompt += "\nRespond with ONLY the category for each, one per line, in the same order. No explanations."

        try:
            result = subprocess.run(
                ['afm', '-s', batch_prompt],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                desc_list = list(descriptions)

                for i, (desc, line) in enumerate(zip(desc_list, lines)):
                    # Clean up the response line
                    category = line.strip()
                    # Remove any numbering prefix like "1. " or "1: "
                    if category and category[0].isdigit():
                        category = category.lstrip('0123456789.-): ').strip()

                    # Validate it's a known category
                    matched_category = match_category(category, valid_categories)
                    results[desc] = matched_category
                    print(f"  {desc[:35]:<35} → {matched_category}")

        except subprocess.TimeoutExpired:
            print("AFM batch timed out, falling back to individual requests", file=sys.stderr)
        except Exception as e:
            print(f"AFM batch error: {e}, falling back to individual requests", file=sys.stderr)

    # Process any remaining (not batch processed) or fallback to individual
    remaining = [d for d in descriptions if d not in results]
    for desc in remaining:
        prompt = f"""Categorize this merchant into exactly one category.

Merchant: {desc}

Categories: {categories_list}

Reply with ONLY the category name, nothing else."""

        try:
            result = subprocess.run(
                ['afm', '-s', prompt],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                category = result.stdout.strip()
                matched_category = match_category(category, valid_categories)
                results[desc] = matched_category
                print(f"  {desc[:35]:<35} → {matched_category}")
            else:
                print(f"  {desc[:35]:<35} → Uncategorized (AFM error)")
                results[desc] = "Uncategorized"

        except subprocess.TimeoutExpired:
            print(f"  {desc[:35]:<35} → Uncategorized (timeout)")
            results[desc] = "Uncategorized"
        except Exception as e:
            print(f"  Error categorizing '{desc[:30]}': {e}", file=sys.stderr)
            results[desc] = "Uncategorized"

    # Web search retry for items that are still uncategorized
    if use_web_search:
        uncategorized = [desc for desc, cat in results.items() if cat == "Uncategorized"]
        if uncategorized:
            print(f"\nRetrying {len(uncategorized)} uncategorized merchants with web search...")

            for desc in uncategorized:
                # Search for merchant info
                web_info = search_merchant_info(desc)
                if not web_info:
                    print(f"  {desc[:35]:<35} → Uncategorized (no web results)")
                    continue

                # Retry with web context
                prompt = f"""Categorize this merchant into exactly one category.

Merchant: {desc}

Web search results about this merchant:
{web_info[:500]}

Categories: {categories_list}

Based on the web search results, what type of business is this? Reply with ONLY the category name, nothing else."""

                try:
                    result = subprocess.run(
                        ['afm', '-s', prompt],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )

                    if result.returncode == 0:
                        category = result.stdout.strip()
                        matched_category = match_category(category, valid_categories)
                        if matched_category != "Uncategorized":
                            results[desc] = matched_category
                            print(f"  {desc[:35]:<35} → {matched_category} (via web search)")
                        else:
                            print(f"  {desc[:35]:<35} → Uncategorized (still unknown)")
                    else:
                        print(f"  {desc[:35]:<35} → Uncategorized (AFM error)")

                except subprocess.TimeoutExpired:
                    print(f"  {desc[:35]:<35} → Uncategorized (timeout)")
                except Exception as e:
                    print(f"  Error recategorizing '{desc[:30]}': {e}", file=sys.stderr)

    return results


def match_category(response: str, valid_categories: List[str]) -> str:
    """Match LLM response to a valid category."""
    response = response.strip()

    # Exact match
    if response in valid_categories:
        return response

    # Case-insensitive match
    for valid in valid_categories:
        if valid.lower() == response.lower():
            return valid

    # Partial match
    for valid in valid_categories:
        if valid.lower() in response.lower() or response.lower() in valid.lower():
            return valid

    return "Uncategorized"


def detect_format(headers: List[str]) -> Optional[str]:
    """Auto-detect statement format from CSV headers."""
    headers_lower = [h.lower() for h in headers]

    if "card member" in headers_lower:
        return "amex"
    if "transaction date" in headers_lower and "debit" in headers_lower:
        return "pocketbook"
    if "date" in headers_lower and "amount" in headers_lower:
        return "commbank"

    return None


def parse_date(date_str: str, fmt: str) -> str:
    """Parse date string and return YYYY-MM-DD format."""
    try:
        dt = datetime.strptime(date_str.strip(), fmt)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        for alt_fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"]:
            try:
                dt = datetime.strptime(date_str.strip(), alt_fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return date_str


def parse_csv(file_path: Path, categories: List[str], use_web_search: bool = True) -> Dict:
    """Parse CSV bank statement and return anonymized, categorized data.

    All categorization is done via LLM using the provided categories list.
    """
    transactions = []
    category_counts = {}

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        detected = detect_format(headers)
        if not detected:
            print(f"Error: Could not detect format. Headers: {headers}", file=sys.stderr)
            sys.exit(1)
        fmt = FORMATS[detected]
        print(f"Detected format: {detected}")

        date_col = fmt["date_col"]
        desc_col = fmt["description_col"]
        date_fmt = fmt["date_format"]

        # Check if this format has separate debit/credit columns
        has_debit_credit = "debit_col" in fmt

        for row in reader:
            try:
                # Parse amount - handle single column or debit/credit split
                if has_debit_credit:
                    debit_str = row.get(fmt["debit_col"], "").strip()
                    credit_str = row.get(fmt["credit_col"], "").strip()

                    if debit_str:
                        amount = float(debit_str.replace("$", "").replace(",", ""))
                        is_expense = True
                    elif credit_str:
                        amount = float(credit_str.replace("$", "").replace(",", ""))
                        is_expense = False
                    else:
                        continue  # Skip rows with no amount
                else:
                    amount_str = row.get(fmt.get("amount_col", "Amount"), "0").strip()
                    amount_str = amount_str.replace("$", "").replace(",", "")
                    amount = float(amount_str)
                    is_expense = amount > 0

                date = parse_date(row.get(date_col, ""), date_fmt)
                description = row.get(desc_col, "").strip()

                transactions.append({
                    "date": date,
                    "amount": abs(amount),
                    "is_expense": is_expense,
                    "_description": description,
                })

            except (ValueError, KeyError) as e:
                print(f"Warning: Skipping row: {e}", file=sys.stderr)
                continue

    # Categorize ALL transactions with LLM
    all_descriptions = set(tx["_description"] for tx in transactions)
    print(f"Found {len(transactions)} transactions with {len(all_descriptions)} unique merchants")

    llm_categories = categorize_with_afm(all_descriptions, categories, use_web_search)

    # Apply categories to transactions
    for tx in transactions:
        desc = tx["_description"]
        tx["category"] = llm_categories.get(desc, "Uncategorized")

    # Build final output - remove descriptions for privacy
    expenses = []
    income = []
    excluded_count = 0

    for tx in transactions:
        # Skip transfers/income
        if tx["category"] in ("Transfer", "Income"):
            excluded_count += 1
            continue

        # Count categories
        category_counts[tx["category"]] = category_counts.get(tx["category"], 0) + 1

        # Build anonymized transaction
        anonymized = {
            "date": tx["date"],
            "amount": tx["amount"],
            "category": tx["category"],
        }

        if tx["is_expense"]:
            expenses.append(anonymized)
        else:
            income.append(anonymized)

    if excluded_count > 0:
        print(f"Excluded {excluded_count} transfer/income transactions")

    # Get remaining uncategorized hints
    uncategorized_hints = set()
    for tx in transactions:
        if tx["category"] == "Uncategorized":
            hint = tx["_description"].split()[0] if tx["_description"] else "Unknown"
            uncategorized_hints.add(hint)

    return {
        "expenses": expenses,
        "income": income,
        "summary": {
            "total_expenses": len(expenses),
            "total_income": len(income),
            "expense_total": round(sum(e["amount"] for e in expenses), 2),
            "income_total": round(sum(i["amount"] for i in income), 2),
            "by_category": category_counts,
        },
        "uncategorized_hints": list(uncategorized_hints)[:20],
    }


def generate_csv_for_import(expenses: List[Dict], output_path: Path) -> None:
    """Generate CSV file compatible with expense_import tool."""
    csv_path = output_path.with_suffix(".csv")

    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "amount", "category"])
        writer.writeheader()
        for tx in expenses:
            writer.writerow({
                "date": tx["date"],
                "amount": tx["amount"],
                "category": tx["category"],
            })

    print(f"CSV for import saved to: {csv_path}")


SERVER_URL = "https://mcp-tools-one.vercel.app/api/budget/categories"


def main():
    parser = argparse.ArgumentParser(
        description="Parse bank statements with local categorization (privacy-first)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python parse_statement.py statement.csv
  python parse_statement.py statement.csv --csv

Privacy: Merchant names are used for categorization locally but NEVER included
in the output. Only categories and amounts are exported.

Uses Apple Foundation Models via the 'afm' CLI tool for categorization.
Install with: brew tap scouzi1966/afm && brew install afm
        """
    )
    parser.add_argument("file", type=Path, help="Bank statement CSV file")
    parser.add_argument("--csv", action="store_true", help="Also generate CSV for import")

    args = parser.parse_args()

    if not args.file.exists():
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    # Fetch categories from server
    print(f"Fetching categories from server...")
    categories = fetch_categories_from_server(SERVER_URL)
    if not categories:
        print("Error: Could not fetch categories from server", file=sys.stderr)
        sys.exit(1)
    print(f"Using {len(categories)} categories: {', '.join(categories)}")

    print(f"Processing: {args.file}")

    result = parse_csv(args.file, categories)

    # Output to JSON file with same name as input
    output_path = args.file.with_suffix(".json")
    output_json = json.dumps(result, indent=2)

    with open(output_path, "w") as f:
        f.write(output_json)
    print(f"JSON saved to: {output_path}")

    if args.csv and result["expenses"]:
        generate_csv_for_import(result["expenses"], output_path)

    # Print summary
    print("\n" + "-" * 40)
    print("Summary:")
    print(f"  Expenses: {result['summary']['total_expenses']} transactions, ${result['summary']['expense_total']:.2f}")
    print(f"  Income:   {result['summary']['total_income']} transactions, ${result['summary']['income_total']:.2f}")

    print("\nBy Category:")
    for cat, count in sorted(result['summary']['by_category'].items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    if result.get("uncategorized_hints"):
        print(f"\nUncategorized merchants (add to categories.json):")
        for hint in result["uncategorized_hints"]:
            print(f"  - {hint}")


if __name__ == "__main__":
    main()
