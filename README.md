# Stage 2 Backend — Intelligence Query Engine

## 🧠 Overview

This project is a backend API built for **Insighta Labs**.
It provides advanced querying over demographic profile data using:

* Filtering
* Sorting
* Pagination
* Rule-based natural language search

The system stores and queries **2026 profiles** in a MySQL database.

---

## 🚀 Base URL

http://YOUR_EC2_IP:3000

---

## ⚙️ Features

* Advanced filtering (gender, age, country, probability)
* Sorting (age, created_at, gender_probability)
* Pagination (limit up to 50)
* Natural language query parsing (rule-based only)
* MySQL database integration
* UUID v7 IDs
* Duplicate-safe seeding
* Global CORS enabled

---

## 🗄️ Database Schema

| Field               | Type             | Description                    |
| ------------------- | ---------------- | ------------------------------ |
| id                  | UUID v7          | Primary key                    |
| name                | VARCHAR (UNIQUE) | Full name                      |
| gender              | VARCHAR          | male / female                  |
| gender_probability  | FLOAT            | Confidence                     |
| age                 | INT              | Age                            |
| age_group           | VARCHAR          | child, teenager, adult, senior |
| country_id          | VARCHAR(2)       | ISO code                       |
| country_name        | VARCHAR          | Country name                   |
| country_probability | FLOAT            | Confidence                     |
| created_at          | TIMESTAMP        | Auto-generated                 |

---

## 🌐 Endpoints

### 1. Get All Profiles

GET /api/profiles

#### Supported Query Parameters

* gender
* age_group
* country_id
* min_age
* max_age
* min_gender_probability
* min_country_probability
* sort_by → age | created_at | gender_probability
* order → asc | desc
* page (default: 1)
* limit (default: 10, max: 50)

---

### 2. Natural Language Search

GET /api/profiles/search?q=<query>

Example:

/api/profiles/search?q=young males from nigeria

---

# 🧠 Natural Language Parsing (CORE REQUIREMENT)

The system uses a **rule-based parser** to convert plain English queries into structured filters.

No AI or NLP libraries are used.

---

## 🔑 Supported Keywords & Mappings

### Gender

| Input           | Output          |
| --------------- | --------------- |
| male, males     | gender = male   |
| female, females | gender = female |

---

### Age Group

| Input           | Output               |
| --------------- | -------------------- |
| child, children | age_group = child    |
| teenager, teens | age_group = teenager |
| adult, adults   | age_group = adult    |
| senior, elderly | age_group = senior   |

---

### Special Age Rule

| Input | Output                     |
| ----- | -------------------------- |
| young | min_age = 16, max_age = 24 |

---

### Numeric Conditions

| Pattern         | Output                   |
| --------------- | ------------------------ |
| above X         | min_age = X              |
| over X          | min_age = X              |
| below X         | max_age = X              |
| under X         | max_age = X              |
| between X and Y | min_age = X, max_age = Y |

---

### Country Mapping

Country detection is based on the keyword **"from"**.

| Input        | Output          |
| ------------ | --------------- |
| from nigeria | country_id = NG |
| from kenya   | country_id = KE |
| from ghana   | country_id = GH |
| from angola  | country_id = AO |

---

## 📌 Example Queries

### Query:

young males

Result:

* gender = male
* min_age = 16
* max_age = 24

---

### Query:

females above 30

Result:

* gender = female
* min_age = 30

---

### Query:

adult males from kenya

Result:

* gender = male
* age_group = adult
* country_id = KE

---

## ❌ Invalid Query Handling

If a query cannot be interpreted:

```json
{
  "status": "error",
  "message": "Unable to interpret query"
}
```

---

## ⚠️ Limitations (REQUIRED SECTION)

* Rule-based parsing only (no AI or NLP models)
* Only predefined keywords are supported
* Queries must follow recognizable patterns (e.g., "from country")
* No support for typos or misspellings
* No OR logic (only AND conditions are applied)
* Limited country mapping
* Complex sentences may not be interpreted correctly

---

## 🌱 Database Seeding

```bash
node seed/seed.js
```

* Inserts 2026 profiles
* Uses duplicate-safe insertion

---

## ⚙️ Setup

```bash
git clone <repo-url>
cd stage-two-backend
npm install
```

Create `.env`:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=stage2_db
PORT=3000
```

Run:

```bash
node seed/seed.js
node server.js
```

---

## 🌍 CORS

Enabled globally:

```
Access-Control-Allow-Origin: *
```

---

## ⚡ Performance

* Indexed filters
* Pagination prevents full-table scans
* Query builder ensures efficient SQL execution

---

## 📌 Author

Stage 2 Backend Assessment Submission
Built for Insighta Labs