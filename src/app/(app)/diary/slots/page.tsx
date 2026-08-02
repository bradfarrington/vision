import { getDiaryStaff } from "@/lib/data/staff";
import { getTenantOptionLists } from "@/lib/data/customer-record";
import { Icon } from "@/components/crm/primitives";
import { SlotFinder } from "@/components/crm/slot-finder";
import { RememberedLink } from "@/components/crm/view-state";

// Next available slot (design screen 09) — the answer to the New Lead wizard's
// old "Live availability coming soon" note.

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function SlotsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [staff, opts] = await Promise.all([
    getDiaryStaff(),
    getTenantOptionLists(["appointment_type"]),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-[26px] py-[22px]">
      <RememberedLink
        href="/diary"
        className="inline-flex w-fit items-center gap-1 text-[12.5px] text-[#71717a] hover:text-[#3f3f46]"
      >
        <Icon name="chevron-left" size={14} strokeWidth={1.75} />
        Diary
      </RememberedLink>

      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          Next available slot
        </h1>
        <span className="text-[12.5px] text-[#71717a]">
          Searches the diary for gaps that fit the whole team
        </span>
      </div>

      <SlotFinder
        staff={staff}
        types={opts.appointment_type ?? []}
        leadId={sp.lead ?? null}
        contractId={sp.contract ?? null}
        customerId={sp.customer ?? null}
      />
    </div>
  );
}
