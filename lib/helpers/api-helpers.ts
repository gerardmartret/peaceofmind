// Helper function to safely parse JSON responses
export const safeJsonParse = async (response: Response) => {
  if (!response.ok) {
    console.error(`❌ API error: ${response.status} ${response.statusText}`);
    return { success: false, error: response.statusText };
  }
  try {
    return await response.json();
  } catch (err) {
    console.error('❌ Failed to parse JSON response:', err);
    return { success: false, error: 'Invalid response format' };
  }
};

