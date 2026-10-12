CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE route_stops
    ADD COLUMN location geography(Point, 4326);

CREATE OR REPLACE FUNCTION update_routestops_location()
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

CREATE TRIGGER trg_update_routestops_location
    BEFORE INSERT OR UPDATE OF latitude, longitude ON route_stops
    FOR EACH ROW
    EXECUTE FUNCTION update_routestops_location();

UPDATE route_stops SET latitude=latitude;

CREATE INDEX idx_routestops_location
    ON route_stops USING GIST (location);