package events

import (
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
)

type OrderPaidItem struct {
	Name     string `json:"name"`
	Unit     string `json:"unit"`
	Quantity int    `json:"quantity"`
}

type OrderPaidEvent struct {
	OrderID       string              `json:"orderId"`
	UserID        string              `json:"userId"`
	KioskID       string              `json:"kioskId"`
	DeliveryMode  string              `json:"deliveryMode"`
	Items         []OrderPaidItem     `json:"items"`
	LogisticsLoad model.LogisticsLoad `json:"logisticsLoad"`
}
