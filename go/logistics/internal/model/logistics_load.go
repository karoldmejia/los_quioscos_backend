package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type PackageType string

const (
	PackageTypeBox      PackageType = "BOX"
	PackageTypeBag      PackageType = "BAG"
	PackageTypeEnvelope PackageType = "ENVELOPE"
	PackageTypePallet   PackageType = "PALLET"
	PackageTypeCostal   PackageType = "COSTAL"
	PackageTypeOther    PackageType = "OTHER"
)

type Package struct {
	ID              uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	LogisticsLoadID uuid.UUID       `gorm:"type:uuid;not null;index"`
	WeightKg        decimal.Decimal `gorm:"type:decimal(10,2);not null"`
	PackageType     PackageType     `gorm:"type:varchar(50);not null"`
	IsFragile       bool            `gorm:"default:false"`
}

type LogisticsLoad struct {
	ID              uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	DeliveryOrderID uuid.UUID       `gorm:"type:uuid;not null;uniqueIndex"`
	Packages        []Package       `gorm:"foreignKey:LogisticsLoadID"`
	TotalWeightKg   decimal.Decimal `gorm:"type:decimal(10,2);not null"`
	IsFragile       bool            `gorm:"not null;default:false"`
	CreatedAt       time.Time       `gorm:"type:timestamptz;autoCreateTime"`
}
