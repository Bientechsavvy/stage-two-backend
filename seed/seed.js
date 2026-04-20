const db = require('../config/db');
const fs = require('fs');
const path = require('path');

async function seed() {
  const filePath = path.join(__dirname, '../data/profiles.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const profiles = JSON.parse(raw);

  console.log(`Seeding ${profiles.length} profiles...`);

  let inserted = 0;
  let skipped = 0;

  for (const profile of profiles) {
    try {
      await db.query(
        `INSERT IGNORE INTO profiles 
          (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profile.id,
          profile.name,
          profile.gender,
          profile.gender_probability,
          profile.age,
          profile.age_group,
          profile.country_id,
          profile.country_name,
          profile.country_probability,
        ]
      );
      inserted++;
    } catch (err) {
      console.error(`Skipped: ${profile.name} — ${err.message}`);
      skipped++;
    }
  }

  console.log(`Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  process.exit(0);
}

seed();
