package model

import (
	"github.com/shopspring/decimal"
)

type StopType string

const (
	StopTypePickup   StopType = "PICKUP"
	StopTypeDelivery StopType = "DELIVERY"
)

type RouteStop struct {
	StopType  StopType        `gorm:"type:varchar(50);not null"`
	Latitude  decimal.Decimal `gorm:"type:decimal(10,2);not null"`
	Longitude decimal.Decimal `gorm:"type:decimal(10,2);not null"`
	Address   string          `gorm:"type:varchar(200)"`
}
