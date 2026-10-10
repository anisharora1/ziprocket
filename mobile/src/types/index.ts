export interface Restaurant {
  _id: string;
  name: string;
  phone?: string;
  rating?: number;
  totalOrders?: number;
  cuisines?: string;
  deliveryZone?: string;
  availabilityStatus?: 'open' | 'closed';
  isCurrentlyOpen?: boolean;
  location?: {
    address: string;
    lat: number;
    lng: number;
  };
  popularItems?: Array<{
    _id: string;
    name: string;
    price: number;
    discountedPrice?: number;
    images?: string[];
  }>;
}
