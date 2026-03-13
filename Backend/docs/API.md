# SchemeSync API Documentation

## Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:3000/api
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format
All responses follow this format:
```json
{
  "success": true|false,
  "message": "Response message",
  "data": { ... },
  "errors": [ ... ] // Only present on validation errors
}
```

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "occupation": "Software Engineer",
  "annualIncome": 500000,
  "address": "123 Main St",
  "district": "Mumbai",
  "state": "Maharashtra",
  "phoneNumber": "+91-9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "token": "jwt-token-here"
  }
}
```

#### Login User
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Get Profile
```http
GET /auth/profile
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /auth/profile
Authorization: Bearer <token>
```

### Schemes

#### Search Schemes
```http
GET /schemes/search?query=farmer&limit=20&offset=0
```

**Query Parameters:**
- `query` (optional): Search term for FTS5 search
- `category` (optional): Filter by scheme category
- `limit` (optional): Number of results (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "schemes": [
      {
        "id": 1,
        "scheme_name": "PM-KISAN",
        "ministry": "Ministry of Agriculture",
        "description": "Income support for farmers",
        "benefits": "Rs. 6000 per year",
        "eligibility_text": "Landholding farmers",
        "category": "agriculture",
        "application_mode": "online",
        "official_url": "https://pmkisan.gov.in",
        "eligibility": {
          "status": "eligible",
          "score": 85,
          "reasons": ["Income requirement met", "Farmer status confirmed"]
        }
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

#### Get Scheme Details
```http
GET /schemes/:id
```

#### Get Eligible Schemes
```http
GET /schemes/eligible/me
Authorization: Bearer <token>
```

#### Get Categories
```http
GET /schemes/categories/list
```

### Family Members

#### Get Family Members
```http
GET /family
Authorization: Bearer <token>
```

#### Add Family Member
```http
POST /family
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Jane Doe",
  "age": 25,
  "relationship": "spouse",
  "occupation": "Teacher",
  "isStudent": false,
  "hasDisability": false
}
```

#### Update Family Member
```http
PUT /family/:id
Authorization: Bearer <token>
```

#### Delete Family Member
```http
DELETE /family/:id
Authorization: Bearer <token>
```

### Applications

#### Get Applications
```http
GET /applications
Authorization: Bearer <token>
```

#### Add Application
```http
POST /applications
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "schemeId": 1,
  "applicationDate": "2024-01-15",
  "acknowledgmentNumber": "ACK123456789",
  "portalUrl": "https://portal.gov.in/application/123",
  "notes": "Applied through official portal"
}
```

#### Update Application
```http
PUT /applications/:id
Authorization: Bearer <token>
```

#### Delete Application
```http
DELETE /applications/:id
Authorization: Bearer <token>
```

#### Get Application Statistics
```http
GET /applications/stats
Authorization: Bearer <token>
```

### Admin Endpoints

#### Crawler Status
```http
GET /admin/crawler/status
```

#### Run Crawler
```http
POST /admin/crawler/run
```

**Request Body:**
```json
{
  "type": "full" // "full", "portal", or "pdf"
}
```

#### Crawler Statistics
```http
GET /admin/crawler/stats
```

#### Database Statistics
```http
GET /admin/stats
```

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limits

- General API: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes
- Search: 20 requests per second

## Eligibility Status

Schemes are evaluated for eligibility with these statuses:
- `eligible` - User meets all criteria
- `likely_eligible` - User likely meets criteria but some data unclear
- `not_eligible` - User does not meet criteria
- `unknown` - Insufficient data to determine eligibility

## Categories

Common scheme categories:
- `agriculture` - Farming and rural schemes
- `education` - Educational support and scholarships
- `health` - Healthcare and medical schemes
- `employment` - Job and skill development
- `housing` - Housing and shelter schemes
- `social_security` - Pensions and social support
- `women_child` - Women and child welfare
- `financial` - Loans and financial assistance
- `general` - Other schemes