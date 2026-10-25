package model

import (
	"time"

	"github.com/google/uuid"
)

type WindowStatus string

const (
	WindowStatusActive WindowStatus = "ACTIVE"
	WindowStatusClosed WindowStatus = "CLOSED"
)

type CloseReason string

const (
	CloseReasonTimeReached      CloseReason = "TIME_REACHED"
	CloseReasonMaxOrdersReached CloseReason = "MAX_ORDERS_REACHED"
	CloseReasonManual           CloseReason = "MANUAL"
)

type GroupingWindow struct {
	ID             uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Status         WindowStatus    `gorm:"type:varchar(50);not null;default:'ACTIVE'"`
	MaxTimeMinutes int             `gorm:"not null;default:60"`
	MaxOrders      int             `gorm:"not null;default:10"`
	OrderCount     int             `gorm:"not null;default:0"`
	Orders         []DeliveryOrder `gorm:"foreignKey:GroupingWindowID"`
	OpenedAt       time.Time       `gorm:"type:timestamptz;autoCreateTime"`
	UpdatedAt      time.Time       `gorm:"type:timestamptz;autoUpdateTime"`
	ClosedAt       *time.Time      `gorm:"type:timestamptz"`
	CloseReason    *CloseReason    `gorm:"type:varchar(100)"`
}
