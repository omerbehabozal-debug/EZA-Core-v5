-- Add soft delete columns to production_intent_logs
ALTER TABLE production_intent_logs 
ADD COLUMN IF NOT EXISTS deleted_by_user BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE production_intent_logs 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE production_intent_logs 
ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID;

-- Create index on deleted_by_user for faster filtering
CREATE INDEX IF NOT EXISTS ix_production_intent_logs_deleted_by_user 
ON production_intent_logs(deleted_by_user);

-- Add foreign key constraint for deleted_by_user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_intent_logs_deleted_by_user'
    ) THEN
        ALTER TABLE production_intent_logs
        ADD CONSTRAINT fk_intent_logs_deleted_by_user
        FOREIGN KEY (deleted_by_user_id) 
        REFERENCES production_users(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Add soft delete columns to production_impact_events
ALTER TABLE production_impact_events 
ADD COLUMN IF NOT EXISTS deleted_by_user BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE production_impact_events 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE production_impact_events 
ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID;

-- Create index on deleted_by_user for faster filtering
CREATE INDEX IF NOT EXISTS ix_production_impact_events_deleted_by_user 
ON production_impact_events(deleted_by_user);

-- Add foreign key constraint for deleted_by_user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_impact_events_deleted_by_user'
    ) THEN
        ALTER TABLE production_impact_events
        ADD CONSTRAINT fk_impact_events_deleted_by_user
        FOREIGN KEY (deleted_by_user_id) 
        REFERENCES production_users(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

