export const SUPPORT_CATEGORIES = [
  { value: 'cereales_derives', label: 'Céréales et dérivés' },
  { value: 'pain_farines_semoule', label: 'Pain, farine et semoule' },
  { value: 'huile_vegetale', label: 'Huile végétale' },
  { value: 'lait_demi_ecreme', label: 'Lait demi-écrémé' },
  { value: 'sucre', label: 'Sucre' },
  { value: 'pates_couscous', label: 'Pâtes alimentaires et couscous' },
  { value: 'papier_scolaire', label: 'Papier, cahiers et livres scolaires' },
  { value: 'the', label: 'Thé' },
  { value: 'autre_controle', label: 'Autre produit contrôlé' },
];

export function supportCategoryLabel(value) {
  return SUPPORT_CATEGORIES.find((category) => category.value === value)?.label || 'Non classé';
}
