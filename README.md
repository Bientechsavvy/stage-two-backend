# Insighta Labs+ — Backend API

## System Architecture
Three-tier system:
- Backend (Node.js + Express + MySQL) — single source of truth
- CLI tool — terminal interface
- Web portal — browser interface

Both CLI and portal authenticate through the same backend.

## Base URL
http://35.180.66.115:3000

## Authentication Flow
1. User runs `insighta login` (CLI) or clicks "Login with GitHub" (portal)
2. Backend redirects to GitHub OAuth with PKCE
3. GitHub redirects back to `/api/v1/auth/github/callback`
4. Backend exchanges code for GitHub user info
5. Backend creates or retrieves user from database
6. Backend issues access token (3 min) + refresh token (5 min)
7. CLI stores tokens at `~/.insighta/credentials.json`
8. Portal stores tokens in HTTP-only cookies

## Token Handling
- Access token expires in 3 minutes
- Refresh token expires in 5 minutes
- On refresh, old token is immediately invalidated
- New access + refresh token pair is issued on every refresh
- Logout deletes refresh token from database

## Role Enforcement
| Role | Permissions |
|------|------------|
| admin | Full access: read, create, delete, export |
| analyst | Read-only: list, search, export |

- Default role on signup: analyst
- Roles are checked on every request via middleware
- Inactive users (is_active = false) get 403 Forbidden

## API Versioning
All profile endpoints require header:
X-API-Version: 1
Missing header returns 400 Bad Request.

## Endpoints

### Auth
GET    /api/v1/auth/github           → Redirect to GitHub
GET    /api/v1/auth/github/callback  → Handle callback
POST   /api/v1/auth/refresh          → Refresh tokens
POST   /api/v1/auth/logout           → Logout
GET    /api/v1/auth/me               → Get current user

### Profiles (require auth + X-API-Version header)
GET    /api/v1/profiles              → List with filters
GET    /api/v1/profiles/search       → Natural language search
GET    /api/v1/profiles/export       → Export CSV
POST   /api/v1/profiles              → Create profile (admin only)

## Rate Limiting
- Auth endpoints: 10 requests/minute
- All other endpoints: 60 requests/minute per user

## Natural Language Parsing
Rule-based keyword matching. No AI or LLMs used.

### How it works:
1. Lowercase the query
2. Detect gender keywords → gender filter
3. Detect age group or "young" → age_group or age range
4. Detect "above/below/between" + number → min_age/max_age
5. Detect country name after "from" → country_id
6. If nothing matched → return "Unable to interpret query"

### Supported Keywords
| Keyword | Filter |
|---------|--------|
| male, males | gender = male |
| female, females | gender = female |
| young | min_age=16, max_age=24 |
| teenager, teen | age_group = teenager |
| adult | age_group = adult |
| child | age_group = child |
| senior, elderly | age_group = senior |
| above X / over X | min_age = X |
| below X / under X | max_age = X |
| from nigeria | country_id = NG |
| from kenya | country_id = KE |

### Limitations
- No NLP — only predefined keywords work
- Spelling mistakes not handled
- "young" is not a stored age_group
- Limited country list (~25 countries)
- Cannot handle negations ("not from nigeria")

## Tech Stack
- Node.js + Express
- MySQL
- JWT (jsonwebtoken)
- GitHub OAuth
- PM2
- AWS EC2