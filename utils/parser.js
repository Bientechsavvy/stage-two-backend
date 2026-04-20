// utils/parser.js

const COUNTRY_MAP = {
  nigeria: 'NG',
  kenya: 'KE',
  ghana: 'GH',
  angola: 'AO',
  benin: 'BJ',
  cameroon: 'CM',
  ethiopia: 'ET',
  tanzania: 'TZ',
  uganda: 'UG',
  senegal: 'SN',
  'south africa': 'ZA',
  egypt: 'EG',
  morocco: 'MA',
  ivory: 'CI',
  "cote d'ivoire": 'CI',
  zambia: 'ZM',
  zimbabwe: 'ZW',
  rwanda: 'RW',
  mali: 'ML',
  niger: 'NE',
  chad: 'TD',
  sudan: 'SD',
  libya: 'LY',
  togo: 'TG',
  guinea: 'GN',
  mozambique: 'MZ',
  madagascar: 'MG',
};

const AGE_GROUP_MAP = {
  child: { age_group: 'child' },
  children: { age_group: 'child' },
  teenager: { age_group: 'teenager' },
  teenagers: { age_group: 'teenager' },
  teen: { age_group: 'teenager' },
  teens: { age_group: 'teenager' },
  adult: { age_group: 'adult' },
  adults: { age_group: 'adult' },
  senior: { age_group: 'senior' },
  seniors: { age_group: 'senior' },
  elderly: { age_group: 'senior' },
  young: { min_age: 16, max_age: 24 },
};

function parseQuery(q) {
  if (!q || typeof q !== 'string' || q.trim() === '') return null;

  const lower = q.toLowerCase().trim();
  const filters = {};
  let matched = false;

  // Gender
  if (/\bmale\b/.test(lower) && !/\bfemale\b/.test(lower)) {
    filters.gender = 'male';
    matched = true;
  } else if (/\bfemale\b/.test(lower)) {
    filters.gender = 'female';
    matched = true;
  }

  // Age groups
  for (const [keyword, mapping] of Object.entries(AGE_GROUP_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`).test(lower)) {
      Object.assign(filters, mapping);
      matched = true;
      break;
    }
  }

  // above / over
  const aboveMatch = lower.match(/(?:above|over)\s+(\d+)/);
  if (aboveMatch) {
    filters.min_age = parseInt(aboveMatch[1]);
    matched = true;
  }

  // below / under
  const belowMatch = lower.match(/(?:below|under)\s+(\d+)/);
  if (belowMatch) {
    filters.max_age = parseInt(belowMatch[1]);
    matched = true;
  }

  // between X and Y
  const betweenMatch = lower.match(/between\s+(\d+)\s+and\s+(\d+)/);
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1]);
    filters.max_age = parseInt(betweenMatch[2]);
    matched = true;
  }

  // country match
  for (const [country, code] of Object.entries(COUNTRY_MAP)) {
    if (lower.includes(country)) {
      filters.country_id = code;
      matched = true;
      break;
    }
  }

  if (!matched) return null;

  return filters;
}

module.exports = { parseQuery };