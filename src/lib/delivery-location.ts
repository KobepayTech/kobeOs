export interface DeliveryPoint {
  latitude: number;
  longitude: number;
}

export function currentDeliveryPoint(): Promise<DeliveryPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is unavailable on this device. Try a phone using HTTPS.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error('Could not get your location. Allow location access and try again.')),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  });
}

export function deliveryMapLink(point: DeliveryPoint) {
  return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
}
