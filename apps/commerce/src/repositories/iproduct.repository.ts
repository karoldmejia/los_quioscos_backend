import { Product } from "../entities/product.entity";
import { ProductCategory } from "../entities/product_category.enum";

export abstract class IProductRepository {

  abstract create(product: Product): Promise<Product>;
  abstract save(product: Product): Promise<Product>;
  abstract update(product: Product): Promise<Product>;
  abstract softDelete(productId: string): Promise<void>;

  abstract deactivate(productId: string): Promise<Product>;
  abstract activate(productId: string): Promise<Product>;


  abstract findById(productId: string): Promise<Product | null>;
  abstract findByIdIncludingDeleted(productId: string): Promise<Product | null>;
  abstract findAll(): Promise<Product[]>;

  abstract findAllByKioskUserId(kioskUserId: number): Promise<Product[]>;
  abstract findActiveByKioskUserId(kioskUserId: number): Promise<Product[]>;
  abstract findActiveByCategory(category: ProductCategory): Promise<Product[]>;
  abstract searchActiveByName(query: string): Promise<Product[]>;
  abstract existsByNameForKiosk(kioskUserId: number, name: string): Promise<boolean>;
  abstract countByKiosk(kioskUserId: number): Promise<number>;
  abstract findRecentlyAdded(limit: number): Promise<Product[]>;
  abstract findProductsByKioskAndCategory(kioskUserId: number, category: ProductCategory): Promise<Product[]>;
}
