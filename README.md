# Flappy Bird Clone

A simple Flappy Bird game implementation using p5.js with no external assets, built entirely with custom-drawn shapes. Features include a leaderboard system using Supabase.

## How to Play

1. Open `index.html` in a web browser
2. Press the Spacebar or click/tap to start the game
3. Press Spacebar or click/tap to make the bird flap upward
4. Avoid hitting the pipes, the ground, or the top of the screen
5. Each pipe you pass through earns you one point
6. When game over, you can submit your score to the leaderboard

## Game Controls

- **Spacebar/Click/Tap**: Start game, make the bird flap, restart after game over
- **Trophy Icon**: View the leaderboard

## Game Features

- Custom-drawn bird and pipe graphics (no external assets)
- Physics-based bird movement with gravity
- Randomly generated pipe gaps
- Pixel-style score counter with visual effects
- Enhanced backgrounds with gradients and animated clouds
- Particle effects for score and game over
- Sound effects (flap, scoring, collision) and background music
- Smooth transitions between game states
- Bird rotation based on velocity
- Global leaderboard with Supabase

## Leaderboard Setup

To enable the leaderboard functionality, you need to set up a Supabase project:

1. Create an account at [Supabase](https://supabase.com/) if you don't have one
2. Create a new project
3. In your project's SQL Editor, run the following SQL commands to create the required table:

```sql
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone to insert scores" 
    ON public.scores
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anyone to read all scores" 
    ON public.scores
    FOR SELECT
    TO anon
    USING (true);
```

4. Update the `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables in `supabase.js` with your project's URL and anon key (found in your Supabase project settings under API)

## Implementation Details

The game uses p5.js for rendering and is built with:
- `index.html`: HTML file that loads the p5.js library and the game code
- `style.css`: Basic styling to center the game canvas and format the leaderboard
- `sketch.js`: Main game logic and drawing functions
- `supabase.js`: Supabase configuration and database operations
- `leaderboard.js`: Leaderboard UI and integration with the game
- `supabase_setup.sql`: SQL commands to set up the Supabase database

## Credits

Sound effects are generated using Web Audio API and were inspired by the original Flappy Bird game. 