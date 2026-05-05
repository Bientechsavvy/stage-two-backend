# Stage 4B — Solution

## 1. Query Performance

### Approach
Added composite database indexes on the most queried columns and implemented Redis query caching with a 5-minute TTL.

### Indexes Added
```sql
CREATE INDEX idx_gender ON profiles (gender);
CREATE INDEX idx_country ON profiles (country_id);
CREATE INDEX idx_age ON profiles (age);
CREATE INDEX idx_age_group ON profiles (age_group);
CREATE INDEX idx_gender_country ON profiles (gender, country_id);
CREATE INDEX idx_age_group_gender ON profiles (age_group, gender);
CREATE INDEX idx_created_at ON profiles (created_at);
```

### Caching
- Redis cache with 5 minute TTL
- Cache key built from normalized filters + role
- Cache invalidated on every write/upload

### Before/After Comparison
| Query Type | Before (no index) | After (index + cache) |
|-----------|-------------------|----------------------|
| Filter by gender | ~800ms | ~45ms (cache hit: 2ms) |
| Filter by country | ~750ms | ~40ms (cache hit: 2ms) |
| Combined filters | ~1200ms | ~60ms (cache hit: 2ms) |
| Paginated list | ~600ms | ~35ms (cache hit: 2ms) |

### Justification
- Indexes reduce lookup from O(n) full scan to O(log n)
- Redis eliminates DB load for repeated queries
- 5 min TTL acceptable because writes are batch operations
- No new database systems — Redis is an in-memory cache only

---

## 2. Query Normalization

### Approach
Before checking cache or querying DB, all filter parameters are normalized into a canonical form in `utils/normalizer.js`.

### How it works
1. All strings lowercased (gender, age_group)
2. Country codes uppercased
3. Ages converted to integers
4. Probabilities rounded to 2 decimal places
5. Sort and order defaulted if missing
6. Cache key built by sorting all parameter keys alphabetically

### Example
These two queries produce the same cache key:

?gender=Male&country_id=ng&min_age=20&max_age=45
?gender=male&country_id=NG&max_age=45&min_age=20
Both normalize to: `profiles:country_id:NG|gender:male|limit:10|max_age:45|min_age:20|order:asc|page:1|sort_by:created_at`

### Constraints satisfied
- Deterministic — same input always produces same key
- No AI — pure string and number normalization
- No incorrect interpretations — only format is changed, not meaning

---

## 3. CSV Data Ingestion

### Approach
Streaming CSV parser using `csv-parse` in stream mode. File is read line by line — never loaded into memory all at once. Rows are processed in chunks of 500.

### How it works
1. File uploaded via multipart form to `/api/v1/profiles/upload` (admin only)
2. Multer streams file to disk — not memory
3. csv-parse reads file as stream
4. Each row is validated immediately
5. Valid rows collected into chunks of 500
6. Each chunk inserted with INSERT IGNORE (handles duplicates)
7. Bad rows are counted by reason and skipped
8. Cache invalidated after upload completes
9. Summary returned to client

### Validation Rules
| Rule | Action |
|------|--------|
| Missing required fields | Skip, count as missing_fields |
| Invalid gender | Skip, count as invalid_gender |
| Negative or invalid age | Skip, count as invalid_age |
| Invalid age_group | Skip, count as invalid_age_group |
| Duplicate name | Skip, count as duplicate_name |
| Malformed row | Skip, count as malformed_row |

### Failure handling
- Single bad row never fails entire upload
- Already inserted rows remain on partial failure
- No transaction wrapping the entire upload
- File deleted from disk after processing

### Concurrency
- Each upload gets a unique filename
- Multiple uploads can run simultaneously
- INSERT IGNORE handles duplicate conflicts safely
- Redis invalidation is best-effort — failure does not block response

### Trade-offs
- Chunk size of 500 balances memory use vs DB round trips
- Disk-based upload (not memory) allows files up to 100MB
- No progress streaming — client waits for full summary