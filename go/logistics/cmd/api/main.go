package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/config"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/consumer"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/repository"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/service"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// configuration

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	if err := config.RunMigrations(cfg.DB.DSN); err != nil {
		log.Fatalf("failed to run migratons: %v", err)
	}
	log.Println("migrations applied succesfully")

	//bd
	db, err := gorm.Open(postgres.Open(cfg.DB.DSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect do database: %v", err)
	}
	log.Println("connected to database")

	// repositories
	routeStopRepo := repository.NewRouteStopRepository(db)
	deliveryRepo := repository.NewDeliveryOrderRepository(db)
	carrierRepo := repository.NewCarrierRepository(db)
	vehicleRepo := repository.NewVehicleRepository(db)
	addressRepo := repository.NewAddressRepository(db)

	// services
	routeStopSvc := service.NewRouteStopService(routeStopRepo)
	carrierSvc := service.NewCarrierService(carrierRepo)
	vehicleSvc := service.NewVehicleService(vehicleRepo)
	addressSvc := service.NewAddressService(addressRepo)
	deliverySvc := service.NewDeliveryService(deliveryRepo, addressSvc, routeStopSvc)

	// consumers
	orderPaidConsumer := consumer.NewConsumer[events.OrderPaidEvent](cfg.Kafka.Brokers, "order.paid", "logistics-order-paid")
	carrierActivatedConsumer := consumer.NewConsumer[events.CarrierActivatedEvent](cfg.Kafka.Brokers, "carrier.activated", "logistics-carrier-projection")
	carrierUpdatedConsumer := consumer.NewConsumer[events.CarrierUpdatedEvent](cfg.Kafka.Brokers, "carrier.updated", "logistics-carrier-projection")
	carrierDeletedConsumer := consumer.NewConsumer[events.CarrierDeletedEvent](cfg.Kafka.Brokers, "carrier.deleted", "logistics-carrier-projection")
	vehicleUpsertConsumer := consumer.NewConsumer[events.VehicleUpsertEvent](cfg.Kafka.Brokers, "vehicle.upsert", "logistics-carrier-projection")
	vehicleDeletedConsumer := consumer.NewConsumer[events.VehicleDeletedEvent](cfg.Kafka.Brokers, "vehicle.deleted", "logistics-carrier-projection")
	addressDefaultUpdatedConsumer := consumer.NewConsumer[events.AddressUpdated](cfg.Kafka.Brokers, "default_address.updated", "logistics-address-projection")

	// context and closing
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// start all consumers on go routines
	var wg sync.WaitGroup
	consumers := []struct {
		name  string
		start func()
	}{
		{
			name:  "order.paid",
			start: func() { orderPaidConsumer.Start(ctx, deliverySvc.HandleOrderPaid) },
		},
		{
			name:  "carrier.activated",
			start: func() { carrierActivatedConsumer.Start(ctx, carrierSvc.HandleCarrierActivated) },
		},
		{
			name:  "carrier.updated",
			start: func() { carrierUpdatedConsumer.Start(ctx, carrierSvc.HandleCarrierUpdated) },
		},
		{
			name:  "carrier.deleted",
			start: func() { carrierDeletedConsumer.Start(ctx, carrierSvc.HandleCarrierDeleted) },
		},
		{
			name:  "vehicle.upsert",
			start: func() { vehicleUpsertConsumer.Start(ctx, vehicleSvc.HandleVehicleUpsert) },
		},
		{
			name:  "vehicle.deleted",
			start: func() { vehicleDeletedConsumer.Start(ctx, vehicleSvc.HandleVehicleDeleted) },
		},
		{
			name:  "default_address.updated",
			start: func() { addressDefaultUpdatedConsumer.Start(ctx, addressSvc.HandleAddressUpdated) },
		},
	}

	for _, c := range consumers {
		wg.Add(1)
		go func(name string, start func()) {
			defer wg.Done()
			log.Printf("starting consumer for topic %q", name)
			start()
			log.Printf("consumer for topic %q stopped", name)
		}(c.name, c.start)
	}

	// wait closing signal

	<-sigCh
	log.Println("shutdown signal received, stopping consumers...")
	cancel()
	wg.Wait()
	log.Println("shutdown complete")
}
