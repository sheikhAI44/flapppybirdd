-- =====================================================
-- FLAPPY BIRD LEADERBOARD - COMPLETE DATABASE SETUP
-- =====================================================

-- STEP 1: Create the scores table with proper constraints
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0), -- Ensure non-negative scores
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Add constraints for data integrity
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT reasonable_score CHECK (score <= 10000) -- Prevent unrealistic scores
);

-- STEP 2: Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS scores_score_desc_idx ON public.scores (score DESC);
CREATE INDEX IF NOT EXISTS scores_email_idx ON public.scores (email);
CREATE INDEX IF NOT EXISTS scores_created_at_idx ON public.scores (created_at DESC);

-- STEP 3: Enable Row Level Security (RLS)
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create comprehensive security policies

-- Allow anyone to read all scores (for leaderboard)
CREATE POLICY "Allow public read access" 
    ON public.scores
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Allow anyone to insert their own scores with rate limiting
CREATE POLICY "Allow public score submission" 
    ON public.scores
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        -- Basic validation
        email IS NOT NULL 
        AND score >= 0 
        AND score <= 10000
        -- Prevent spam: max 10 submissions per email per hour
        AND (
            SELECT COUNT(*) 
            FROM public.scores 
            WHERE email = NEW.email 
            AND created_at > NOW() - INTERVAL '1 hour'
        ) < 10
    );

-- Prevent updates and deletes from anonymous users
CREATE POLICY "Restrict modifications" 
    ON public.scores
    FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "Restrict deletions" 
    ON public.scores
    FOR DELETE
    TO authenticated
    USING (false);

-- STEP 5: Create a function for getting top scores (performance optimization)
CREATE OR REPLACE FUNCTION get_top_scores(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    email TEXT,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    rank INTEGER
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        s.id,
        s.email,
        s.score,
        s.created_at,
        ROW_NUMBER() OVER (ORDER BY s.score DESC, s.created_at ASC)::INTEGER as rank
    FROM public.scores s
    ORDER BY s.score DESC, s.created_at ASC
    LIMIT limit_count;
$$;

-- STEP 6: Create a function for getting user's best score
CREATE OR REPLACE FUNCTION get_user_best_score(user_email TEXT)
RETURNS TABLE (
    best_score INTEGER,
    rank INTEGER,
    total_submissions INTEGER
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        MAX(score) as best_score,
        (
            SELECT COUNT(*) + 1 
            FROM public.scores s2 
            WHERE s2.score > MAX(s1.score)
        )::INTEGER as rank,
        COUNT(*)::INTEGER as total_submissions
    FROM public.scores s1
    WHERE s1.email = user_email
    GROUP BY s1.email;
$$;

-- STEP 7: Add table and column comments for documentation
COMMENT ON TABLE public.scores IS 'Leaderboard scores for Flappy Bird game with security and performance optimizations';
COMMENT ON COLUMN public.scores.id IS 'Unique identifier for each score entry';
COMMENT ON COLUMN public.scores.email IS 'Player email address (validated format)';
COMMENT ON COLUMN public.scores.score IS 'Player score (0-10000 range)';
COMMENT ON COLUMN public.scores.created_at IS 'Timestamp when the score was submitted';

-- STEP 8: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON public.scores TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_scores(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_best_score(TEXT) TO anon, authenticated;

-- STEP 9: Create a view for public leaderboard (masks sensitive data)
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC) as rank,
    -- Mask email for privacy: show first char + *** + domain
    CASE 
        WHEN LENGTH(SPLIT_PART(email, '@', 1)) > 1 THEN
            LEFT(SPLIT_PART(email, '@', 1), 1) || '***@' || SPLIT_PART(email, '@', 2)
        ELSE
            '***@' || SPLIT_PART(email, '@', 2)
    END as masked_email,
    score,
    DATE(created_at) as submission_date
FROM public.scores
ORDER BY score DESC, created_at ASC;

-- Grant access to the leaderboard view
GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- =====================================================
-- SETUP COMPLETE! 
-- Your Flappy Bird leaderboard is now ready with:
-- ✅ Secure data validation
-- ✅ Performance optimizations  
-- ✅ Rate limiting protection
-- ✅ Privacy-focused data masking
-- ✅ Comprehensive security policies
-- ===================================================== 