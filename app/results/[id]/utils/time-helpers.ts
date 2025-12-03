// Helper function to convert time to HH:MM format for TimePicker
export const formatTimeForPicker = (time: string | number | undefined): string => {
  if (!time && time !== 0) {
    console.log('⚠️ [TimePicker] No time value provided, using default 09:00');
    return '09:00';
  }

  // If it's already a string in HH:MM format, normalize it
  if (typeof time === 'string' && time.includes(':')) {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    // Ensure valid range
    const validH = Math.max(0, Math.min(23, h));
    const validM = Math.max(0, Math.min(59, m));
    const result = `${validH.toString().padStart(2, '0')}:${validM.toString().padStart(2, '0')}`;
    console.log('✅ [TimePicker] Formatted time from string:', time, '→', result);
    return result;
  }

  // If it's a decimal number (e.g., 14.5 for 14:30) or string number
  if (typeof time === 'number' || (typeof time === 'string' && !time.includes(':'))) {
    const numTime = typeof time === 'number' ? time : parseFloat(String(time));
    if (isNaN(numTime)) {
      console.log('⚠️ [TimePicker] Invalid number format:', time, 'using default 09:00');
      return '09:00';
    }
    const hours = Math.floor(Math.abs(numTime));
    const minutes = Math.round((Math.abs(numTime) % 1) * 60);
    // Ensure valid range
    const validH = Math.max(0, Math.min(23, hours));
    const validM = Math.max(0, Math.min(59, minutes));
    const result = `${validH.toString().padStart(2, '0')}:${validM.toString().padStart(2, '0')}`;
    console.log('✅ [TimePicker] Formatted time from number:', time, '→', result);
    return result;
  }

  console.log('⚠️ [TimePicker] Unknown time format:', time, 'using default 09:00');
  return '09:00';
};

// Function to format stored time - times are already stored in trip destination timezone
// This function just formats the time string (HH:MM) for display
export const getDestinationLocalTime = (timeString: string): string => {
  if (!timeString) return 'N/A';

  // Parse the time string (e.g., "18:35" or "18")
  const timeParts = timeString.split(':');
  const hours = parseInt(timeParts[0]) || 0;
  const minutes = parseInt(timeParts[1]) || 0;

  // Format as HH:MM (pad with zeros if needed)
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');

  return `${formattedHours}:${formattedMinutes}`;
};

// Keep getLondonLocalTime for backward compatibility
export const getLondonLocalTime = (timeString: string): string => {
  return getDestinationLocalTime(timeString);
};

