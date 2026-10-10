package model

import (
	"github.com/shopspring/decimal"
)

type RouteStop struct {
	Latitude  decimal.Decimal `gorm:"type:decimal(10,7);not null"`
	Longitude decimal.Decimal `gorm:"type:decimal(10,7);not null"`
	Address   string          `gorm:"type:varchar(200)"`
}
