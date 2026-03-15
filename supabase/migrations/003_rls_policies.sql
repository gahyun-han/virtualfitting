-- Enable RLS
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE try_on_jobs ENABLE ROW LEVEL SECURITY;

-- Wardrobe items policies
CREATE POLICY "Users can view own wardrobe" ON wardrobe_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wardrobe" ON wardrobe_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wardrobe" ON wardrobe_items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wardrobe" ON wardrobe_items
    FOR DELETE USING (auth.uid() = user_id);

-- Try-on jobs policies
CREATE POLICY "Users can view own try-on jobs" ON try_on_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own try-on jobs" ON try_on_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own try-on jobs" ON try_on_jobs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own try-on jobs" ON try_on_jobs
    FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket policies (run in Supabase dashboard or via SQL)
-- Buckets to create: wardrobe-originals, wardrobe-segmented, wardrobe-thumbnails (public), tryon-person, tryon-results
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('wardrobe-originals', 'wardrobe-originals', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('wardrobe-segmented', 'wardrobe-segmented', false, 10485760, ARRAY['image/png']),
    ('wardrobe-thumbnails', 'wardrobe-thumbnails', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp']),
    ('tryon-person', 'tryon-person', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('tryon-results', 'tryon-results', false, 20971520, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users manage own originals" ON storage.objects
    FOR ALL USING (bucket_id = 'wardrobe-originals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users manage own segmented" ON storage.objects
    FOR ALL USING (bucket_id = 'wardrobe-segmented' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read thumbnails" ON storage.objects
    FOR SELECT USING (bucket_id = 'wardrobe-thumbnails');

CREATE POLICY "Users manage own thumbnails" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'wardrobe-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users manage own person images" ON storage.objects
    FOR ALL USING (bucket_id = 'tryon-person' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users manage own tryon results" ON storage.objects
    FOR ALL USING (bucket_id = 'tryon-results' AND auth.uid()::text = (storage.foldername(name))[1]);
