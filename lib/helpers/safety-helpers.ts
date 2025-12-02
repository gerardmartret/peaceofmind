// Helper functions for safety score display

export const getSafetyColor = (score: number): string => {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};

export const getSafetyBg = (score: number): string => {
  if (score >= 80) return 'bg-green-500/10 border-green-500/30';
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
  if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700';
  return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
};

export const getSafetyLabel = (score: number): string => {
  if (score >= 80) return 'Very Safe';
  if (score >= 60) return 'Moderately Safe';
  if (score >= 40) return 'Caution Advised';
  return 'High Alert';
};

