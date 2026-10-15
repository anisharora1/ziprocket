export interface PopularItem {
  _id?: string;
  name: string;
  price: number;
  discountedPrice?: number;
  isFeatured?: boolean;
  prepTimeMinutes?: number;
  spiceLevel?: string;
  images?: string[] | any[];
}

export interface Restaurant {
  _id: string;
  name: string;
  phone?: string;
  image?: string | { url?: string; publicId?: string };
  logo?: string | { url?: string; publicId?: string };
  rating?: number;
  totalOrders?: number;
  cuisines?: string;
  deliveryZone?: string;
  availabilityStatus?: 'open' | 'closed';
  isActive?: boolean;
  status?: string;
  isCurrentlyOpen?: boolean;
  operatingHours?: {
    open?: string;
    close?: string;
  };
  location?: {
    address: string;
    lat: number;
    lng: number;
  };
  popularItems?: PopularItem[];
}

