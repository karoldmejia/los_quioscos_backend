package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type DeliveryStatus string

const (
	StatusPending         DeliveryStatus = "PENDING"
	StatusInQueue         DeliveryStatus = "IN_QUEUE"
	StatusScheduled       DeliveryStatus = "SCHEDULED"
	StatusCarrierAssigned DeliveryStatus = "CARRIER_ASSIGNED"
	StatusKioskReady      DeliveryStatus = "KIOSK_READY"
	StatusReadyToStart    DeliveryStatus = "READY_TO_START"
	StatusInProgress      DeliveryStatus = "IN_PROGRESS"
	StatusCompleted       DeliveryStatus = "COMPLETED"
	StatusCancelled       DeliveryStatus = "CANCELLED"
)

type DeliveryMode string

const (
	DeliveryModeIndividual DeliveryMode = "INDIVIDUAL"
	DeliveryModeGrouped    DeliveryMode = "GROUPED"
)

type DeliveryOrder struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`

	OrderID uuid.UUID `gorm:"type:uuid;not null"`
	UserID  uuid.UUID `gorm:"type:uuid;not null"`
	KioskID uuid.UUID `gorm:"type:uuid;not null"`

	LogisticsLoad *LogisticsLoad `gorm:"foreignKey:DeliveryOrderID;references:ID"`

	DeliveryMode DeliveryMode   `gorm:"type:varchar(50);not null"`
	Status       DeliveryStatus `gorm:"type:varchar(50);not null;default:'PENDING'"`

	ScheduledDeliveryDate *time.Time `gorm:"type:timestamptz"`

	ShippingCost     *decimal.Decimal `gorm:"type:decimal(10,2)"`
	BaseShippingCost *decimal.Decimal `gorm:"type:decimal(10,2)"`
	PlatformMargin   *decimal.Decimal `gorm:"type:decimal(10,2)"`
	Pickup           RouteStop        `gorm:"embedded;embeddedPrefix:pickup_"`
	Delivery         RouteStop        `gorm:"embedded;embeddedPrefix:delivery_"`

	GroupWindowID *uuid.UUID `gorm:"type:uuid"`
	CancelledAt   *time.Time `gorm:"type:timestamptz"`
	CompletedAt   *time.Time `gorm:"type:timestamptz"`
	CreatedAt     time.Time  `gorm:"type:timestamptz;autoCreateTime"`
	UpdatedAt     time.Time  `gorm:"type:timestamptz;autoUpdateTime"`
}
