# SchemeSync Backend

Core backend system for SchemeSync - Government Welfare Scheme Discovery Platform

## Architecture Overview

- **Identity & Profile Layer**: User authentication and profile management
- **Scheme Discovery Layer**: Dual system with instant search + background crawling
- **SQLite Database**: FTS5-enabled scheme indexing
- **Eligibility Engine**: Rule-based scheme matching
- **API Layer**: RESTful endpoints for web/mobile/extension
- **Agentic Crawling**: Background scheme discovery agents

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite with FTS5
- **Authentication**: JWT
- **Crawling**: Puppeteer + PDF parsing
- **Deployment**: AWS EC2 Free Tier

## Quick Start

```bash
cd Backend
npm install
npm run setup-db
npm start
```

## API Endpoints

- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication
- `GET /schemes/search` - Search schemes with FTS5
- `GET /schemes/eligible` - Get eligible schemes for user
- `POST /applications/add` - Track scheme applications

## Background Services

- **Scheme Crawler**: Discovers new schemes from government portals
- **PDF Parser**: Extracts scheme data from official documents
- **Eligibility Processor**: Updates scheme eligibility tags