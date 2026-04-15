export class ExpiringContractDto {
  contract_id: string;
  business_id: string;
  kiosk_id: string;
  end_date: Date;
  days_until_expiry: number;
}

export class RenewalNotificationDto {
  contract_id: string;
  business_id: string;
  kiosk_id: string;
  end_date: Date;
  days_notice: number;
  notification_type: 'TWO_WEEKS' | 'ONE_WEEK' | 'THREE_DAYS' | 'EXPIRED';
}

export class CreateRenewalContractDto {
  parent_contract_id: string;
  business_id: string;
  kiosk_id: string;
  start_date: Date;
  end_date: Date;
  frequency: string;
  change_deadline_days: number;
  cancellation_deadline_days: number;
  logistics_mode: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    requirements_json?: any;
  }>;
}

export class RenewalResultDto {
  success: boolean;
  parent_contract_id: string;
  new_contract_id?: string;
  status: string;
  message?: string;
  error?: string;
}