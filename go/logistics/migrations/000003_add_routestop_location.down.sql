DROP INDEX IF EXISTS idx_routestops_location;
DROP TRIGGER IF EXISTS trg_update_routestops_location ON route_stops;
DROP FUNCTION IF EXISTS update_routestops_location();
ALTER TABLE route_stops DROP COLUMN IF EXISTS location;