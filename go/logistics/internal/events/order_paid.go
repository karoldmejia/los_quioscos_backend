package events

type PackageEvent struct {
	WeightKg    float64 `json:"weightKg"`
	PackageType string  `json:"packageType"`
	IsFragile   bool    `json:"isFragile"`
}

type LogisticsLoadEvent struct {
	Packages []PackageEvent `json:"packages"`
}

type RouteStopEvent struct {
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	AddressLine string  `json:"addressLine"`
}

type OrderPaidItem struct {
	Name     string `json:"name"`
	Unit     string `json:"unit"`
	Quantity int    `json:"quantity"`
}

type OrderPaidEvent struct {
	OrderID         string             `json:"orderId"`
	UserID          string             `json:"userId"`
	KioskID         string             `json:"kioskId"`
	DeliveryMode    string             `json:"deliveryMode"`
	Items           []OrderPaidItem    `json:"items"`
	LogisticsLoad   LogisticsLoadEvent `json:"logisticsLoad"`
	PickupAddress   RouteStopEvent     `json:"pickupAddress"`
	DeliveryAddress RouteStopEvent     `json:"deliveryAddress"`
}
