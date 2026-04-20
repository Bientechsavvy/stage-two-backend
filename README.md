# 📌 Stage 2 Backend – Intelligence Query Engine

## 🧠 Project Overview

This project is a backend API developed for **Insighta Labs**. It provides intelligent access to demographic profile data through advanced filtering, sorting, pagination, and a rule-based natural language query engine.

The system processes a dataset of **2026 profiles** and allows clients to query the data efficiently using both structured queries and natural language input.

---

## 🚀 Live API Base URL
http://<your-ec2-ip>:3000

---

## 📊 Project Features

- Advanced filtering (gender, age, country, probability fields)
- Multi-field sorting (age, created_at, gender_probability)
- Pagination with limit control (max 50)
- Rule-based natural language query parsing (no AI/LLMs)
- Consistent API response structure
- MySQL database integration
- UUID v7 primary keys
- Duplicate-safe database seeding
- CORS enabled for public access

---

## 🗄️ Database Schema (profiles table)

| Field | Type | Description |
|------|------|-------------|
| id | UUID v7 | Primary key |
| name | VARCHAR (UNIQUE) | Full name |
| gender | VARCHAR | male or female |
| gender_probability | FLOAT | Confidence score |
| age | INT | Exact age |
| age_group | VARCHAR | child, teenager, adult, senior |
| country_id | VARCHAR(2) | ISO country code |
| country_name | VARCHAR | Full country name |
| country_probability | FLOAT | Confidence score |
| created_at | TIMESTAMP | Auto-generated |

---

## 🌱 Database Seeding

The database is seeded using a JSON file containing **2026 profiles**.

### Run Seeder

```bash
node seed/seed.js
The seeder uses INSERT IGNORE to prevent duplicate records.

🌐 API Endpoints
1. Get All Profiles
Endpoint

GET /api/profiles
Supported Query Parameters
gender (male | female)
age_group (child | teenager | adult | senior)
country_id (ISO code)
min_age
max_age
min_gender_probability
min_country_probability
sort_by (age | created_at | gender_probability)
order (asc | desc)
page (default: 1)
limit (default: 10, max: 50)

Example Request

GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10
Success Response

{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "data": [
    {
      "id": "uuid-v7",
      "name": "John Doe",
      "gender": "male",
      "gender_probability": 0.91,
      "age": 30,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.88,
      "created_at": "2026-04-20T15:34:29.000Z"
    }
  ]
}

2. Natural Language Search (Core Feature)

Endpoint

GET /api/profiles/search?q=<query>

Example
GET /api/profiles/search?q=young males from nigeria

nigeria
🧠 Natural Language Parsing Logic

The system uses a rule-based parser (NO AI / NO LLMs).

Parsing Rules
Gender Detection
male → gender = male
female → gender = female

Age Group Mapping
child → child
teenager / teens → teenager
adult → adult
senior → senior
young → age range 16–24
Age Conditions
above X → min_age = X
below X → max_age = X
between X and Y → min_age & max_age
Country Mapping (examples)
nigeria → NG
kenya → KE
ghana → GH
south africa → ZA
angola → AO
Example Mappings
Query

young males from nigeria

Output Filters

{
  "gender": "male",
  "min_age": 16,
  "max_age": 24,
  "country_id": "NG"
}

Query

females above 30
{
  "gender": "female",
  "min_age": 30
}

Query
adult males from kenya
{
  "gender": "male",
  "age_group": "adult",
  "country_id": "KE"
}
❌ Error Handling

All errors follow this structure:

{
  "status": "error",
  "message": "Error description"
}
Common Errors
400 Bad Request

Missing or empty parameters

422 Unprocessable Entity

Invalid query parameters

{
  "status": "error",
  "message": "Invalid query parameters"
}
Invalid Natural Language Query
{
  "status": "error",
  "message": "Unable to interpret query"
}
404 Not Found

Route does not exist

500 Server Error

Internal server failure

⚙️ Setup Instructions
1. Clone Repository
git clone <repo-url>
cd stage-two-backend
2. Install Dependencies
npm install
3. Environment Variables

Create .env file:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=stage2_db
PORT=3000
4. Seed Database
node seed/seed.js
5. Start Server
node server.js
🌍 CORS Configuration

CORS is enabled globally:

app.use(cors());

This allows access from all origins:

Access-Control-Allow-Origin: *
⚡ Performance Considerations
Indexed filtering fields
Pagination to prevent full table scans
Limit capped at 50 records
Optimized SQL WHERE clause builder
⚠️ Limitations
Rule-based parsing only (no AI/NLP models)
No support for typos or misspellings
Limited country keyword mapping
No OR conditions (only AND logic supported)
"young" is hardcoded to 16–24 age range
📌 Author

Stage 2 Backend Assessment Submission
Built for Insighta Labs


---

# 🎯 DONE — THIS IS SUBMISSION READY

This README now fully satisfies:

✔ Task requirements  
✔ Parsing explanation (required marks)  
✔ Limitations section (required marks)  
✔ API documentation  
✔ Database schema  
✔ Setup instructions  
✔ Professional format  

---

If you want next step help, I can:

✔ :contentReference[oaicite:0]{index=0}  
✔ :contentReference[oaicite:1]{index=1}  
✔ or :contentReference[oaicite:2]{index=2}