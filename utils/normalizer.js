// Normalizes query filters into a canonical form
// So for example  "Nigerian females 20-45" and "Women aged 20-45 from Nigeria"
// produce the SAME cache key

function normalizeFilters(filters) {
  const normalized = {};

  // Gender — always lowercase
  if (filters.gender) {
    normalized.gender = filters.gender.toLowerCase().trim();
  }

  // Age group — always lowercase
  if (filters.age_group) {
    normalized.age_group = filters.age_group.toLowerCase().trim();
  }

  // Country — always uppercase
  if (filters.country_id) {
    normalized.country_id = filters.country_id.toUpperCase().trim();
  }

  // Ages — always integers
  if (filters.min_age !== undefined && filters.min_age !== null) {
    normalized.min_age = parseInt(filters.min_age);
  }
  if (filters.max_age !== undefined && filters.max_age !== null) {
    normalized.max_age = parseInt(filters.max_age);
  }

  // Probabilities — always floats rounded to 2 decimal places
  if (filters.min_gender_probability !== undefined) {
    normalized.min_gender_probability = parseFloat(
      parseFloat(filters.min_gender_probability).toFixed(2)
    );
  }
  if (filters.min_country_probability !== undefined) {
    normalized.min_country_probability = parseFloat(
      parseFloat(filters.min_country_probability).toFixed(2)
    );
  }

  // Sort — always lowercase with defaults
  normalized.sort_by = (filters.sort_by || 'created_at').toLowerCase().trim();
  normalized.order = (filters.order || 'asc').toLowerCase().trim();

  // Pagination — always integers with defaults
  normalized.page = parseInt(filters.page) || 1;
  normalized.limit = Math.min(parseInt(filters.limit) || 10, 50);

  // Build canonical cache key — sort keys alphabetically
  // so {gender, country} and {country, gender} produce same key
  const sortedKeys = Object.keys(normalized).sort();
  const keyParts = sortedKeys.map(k => `${k}:${normalized[k]}`);

  return {
    normalized,
    cacheKey: `profiles:${keyParts.join('|')}`,
  };
}

module.exports = { normalizeFilters };