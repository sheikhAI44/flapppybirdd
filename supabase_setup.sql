-- STEP 1: Create the scores table
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STEP 2: Enable Row Level Security (RLS)
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- STEP 3: Create policy to allow anyone to insert records
CREATE POLICY "Allow anyone to insert scores" 
    ON public.scores
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- STEP 4: Create policy to allow anyone to read all records
CREATE POLICY "Allow anyone to read all scores" 
    ON public.scores
    FOR SELECT
    TO anon
    USING (true);

-- STEP 5: Create an index for faster sorting by score (descending)
CREATE INDEX IF NOT EXISTS scores_score_desc_idx ON public.scores (score DESC);

-- STEP 6: Comment the table and columns for better documentation
COMMENT ON TABLE public.scores IS 'Table storing player scores for Flappy Bird game';
COMMENT ON COLUMN public.scores.id IS 'Unique identifier for each score entry';
COMMENT ON COLUMN public.scores.email IS 'Player email address';
COMMENT ON COLUMN public.scores.score IS 'Player score value';
COMMENT ON COLUMN public.scores.created_at IS 'Timestamp when the score was recorded'; 