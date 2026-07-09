-- Create the public profiles table linked to Supabase Auth
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL,
  primary_role TEXT NOT NULL,
  domain_of_focus TEXT NOT NULL,
  referral_source TEXT NOT NULL,                                      -- ← new
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Data Integrity Constraints
  CONSTRAINT min_length_full_name CHECK (char_length(trim(full_name)) >= 2),
  CONSTRAINT min_length_username  CHECK (char_length(trim(username)) >= 3),
  CONSTRAINT clean_username       CHECK (username ~ '^[a-z0-9_]+$')  -- Forces lowercase, numbers, underscores
);

-- Create a unique index for case-insensitive username lookups
CREATE UNIQUE INDEX profiles_username_idx ON public.profiles (lower(username));

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow individual profile insertion"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow public/individual profile reading"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Allow individual profile updating"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);