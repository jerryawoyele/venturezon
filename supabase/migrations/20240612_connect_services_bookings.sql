-- Connect services and bookings tables
-- First, check if the foreign key already exists
DO $$
BEGIN
    -- Check if the foreign key exists, if not, add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'bookings_service_id_fkey'
    ) THEN
        -- Add foreign key from bookings to services
        ALTER TABLE bookings 
        ADD CONSTRAINT bookings_service_id_fkey
        FOREIGN KEY (service_id) 
        REFERENCES services(id)
        ON DELETE CASCADE;
    END IF;
END
$$;

-- Check if the status column is already an enum type
DO $$
DECLARE
    status_type text;
BEGIN
    -- Get the data type of the status column
    SELECT data_type INTO status_type
    FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'status';
    
    -- If status is already an enum type, we need to modify it to add the new value
    IF status_type = 'USER-DEFINED' THEN
        -- Add the new enum value to the existing enum type
        -- First, get the enum type name
        DECLARE enum_type_name text;
        BEGIN
            SELECT udt_name INTO enum_type_name
            FROM information_schema.columns
            WHERE table_name = 'bookings' AND column_name = 'status';
            
            -- Add the new enum value if it doesn't exist
            IF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumtypid = enum_type_name::regtype::oid
                AND enumlabel = 'confirm_service'
            ) THEN
                -- Add the new enum value 
                EXECUTE 'ALTER TYPE ' || enum_type_name || ' ADD VALUE IF NOT EXISTS ''confirm_service''';
            END IF;
        END;
    ELSE
        -- If status is not an enum type, it's probably a text/varchar column
        -- We don't need to modify the column type, just make sure the application
        -- can handle the new status value
        RAISE NOTICE 'Status column is a % type. No modification needed.', status_type;
    END IF;
END
$$; 