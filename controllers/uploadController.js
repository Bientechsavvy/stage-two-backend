const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const redis = require('../config/redis');

const VALID_GENDERS = ['male', 'female'];
const VALID_AGE_GROUPS = ['child', 'teenager', 'adult', 'senior'];
const CHUNK_SIZE = 500;

async function uploadCSV(req, res) {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const reasons = {
    duplicate_name: 0,
    invalid_age: 0,
    missing_fields: 0,
    invalid_gender: 0,
    invalid_age_group: 0,
    malformed_row: 0,
  };

  let total_rows = 0;
  let inserted = 0;
  let skipped = 0;
  let chunk = [];

  const processChunk = async (rows) => {
    for (const row of rows) {
      try {
        await db.query(
          `INSERT IGNORE INTO profiles
            (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            row.name,
            row.gender,
            parseFloat(row.gender_probability) || 0,
            parseInt(row.age),
            row.age_group,
            row.country_id?.toUpperCase(),
            row.country_name,
            parseFloat(row.country_probability) || 0,
          ]
        );
        inserted++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          reasons.duplicate_name++;
        }
        skipped++;
      }
    }
  };

  return new Promise((resolve) => {
    const parser = fs.createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      })
    );

    parser.on('data', async (row) => {
      total_rows++;

      // Validate required fields
      if (!row.name || !row.gender || !row.age || !row.age_group || !row.country_id) {
        reasons.missing_fields++;
        skipped++;
        return;
      }

      // Validate gender
      if (!VALID_GENDERS.includes(row.gender?.toLowerCase())) {
        reasons.invalid_gender++;
        skipped++;
        return;
      }

      // Validate age
      const age = parseInt(row.age);
      if (isNaN(age) || age < 0 || age > 150) {
        reasons.invalid_age++;
        skipped++;
        return;
      }

      // Validate age group
      if (!VALID_AGE_GROUPS.includes(row.age_group?.toLowerCase())) {
        reasons.invalid_age_group++;
        skipped++;
        return;
      }

      chunk.push({
        ...row,
        gender: row.gender.toLowerCase(),
        age_group: row.age_group.toLowerCase(),
      });

      // Process in chunks to avoid memory issues
      if (chunk.length >= CHUNK_SIZE) {
        parser.pause();
        const currentChunk = [...chunk];
        chunk = [];
        await processChunk(currentChunk);
        parser.resume();
      }
    });

    parser.on('end', async () => {
      // Process remaining rows
      if (chunk.length > 0) {
        await processChunk(chunk);
      }

      // Clean up uploaded file
      fs.unlink(filePath, () => {});

      // Invalidate cache after bulk insert
      try {
        const keys = await redis.keys('profiles:*');
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch (err) {
        // Silent fail — cache invalidation failure should not affect response
      }

      resolve(res.status(200).json({
        status: 'success',
        total_rows,
        inserted,
        skipped,
        reasons,
      }));
    });

    parser.on('error', (err) => {
      fs.unlink(filePath, () => {});
      resolve(res.status(500).json({
        status: 'error',
        message: 'Failed to parse CSV file',
      }));
    });
  });
}

module.exports = { uploadCSV };