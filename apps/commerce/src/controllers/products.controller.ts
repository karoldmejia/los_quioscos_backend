import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductService } from '../services/product.service';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { SearchProductDto } from '../dtos/search-product.dto';
import { ProductCategory } from '../enums/product-category.enum';

@Controller()
export class ProductsController {
  constructor(private readonly productService: ProductService) {}

  @MessagePattern({ cmd: 'create_product' })
  async createProduct(@Payload() dto: CreateProductDto): Promise<Product> {
    return await this.productService.create(dto);
  }

  @MessagePattern({ cmd: 'update_product' })
  async updateProduct(@Payload() payload: { id: string; dto: UpdateProductDto }): Promise<Product> {
    const { id, dto } = payload;
    return await this.productService.update(id, dto);
  }

  @MessagePattern({ cmd: 'get_product' })
  async getProduct(@Payload() id: string): Promise<Product> {
    return await this.productService.findById(id);
  }

  @MessagePattern({ cmd: 'get_product_including_deleted' })
  async getProductIncludingDeleted(@Payload() id: string): Promise<Product> {
    return await this.productService.findByIdIncludingDeleted(id);
  }

  @MessagePattern({ cmd: 'get_all_products' })
  async getAllProducts(): Promise<Product[]> {
    return await this.productService.findAll();
  }

  @MessagePattern({ cmd: 'get_kiosk_products' })
  async getKioskProducts(@Payload() kioskUserId: number): Promise<Product[]> {
    return await this.productService.findAllByKioskUserId(kioskUserId);
  }

  @MessagePattern({ cmd: 'get_active_kiosk_products' })
  async getActiveKioskProducts(@Payload() kioskUserId: number): Promise<Product[]> {
    return await this.productService.findActiveByKioskUserId(kioskUserId);
  }

  @MessagePattern({ cmd: 'get_products_by_category' })
  async getProductsByCategory(@Payload() category: ProductCategory): Promise<Product[]> {
    return await this.productService.findActiveByCategory(category);
  }

  @MessagePattern({ cmd: 'search_products' })
  async searchProducts(@Payload() searchDto: SearchProductDto): Promise<Product[]> {
    return await this.productService.searchActiveByName(searchDto);
  }

  @MessagePattern({ cmd: 'deactivate_product' })
  async deactivateProduct(@Payload() id: string): Promise<Product> {
    return await this.productService.deactivate(id);
  }

  @MessagePattern({ cmd: 'activate_product' })
  async activateProduct(@Payload() id: string): Promise<Product> {
    return await this.productService.activate(id);
  }

  @MessagePattern({ cmd: 'delete_product' })
  async deleteProduct(@Payload() id: string): Promise<void> {
    return await this.productService.remove(id);
  }

  @MessagePattern({ cmd: 'check_product_name_exists' })
  async checkProductNameExists(@Payload() payload: { kioskUserId: number; name: string }): Promise<boolean> {
    const { kioskUserId, name } = payload;
    return await this.productService.existsByNameForKiosk(kioskUserId, name);
  }

  @MessagePattern({ cmd: 'count_kiosk_products' })
  async countKioskProducts(@Payload() kioskUserId: number): Promise<number> {
    return await this.productService.countByKiosk(kioskUserId);
  }

  @MessagePattern({ cmd: 'get_recent_products' })
  async getRecentProducts(@Payload() limit?: number): Promise<Product[]> {
    return await this.productService.findRecentlyAdded(limit);
  }

  @MessagePattern({ cmd: 'get_kiosk_products_by_category' })
  async getKioskProductsByCategory(@Payload() payload: { kioskUserId: number; category: ProductCategory }): Promise<Product[]> {
    const { kioskUserId, category } = payload;
    return await this.productService.findProductsByKioskAndCategory(kioskUserId, category);
  }

  @MessagePattern({ cmd: 'validate_product_for_order' })
  async validateProductForOrder(@Payload() productId: string): Promise<{
    isValid: boolean;
    product?: Product;
    error?: string;
  }> {
    return await this.productService.validateProductForOrder(productId);
  }
}