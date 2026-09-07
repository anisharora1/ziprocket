import MenuItem from "../models/MenuItem";
import GroceryProduct from "../models/GroceryProduct";

export async function verifyItemPrices(items: any[], orderType: "food" | "grocery", restaurant?: string) {
    let verifiedItemTotal = 0;
    const verifiedItems: any[] = [];

    for (const item of items) {
        let product: any;
        let realPrice = 0;
        let variantLabel: string | undefined;

        if (orderType === "food") {
            const itemId = item.menuItem || item._id || (typeof item.id === "string" ? item.id.replace(/^food-/, "") : item.id);
            product = await MenuItem.findById(itemId);
            if (!product) throw new Error("One or more items in your cart are no longer available.");
            if (restaurant && restaurant !== "grocery" && product.restaurant && product.restaurant.toString() !== restaurant.toString()) {
                throw new Error(`"${product.name}" doesn't belong to this restaurant.`);
            }
            if (item.variantId && product.variants?.length) {
                const variant = product.variants.find((v: any) => v._id.toString() === item.variantId);
                if (!variant || !variant.isAvailable) throw new Error(`The selected option for "${product.name}" is no longer available.`);
                realPrice = (variant.discountedPrice !== undefined && Number(variant.discountedPrice) > 0) ? variant.discountedPrice : (variant.price || 0);
                variantLabel = variant.label;
            } else {
                realPrice = (product.discountedPrice !== undefined && Number(product.discountedPrice) > 0) ? product.discountedPrice : product.price;
            }
        } else {
            const itemId = item.groceryItem || item._id || (typeof item.id === "string" ? item.id.replace(/^groc-/, "").replace(/^grocery-/, "") : item.id);
            product = await GroceryProduct.findById(itemId);
            if (!product) throw new Error("One or more items in your cart are no longer available.");
            if (item.variantId && product.variants?.length) {
                const variant = product.variants.find((v: any) => v._id.toString() === item.variantId);
                if (!variant) throw new Error(`The selected option for "${product.name}" is no longer available.`);
                realPrice = (variant.discountedPrice !== undefined && Number(variant.discountedPrice) > 0) ? variant.discountedPrice : (variant.price || 0);
                variantLabel = variant.label;
            } else {
                realPrice = (product.discountedPrice !== undefined && Number(product.discountedPrice) > 0) ? product.discountedPrice : product.price;
            }
        }

        verifiedItemTotal += realPrice * item.quantity;
        verifiedItems.push({ 
            ...item, 
            price: realPrice, 
            ...(variantLabel !== undefined ? { variantLabel } : {}) 
        });
    }

    return { verifiedItemTotal, verifiedItems };
}
