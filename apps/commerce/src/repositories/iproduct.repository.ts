import { Product } from "../entities/product.entity";
import { ProductCategory } from "../enums/product-category.enum";

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

  abstract findAllByKioskUserId(kioskUserId: string): Promise<Product[]>;
  abstract findActiveByKioskUserId(kioskUserId: string): Promise<Product[]>;
  abstract findActiveByCategory(category: ProductCategory): Promise<Product[]>;
  abstract searchActiveByName(query: string): Promise<Product[]>;
  abstract existsByNameForKiosk(kioskUserId: string, name: string): Promise<boolean>;
  abstract countByKiosk(kioskUserId: string): Promise<number>;
  abstract findRecentlyAdded(limit: number): Promise<Product[]>;
  abstract findProductsByKioskAndCategory(kioskUserId: string, category: ProductCategory): Promise<Product[]>;
}
