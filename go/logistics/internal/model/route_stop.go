package model

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type StopType string

const (
	StopTypePickup   StopType = "PICKUP"
	StopTypeDelivery StopType = "DELIVERY"
)

type RouteStop struct {
	ID        uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	StopType  StopType        `gorm:"type:varchar(20);not null"`
	Latitude  decimal.Decimal `gorm:"type:decimal(10,7);not null"`
	Longitude decimal.Decimal `gorm:"type:decimal(10,7);not null"`
}
