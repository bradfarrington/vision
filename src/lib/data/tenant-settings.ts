import "server-only";

import { createClient } from "@/lib/supabase/server";
import { WORK_CATEGORIES, type WorkCategory } from "@/lib/appointments";

// ---------------------------------------------------------------------------
// Per-tenant display settings (`public.tenant_settings`, one row per company).
//
// FAILS SOFT everywhere: schema here is applied by hand, so until the migration
// is run the diary must render in its default colours rather than erroring out
// — the same rule the saved views follow.
// ---------------------------------------------------------------------------

/** One hex per job category. Absent keys fall back to the platform default. */
export type DiaryColours = Partial<Record<WorkCategory, string>>;

export type TenantSettings = {
  diaryColours: DiaryColours;
};

const EMPTY: TenantSettings = { diaryColours: {} };

export async function getTenantSettings(): Promise<TenantSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenant_settings")
      .select("settings")
      .maybeSingle();
    if (error || !data) return EMPTY;

    const settings = (data.settings ?? {}) as Record<string, unknown>;
    const raw = (settings.diaryColours ?? {}) as Record<string, unknown>;
    const diaryColours: DiaryColours = {};
    for (const c of WORK_CATEGORIES) {
      const v = raw[c.key];
      // Only well-formed hex is trusted — this ends up in a style attribute.
      if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) diaryColours[c.key] = v;
    }
    return { diaryColours };
  } catch {
    return EMPTY;
  }
}
