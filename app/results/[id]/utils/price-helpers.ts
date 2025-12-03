// Format number with commas and 2 decimals (only for display, allows partial input)
export const formatPriceDisplay = (value: string): string => {
  if (!value) return '';
  // Remove commas first, then any non-numeric characters except decimal point
  const cleaned = value.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  
  // Handle multiple decimal points - keep only the first one
  const firstDotIndex = cleaned.indexOf('.');
  let normalizedValue = cleaned;
  if (firstDotIndex !== -1) {
    const beforeDot = cleaned.substring(0, firstDotIndex);
    const afterDot = cleaned.substring(firstDotIndex + 1).replace(/\./g, '');
    normalizedValue = beforeDot + (afterDot ? '.' + afterDot : '.');
  }
  
  // Handle partial decimal input (e.g., "123." should stay as "123.")
  if (normalizedValue.endsWith('.')) {
    const numPart = normalizedValue.slice(0, -1);
    if (numPart) {
      const num = parseFloat(numPart);
      if (!isNaN(num) && num >= 0) {
        return num.toLocaleString('en-US') + '.';
      }
    }
    return normalizedValue;
  }
  
  // Split into integer and decimal parts
  const parts = normalizedValue.split('.');
  const integerPart = parts[0] || '';
  const decimalPart = parts[1] || '';
  
  // Format integer part with commas
  if (integerPart) {
    const num = parseFloat(integerPart);
    if (!isNaN(num) && num >= 0) {
      const formattedInteger = num.toLocaleString('en-US');
      if (decimalPart !== undefined && decimalPart !== '') {
        // Has decimal part - allow up to 2 decimal places while typing
        const limitedDecimal = decimalPart.slice(0, 2);
        return `${formattedInteger}.${limitedDecimal}`;
      } else {
        // No decimal part yet
        return formattedInteger;
      }
    }
  }
  
  // Fallback: return cleaned value if parsing fails
  return normalizedValue;
};

// Parse formatted price back to number string
export const parsePriceInput = (value: string): string => {
  // Remove commas and keep only numbers and decimal point
  return value.replace(/,/g, '').replace(/[^\d.]/g, '');
};

