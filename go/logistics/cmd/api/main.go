package main

import (
	"log"
	"os"
	"strings"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	brokers := strings.Split(getEnv("KAFKA_BROKERS", "localhost:9092"), ",")
	topic := getEnv("KAFKA_TOPIC_ORDER_PAID", "order.paid")
	groupID := getEnv("KAFKA_GROUP_ID", "logistics-group")
	dbDSN := getEnv("DATABASE_URL", "host=localhost user=postgres password=postgres dbname=logistics port=5432 sslmode=disable")

	db, err := gorm.Open(postgres.Open(dbDSN), &gorm.Config{})
	if err !=nil {
		log.Fatalf("failed to connect do database: %v", err)
	}
	log.Println("connected to database")

	if err := db.AutoMigrate(&model.DeliveryOrder{}); err !=nil {
		log.Fatalf("failed to migrate database: %v", err)
	}
	log.Println(("database migrated succesfully"))

	repo := repository.

	svc:= service.
}


func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
