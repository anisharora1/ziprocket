export const GROCERY_CATEGORIES_MAP: Record<string, string[]> = {
  "Vegetables & Fruits": ["Fresh Vegetables", "Fresh Fruits", "Herbs & Seasonings"],
  "Dairy & Bread": ["Milk & Cream", "Butter & Cheese", "Bread & Pav", "Curd & Paneer"],
  "Atta, Rice & Dals": ["Atta & Flours", "Rice & Basmati", "Dals & Pulses", "Ghee & Oils"],
  "Munchies": ["Chips & Crisps", "Bhujia & Namkeen", "Biscuits & Cookies", "Popcorn"],
  "Cold Drinks & Juices": ["Soft Drinks", "Fruit Juices", "Energy Drinks", "Soda & Mixers"],
  "Household Essentials": ["Detergents & Cleaners", "Pooja Needs", "Tissues & Disposables", "Repellents"],
  "Personal Care": ["Soaps & Bodywash", "Shampoos & Haircare", "Oral Care", "Deodorants"],
  "Masala & Dry Fruits": ["Whole Spices", "Ground Masalas", "Dry Fruits & Nuts", "Seeds & Others"],
};

export const GROCERY_CATEGORY_DISPLAY: Record<string, { name: string; image: string; color: string }> = {
  "Vegetables & Fruits": {
    name: "Fruits & Veggies",
    image: "https://res.cloudinary.com/dxrtse4ni/image/upload/v1786564029/copy_of_fruitsandveg.avif",
    color: "bg-[#FFF1E6] text-[#FF5C00] border-[#FFE2CC]/50"
  },
  "Dairy & Bread": {
    name: "Dairy & Bread",
    image: "https://res.cloudinary.com/dxrtse4ni/image/upload/v1788498832/dairy_bread.avif",
    color: "bg-[#FFF8F2] text-[#E05200] border-[#FFECDB]/50"
  },
  "Atta, Rice & Dals": {
    name: "Atta, Rice, Oils",
    image: "https://res.cloudinary.com/dxrtse4ni/image/upload/v1788580721/asset_atta__rice___dal.png",
    color: "bg-[#FFEBE5] text-[#FF4500] border-[#FFD5CC]/50"
  },
  "Munchies": {
    name: "Munchies",
    image: "https://res.cloudinary.com/dxrtse4ni/image/upload/v1788580030/munchies.avif",
    color: "bg-[#FFF1E6] text-[#FF5C00] border-[#FFE2CC]/50"
  },
  "Cold Drinks & Juices": {
    name: "Drinks & Juices",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=150&h=150&q=80",
    color: "bg-[#FFF8F2] text-[#E05200] border-[#FFECDB]/50"
  },
  "Household Essentials": {
    name: "Household",
    image: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=150&h=150&q=80",
    color: "bg-[#FFEBE5] text-[#FF4500] border-[#FFD5CC]/50"
  },
  "Personal Care": {
    name: "Personal Care",
    image: "https://images.unsplash.com/photo-1607006342411-92346cf57b4e?auto=format&fit=crop&w=150&h=150&q=80",
    color: "bg-[#FFF1E6] text-[#FF5C00] border-[#FFE2CC]/50"
  },
  "Masala & Dry Fruits": {
    name: "Masala & Dry Fruits",
    image: "https://res.cloudinary.com/dxrtse4ni/image/upload/v1788498832/mashalas.avif",
    color: "bg-[#FFF4E0] text-[#B8860B] border-[#F5DEB3]/50"
  }
};

export const GROCERY_SUBCATEGORY_ICONS: Record<string, string> = {
  "All": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&h=120&q=80",
  // Vegetables & Fruits
  "Fresh Vegetables": "https://res.cloudinary.com/dxrtse4ni/image/upload/v1788498833/grouping_asset_Fresh_Vegetables.png",
  "Fresh Fruits": "https://res.cloudinary.com/dxrtse4ni/image/upload/v1788498832/grouping_asset_Fresh_fruits.png",
  "Herbs & Seasonings": "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=120&h=120&q=80",
  // Dairy & Bread
  "Milk & Cream": "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=120&h=120&q=80",
  "Butter & Cheese": "https://images.unsplash.com/photo-1486299267070-83823f5448dd?auto=format&fit=crop&w=120&h=120&q=80",
  "Bread & Pav": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=120&h=120&q=80",
  "Curd & Paneer": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=120&h=120&q=80",
  // Atta, Rice & Dals
  "Atta & Flours": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=120&h=120&q=80",
  "Rice & Basmati": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=120&h=120&q=80",
  "Dals & Pulses": "https://images.unsplash.com/photo-1515942400420-2b98fed1f515?auto=format&fit=crop&w=120&h=120&q=80",
  "Ghee & Oils": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=120&h=120&q=80",
  // Munchies
  "Chips & Crisps": "https://res.cloudinary.com/dxrtse4ni/image/upload/v1788580721/chips.webp",
  "Bhujia & Namkeen": "https://res.cloudinary.com/dxrtse4ni/image/upload/v1788580721/namkeen.webp",
  "Biscuits & Cookies": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=120&h=120&q=80",
  "Popcorn": "https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=120&h=120&q=80",
  // Cold Drinks & Juices
  "Soft Drinks": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=120&h=120&q=80",
  "Fruit Juices": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=120&h=120&q=80",
  "Energy Drinks": "https://images.unsplash.com/photo-1527960656306-ff37c5699b7b?auto=format&fit=crop&w=120&h=120&q=80",
  "Soda & Mixers": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=120&h=120&q=80",
  // Household Essentials
  "Detergents & Cleaners": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=120&h=120&q=80",
  "Pooja Needs": "https://images.unsplash.com/photo-1609137144813-90d1bf4f9e8a?auto=format&fit=crop&w=120&h=120&q=80",
  "Tissues & Disposables": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=120&h=120&q=80",
  "Repellents": "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?auto=format&fit=crop&w=120&h=120&q=80",
  // Personal Care
  "Soaps & Bodywash": "https://images.unsplash.com/photo-1607006342411-92346cf57b4e?auto=format&fit=crop&w=120&h=120&q=80",
  "Shampoos & Haircare": "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=120&h=120&q=80",
  "Oral Care": "https://images.unsplash.com/photo-1559599101-f09722fb4925?auto=format&fit=crop&w=120&h=120&q=80",
  "Deodorants": "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=120&h=120&q=80",
  // Masala & Dry Fruits
  "Whole Spices": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=120&h=120&q=80",
  "Ground Masalas": "https://images.unsplash.com/photo-1596040033229-6f1352c141e1?auto=format&fit=crop&w=120&h=120&q=80",
  "Dry Fruits & Nuts": "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=120&h=120&q=80",
  "Seeds & Others": "https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?auto=format&fit=crop&w=120&h=120&q=80",
};
