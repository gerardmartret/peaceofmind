// Helper function to get time label for location inputs
export const getTimeLabel = (index: number, totalLocations: number): string => {
  if (index === 0) return 'Pickup Time';
  if (index === totalLocations - 1) return 'Drop Off Time';
  return 'Resume At';
};

