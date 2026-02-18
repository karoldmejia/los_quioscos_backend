import { OrderStatus } from "../enums/order-status.enum";

export type FindManyOrdersFilters = {
  status?: OrderStatus | OrderStatus[];
  kioskUserId?: number;
  userId?: string;
  expiresAtBefore?: Date;
  limit?: number;
};
