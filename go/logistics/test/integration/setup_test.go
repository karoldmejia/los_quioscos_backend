//go:build integration

package integration

import (
	"context"
	"log"
	"os"
	"testing"

	"github.com/testcontainers/testcontainers-go/modules/kafka"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
)

var (
	testDB            *gorm.DB
	kafkaBrokers      []string
	postgresContainer *tcpostgres.PostgresContainer
	kafkaContainer    *kafka.KafkaContainer
)

func TestMain(m *testing.M) {
	log.Println("TestMain started")

	ctx := context.Background()

	// levantar Postgres
	pg, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("logistics_test"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		tcpostgres.BasicWaitStrategies(),
	)
	if err != nil {
		log.Fatalf("failed to start postgres: %v", err)
	}
	postgresContainer = pg
	log.Println("Postgres container started")

	// conectar GORM y migrar
	connStr, err := pg.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("failed to get connection string: %v", err)
	}
	testDB, err = gorm.Open(gormpostgres.Open(connStr), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}
	if err := testDB.AutoMigrate(&model.DeliveryOrder{}, &model.LogisticsLoad{}, &model.Package{}, &model.Carrier{}, &model.Vehicle{}); err != nil {
		log.Fatalf("failed to migrate: %v", err)
	}
	log.Printf("testDB initialized: %v", testDB != nil)

	// levantar Kafka
	k, err := kafka.Run(ctx,
		"confluentinc/confluent-local:7.5.0",
		kafka.WithClusterID("test-cluster"),
	)
	if err != nil {
		log.Fatalf("failed to start kafka: %v", err)
	}
	kafkaContainer = k

	brokers, err := k.Brokers(ctx)
	if err != nil {
		log.Fatalf("failed to get brokers: %v", err)
	}
	kafkaBrokers = brokers

	// correr los tests
	code := m.Run()

	// 5. Limpieza
	if err := postgresContainer.Terminate(ctx); err != nil {
		log.Printf("failed to terminate postgres: %v", err)
	}
	if err := kafkaContainer.Terminate(ctx); err != nil {
		log.Printf("failed to terminate kafka: %v", err)
	}
	os.Exit(code)
}
