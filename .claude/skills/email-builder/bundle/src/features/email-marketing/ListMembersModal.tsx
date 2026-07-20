import { useEffect, useState, useMemo } from 'react';
import { Icon, Button, Avatar } from '../../components/ui/primitives';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  listId: string;
  onClose: () => void;
}

interface Person {
  id: string;
  full_name: string;
  email: string | null;
  ref_code: string;
  avatar_tint: number;
  roles: string[];
}

export default function ListMembersModal({ listId, onClose }: Props) {
  const { user } = useAuth();
  const [listName, setListName] = useState('');
  const [members, setMembers] = useState<Person[]>([]);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: list }, { data: memberRows }, { data: people }] = await Promise.all([
        supabase.from('comms_lists').select('name').eq('id', listId).maybeSingle(),
        supabase.from('comms_list_members').select('person_id, person:people(id, full_name, email, ref_code, avatar_tint, roles)').eq('list_id', listId),
        supabase.from('people').select('id, full_name, email, ref_code, avatar_tint, roles').order('full_name'),
      ]);
      if (list) setListName(list.name);
      if (memberRows) setMembers((memberRows as any[]).map(r => r.person).filter(Boolean));
      if (people) setAllPeople(people as Person[]);
      setLoading(false);
    })();
  }, [listId]);

  const memberIds = useMemo(() => new Set(members.map(m => m.id)), [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPeople;
    return allPeople.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      p.ref_code.toLowerCase().includes(q),
    );
  }, [allPeople, search]);

  async function toggle(personId: string) {
    setSaving(true);
    if (memberIds.has(personId)) {
      await supabase.from('comms_list_members').delete().eq('list_id', listId).eq('person_id', personId);
      setMembers(prev => prev.filter(p => p.id !== personId));
    } else {
      await supabase.from('comms_list_members').insert({ list_id: listId, person_id: personId, added_by: user?.id });
      const person = allPeople.find(p => p.id === personId);
      if (person) setMembers(prev => [...prev, person]);
    }
    setSaving(false);
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{listName || 'List members'}</h3>
            <div style={{ fontSize: 12, color: '#8A929B', marginTop: 4 }}>{members.length} {members.length === 1 ? 'person' : 'people'} on this list</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', color: '#5A6670' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid #EEF1F3' }}>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#8A929B' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people by name, email or ref…"
              style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #E1E5E8', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#8A929B' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#8A929B', fontSize: 13 }}>No people match this search.</div>
          ) : filtered.map(p => {
            const isMember = memberIds.has(p.id);
            return (
              <button key={p.id} onClick={() => toggle(p.id)} disabled={saving || !p.email}
                title={!p.email ? 'No email on this person — cannot be added' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '10px 20px',
                  border: 'none', borderBottom: '1px solid #F5F7F8',
                  background: isMember ? '#F5F0FA' : '#fff',
                  cursor: !p.email ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  opacity: !p.email ? 0.5 : 1,
                }}>
                <Avatar name={p.full_name} size={32} tint={p.avatar_tint} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{p.full_name}</div>
                  <div style={{ fontSize: 12, color: '#8A929B', marginTop: 2 }}>
                    {p.ref_code}{p.email ? ` · ${p.email}` : ' · No email'}
                  </div>
                </div>
                {isMember ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4B0082', fontSize: 12, fontWeight: 600 }}>
                    <Icon name="check" size={14} /> On list
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: '#8A929B' }}>Add</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={footerStyle}>
          <div style={{ flex: 1, fontSize: 12, color: '#8A929B' }}>
            Click a person to add or remove them.
          </div>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modalStyle: React.CSSProperties = {
  width: 600, maxWidth: '92vw', maxHeight: '85vh', background: '#fff', borderRadius: 12,
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', borderBottom: '1px solid #EEF1F3',
};
const footerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 20px', borderTop: '1px solid #EEF1F3',
};
