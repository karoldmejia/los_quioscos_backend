import { OrderStatus } from "../enums/order.enum.js";

export type FindManyOrdersFilters = {
  status?: OrderStatus | OrderStatus[];
  kioskUserId?: number;
  userId?: string;
  expiresAtBefore?: Date;
  limit?: number;
};
