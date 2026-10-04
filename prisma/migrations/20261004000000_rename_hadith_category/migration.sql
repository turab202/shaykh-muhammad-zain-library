UPDATE "categories"
SET
    "name" = 'Hadith',
    "translations" = jsonb_set(
        jsonb_set(COALESCE("translations", '{}'::jsonb), '{ar}', to_jsonb('الحديث'::text), true),
        '{am}',
        to_jsonb('ሐዲስ'::text),
        true
    ),
    "description" = 'Study of the sayings of the Prophet ﷺ',
    "descTranslations" = jsonb_set(
        COALESCE("descTranslations", '{}'::jsonb),
        '{ar}',
        to_jsonb('دراسة أحاديث النبي ﷺ'::text),
        true
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'hadith';