#!/usr/bin/env python3
"""
Local Bank Statement Parser (Privacy-First)

Parses bank statements, categorizes locally, and outputs anonymized data.
Merchant names never leave your machine.

Usage:
    python parse_statement.py <statement_file> [--output OUTPUT]
    python parse_statement.py <statement_file> --llm  # Use Apple Foundation Models for unknowns

Examples:
    python parse_statement.py statement.csv
    python parse_statement.py statement.csv --llm
    python parse_statement.py statement.csv --fetch-categories  # Sync categories from MCP server
"""

import argparse
import csv
import json
import subprocess
import sys
import urllib.request
import urllib.error
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

# Categories the LLM can choose from
VALID_CATEGORIES = [
    "Groceries", "Coffee", "Dining Out", "Food Delivery",
    "Alcohol", "Treats", "Shopping", "Transport", "Fuel",
    "Utilities", "Subscriptions", "Health & Beauty", "Health",
    "Kids", "Insurance", "Entertainment", "Travel", "Education",
    "Gifts", "Home", "Pets", "Fitness", "Transfer", "Income", "Uncategorized"
]


# Map external category names to our categories
CATEGORY_MAPPING = {
    # Food & Drink
    ("Food & Drink", "Coffee & Tea"): "Coffee",
    ("Food & Drink", "Groceries"): "Groceries",
    ("Food & Drink", "Restaurants"): "Dining Out",
    ("Food & Drink", "Fast Food"): "Dining Out",
    ("Food & Drink", "Bars & Pubs"): "Alcohol",
    ("Food & Drink", "Alcohol"): "Alcohol",
    ("Food & Drink", "Snacks"): "Treats",
    ("Food & Drink", "Tobacco"): "Treats",
    ("Food & Drink", "Other Food Expenses"): "Dining Out",
    ("Food & Drink", ""): "Dining Out",

    # Transportation
    ("Transportation", "Public Transit"): "Transport",
    ("Transportation", "Fuel"): "Fuel",
    ("Transportation", "Parking"): "Transport",
    ("Transportation", "Parking & Tolls"): "Transport",
    ("Transportation", "Taxi & Rideshare"): "Transport",
    ("Transportation", "Auto Supplies"): "Transport",
    ("Transportation", ""): "Transport",

    # Shopping
    ("Shopping", "Clothing"): "Shopping",
    ("Shopping", "Electronics"): "Shopping",
    ("Shopping", "General"): "Shopping",
    ("Shopping", ""): "Shopping",

    # Bills & Utilities
    ("Bills & Utilities", "Phone"): "Utilities",
    ("Bills & Utilities", "Internet"): "Utilities",
    ("Bills & Utilities", "Electricity"): "Utilities",
    ("Bills & Utilities", "Gas"): "Utilities",
    ("Bills & Utilities", ""): "Utilities",

    # Entertainment & Leisure
    ("Entertainment", "Streaming"): "Subscriptions",
    ("Entertainment", "Movies"): "Entertainment",
    ("Entertainment", ""): "Entertainment",
    ("Leisure", "Games"): "Entertainment",
    ("Leisure", "Books & News"): "Entertainment",
    ("Leisure", "Art"): "Entertainment",
    ("Leisure", ""): "Entertainment",

    # Health & Fitness
    ("Health & Fitness", "Pharmacy"): "Health",
    ("Health & Fitness", "Gym"): "Fitness",
    ("Health & Fitness", ""): "Health",
    ("Sports & Fitness", "Memberships"): "Fitness",
    ("Sports & Fitness", ""): "Fitness",
    ("Health & Medical", "Doctor"): "Health",
    ("Health & Medical", ""): "Health",

    # Personal
    ("Personal Care", ""): "Health & Beauty",
    ("Personal", "Beauty"): "Health & Beauty",
    ("Personal", "Clothing"): "Shopping",
    ("Personal", "Other Personal Expenses"): "Shopping",
    ("Personal", ""): "Shopping",

    # Financial
    ("Financial", "Transfers"): "Transfer",
    ("Financial", "Direct Debits"): "Utilities",
    ("Financial", ""): "Transfer",

    # Other
    ("Education", "Tuition & Fees"): "Education",
    ("Education", ""): "Education",
    ("Travel", "Accommodation"): "Travel",
    ("Travel", ""): "Travel",
    ("Gifts & Donations", ""): "Gifts",
    ("Home", "Furnishings"): "Home",
    ("Home", "Other Home Expenses"): "Home",
    ("Home", ""): "Home",
    ("Insurance", "Financial Insurance"): "Insurance",
    ("Insurance", ""): "Insurance",
    ("Tax", "Personal Taxes"): "Utilities",
    ("Tax", ""): "Utilities",
    ("Services", "Government"): "Utilities",
    ("Services", ""): "Shopping",
    ("Business", "Services"): "Shopping",
    ("Business", ""): "Shopping",
    ("Kids", ""): "Kids",
    ("Pets", ""): "Pets",
    ("Income", ""): "Income",
    ("Transfer", ""): "Transfer",
}


def map_external_category(category: str, subcategory: str) -> str:
    """Map external category/subcategory to our categories."""
    # Try exact match with subcategory
    key = (category, subcategory)
    if key in CATEGORY_MAPPING:
        return CATEGORY_MAPPING[key]

    # Try category with empty subcategory
    key = (category, "")
    if key in CATEGORY_MAPPING:
        return CATEGORY_MAPPING[key]

    # Try to match just the category name to our valid categories
    for valid_cat in VALID_CATEGORIES:
        if valid_cat.lower() in category.lower() or category.lower() in valid_cat.lower():
            return valid_cat

    return "Uncategorized"


def load_categories(config_path: Path) -> Dict:
    """Load categorization rules from JSON config."""
    if not config_path.exists():
        print(f"Warning: Categories file not found at {config_path}", file=sys.stderr)
        return {"rules": [], "default_category": "Uncategorized"}

    with open(config_path, "r") as f:
        return json.load(f)


def categorize(description: str, rules: List[Dict], default: str) -> str:
    """Match description against rules and return category."""
    desc_upper = description.upper()

    for rule in rules:
        pattern = rule["pattern"].upper()
        if pattern in desc_upper:
            return rule["category"]

    return default


def fetch_categories_from_server(server_url: str) -> List[str]:
    """Fetch valid categories from the MCP server."""
    try:
        # Call the MCP server's budget_list_category_names tool
        # MCP uses JSON-RPC, so we need to construct the proper request
        request_data = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "budget_list_category_names",
                "arguments": {}
            }
        }).encode('utf-8')

        req = urllib.request.Request(
            server_url,
            data=request_data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

            # Parse the response - MCP returns content as text
            if 'result' in data and 'content' in data['result']:
                content = data['result']['content']
                if content and len(content) > 0:
                    # Parse the JSON from the text content
                    result = json.loads(content[0].get('text', '{}'))
                    return result.get('categories', [])

        return []
    except urllib.error.URLError as e:
        print(f"Warning: Could not fetch categories from server: {e}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Warning: Error fetching categories: {e}", file=sys.stderr)
        return []


def categorize_with_afm(descriptions: Set[str], valid_categories: List[str]) -> Dict[str, str]:
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

                return results
            else:
                print(f"AFM batch error: {result.stderr}", file=sys.stderr)
        except subprocess.TimeoutExpired:
            print("AFM batch timed out, falling back to individual requests", file=sys.stderr)
        except Exception as e:
            print(f"AFM batch error: {e}, falling back to individual requests", file=sys.stderr)

    # Fallback: process one at a time
    for desc in descriptions:
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


def parse_csv(file_path: Path, format_name: Optional[str], categories_config: Dict,
              use_llm: bool = False, valid_categories: Optional[List[str]] = None,
              exclude_transfers: bool = False) -> Dict:
    """Parse CSV bank statement and return anonymized, categorized data."""
    transactions = []  # Store all transactions with original descriptions temporarily
    uncategorized_descriptions = set()
    category_counts = {}

    rules = categories_config.get("rules", [])
    default_category = categories_config.get("default_category", "Uncategorized")

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        if format_name:
            if format_name not in FORMATS:
                print(f"Error: Unknown format '{format_name}'.", file=sys.stderr)
                sys.exit(1)
            fmt = FORMATS[format_name]
        else:
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
        # Check if this format has pre-existing categories
        has_category_col = "category_col" in fmt

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

                # Get category - use existing if available, otherwise use rules
                if has_category_col:
                    existing_cat = row.get(fmt["category_col"], "").strip()
                    subcategory = row.get(fmt.get("subcategory_col", ""), "").strip()

                    # Map common category names to our categories
                    category = map_external_category(existing_cat, subcategory)

                    # If mapping failed, try our rules
                    if category == default_category:
                        category = categorize(description, rules, default_category)
                else:
                    category = categorize(description, rules, default_category)

                # Track uncategorized for LLM
                if category == default_category:
                    uncategorized_descriptions.add(description)

                transactions.append({
                    "date": date,
                    "amount": abs(amount),
                    "category": category,
                    "is_expense": is_expense,
                    "_description": description,  # Temporary, will be removed
                })

            except (ValueError, KeyError) as e:
                print(f"Warning: Skipping row: {e}", file=sys.stderr)
                continue

    # Use Apple Foundation Models for uncategorized if requested
    llm_categories = {}
    if use_llm and uncategorized_descriptions:
        # Use provided categories or fall back to built-in list
        cats_for_llm = valid_categories if valid_categories else VALID_CATEGORIES
        llm_categories = categorize_with_afm(uncategorized_descriptions, cats_for_llm)

        # Apply LLM categories
        for tx in transactions:
            if tx["category"] == default_category:
                desc = tx["_description"]
                if desc in llm_categories:
                    tx["category"] = llm_categories[desc]

    # Build final output - remove descriptions for privacy
    expenses = []
    income = []
    excluded_count = 0

    for tx in transactions:
        # Skip transfers if requested
        if exclude_transfers and tx["category"] in ("Transfer", "Income"):
            excluded_count += 1
            continue

        # Track uncategorized hints (only first word, for privacy)
        if tx["category"] == default_category:
            merchant_hint = tx["_description"].split()[0] if tx["_description"] else "Unknown"

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
        if tx["category"] == default_category:
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


def main():
    parser = argparse.ArgumentParser(
        description="Parse bank statements with local categorization (privacy-first)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python parse_statement.py statement.csv
  python parse_statement.py statement.csv --llm
  python parse_statement.py statement.csv --llm --fetch-categories

Privacy: Merchant names are used for categorization locally but NEVER included
in the output. Only categories and amounts are exported.

LLM: Uses Apple Foundation Models via the 'afm' CLI tool.
Install with: brew tap scouzi1966/afm && brew install afm
        """
    )
    parser.add_argument("file", type=Path, help="Bank statement CSV file")
    parser.add_argument("--format", "-f", choices=FORMATS.keys(), help="Statement format")
    parser.add_argument("--output", "-o", type=Path, help="Output JSON file")
    parser.add_argument("--csv", action="store_true", help="Also generate CSV for import")
    parser.add_argument("--categories", "-c", type=Path, help="Custom categories JSON file")
    parser.add_argument("--llm", action="store_true", help="Use Apple Foundation Models for uncategorized merchants")
    parser.add_argument("--fetch-categories", action="store_true", help="Fetch valid categories from MCP server before categorizing")
    parser.add_argument("--server", "-s", default="https://mcp-tools-one.vercel.app/api/mcp",
                        help="MCP server URL (default: https://mcp-tools-one.vercel.app/api/mcp)")
    parser.add_argument("--exclude-transfers", action="store_true", help="Exclude Transfer transactions from output")

    args = parser.parse_args()

    if not args.file.exists():
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    # Fetch categories from server if requested
    server_categories = None
    if args.fetch_categories:
        print(f"Fetching categories from: {args.server}")
        server_categories = fetch_categories_from_server(args.server)
        if server_categories:
            print(f"Fetched {len(server_categories)} categories from server")
            # Update VALID_CATEGORIES for rule-based matching too
            global VALID_CATEGORIES
            VALID_CATEGORIES = server_categories + ["Uncategorized"]
        else:
            print("Warning: Could not fetch categories, using built-in list", file=sys.stderr)

    # Load categorization rules
    categories_path = args.categories or (Path(__file__).parent / "categories.json")
    categories_config = load_categories(categories_path)
    print(f"Loaded {len(categories_config.get('rules', []))} categorization rules")

    print(f"Processing: {args.file}")

    result = parse_csv(
        args.file,
        args.format,
        categories_config,
        use_llm=args.llm,
        valid_categories=server_categories,
        exclude_transfers=args.exclude_transfers
    )

    # Output
    output_json = json.dumps(result, indent=2)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output_json)
        print(f"JSON saved to: {args.output}")

        if args.csv and result["expenses"]:
            generate_csv_for_import(result["expenses"], args.output)
    else:
        print("\n" + "=" * 60)
        print("ANONYMIZED TRANSACTIONS (no merchant names)")
        print("=" * 60)
        print(output_json)

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
