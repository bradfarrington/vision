// Default body_blocks / body_settings for each system_email_templates.key.
// The migration seeds the rows with empty blocks; the builder falls back to
// these defaults when opening a system template that hasn't been customised
// yet, and persists them on first save.
//
// Merge tags used by these templates:
//   {{recipient_name}}        — full name of the recipient (staff member)
//   {{recipient_first_name}}  — first name only
//   {{org_name}}              — organisation name
//   {{invite_link}}           — invite acceptance URL (staff_invite only)
//   {{inviter_name}}          — who invited them (staff_invite only)
//   {{reset_link}}            — password reset URL (password_reset only)
//   {{notification_title}}    — notification headline
//   {{notification_body}}     — notification body text
//   {{notification_link}}     — deep link into the CRM (e.g. /cases/abc/triage)
//   {{sender_name}}           — staff member who sent a portal chat message
//   {{message_preview}}       — first 240 chars of a portal chat message
//   {{current_date}}, {{current_year}}

import { BRAND } from './constants';
import type { BlockData } from './constants';

/* Fixed UUIDs — system templates are seeded once and the block IDs are
   only used for keying React lists; collisions across templates are fine. */
const uid = (suffix: string) => `sys-${suffix}`;

interface SystemTemplateDefault {
  blocks: BlockData[];
  settings: Record<string, any>;
}

const baseSettings = {
  width: 600,
  bodyBg: '#f5f5f5',
  contentBg: '#ffffff',
  fontFamily: "'Inter', sans-serif",
  textColor: '#1f2937',
  linkColor: BRAND,
  logoUrl: '',
  footerText: '&copy; {{current_year}} {{org_name}}',
};

function heading(key: string, content: string): BlockData {
  return {
    id: uid(`h-${key}`), type: 'heading',
    data: { content, level: 'h2', color: '', bgColor: '', fontFamily: '', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  };
}

function text(key: string, content: string): BlockData {
  return {
    id: uid(`t-${key}`), type: 'text',
    data: { content, color: '', bgColor: '', fontFamily: '', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  };
}

function button(key: string, label: string, link: string): BlockData {
  return {
    id: uid(`b-${key}`), type: 'button',
    data: {
      text: label, link, align: 'center',
      bgColor: BRAND, textColor: '#ffffff', borderRadius: '8',
      fullWidth: false, fontSize: '15', fontWeight: '600',
      paddingV: '12', paddingH: '32', fontFamily: '',
      padding: { top: 12, right: 0, bottom: 12, left: 0 },
    },
  };
}

function spacer(key: string, height = '16'): BlockData {
  return { id: uid(`s-${key}`), type: 'spacer', data: { height, bgColor: '', padding: { top: 0, right: 0, bottom: 0, left: 0 } } };
}

const TEMPLATES: Record<string, SystemTemplateDefault> = {
  staff_invite: {
    settings: { ...baseSettings, subject: "You're invited to {{org_name}} CRM", previewText: 'Accept your invite to get started.' },
    blocks: [
      heading('si-1', '<p>You\'re invited to {{org_name}}</p>'),
      text('si-1', '<p>Hi {{recipient_first_name}},</p><p>{{inviter_name}} has invited you to join the {{org_name}} CRM. Click the button below to accept your invite, set your password and get started.</p>'),
      button('si-1', 'Accept invite', '{{invite_link}}'),
      text('si-2', '<p style="font-size:13px;color:#5A6670">This invite link expires in 7 days.</p>'),
      spacer('si-1'),
      text('si-3', '<p style="font-size:12px;color:#8A929B">If you weren\'t expecting this invitation, you can safely ignore this email.</p>'),
    ],
  },

  password_reset: {
    settings: { ...baseSettings, subject: 'Reset your {{org_name}} CRM password', previewText: 'Click the link inside to choose a new password.' },
    blocks: [
      heading('pr-1', '<p>Reset your password</p>'),
      text('pr-1', '<p>Hi {{recipient_first_name}},</p><p>We got a request to reset the password on your {{org_name}} CRM account. Click the button below to choose a new password.</p>'),
      button('pr-1', 'Reset password', '{{reset_link}}'),
      text('pr-2', '<p style="font-size:13px;color:#5A6670">This link expires in 1 hour and can only be used once.</p>'),
      spacer('pr-1'),
      text('pr-3', '<p style="font-size:12px;color:#8A929B">If you didn\'t ask to reset your password, you can safely ignore this email — your current password will keep working.</p>'),
    ],
  },

  portal_message_received: {
    settings: { ...baseSettings, subject: 'New message from {{sender_name}}', previewText: '{{message_preview}}' },
    blocks: [
      heading('pmr-1', '<p>You have a new message</p>'),
      text('pmr-1', '<p>Hi {{recipient_first_name}},</p><p>{{sender_name}} has just sent you a message in your {{org_name}} space.</p>'),
      text('pmr-2', '<p style="padding:12px;background:#F4F0FA;border-left:3px solid #4B0082;border-radius:4px;font-style:italic">{{message_preview}}</p>'),
      text('pmr-3', '<p>Log in to your space to read it and reply.</p>'),
      spacer('pmr-1'),
      text('pmr-4', '<p style="font-size:12px;color:#8A929B">You\'re getting this because someone from your support team has sent you a message in your {{org_name}} space.</p>'),
    ],
  },

  member_password_reset: {
    settings: { ...baseSettings, subject: 'Reset your {{org_name}} password', previewText: 'Tap the link inside to choose a new password.' },
    blocks: [
      heading('mpr-1', '<p>Reset your password</p>'),
      text('mpr-1', '<p>Hi {{recipient_first_name}},</p><p>We got a request to reset the password for your {{org_name}} member space. Tap the button below to choose a new password.</p>'),
      button('mpr-1', 'Reset password', '{{reset_link}}'),
      text('mpr-2', '<p style="font-size:13px;color:#5A6670">This link expires in 1 hour and can only be used once.</p>'),
      spacer('mpr-1'),
      text('mpr-3', '<p style="font-size:12px;color:#8A929B">If you didn\'t ask for this, you can safely ignore this email — your current password will keep working.</p>'),
    ],
  },

  notif_overdue_action: {
    settings: { ...baseSettings, subject: 'Overdue action: {{notification_title}}', previewText: '{{notification_body}}' },
    blocks: [
      heading('oa-1', '<p>⏰ Overdue action</p>'),
      text('oa-1', '<p>Hi {{recipient_first_name}},</p><p>The following action is now overdue:</p>'),
      text('oa-2', '<p style="padding:12px;background:#FFF3E0;border-left:3px solid #E67E22;border-radius:4px"><strong>{{notification_title}}</strong><br>{{notification_body}}</p>'),
      button('oa-1', 'Open in CRM', '{{notification_link}}'),
    ],
  },

  notif_new_referral: {
    settings: { ...baseSettings, subject: 'New referral: {{notification_title}}', previewText: '{{notification_body}}' },
    blocks: [
      heading('nr-1', '<p>📥 New referral submitted</p>'),
      text('nr-1', '<p>Hi {{recipient_first_name}},</p><p>A new referral has been submitted:</p>'),
      text('nr-2', '<p style="padding:12px;background:#F0F7FB;border-left:3px solid #2F6FA3;border-radius:4px"><strong>{{notification_title}}</strong><br>{{notification_body}}</p>'),
      button('nr-1', 'Review referral', '{{notification_link}}'),
    ],
  },

  notif_safeguarding_flag: {
    settings: { ...baseSettings, subject: 'Safeguarding alert: {{notification_title}}', previewText: '{{notification_body}}' },
    blocks: [
      heading('sf-1', '<p style="color:#C0392B">🛡 Safeguarding alert</p>'),
      text('sf-1', '<p>Hi {{recipient_first_name}},</p><p>A safeguarding indicator has been raised that requires your attention as a Designated Safeguarding Lead:</p>'),
      text('sf-2', '<p style="padding:12px;background:#FBEAE8;border-left:3px solid #C0392B;border-radius:4px"><strong>{{notification_title}}</strong><br>{{notification_body}}</p>'),
      button('sf-1', 'Open case triage', '{{notification_link}}'),
      spacer('sf-1'),
      text('sf-3', '<p style="font-size:12px;color:#8A929B">Please review and follow up promptly. A safeguarding follow-up action has been opened automatically on the case.</p>'),
    ],
  },

  notif_rag_change: {
    settings: { ...baseSettings, subject: 'RAG status changed: {{notification_title}}', previewText: '{{notification_body}}' },
    blocks: [
      heading('rg-1', '<p>📊 RAG status update</p>'),
      text('rg-1', '<p>Hi {{recipient_first_name}},</p><p>A triage domain RAG rating has changed:</p>'),
      text('rg-2', '<p style="padding:12px;background:#FBF3E4;border-left:3px solid #E67E22;border-radius:4px"><strong>{{notification_title}}</strong><br>{{notification_body}}</p>'),
      button('rg-1', 'View case', '{{notification_link}}'),
    ],
  },

  notif_task_reminder: {
    settings: { ...baseSettings, subject: 'Task reminder: {{notification_title}}', previewText: '{{notification_body}}' },
    blocks: [
      heading('tr-1', '<p>🔔 Task reminder</p>'),
      text('tr-1', '<p>Hi {{recipient_first_name}},</p><p>You have a task that needs your attention:</p>'),
      text('tr-2', '<p style="padding:12px;background:#FFF8E1;border-left:3px solid #8A6600;border-radius:4px"><strong>{{notification_title}}</strong><br>{{notification_body}}</p>'),
      button('tr-1', 'Open task', '{{notification_link}}'),
    ],
  },

  notif_system: {
    settings: { ...baseSettings, subject: '{{notification_title}}', previewText: '{{notification_body}}' },
    blocks: [
      heading('sm-1', '<p>{{notification_title}}</p>'),
      text('sm-1', '<p>Hi {{recipient_first_name}},</p><p>{{notification_body}}</p>'),
      button('sm-1', 'Open in CRM', '{{notification_link}}'),
    ],
  },

  training_invite: {
    settings: { ...baseSettings, subject: "You're invited to {{event_title}}", previewText: '{{event_date}} — see you there.' },
    blocks: [
      heading('ti-1', '<p>You\'re invited to {{event_title}}</p>'),
      text('ti-1', '<p>Hi {{recipient_first_name}},</p><p>{{org_name}} would like to invite you to <strong>{{event_title}}</strong>.</p>'),
      text('ti-2', '<p style="padding:12px;background:#F4F0FA;border-left:3px solid #4B0082;border-radius:4px"><strong>Date:</strong> {{event_date}}<br><strong>Time:</strong> {{event_time}}<br><strong>Where:</strong> {{event_location}}</p>'),
      text('ti-3', '{{event_join_block}}'),
      spacer('ti-1'),
      text('ti-4', '<p style="font-size:12px;color:#8A929B">If you can\'t make it, no need to reply — just don\'t join on the day.</p>'),
    ],
  },
};

export const SYSTEM_TEMPLATE_KEYS = Object.keys(TEMPLATES);

export function getSystemTemplateDefault(key: string): SystemTemplateDefault | null {
  return TEMPLATES[key] || null;
}

/* Sample merge values used for builder previews + test sends so the
   email looks realistic before it's persisted with real data. */
export const SYSTEM_SAMPLE_DATA: Record<string, string> = {
  '{{recipient_name}}':         'Alex Morgan',
  '{{recipient_first_name}}':   'Alex',
  '{{org_name}}':               'GamLEARN',
  '{{invite_link}}':            'https://gamlearn.example/accept-invite?token=preview',
  '{{inviter_name}}':           'Sam Patel',
  '{{reset_link}}':             'https://gamlearn.example/reset-password?token=preview',
  '{{notification_title}}':     'Sample notification headline',
  '{{notification_body}}':      'This is a sample of what the notification body will look like in your inbox.',
  '{{notification_link}}':      'https://gamlearn.example/today',
  '{{event_title}}':            'Money Worries Workshop',
  '{{event_date}}':             'Saturday, 12 June 2026',
  '{{event_time}}':             '10:00 – 12:00',
  '{{event_location}}':         'Online',
  '{{event_join_url}}':         'https://teams.microsoft.com/l/meetup-join/preview',
  '{{event_join_block}}':       '<p style="padding:12px;background:#E8F6EE;border-left:3px solid #00664D;border-radius:4px"><strong>Join on the day:</strong> <a href="https://teams.microsoft.com/l/meetup-join/preview" style="color:#00664D">https://teams.microsoft.com/l/meetup-join/preview</a></p>',
  '{{sender_name}}':            'Sam Patel',
  '{{message_preview}}':        'Just checking in to see how you got on with the action plan we agreed last week — let me know when you have a moment.',
  '{{current_date}}':           new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  '{{current_year}}':           String(new Date().getFullYear()),
};
