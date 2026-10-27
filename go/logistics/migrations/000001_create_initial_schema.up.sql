-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE addresses (
    id                uuid PRIMARY KEY,
    user_id           uuid NOT NULL,
    role              varchar(200),
    latitude          numeric(10,7) NOT NULL,
    longitude         numeric(10,7) NOT NULL,
    service_radius_km numeric(10,2),
    changed_at        timestamptz
);

CREATE UNIQUE INDEX idx_addresses_user_id ON addresses (user_id);

CREATE TABLE carriers (
    user_id             uuid PRIMARY KEY,
    is_accepting_routes boolean NOT NULL DEFAULT true,
    activated_at        timestamptz,
    updated_at          timestamptz,
    deleted_at          timestamptz
);

CREATE INDEX idx_carriers_deleted_at ON carriers (deleted_at);

CREATE TABLE vehicles (
    vehicle_id             uuid PRIMARY KEY,
    carrier_id             uuid NOT NULL,
    max_weight_kg          numeric(10,2),
    accepted_package_types jsonb,
    updated_at             timestamptz,
    deleted_at             timestamptz,
    CONSTRAINT fk_carriers_vehicle
        FOREIGN KEY (carrier_id) REFERENCES carriers (user_id)
);

CREATE UNIQUE INDEX idx_vehicles_carrier_id ON vehicles (carrier_id);
CREATE INDEX idx_vehicles_deleted_at ON vehicles (deleted_at);

CREATE TABLE route_stops (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stop_type  varchar(20) NOT NULL,
    latitude   numeric(10,7) NOT NULL,
    longitude  numeric(10,7) NOT NULL
);

CREATE TABLE grouping_windows (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status varchar(50) NOT NULL DEFAULT 'ACTIVE',
    max_time_minutes integer NOT NULL DEFAULT 60,
    max_orders integer NOT NULL DEFAULT 6,
    order_count integer NOT NULL DEFAULT 0,
    opened_at timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    close_reason varchar(100),
)

CREATE INDEX idx_grouping_windows_status_opened ON grouping_windows(status, opened_at)
CREATE INDEX idx_windows_expiry ON grouping_windows((opened_at + make_interval(mins => max_time_minutes)))
    WHERE status = 'ACTIVE'
CREATE INDEX idx_full_windows ON grouping_windows(id)
    WHERE status = 'ACTIVE' AND (order_count >= max_orders)


CREATE TABLE delivery_orders (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                 uuid NOT NULL,
    user_id                  uuid NOT NULL,
    kiosk_id                 uuid NOT NULL,
    pickup_route_stop_id     uuid NOT NULL,
    delivery_route_stop_id   uuid NOT NULL,
    delivery_mode            varchar(50) NOT NULL,
    status                   varchar(50) NOT NULL DEFAULT 'PENDING',
    scheduled_delivery_date  timestamptz,
    shipping_cost            numeric(10,2),
    base_shipping_cost       numeric(10,2),
    platform_margin          numeric(10,2),
    grouping_window_id          uuid,
    cancelled_at             timestamptz,
    completed_at             timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_delivery_orders_pickup_route_stop
        FOREIGN KEY (pickup_route_stop_id) REFERENCES route_stops (id),
    CONSTRAINT fk_delivery_orders_delivery_route_stop
        FOREIGN KEY (delivery_route_stop_id) REFERENCES route_stops (id),
    CONSTRAINT fk_grouping_windows_orders
        FOREIGN KEY (grouping_window_id) REFERENCES grouping_windows (id)
);

CREATE INDEX idx_delivery_orders_pickup_route_stop_id
    ON delivery_orders (pickup_route_stop_id);
CREATE INDEX idx_delivery_orders_delivery_route_stop_id
    ON delivery_orders (delivery_route_stop_id);
CREATE INDEX idx_delivery_orders_grouping_window_id
    ON delivery_orders (grouping_window_id);
    
CREATE TABLE logistics_loads (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_order_id uuid NOT NULL,
    total_weight_kg   numeric(10,2) NOT NULL,
    is_fragile        boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_delivery_orders_logistics_load
        FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders (id)
);

CREATE UNIQUE INDEX idx_logistics_loads_delivery_order_id
    ON logistics_loads (delivery_order_id);

CREATE TABLE packages (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    logistics_load_id uuid NOT NULL,
    weight_kg         numeric(10,2) NOT NULL,
    package_type      varchar(50) NOT NULL,
    is_fragile        boolean NOT NULL DEFAULT false,
    CONSTRAINT fk_logistics_loads_packages
        FOREIGN KEY (logistics_load_id) REFERENCES logistics_loads (id)
);

CREATE INDEX idx_packages_logistics_load_id ON packages (logistics_load_id);