const SUPPORT_CATEGORIES = new Set([
  'cereales_derives',
  'pain_farines_semoule',
  'huile_vegetale',
  'lait_demi_ecreme',
  'sucre',
  'pates_couscous',
  'papier_scolaire',
  'the',
  'autre_controle',
]);

function normalizeSupportFields({ is_government_supported, support_category }) {
  const isSupported = Boolean(is_government_supported);
  const category = typeof support_category === 'string' && support_category.trim()
    ? support_category.trim()
    : null;

  if (!isSupported) {
    return { isSupported: false, category: null };
  }

  if (!category || !SUPPORT_CATEGORIES.has(category)) {
    const err = new Error('support_category is required for controlled products');
    err.status = 400;
    throw err;
  }

  return { isSupported: true, category };
}

module.exports = { SUPPORT_CATEGORIES, normalizeSupportFields };
