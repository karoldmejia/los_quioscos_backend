CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE addresses
    ADD COLUMN location geography(Point, 4326);

CREATE OR REPLACE FUNCTION update_address_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(
            ST_MakePoint(NEW.longitude, NEW.latitude),
            4326
        )::geography;
    ELSE
        NEW.location := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_address_location
    BEFORE INSERT OR UPDATE OF latitude, longitude ON addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_address_location();

UPDATE addresses SET latitude=latitude;

CREATE INDEX idx_addresses_location
    ON addresses USING GIST (location);