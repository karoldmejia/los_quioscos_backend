package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type Address struct {
	ID              uuid.UUID        `gorm:"type:uuid;primaryKey"`
	UserID          uuid.UUID        `gorm:"type:uuid;not null;uniqueIndex"`
	Role            string           `gorm:"type:varchar(200)"`
	Latitude        decimal.Decimal  `gorm:"type:decimal(10,7);not null"`
	Longitude       decimal.Decimal  `gorm:"type:decimal(10,7);not null"`
	ServiceRadiusKm *decimal.Decimal `gorm:"type:decimal(10,2)"`
	ChangedAt       time.Time        `gorm:"type:timestamptz"`
}
