CREATE TABLE try_on_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wardrobe_item_id    UUID REFERENCES wardrobe_items(id) ON DELETE SET NULL,
    person_image_url    TEXT NOT NULL,
    result_url          TEXT,
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    replicate_job_id    TEXT,
    error_message       TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_try_on_jobs_user_id ON try_on_jobs(user_id);
CREATE INDEX idx_try_on_jobs_status ON try_on_jobs(status);
