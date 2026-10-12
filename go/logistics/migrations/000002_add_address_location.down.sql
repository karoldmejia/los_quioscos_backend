DROP INDEX IF EXISTS idx_addresses_location;
DROP TRIGGER IF EXISTS trg_update_address_location ON addresses;
DROP FUNCTION IF EXISTS update_address_location();
ALTER TABLE addresses DROP COLUMN IF EXISTS location;