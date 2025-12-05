import { useMemo } from 'react';

interface UseDrivaniaVehicleCalculationsParams {
  drivaniaQuotes: any;
}

interface UseDrivaniaVehicleCalculationsReturn {
  lowestDrivaniaPrice: number | null;
  drivaniaCurrency: string | null;
}

/**
 * Hook to calculate Drivania vehicle-related values from quotes
 */
export function useDrivaniaVehicleCalculations({
  drivaniaQuotes,
}: UseDrivaniaVehicleCalculationsParams): UseDrivaniaVehicleCalculationsReturn {
  // Calculate lowest Drivania quote price
  const lowestDrivaniaPrice = useMemo(() => {
    if (!drivaniaQuotes?.quotes?.vehicles || drivaniaQuotes.quotes.vehicles.length === 0) {
      return null;
    }
    const prices = drivaniaQuotes.quotes.vehicles
      .map((vehicle: any) => vehicle.sale_price?.price)
      .filter((price: any) => typeof price === 'number' && !isNaN(price));
    if (prices.length === 0) return null;
    return Math.min(...prices);
  }, [drivaniaQuotes]);

  const drivaniaCurrency = drivaniaQuotes?.currency_code || null;

  return {
    lowestDrivaniaPrice,
    drivaniaCurrency,
  };
}
