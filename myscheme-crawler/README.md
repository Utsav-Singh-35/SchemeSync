# MyScheme API Crawler

Production-grade Python crawler for downloading all scheme metadata from the MyScheme API and storing it in a structured database.

## Overview

This crawler retrieves all ~4,645 government schemes from the MyScheme API (`https://api.myscheme.gov.in/search/v6/schemes`) with proper rate limiting, error handling, and restart safety.

## Features

- **Complete Data Extraction**: Downloads all scheme metadata including categories, states, and tags
- **Rate Limited**: Respects API limits with 1 request per second
- **Restart Safe**: Maintains progress checkpoints for interrupted crawls
- **Robust Error Handling**: Exponential backoff retry logic with proper error recovery
- **Structured Storage**: Normalized SQLite database with proper indexing
- **Production Ready**: Comprehensive logging, statistics, and monitoring

## Quick Start

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set API Key**
   ```bash
   cp .env.example .env
   # Edit .env and add your MYSCHEME_API_KEY
   export MYSCHEME_API_KEY=your_api_key_here
   ```

3. **Run Crawler**
   ```bash
   python main.py
   ```

## Usage Examples

```bash
# Full crawl (all ~4,645 schemes)
python main.py

# Test with limited pages
python main.py --max-pages 10

# Larger page size for faster crawling
python main.py --page-size 50

# Reset and start fresh
python main.py --reset

# Check current status
python main.py --status

# Verbose logging
python main.py --log-level DEBUG --log-file crawler.log

# Save statistics to file
python main.py --stats-file results.json
```

## Architecture

```
crawler/
├── config.py          # Environment variables and configuration
├── api_client.py      # HTTP client with rate limiting and retry logic
├── parser.py          # JSON response parsing and validation
├── database.py        # SQLite database operations
├── progress.py        # Progress tracking for restart safety
├── crawler.py         # Main crawling logic and coordination
└── main.py           # CLI entry point and execution
```

## Database Schema

### Main Tables

**schemes**
- `id` (TEXT PRIMARY KEY) - Unique scheme identifier
- `slug` (TEXT) - URL-friendly scheme identifier
- `name` (TEXT NOT NULL) - Full scheme name
- `short_title` (TEXT) - Abbreviated title
- `ministry` (TEXT) - Nodal ministry name
- `level` (TEXT) - Government level (Central/State/District)
- `description` (TEXT) - Brief description
- `close_date` (TEXT) - Scheme closure date
- `created_at`, `updated_at` (TIMESTAMP) - Audit fields

### Junction Tables

**scheme_categories** - Many-to-many scheme categories
**scheme_states** - Many-to-many beneficiary states  
**scheme_tags** - Many-to-many scheme tags

## API Integration

### Endpoint
```
GET https://api.myscheme.gov.in/search/v6/schemes
```

### Parameters
- `lang=en` - Language (English)
- `q=[]` - Filters (empty for all schemes)
- `keyword=""` - Search query (empty for all)
- `sort=""` - Sorting (default)
- `from=0` - Pagination offset
- `size=10` - Records per page

### Headers
```
Accept: application/json
Origin: https://www.myscheme.gov.in
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
X-Api-Key: {your_api_key}
```

## Rate Limiting & Retry Logic

- **Rate Limit**: 1 request per second
- **Retry Strategy**: Up to 3 attempts with exponential backoff
- **Backoff**: 1s → 2s → 4s → fail
- **Error Handling**: Automatic retry on network errors, rate limits, and server errors

## Progress Tracking

The crawler maintains a `progress.json` file with:

```json
{
  "last_page": 120,
  "last_offset": 1200,
  "total_schemes_processed": 1205,
  "total_schemes_saved": 1198,
  "total_pages": 465,
  "page_size": 10,
  "completed": false,
  "start_time": "2026-03-13T16:30:00",
  "last_update": "2026-03-13T16:45:00"
}
```

## Configuration

Environment variables in `.env`:

```bash
MYSCHEME_API_KEY=your_api_key_here
```

## Output

After completion:
- **Database**: `schemes.db` (SQLite)
- **Progress**: `progress.json` (checkpoint file)
- **Logs**: Console output + optional log file
- **Statistics**: Comprehensive crawling metrics

## Error Handling

The crawler handles:
- Network timeouts and connection errors
- API rate limiting (429 responses)
- Authentication failures (401/403)
- Server errors (5xx responses)
- Invalid JSON responses
- Database connection issues
- Interrupted crawls (Ctrl+C)

## Performance

**Expected Performance**:
- ~4,645 total schemes
- ~465 pages at 10 schemes per page
- 1 request per second = ~8 minutes total
- Database operations: <1ms per scheme
- Memory usage: <50MB

**Optimization Options**:
- Increase `--page-size` to 50-100 for faster crawling
- Use `--max-pages` for testing/development
- Enable `--log-level ERROR` to reduce I/O overhead

## Monitoring

Real-time progress logging:
```
2026-03-13 16:30:15 - INFO - Starting MyScheme crawler
2026-03-13 16:30:16 - INFO - Total schemes: 4645, Total pages: 465
2026-03-13 16:30:17 - INFO - Crawling page 1/465 (offset: 0)
2026-03-13 16:30:18 - INFO - Page 1 completed: 10/10 schemes saved (0.2% progress)
```

Final statistics:
```
==============================================================
MYSCHEME CRAWLER RESULTS
==============================================================
Total API requests: 465
Failed requests: 0
Success rate: 100.0%
Schemes processed: 4645
Schemes saved: 4645
Progress: 100.0%
Completed: Yes
Total schemes in database: 4645
Duration: 00:08:15
==============================================================
```

## Requirements

- Python 3.7+
- `requests` - HTTP client
- `python-dotenv` - Environment variable management
- `tenacity` - Retry logic
- SQLite3 (built-in)

## License

MIT License - See LICENSE file for details.