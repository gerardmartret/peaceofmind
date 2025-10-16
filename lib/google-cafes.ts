/**
 * Google Places API integration for finding nearby cafes
 * Finds top 3 cafes within 5 min walking distance (~250m)
 * Sorted by reviews and price level
 */

export interface Cafe {
  id: string;
  name: string;
  address: string;
  rating: number;
  userRatingsTotal: number;
  priceLevel: number; // 1-4, where 3-4 is premium
  distance?: number; // meters from search location
  lat: number;
  lng: number;
  types: string[];
  businessStatus?: string;
}

export interface CafeSearchResult {
  location: string;
  coordinates: { lat: number; lng: number };
  cafes: Cafe[];
  summary: {
    total: number;
    averageRating: number;
    averageDistance: number;
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Search for nearby cafes using Google Places API
 * Returns top 3 cafes within 250m (5 min walking distance)
 * Sorted by number of reviews and price level
 */
export async function searchNearbyCafes(
  lat: number,
  lng: number,
  locationName: string
): Promise<CafeSearchResult> {
  try {
    console.log(`\n☕ SEARCHING FOR TOP CAFES`);
    console.log('='.repeat(60));
    console.log(`📍 Location: ${locationName}`);
    console.log(`🎯 Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    console.log(`🔍 Radius: 250m (~5 min walk)`);
    console.log(`📊 Sorting: Reviews & Price`);

    return new Promise((resolve) => {
      const service = new google.maps.places.PlacesService(
        document.createElement('div')
      );

      const request: google.maps.places.PlaceSearchRequest = {
        location: new google.maps.LatLng(lat, lng),
        radius: 250, // 250 meters (~5 min walking)
        type: 'cafe',
      };

      service.nearbySearch(request, (results, status) => {
        if (
          status === google.maps.places.PlacesServiceStatus.OK &&
          results &&
          results.length > 0
        ) {
          console.log(`📊 Found ${results.length} cafes, sorting...`);

          // Get all operational cafes and sort by reviews & price
          const topCafes = results
            .filter((place) => {
              const isOpen = place.business_status === 'OPERATIONAL';
              const hasReviews = (place.user_ratings_total || 0) > 0;
              return isOpen && hasReviews;
            })
            .map((place) => {
              const distance = place.geometry?.location
                ? calculateDistance(
                    lat,
                    lng,
                    place.geometry.location.lat(),
                    place.geometry.location.lng()
                  )
                : 0;

              return {
                id: place.place_id || '',
                name: place.name || 'Unknown Cafe',
                address: place.vicinity || '',
                rating: place.rating || 0,
                userRatingsTotal: place.user_ratings_total || 0,
                priceLevel: place.price_level || 0,
                distance: Math.round(distance),
                lat: place.geometry?.location?.lat() || 0,
                lng: place.geometry?.location?.lng() || 0,
                types: place.types || [],
                businessStatus: place.business_status,
              };
            })
            .sort((a, b) => {
              // Sort by number of reviews (more is better), then price level (higher is better), then rating
              if (b.userRatingsTotal !== a.userRatingsTotal) {
                return b.userRatingsTotal - a.userRatingsTotal;
              }
              if (b.priceLevel !== a.priceLevel) {
                return b.priceLevel - a.priceLevel;
              }
              return b.rating - a.rating;
            })
            .slice(0, 3); // Get top 3 cafes

          console.log(`✅ Found top ${topCafes.length} cafes`);
          topCafes.forEach((cafe, idx) => {
            const priceDisplay = cafe.priceLevel > 0 ? '$'.repeat(cafe.priceLevel) : 'N/A';
            console.log(
              `   ${idx + 1}. ${cafe.name} - ${cafe.rating}⭐ (${cafe.userRatingsTotal} reviews, ${priceDisplay}) - ${Math.round(cafe.distance)}m`
            );
          });

          const averageRating =
            topCafes.length > 0
              ? topCafes.reduce((sum, cafe) => sum + cafe.rating, 0) /
                topCafes.length
              : 0;

          const averageDistance =
            topCafes.length > 0
              ? topCafes.reduce((sum, cafe) => sum + cafe.distance, 0) /
                topCafes.length
              : 0;

          resolve({
            location: locationName,
            coordinates: { lat, lng },
            cafes: topCafes,
            summary: {
              total: topCafes.length,
              averageRating: Math.round(averageRating * 10) / 10,
              averageDistance: Math.round(averageDistance),
            },
          });
        } else {
          console.log(`⚠️  No cafes found or search failed: ${status}`);
          resolve({
            location: locationName,
            coordinates: { lat, lng },
            cafes: [],
            summary: {
              total: 0,
              averageRating: 0,
              averageDistance: 0,
            },
          });
        }
      });
    });
  } catch (error) {
    console.error('❌ Error searching for cafes:', error);
    return {
      location: locationName,
      coordinates: { lat, lng },
      cafes: [],
      summary: {
        total: 0,
        averageRating: 0,
        averageDistance: 0,
      },
    };
  }
}

