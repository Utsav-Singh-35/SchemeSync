# SchemeSync - Government Welfare Scheme Discovery Platform

**Developed by Team DeadCode Labs**

SchemeSync is a comprehensive platform that helps citizens discover, understand, and apply for government welfare schemes using AI-powered crawling and intelligent eligibility matching.

## 🎯 Project Overview

SchemeSync addresses the challenge of scheme discovery by providing:
- **Instant Search**: FTS5-powered scheme database for immediate results
- **Agentic Discovery**: Background AI agents continuously discover new schemes
- **Smart Eligibility**: Rule-based engine evaluates user eligibility
- **Multi-Platform**: Web, mobile, and browser extension support
- **Real Data**: No mocked APIs - real scheme crawling from government portals

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Platform  │    │  Mobile App     │    │ Browser Ext     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     SchemeSync API        │
                    │   (Express.js + SQLite)   │
                    └─────────────┬─────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
    ┌─────▼─────┐      ┌─────────▼─────────┐      ┌─────▼─────┐
    │ Portal    │      │ Eligibility       │      │ FTS5      │
    │ Crawlers  │      │ Engine            │      │ Search    │
    └───────────┘      └───────────────────┘      └───────────┘
```

## 🚀 Quick Start

### Backend Setup
```bash
cd Backend
npm install
npm run setup-db
npm start
```

### Development
```bash
# Start development server
npm run dev

# Run crawlers manually
npm run crawl

# Check API health
curl http://localhost:3000/health
```

## 📁 Project Structure

```
SchemeSync/
├── Backend/           # Core API server
│   ├── src/
│   │   ├── agents/    # Crawling agents
│   │   ├── auth/      # Authentication
│   │   ├── database/  # SQLite + FTS5
│   │   ├── routes/    # API endpoints
│   │   └── services/  # Business logic
│   ├── deploy/        # AWS deployment
│   └── docs/          # API documentation
├── Web/               # React web platform
├── Mobile App/        # React Native app
└── Extension/         # Browser extension
```

## 🔧 Core Features

### 1. Dual Search System
- **Instant Results**: SQLite FTS5 for immediate scheme search
- **Background Discovery**: AI agents crawl government portals continuously

### 2. Intelligent Eligibility
- Rule-based evaluation engine
- Structured eligibility tags
- Family member consideration
- Confidence scoring

### 3. Real Data Sources
- Government portal crawling
- PDF document parsing
- Official scheme announcements
- Deduplication strategies

### 4. Production Ready
- AWS EC2 Free Tier deployment
- PM2 process management
- Nginx reverse proxy
- Automated backups

## 🛠️ Technology Stack

**Backend:**
- Node.js + Express.js
- SQLite with FTS5 full-text search
- JWT authentication
- Puppeteer for crawling
- PDF parsing capabilities

**Deployment:**
- AWS EC2 Free Tier
- PM2 process management
- Nginx reverse proxy
- Let's Encrypt SSL

**Security:**
- Rate limiting
- Input validation
- Security headers
- Firewall configuration

## 📊 API Endpoints

```
Authentication:
POST /api/auth/register    # User registration
POST /api/auth/login       # User login
GET  /api/auth/profile     # Get profile

Schemes:
GET  /api/schemes/search   # Search schemes (FTS5)
GET  /api/schemes/:id      # Scheme details
GET  /api/schemes/eligible/me  # User's eligible schemes

Family:
GET  /api/family           # Family members
POST /api/family           # Add family member

Applications:
GET  /api/applications     # User applications
POST /api/applications     # Track new application
```

## 🚀 Deployment

### AWS EC2 Free Tier
```bash
# Quick deployment
cd Backend
chmod +x deploy/aws-setup.sh
./deploy/aws-setup.sh
```

### Manual Setup
1. Launch t2.micro EC2 instance
2. Install Node.js, PM2, Nginx
3. Configure environment variables
4. Setup SSL certificate
5. Start application with PM2

See [DEPLOYMENT.md](Backend/docs/DEPLOYMENT.md) for detailed instructions.

## 🔍 Crawling Agents

### Portal Crawler
- Crawls major government websites
- Extracts scheme information
- Handles dynamic content

### PDF Crawler
- Downloads and parses PDF documents
- Extracts structured scheme data
- Processes government circulars

### Orchestrator
- Schedules crawling jobs
- Manages deduplication
- Monitors crawl statistics

## 📈 Performance

- **Search Speed**: Sub-100ms FTS5 queries
- **Crawling**: Background processing without blocking
- **Scalability**: Designed for AWS Free Tier limits
- **Caching**: Nginx-level response caching

## 🔒 Security

- JWT-based authentication
- Rate limiting (100 req/15min)
- Input validation with Joi
- SQL injection prevention
- XSS protection headers
- HTTPS enforcement

## 📱 Multi-Platform Support

- **Web Platform**: React-based responsive interface
- **Mobile App**: React Native for iOS/Android
- **Browser Extension**: Assists with form filling on government portals

## 🎯 Eligibility Engine

Smart evaluation considers:
- Age requirements
- Income limits
- Occupation matching
- Geographic restrictions
- Family composition
- Student/disability status

## 📊 Database Schema

```sql
-- Core tables
users              # User profiles
family_members     # Family information
schemes            # Government schemes
schemes_fts        # FTS5 search index
eligibility_tags   # Structured eligibility rules
applications       # Application tracking
crawler_sources    # Crawling targets
```

## 🔄 Background Processing

- **Scheduled Crawling**: Every 6 hours by default
- **Deduplication**: Prevents duplicate schemes
- **Error Handling**: Robust retry mechanisms
- **Monitoring**: Crawl statistics and health checks

## 📚 Documentation

- [API Documentation](Backend/docs/API.md)
- [Deployment Guide](Backend/docs/DEPLOYMENT.md)
- [Architecture Overview](Backend/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes
4. Add tests
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🏆 Team DeadCode Labs

Building real-world solutions for government scheme accessibility.

---

**Note**: This is a production-ready system designed for real deployment, not a prototype. All components use actual data sources and implement proper security measures.