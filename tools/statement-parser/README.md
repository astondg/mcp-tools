# Bank Statement Parser

Parses bank statement CSVs and outputs JSON compatible with MCP budget tools. Uses direct CSV parsing - no external dependencies, runs instantly.

## Usage

```bash
cd tools/statement-parser

# Parse a statement (auto-detects format)
python parse_statement.py ~/Downloads/statement.csv

# Save output to file
python parse_statement.py statement.csv --output transactions.json

# Also generate CSV for bulk import
python parse_statement.py statement.csv --output transactions.json --csv

# Specify format explicitly
python parse_statement.py statement.csv --format amex
```

## Supported Formats

| Format | Detection | Notes |
|--------|-----------|-------|
| `amex` | "Card Member" column | American Express statements |
| `commbank` | Generic Date/Amount/Description | Commonwealth Bank |

To add your second format, edit `FORMATS` dict in `parse_statement.py`.

## Output Format

```json
{
  "expenses": [
    {
      "date": "2024-01-15",
      "amount": 45.99,
      "description": "WOOLWORTHS 1234 SYDNEY",
      "merchantName": "WOOLWORTHS 1234"
    }
  ],
  "income": [...],
  "summary": {
    "total_expenses": 188,
    "total_income": 0,
    "expense_total": 5432.10,
    "income_total": 0
  }
}
```

## Using with MCP Budget Tools

### Option 1: CSV Bulk Import

```bash
python parse_statement.py statement.csv -o parsed.json --csv
```

Then tell Claude:
> Import expenses from tools/statement-parser/parsed.csv using expense_import

### Option 2: Copy JSON

```bash
python parse_statement.py statement.csv | pbcopy
```

Then paste to Claude for processing.

## Adding New Formats

Edit `parse_statement.py` and add to the `FORMATS` dict:

```python
FORMATS = {
    "mybank": {
        "date_col": "Transaction Date",  # Column name for date
        "amount_col": "Amount",           # Column name for amount
        "description_col": "Details",     # Column name for description
        "date_format": "%d/%m/%Y",        # Python strptime format
    },
    ...
}
```

Then update `detect_format()` to auto-detect your format based on unique column names.
