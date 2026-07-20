/* @ds-bundle: {"format":4,"namespace":"VisionDesignSystem_7d86eb","components":[{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Avatar","sourcePath":"components/display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"Stat","sourcePath":"components/display/Stat.jsx"},{"name":"Tag","sourcePath":"components/display/Tag.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"ProgressBar","sourcePath":"components/feedback/ProgressBar.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Breadcrumb","sourcePath":"components/navigation/Breadcrumb.jsx"},{"name":"NavItem","sourcePath":"components/navigation/NavItem.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Dialog","sourcePath":"components/overlay/Dialog.jsx"}],"sourceHashes":{"components/data/Table.jsx":"89cba8f051ac","components/display/Avatar.jsx":"7db76b6f6fa0","components/display/Badge.jsx":"fbb904718e15","components/display/Card.jsx":"97ca927cef5b","components/display/Stat.jsx":"3c15515d3622","components/display/Tag.jsx":"b299a0f0f1fb","components/feedback/Alert.jsx":"dcf70e3b4386","components/feedback/ProgressBar.jsx":"fae038cbf1cb","components/feedback/Toast.jsx":"1af96a503b30","components/feedback/Tooltip.jsx":"ad743e9458de","components/forms/Button.jsx":"2059bc8063f6","components/forms/Checkbox.jsx":"ccd96078f89d","components/forms/IconButton.jsx":"6b20ecb33a6b","components/forms/Input.jsx":"65e05c312d4d","components/forms/Radio.jsx":"624946ae6d8e","components/forms/Select.jsx":"65e611ee191c","components/forms/Switch.jsx":"c6fc72bb7b7e","components/forms/Textarea.jsx":"7c9558f7c09e","components/navigation/Breadcrumb.jsx":"393e259449ba","components/navigation/NavItem.jsx":"980b94e5e8b6","components/navigation/Tabs.jsx":"f6dca63b9cf1","components/overlay/Dialog.jsx":"91d655776d0a","ui_kits/vision-app/AppShell.jsx":"cc75de83a242","ui_kits/vision-app/Dashboard.jsx":"48ec59298604","ui_kits/vision-app/Diary.jsx":"711bb88853eb","ui_kits/vision-app/LeadDetail.jsx":"a62ed8359473","ui_kits/vision-app/Leads.jsx":"6510cf2d45c8","ui_kits/vision-app/data.js":"5280c99c1740","ui_kits/vision-app/icons.js":"9c75244173e6"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.VisionDesignSystem_7d86eb = window.VisionDesignSystem_7d86eb || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data/Table.jsx
try { (() => {
/**
 * Vision Table — dense data table with hairline rows, hover, optional row click.
 * columns: [{ key, header, width, align, render(row) }]
 */
function Table({
  columns = [],
  rows = [],
  onRowClick,
  selectable = false,
  style = {}
}) {
  const [hovered, setHovered] = React.useState(-1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      overflowX: 'auto',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--vs-white)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      textAlign: c.align || 'left',
      padding: '11px 16px',
      fontSize: 11.5,
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      background: 'var(--vs-neutral-50)',
      borderBottom: '1px solid var(--border-hairline)',
      whiteSpace: 'nowrap',
      width: c.width
    }
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: row.id ?? i,
    onClick: onRowClick ? () => onRowClick(row) : undefined,
    onMouseEnter: () => setHovered(i),
    onMouseLeave: () => setHovered(-1),
    style: {
      background: hovered === i ? 'var(--vs-neutral-50)' : 'transparent',
      cursor: onRowClick ? 'pointer' : 'default',
      transition: 'background var(--dur-fast)'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      textAlign: c.align || 'left',
      padding: '12px 16px',
      fontSize: 14,
      color: 'var(--text-body)',
      borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border-hairline)',
      whiteSpace: c.wrap ? 'normal' : 'nowrap'
    }
  }, c.render ? c.render(row) : row[c.key])))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/display/Avatar.jsx
try { (() => {
/** Vision Avatar — initials or image; graphite fallback, blue optional. */
function Avatar({
  name = '',
  src = null,
  size = 36,
  color = 'neutral',
  style = {}
}) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const colors = {
    neutral: {
      bg: 'var(--vs-neutral-150)',
      fg: 'var(--vs-neutral-700)'
    },
    ink: {
      bg: 'var(--vs-ink)',
      fg: '#fff'
    },
    blue: {
      bg: 'var(--vs-blue-tint-strong)',
      fg: 'var(--accent-active)'
    }
  };
  const c = colors[color] || colors.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      background: src ? 'var(--vs-neutral-100)' : c.bg,
      color: c.fg,
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: size * 0.38,
      letterSpacing: '-0.01em',
      border: '1px solid rgba(16,20,24,0.06)',
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
/** Vision Badge — status pill for pipeline stages, job states, counts. */
function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  style = {}
}) {
  const variants = {
    neutral: {
      bg: 'var(--vs-neutral-100)',
      fg: 'var(--vs-neutral-700)',
      dot: 'var(--vs-neutral-500)'
    },
    blue: {
      bg: 'var(--vs-blue-tint)',
      fg: 'var(--accent-active)',
      dot: 'var(--accent)'
    },
    success: {
      bg: 'var(--vs-success-tint)',
      fg: '#137a4a',
      dot: 'var(--vs-success)'
    },
    warning: {
      bg: 'var(--vs-warning-tint)',
      fg: '#96600f',
      dot: 'var(--vs-warning)'
    },
    danger: {
      bg: 'var(--vs-danger-tint)',
      fg: '#a83232',
      dot: 'var(--vs-danger)'
    },
    outline: {
      bg: 'transparent',
      fg: 'var(--vs-neutral-600)',
      dot: 'var(--vs-neutral-400)',
      border: '1px solid var(--border-default)'
    }
  };
  const v = variants[variant] || variants.neutral;
  const sizes = {
    sm: {
      fs: 11,
      py: 2,
      px: 7,
      h: 18
    },
    md: {
      fs: 12,
      py: 3,
      px: 9,
      h: 22
    }
  };
  const s = sizes[size] || sizes.md;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      height: s.h,
      padding: `0 ${s.px}px`,
      background: v.bg,
      color: v.fg,
      border: v.border || 'none',
      borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-body)',
      fontSize: s.fs,
      fontWeight: 600,
      letterSpacing: '-0.002em',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: v.dot,
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Vision Card — white surface, hairline border, soft/no shadow. 12–16px radius. */
function Card({
  padding = 20,
  radius = 'lg',
  hover = false,
  header = null,
  footer = null,
  style = {},
  children,
  onClick,
  ...rest
}) {
  const [h, setH] = React.useState(false);
  const radii = {
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: radii[radius] || radii.lg,
      overflow: 'hidden',
      boxShadow: hover && h ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      transition: 'box-shadow var(--dur-med) var(--ease-standard), border-color var(--dur-med)',
      cursor: onClick ? 'pointer' : 'default',
      ...style
    }
  }, rest), header && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      borderBottom: '1px solid var(--border-hairline)',
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 15,
      letterSpacing: '-0.014em',
      color: 'var(--text-strong)'
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 18px',
      borderTop: '1px solid var(--border-hairline)',
      background: 'var(--vs-neutral-50)'
    }
  }, footer));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/Stat.jsx
try { (() => {
/** Vision Stat — KPI figure for dashboards, with optional delta and label. */
function Stat({
  label,
  value,
  delta = null,
  trend = 'up',
  icon = null,
  style = {}
}) {
  const up = trend === 'up';
  const deltaColor = delta == null ? undefined : up ? 'var(--vs-success)' : 'var(--vs-danger)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 16,
      height: 16,
      color: 'var(--text-subtle)'
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--text-muted)',
      letterSpacing: '0.01em'
    }
  }, label)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: '-0.025em',
      color: 'var(--text-strong)',
      lineHeight: 1
    }
  }, value), delta != null && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      color: deltaColor
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      transform: up ? 'none' : 'rotate(180deg)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 19V5M5 12l7-7 7 7"
  })), delta)));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Stat.jsx", error: String((e && e.message) || e) }); }

// components/display/Tag.jsx
try { (() => {
/** Vision Tag — removable label/chip for filters, categories, assignees. */
function Tag({
  children,
  onRemove,
  color = 'neutral',
  style = {}
}) {
  const colors = {
    neutral: {
      bg: 'var(--vs-neutral-100)',
      fg: 'var(--vs-neutral-700)'
    },
    blue: {
      bg: 'var(--vs-blue-tint)',
      fg: 'var(--accent-active)'
    }
  };
  const c = colors[color] || colors.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: onRemove ? '0 4px 0 9px' : '0 9px',
      background: c.bg,
      color: c.fg,
      borderRadius: 'var(--radius-md)',
      fontFamily: 'var(--font-body)',
      fontSize: 12.5,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      ...style
    }
  }, children, onRemove && /*#__PURE__*/React.createElement("button", {
    onClick: onRemove,
    "aria-label": "Remove",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 16,
      height: 16,
      border: 'none',
      background: 'transparent',
      color: 'currentColor',
      opacity: 0.6,
      cursor: 'pointer',
      borderRadius: 4,
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  }))));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
/** Vision Alert — inline message banner: info / success / warning / danger. */
function Alert({
  variant = 'info',
  title,
  children,
  icon = null,
  onClose,
  style = {}
}) {
  const variants = {
    info: {
      bg: 'var(--vs-info-tint)',
      border: '#cfe1fb',
      fg: 'var(--accent-active)',
      ic: 'var(--accent)'
    },
    success: {
      bg: 'var(--vs-success-tint)',
      border: '#c6e8d5',
      fg: '#137a4a',
      ic: 'var(--vs-success)'
    },
    warning: {
      bg: 'var(--vs-warning-tint)',
      border: '#f0dcb4',
      fg: '#96600f',
      ic: 'var(--vs-warning)'
    },
    danger: {
      bg: 'var(--vs-danger-tint)',
      border: '#f4cccc',
      fg: '#a83232',
      ic: 'var(--vs-danger)'
    }
  };
  const v = variants[variant] || variants.info;
  const defaultIcons = {
    info: /*#__PURE__*/React.createElement("path", {
      d: "M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"
    }),
    success: /*#__PURE__*/React.createElement("path", {
      d: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3"
    }),
    warning: /*#__PURE__*/React.createElement("path", {
      d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01"
    }),
    danger: /*#__PURE__*/React.createElement("path", {
      d: "M12 8v4M12 16h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"
    })
  };
  return /*#__PURE__*/React.createElement("div", {
    role: "alert",
    style: {
      display: 'flex',
      gap: 11,
      alignItems: 'flex-start',
      padding: '12px 14px',
      background: v.bg,
      border: `1px solid ${v.border}`,
      borderRadius: 'var(--radius-md)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      flexShrink: 0,
      marginTop: 1,
      color: v.ic
    }
  }, icon || /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, defaultIcons[variant])), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      fontWeight: 600,
      color: v.fg,
      marginBottom: children ? 3 : 0
    }
  }, title), children && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 13.5,
      lineHeight: 1.5,
      color: 'var(--text-body)'
    }
  }, children)), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Dismiss",
    style: {
      display: 'inline-flex',
      border: 'none',
      background: 'transparent',
      color: v.fg,
      opacity: 0.6,
      cursor: 'pointer',
      padding: 2,
      marginTop: -1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  }))));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressBar.jsx
try { (() => {
/** Vision ProgressBar — thin blue track for completion, capacity, workflow progress. */
function ProgressBar({
  value = 0,
  max = 100,
  label,
  showValue = false,
  size = 'md',
  color = 'blue',
  style = {}
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const h = size === 'sm' ? 4 : size === 'lg' ? 10 : 6;
  const colors = {
    blue: 'var(--accent)',
    success: 'var(--vs-success)',
    warning: 'var(--vs-warning)',
    ink: 'var(--vs-ink)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, (label || showValue) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-body)',
      fontSize: 12.5
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)',
      fontWeight: 500
    }
  }, label), showValue && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12
    }
  }, Math.round(pct), "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      background: 'var(--vs-neutral-150)',
      borderRadius: 999,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: '100%',
      background: colors[color] || colors.blue,
      borderRadius: 999,
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
/** Vision Toast — transient confirmation. Render inside a fixed stack (ToastStack in real apps). */
function Toast({
  variant = 'default',
  title,
  children,
  onClose,
  style = {}
}) {
  const accents = {
    default: 'var(--vs-neutral-400)',
    success: 'var(--vs-success)',
    danger: 'var(--vs-danger)',
    blue: 'var(--accent)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 11,
      alignItems: 'flex-start',
      width: 340,
      padding: '13px 14px',
      background: 'var(--vs-white)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-pop)',
      borderLeft: `3px solid ${accents[variant] || accents.default}`,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-strong)',
      marginBottom: children ? 2 : 0
    }
  }, title), children && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      lineHeight: 1.45,
      color: 'var(--text-muted)'
    }
  }, children)), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Dismiss",
    style: {
      display: 'inline-flex',
      border: 'none',
      background: 'transparent',
      color: 'var(--text-subtle)',
      cursor: 'pointer',
      padding: 2
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  }))));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
/** Vision Tooltip — hover label. Dark graphite bubble. */
function Tooltip({
  label,
  side = 'top',
  children,
  style = {}
}) {
  const [show, setShow] = React.useState(false);
  const pos = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: 8
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: 8
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginRight: 8
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: 8
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      ...style
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      zIndex: 50,
      ...pos[side],
      whiteSpace: 'nowrap',
      background: 'var(--vs-ink)',
      color: '#fff',
      fontFamily: 'var(--font-body)',
      fontSize: 12.5,
      fontWeight: 500,
      padding: '6px 9px',
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--shadow-lg)',
      pointerEvents: 'none'
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Vision Button — primary CTA and action button.
 * Variants: primary (blue), secondary (white + hairline), ghost, danger.
 * Accent blue used sparingly, "like current through a wire".
 */
function Button({
  variant = 'primary',
  size = 'md',
  icon = null,
  iconRight = null,
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  children,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: {
      height: 32,
      padding: '0 12px',
      fontSize: 13,
      gap: 6,
      radius: 'var(--radius-md)'
    },
    md: {
      height: 40,
      padding: '0 16px',
      fontSize: 14,
      gap: 8,
      radius: 'var(--radius-md)'
    },
    lg: {
      height: 46,
      padding: '0 22px',
      fontSize: 15,
      gap: 8,
      radius: 'var(--radius-md)'
    }
  };
  const s = sizes[size] || sizes.md;
  const variants = {
    primary: {
      background: 'var(--accent)',
      color: '#fff',
      border: '1px solid var(--accent)',
      '--hover-bg': 'var(--accent-hover)',
      '--active-bg': 'var(--accent-active)'
    },
    secondary: {
      background: 'var(--vs-white)',
      color: 'var(--text-strong)',
      border: '1px solid var(--border-default)',
      '--hover-bg': 'var(--vs-neutral-50)',
      '--active-bg': 'var(--vs-neutral-100)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-body)',
      border: '1px solid transparent',
      '--hover-bg': 'var(--vs-neutral-100)',
      '--active-bg': 'var(--vs-neutral-150)'
    },
    danger: {
      background: 'var(--vs-danger)',
      color: '#fff',
      border: '1px solid var(--vs-danger)',
      '--hover-bg': '#c23a3a',
      '--active-bg': '#a83232'
    }
  };
  const v = variants[variant] || variants.primary;
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const bg = disabled ? undefined : active ? v['--active-bg'] : hover ? v['--hover-bg'] : v.background;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      height: s.height,
      padding: s.padding,
      width: fullWidth ? '100%' : undefined,
      fontFamily: 'var(--font-body)',
      fontSize: s.fontSize,
      fontWeight: 600,
      letterSpacing: '-0.006em',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      borderRadius: s.radius,
      border: v.border,
      background: bg || v.background,
      color: v.color,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast)',
      boxShadow: 'var(--shadow-none)',
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: '1.15em',
      height: '1.15em'
    }
  }, icon), children, iconRight && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: '1.15em',
      height: '1.15em'
    }
  }, iconRight));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
/** Vision Checkbox — square check with blue fill when selected. */
function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  disabled = false,
  id,
  onChange,
  style = {}
}) {
  const rid = id || React.useId();
  const [internal, setInternal] = React.useState(defaultChecked || false);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;
  const toggle = e => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange && onChange(e);
  };
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: rid,
    style: {
      display: 'flex',
      gap: 10,
      alignItems: description ? 'flex-start' : 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      flexShrink: 0,
      width: 18,
      height: 18,
      marginTop: description ? 1 : 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: rid,
    type: "checkbox",
    checked: on,
    onChange: toggle,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 18,
      height: 18,
      margin: 0,
      cursor: 'inherit'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 5,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: on ? 'var(--accent)' : 'var(--vs-white)',
      border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`,
      transition: 'background var(--dur-fast), border-color var(--dur-fast)'
    }
  }, on && /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  })))), label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-strong)',
      lineHeight: 1.35
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 12.5,
      color: 'var(--text-muted)',
      lineHeight: 1.4
    }
  }, description)));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Vision IconButton — square icon-only button for toolbars, table rows, cards.
 */
function IconButton({
  variant = 'ghost',
  size = 'md',
  icon,
  disabled = false,
  'aria-label': ariaLabel,
  onClick,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: 28,
    md: 34,
    lg: 40
  };
  const dim = sizes[size] || sizes.md;
  const variants = {
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
      border: '1px solid transparent',
      hover: 'var(--vs-neutral-100)',
      active: 'var(--vs-neutral-150)'
    },
    secondary: {
      background: 'var(--vs-white)',
      color: 'var(--text-body)',
      border: '1px solid var(--border-default)',
      hover: 'var(--vs-neutral-50)',
      active: 'var(--vs-neutral-100)'
    },
    primary: {
      background: 'var(--accent)',
      color: '#fff',
      border: '1px solid var(--accent)',
      hover: 'var(--accent-hover)',
      active: 'var(--accent-active)'
    }
  };
  const v = variants[variant] || variants.ghost;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": ariaLabel,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: dim,
      height: dim,
      borderRadius: 'var(--radius-md)',
      border: v.border,
      background: disabled ? v.background : hover ? v.hover : v.background,
      color: v.color,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background var(--dur-fast) var(--ease-standard)',
      padding: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: dim * 0.5,
      height: dim * 0.5
    }
  }, icon));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Vision Input — text field with optional label, leading/trailing icon, and states.
 */
function Input({
  label,
  hint,
  error,
  size = 'md',
  leadingIcon = null,
  trailingIcon = null,
  disabled = false,
  value,
  defaultValue,
  placeholder,
  type = 'text',
  id,
  onChange,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const sizes = {
    sm: {
      h: 34,
      fs: 13,
      px: 10
    },
    md: {
      h: 40,
      fs: 14,
      px: 12
    },
    lg: {
      h: 46,
      fs: 15,
      px: 14
    }
  };
  const s = sizes[size] || sizes.md;
  const borderColor = error ? 'var(--vs-danger)' : focus ? 'var(--border-focus)' : 'var(--border-default)';
  const rid = id || React.useId();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: rid,
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: s.h,
      padding: `0 ${s.px}px`,
      background: disabled ? 'var(--vs-neutral-100)' : 'var(--vs-white)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      opacity: disabled ? 0.6 : 1,
      cursor: disabled ? 'not-allowed' : 'text'
    }
  }, leadingIcon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 16,
      height: 16,
      color: 'var(--text-subtle)',
      flexShrink: 0
    }
  }, leadingIcon), /*#__PURE__*/React.createElement("input", _extends({
    id: rid,
    type: type,
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-body)',
      fontSize: s.fs,
      color: 'var(--text-strong)',
      padding: 0,
      height: '100%'
    }
  }, rest)), trailingIcon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 16,
      height: 16,
      color: 'var(--text-subtle)',
      flexShrink: 0
    }
  }, trailingIcon)), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      color: error ? 'var(--vs-danger)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
/** Vision Radio — single-select circle, blue dot when active. Group with RadioGroup or shared name. */
function Radio({
  label,
  description,
  checked,
  defaultChecked,
  disabled = false,
  name,
  value,
  id,
  onChange,
  style = {}
}) {
  const rid = id || React.useId();
  const [internal, setInternal] = React.useState(defaultChecked || false);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;
  const toggle = e => {
    if (disabled) return;
    if (!isControlled) setInternal(true);
    onChange && onChange(e);
  };
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: rid,
    style: {
      display: 'flex',
      gap: 10,
      alignItems: description ? 'flex-start' : 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      flexShrink: 0,
      width: 18,
      height: 18,
      marginTop: description ? 1 : 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: rid,
    type: "radio",
    name: name,
    value: value,
    checked: isControlled ? checked : undefined,
    defaultChecked: !isControlled ? defaultChecked : undefined,
    onChange: toggle,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 18,
      height: 18,
      margin: 0,
      cursor: 'inherit'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--vs-white)',
      border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`,
      transition: 'border-color var(--dur-fast)'
    }
  }, on && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--accent)'
    }
  }))), label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-strong)',
      lineHeight: 1.35
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 12.5,
      color: 'var(--text-muted)',
      lineHeight: 1.4
    }
  }, description)));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Vision Select — native select styled to match Input, with chevron. */
function Select({
  label,
  hint,
  error,
  size = 'md',
  disabled = false,
  value,
  defaultValue,
  id,
  onChange,
  children,
  options,
  placeholder,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const sizes = {
    sm: {
      h: 34,
      fs: 13,
      px: 10
    },
    md: {
      h: 40,
      fs: 14,
      px: 12
    },
    lg: {
      h: 46,
      fs: 15,
      px: 14
    }
  };
  const s = sizes[size] || sizes.md;
  const borderColor = error ? 'var(--vs-danger)' : focus ? 'var(--border-focus)' : 'var(--border-default)';
  const rid = id || React.useId();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: rid,
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: rid,
    value: value,
    defaultValue: defaultValue,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: 'none',
      WebkitAppearance: 'none',
      width: '100%',
      height: s.h,
      padding: `0 ${s.px + 22}px 0 ${s.px}px`,
      fontFamily: 'var(--font-body)',
      fontSize: s.fs,
      color: 'var(--text-strong)',
      background: disabled ? 'var(--vs-neutral-100)' : 'var(--vs-white)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      outline: 'none',
      boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)'
    }
  }, rest), placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options ? options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value ?? o,
    value: o.value ?? o
  }, o.label ?? o)) : children), /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      position: 'absolute',
      right: s.px,
      pointerEvents: 'none',
      color: 'var(--text-subtle)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  }))), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      color: error ? 'var(--vs-danger)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/** Vision Switch — toggle for settings; blue track when on. */
function Switch({
  label,
  description,
  checked,
  defaultChecked,
  disabled = false,
  id,
  onChange,
  style = {}
}) {
  const rid = id || React.useId();
  const [internal, setInternal] = React.useState(defaultChecked || false);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;
  const toggle = e => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange && onChange(e);
  };
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: rid,
    style: {
      display: 'flex',
      gap: 10,
      alignItems: description ? 'flex-start' : 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      flexShrink: 0,
      width: 36,
      height: 20,
      marginTop: description ? 1 : 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    id: rid,
    type: "checkbox",
    checked: isControlled ? checked : undefined,
    defaultChecked: !isControlled ? defaultChecked : undefined,
    onChange: toggle,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 36,
      height: 20,
      margin: 0,
      cursor: 'inherit'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 20,
      borderRadius: 999,
      background: on ? 'var(--accent)' : 'var(--vs-neutral-300)',
      transition: 'background var(--dur-med) var(--ease-standard)',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: on ? 18 : 2,
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 1px 2px rgba(16,20,24,0.25)',
      transition: 'left var(--dur-med) var(--ease-standard)'
    }
  }))), label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-strong)',
      lineHeight: 1.35
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 12.5,
      color: 'var(--text-muted)',
      lineHeight: 1.4
    }
  }, description)));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Vision Textarea — multi-line text field. */
function Textarea({
  label,
  hint,
  error,
  rows = 4,
  disabled = false,
  value,
  defaultValue,
  placeholder,
  id,
  onChange,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const borderColor = error ? 'var(--vs-danger)' : focus ? 'var(--border-focus)' : 'var(--border-default)';
  const rid = id || React.useId();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: rid,
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("textarea", _extends({
    id: rid,
    rows: rows,
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      resize: 'vertical',
      padding: '10px 12px',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      lineHeight: 1.5,
      color: 'var(--text-strong)',
      background: disabled ? 'var(--vs-neutral-100)' : 'var(--vs-white)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      outline: 'none',
      boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      opacity: disabled ? 0.6 : 1
    }
  }, rest)), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      color: error ? 'var(--vs-danger)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumb.jsx
try { (() => {
/** Vision Breadcrumb — path trail for nested records (Lead › Quote › Contract). */
function Breadcrumb({
  items = [],
  style = {}
}) {
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Breadcrumb",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      ...style
    }
  }, items.map((it, i) => {
    const last = i === items.length - 1;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, it.href && !last ? /*#__PURE__*/React.createElement("a", {
      href: it.href,
      style: {
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-muted)',
        textDecoration: 'none'
      }
    }, it.label) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: last ? 600 : 500,
        color: last ? 'var(--text-strong)' : 'var(--text-muted)'
      }
    }, it.label), !last && /*#__PURE__*/React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "var(--text-subtle)",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "m9 18 6-6-6-6"
    })));
  }));
}
Object.assign(__ds_scope, { Breadcrumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavItem.jsx
try { (() => {
/** Vision NavItem — sidebar navigation row. Active row gets blue tint + accent text. */
function NavItem({
  icon = null,
  label,
  active = false,
  badge = null,
  href,
  onClick,
  style = {}
}) {
  const [h, setH] = React.useState(false);
  const bg = active ? 'var(--surface-selected)' : h ? 'var(--vs-neutral-100)' : 'transparent';
  const fg = active ? 'var(--accent-active)' : 'var(--vs-neutral-700)';
  const Comp = href ? 'a' : 'button';
  return /*#__PURE__*/React.createElement(Comp, {
    href: href,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      width: '100%',
      padding: '8px 10px',
      border: 'none',
      background: bg,
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      textDecoration: 'none',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      color: fg,
      textAlign: 'left',
      transition: 'background var(--dur-fast), color var(--dur-fast)',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      width: 18,
      height: 18,
      flexShrink: 0,
      color: active ? 'var(--accent)' : 'var(--text-muted)'
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, label), badge != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fontWeight: 600,
      color: active ? 'var(--accent-active)' : 'var(--text-muted)',
      background: active ? 'var(--vs-white)' : 'var(--vs-neutral-150)',
      borderRadius: 999,
      padding: '1px 7px'
    }
  }, badge));
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/** Vision Tabs — underline tabs for switching views. Active tab uses the accent underline. */
function Tabs({
  tabs = [],
  value,
  defaultValue,
  onChange,
  style = {}
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? (tabs[0] && (tabs[0].value ?? tabs[0])));
  const active = value !== undefined ? value : internal;
  const select = v => {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  };
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border-hairline)',
      ...style
    }
  }, tabs.map(t => {
    const val = t.value ?? t;
    const label = t.label ?? t;
    const on = val === active;
    return /*#__PURE__*/React.createElement("button", {
      key: val,
      role: "tab",
      "aria-selected": on,
      onClick: () => select(val),
      style: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '10px 12px 12px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: on ? 600 : 500,
        color: on ? 'var(--text-strong)' : 'var(--text-muted)',
        letterSpacing: '-0.006em',
        transition: 'color var(--dur-fast)'
      }
    }, label, t.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        color: on ? 'var(--accent-active)' : 'var(--text-subtle)',
        background: on ? 'var(--vs-blue-tint)' : 'var(--vs-neutral-100)',
        borderRadius: 999,
        padding: '1px 6px'
      }
    }, t.count), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 6,
        right: 6,
        bottom: -1,
        height: 2,
        borderRadius: 2,
        background: on ? 'var(--accent)' : 'transparent'
      }
    }));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Dialog.jsx
try { (() => {
/** Vision Dialog — centred modal over a scrim. Controlled via `open`/`onClose`. */
function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  width = 460,
  children,
  style = {}
}) {
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && open) onClose && onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(16,20,24,0.44)',
      backdropFilter: 'blur(1.5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      width,
      maxWidth: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      background: 'var(--vs-white)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-pop)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 22px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12
    }
  }, title && /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: 19,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)'
    }
  }, title), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      display: 'inline-flex',
      border: 'none',
      background: 'transparent',
      color: 'var(--text-subtle)',
      cursor: 'pointer',
      padding: 4,
      marginTop: -2,
      marginRight: -4
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  })))), description && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '6px 0 0',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      lineHeight: 1.5,
      color: 'var(--text-muted)'
    }
  }, description)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 22px'
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      padding: '14px 22px',
      borderTop: '1px solid var(--border-hairline)',
      background: 'var(--vs-neutral-50)'
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Dialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/vision-app/AppShell.jsx
try { (() => {
// Vision app shell — sidebar + topbar. Exported to window.AppShell.
(function () {
  const React = window.React;
  const {
    NavItem,
    Avatar,
    IconButton,
    Badge
  } = window.VisionDesignSystem_7d86eb;
  const I = window.VIcons;
  const NAV = [{
    key: 'dashboard',
    label: 'Dashboard',
    icon: I.Dashboard
  }, {
    key: 'leads',
    label: 'Leads',
    icon: I.Leads,
    badge: 12
  }, {
    key: 'quotes',
    label: 'Quotes',
    icon: I.Quotes,
    badge: 5
  }, {
    key: 'contracts',
    label: 'Contracts',
    icon: I.Contracts
  }, {
    key: 'diary',
    label: 'Diary',
    icon: I.Diary
  }, {
    key: 'stock',
    label: 'Stock',
    icon: I.Stock
  }, {
    key: 'finance',
    label: 'Finance',
    icon: I.Finance
  }, {
    key: 'comms',
    label: 'Comms',
    icon: I.Comms
  }, {
    key: 'workflows',
    label: 'Workflows',
    icon: I.Workflows
  }];
  function Wordmark() {
    return React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 6px'
      }
    }, React.createElement('span', {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 26,
        letterSpacing: '-0.02em',
        color: 'var(--vs-ink)',
        lineHeight: 1
      }
    }, 'vision', React.createElement('span', {
      style: {
        color: 'var(--vs-blue)'
      }
    }, '.')));
  }
  function AppShell({
    active,
    onNavigate,
    children
  }) {
    const D = window.VData;
    return React.createElement('div', {
      style: {
        display: 'flex',
        height: '100%',
        background: 'var(--surface-app)',
        fontFamily: 'var(--font-body)'
      }
    },
    // Sidebar
    React.createElement('aside', {
      style: {
        width: 244,
        flexShrink: 0,
        background: 'var(--vs-white)',
        borderRight: '1px solid var(--border-hairline)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px'
      }
    }, React.createElement('div', {
      style: {
        marginBottom: 18
      }
    }, React.createElement(Wordmark)),
    // Tenant switcher
    React.createElement('button', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        marginBottom: 16,
        background: 'var(--vs-neutral-50)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        textAlign: 'left'
      }
    }, React.createElement(Avatar, {
      name: 'Northgate Installations',
      color: 'ink',
      size: 28
    }), React.createElement('div', {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement('div', {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-strong)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, 'Northgate'), React.createElement('div', {
      style: {
        fontSize: 11,
        color: 'var(--text-muted)'
      }
    }, 'Installations Ltd')), React.createElement(I.ChevronDown, {
      size: 15,
      style: {
        color: 'var(--text-subtle)'
      }
    })), React.createElement('nav', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, NAV.map(n => React.createElement(NavItem, {
      key: n.key,
      label: n.label,
      active: active === n.key,
      badge: n.badge,
      icon: React.createElement(n.icon, {
        size: 18
      }),
      onClick: () => onNavigate && onNavigate(n.key)
    }))), React.createElement('div', {
      style: {
        marginTop: 'auto',
        paddingTop: 8
      }
    }, React.createElement(NavItem, {
      label: 'Settings',
      icon: React.createElement(I.Settings, {
        size: 18
      }),
      active: active === 'settings',
      onClick: () => onNavigate && onNavigate('settings')
    }))),
    // Main column
    React.createElement('div', {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, React.createElement('header', {
      style: {
        height: 60,
        flexShrink: 0,
        background: 'var(--vs-white)',
        borderBottom: '1px solid var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 22px'
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        maxWidth: 420,
        height: 38,
        padding: '0 12px',
        background: 'var(--vs-neutral-100)',
        borderRadius: 'var(--radius-md)'
      }
    }, React.createElement(I.Search, {
      size: 16,
      style: {
        color: 'var(--text-subtle)'
      }
    }), React.createElement('input', {
      placeholder: 'Search leads, quotes, contacts…',
      style: {
        flex: 1,
        border: 'none',
        background: 'transparent',
        outline: 'none',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        color: 'var(--text-strong)'
      }
    }), React.createElement('kbd', {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-subtle)',
        background: 'var(--vs-white)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 4,
        padding: '1px 5px'
      }
    }, '⌘K')), React.createElement('div', {
      style: {
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, React.createElement('div', {
      style: {
        position: 'relative',
        display: 'inline-flex'
      }
    }, React.createElement(IconButton, {
      variant: 'ghost',
      icon: React.createElement(I.Bell, {
        size: 18
      }),
      'aria-label': 'Notifications'
    }), React.createElement('span', {
      style: {
        position: 'absolute',
        top: 6,
        right: 7,
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: 'var(--vs-blue)',
        border: '2px solid var(--vs-white)'
      }
    })), React.createElement('div', {
      style: {
        width: 1,
        height: 26,
        background: 'var(--border-hairline)'
      }
    }), React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9
      }
    }, React.createElement(Avatar, {
      name: D.user.name,
      size: 32,
      color: 'blue'
    }), React.createElement('div', {
      style: {
        lineHeight: 1.25
      }
    }, React.createElement('div', {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-strong)'
      }
    }, D.user.name), React.createElement('div', {
      style: {
        fontSize: 11,
        color: 'var(--text-muted)'
      }
    }, D.user.role))))), React.createElement('main', {
      style: {
        flex: 1,
        overflow: 'auto'
      }
    }, children)));
  }
  window.AppShell = AppShell;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/vision-app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/vision-app/Dashboard.jsx
try { (() => {
const {
  Card,
  Stat,
  Badge,
  Button,
  ProgressBar,
  Avatar,
  Tabs
} = window.VisionDesignSystem_7d86eb;
const I = window.VIcons;
function PageHead({
  eyebrow,
  title,
  sub,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", null, eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 7
    }
  }, eyebrow), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: '-0.024em',
      color: 'var(--text-strong)'
    }
  }, title), sub && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '6px 0 0',
      fontSize: 14.5,
      color: 'var(--text-muted)'
    }
  }, sub)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexShrink: 0
    }
  }, actions));
}
function Dashboard() {
  const D = window.VData;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '26px 28px',
      maxWidth: 1180,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(PageHead, {
    eyebrow: "Wednesday, 18 June",
    title: "Good morning, Sarah",
    sub: "Here's where the business stands today.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: /*#__PURE__*/React.createElement(I.Download, {
        size: 16
      })
    }, "Export"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: /*#__PURE__*/React.createElement(I.Plus, {
        size: 16
      })
    }, "New lead"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16,
      marginBottom: 20
    }
  }, D.kpis.map((k, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    padding: 18
  }, /*#__PURE__*/React.createElement(Stat, {
    label: k.label,
    value: k.value,
    delta: k.delta,
    trend: k.trend
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: 0,
    header: "Pipeline by stage"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, D.pipeline.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '150px 1fr 64px',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-body)'
    }
  }, s.stage), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-subtle)'
    }
  }, s.count)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 26,
      background: 'var(--vs-neutral-100)',
      borderRadius: 6,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: s.pct + '%',
      height: '100%',
      background: i === 4 ? 'var(--vs-success)' : 'var(--vs-blue)',
      opacity: i === 4 ? 1 : 0.35 + i * 0.16,
      borderRadius: 6
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--text-strong)',
      textAlign: 'right'
    }
  }, s.value))))), /*#__PURE__*/React.createElement(Card, {
    padding: 0,
    header: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("span", null, "Today's diary"), /*#__PURE__*/React.createElement("a", {
      href: "#",
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-link)',
        textDecoration: 'none'
      }
    }, "Open"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, D.installs.map((ev, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 12,
      padding: '13px 20px',
      borderBottom: i === D.installs.length - 1 ? 'none' : '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      color: 'var(--text-muted)',
      width: 46,
      flexShrink: 0,
      paddingTop: 1
    }
  }, ev.time), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-strong)',
      marginBottom: 4
    }
  }, ev.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 12.5,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: ev.tv,
    size: "sm"
  }, ev.tag), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(I.MapPin, {
    size: 13
  }), ev.where)))))))));
}
Object.assign(window, {
  Dashboard,
  PageHead
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/vision-app/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/vision-app/Diary.jsx
try { (() => {
const {
  Card,
  Badge,
  Button,
  Tabs,
  Avatar
} = window.VisionDesignSystem_7d86eb;
const I4 = window.VIcons;
const DIARY = [{
  day: 0,
  start: 8,
  dur: 2,
  title: 'Survey — Elm Conservatories',
  who: 'Jo Blake',
  tag: 'Survey',
  tv: 'warning'
}, {
  day: 0,
  start: 13,
  dur: 3,
  title: 'Install — Baywater Roofing',
  who: 'Fit team A',
  tag: 'Install',
  tv: 'blue'
}, {
  day: 1,
  start: 9,
  dur: 2,
  title: 'Measure — Meadow View',
  who: 'R. Docherty',
  tag: 'Survey',
  tv: 'warning'
}, {
  day: 1,
  start: 14,
  dur: 2.5,
  title: 'Sign-off — Aspen Rooms',
  who: 'Fit team B',
  tag: 'Sign-off',
  tv: 'success'
}, {
  day: 2,
  start: 8.5,
  dur: 4,
  title: 'Install — Fenwick Doors',
  who: 'Fit team A',
  tag: 'Install',
  tv: 'blue'
}, {
  day: 3,
  start: 10,
  dur: 2,
  title: 'Survey — Harbour Living',
  who: 'Sarah Kelly',
  tag: 'Survey',
  tv: 'warning'
}, {
  day: 3,
  start: 13.5,
  dur: 3,
  title: 'Install — Meadow View',
  who: 'Fit team C',
  tag: 'Install',
  tv: 'blue'
}, {
  day: 4,
  start: 9,
  dur: 5,
  title: 'Install — Northgate Windows',
  who: 'Fit team A',
  tag: 'Install',
  tv: 'blue'
}];
const DAYS = [{
  d: 'Mon',
  n: 16
}, {
  d: 'Tue',
  n: 17
}, {
  d: 'Wed',
  n: 18,
  today: true
}, {
  d: 'Thu',
  n: 19
}, {
  d: 'Fri',
  n: 20
}, {
  d: 'Sat',
  n: 21
}];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const EVCOLORS = {
  blue: {
    bg: '#eaf2fd',
    bar: 'var(--vs-blue)',
    fg: 'var(--accent-active)'
  },
  warning: {
    bg: '#fbf1df',
    bar: 'var(--vs-warning)',
    fg: '#96600f'
  },
  success: {
    bg: '#e7f5ee',
    bar: 'var(--vs-success)',
    fg: '#137a4a'
  }
};
const ROW_H = 46;
function Diary() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '26px 28px',
      maxWidth: 1180,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(PageHead, {
    eyebrow: "16 \u2013 21 June",
    title: "Diary",
    sub: "Surveys, installs and sign-offs across every team.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary"
    }, "Today"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: /*#__PURE__*/React.createElement(I4.Plus, {
        size: 16
      })
    }, "Book job"))
  }), /*#__PURE__*/React.createElement(Card, {
    padding: 0,
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `56px repeat(6, 1fr)`,
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", null), DAYS.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '12px 0',
      textAlign: 'center',
      borderLeft: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: d.today ? 'var(--accent)' : 'var(--text-muted)'
    }
  }, d.d), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 3,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 30,
      height: 30,
      borderRadius: '50%',
      fontFamily: 'var(--font-display)',
      fontSize: 16,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: d.today ? '#fff' : 'var(--text-strong)',
      background: d.today ? 'var(--vs-blue)' : 'transparent'
    }
  }, d.n)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `56px repeat(6, 1fr)`,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", null, HOURS.map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      height: ROW_H,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -7,
      right: 8,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-subtle)'
    }
  }, h, ":00")))), DAYS.map((d, di) => /*#__PURE__*/React.createElement("div", {
    key: di,
    style: {
      position: 'relative',
      borderLeft: '1px solid var(--border-hairline)'
    }
  }, HOURS.map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      height: ROW_H,
      borderBottom: '1px solid var(--border-hairline)'
    }
  })), DIARY.filter(e => e.day === di).map((e, ei) => {
    const c = EVCOLORS[e.tv];
    const top = (e.start - 8) * ROW_H;
    const height = e.dur * ROW_H - 4;
    return /*#__PURE__*/React.createElement("div", {
      key: ei,
      style: {
        position: 'absolute',
        top,
        left: 4,
        right: 4,
        height,
        background: c.bg,
        borderLeft: `3px solid ${c.bar}`,
        borderRadius: 6,
        padding: '6px 8px',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--text-strong)',
        lineHeight: 1.25,
        marginBottom: 3
      }
    }, e.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: c.fg,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.03em'
      }
    }, e.tag), height > 60 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--text-muted)',
        marginTop: 4
      }
    }, e.who));
  }))))));
}
window.Diary = Diary;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/vision-app/Diary.jsx", error: String((e && e.message) || e) }); }

// ui_kits/vision-app/LeadDetail.jsx
try { (() => {
const {
  Card,
  Table,
  Badge,
  Button,
  Breadcrumb,
  Avatar,
  ProgressBar,
  Alert,
  IconButton
} = window.VisionDesignSystem_7d86eb;
const I3 = window.VIcons;
function ActivityIcon({
  kind
}) {
  const map = {
    stage: I3.ArrowRight,
    mail: I3.Mail,
    call: I3.Phone,
    plus: I3.Plus
  };
  const C = map[kind] || I3.Check;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 30,
      height: 30,
      borderRadius: '50%',
      background: 'var(--vs-neutral-100)',
      color: 'var(--text-muted)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(C, {
    size: 14
  }));
}
function LeadDetail({
  onBack
}) {
  const D = window.VData;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 28px',
      maxWidth: 1180,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement("span", {
      style: {
        transform: 'rotate(180deg)',
        display: 'inline-flex'
      }
    }, /*#__PURE__*/React.createElement(I3.ArrowRight, {
      size: 16
    })),
    "aria-label": "Back",
    onClick: onBack
  }), /*#__PURE__*/React.createElement(Breadcrumb, {
    items: [{
      label: 'Leads',
      href: '#'
    }, {
      label: 'Northgate Windows',
      href: '#'
    }, {
      label: 'Quote #1042'
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Northgate Windows",
    color: "ink",
    size: 48
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: '-0.022em',
      color: 'var(--text-strong)'
    }
  }, "Northgate Windows"), /*#__PURE__*/React.createElement(Badge, {
    variant: "blue",
    dot: true
  }, "Quoted")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 5,
      fontSize: 13.5,
      color: 'var(--text-muted)',
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(I3.MapPin, {
    size: 14
  }), "Leeds LS1"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(I3.Phone, {
    size: 14
  }), "David Mills"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)'
    }
  }, "QUOTE-1042")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement(I3.Send, {
      size: 16
    })
  }, "Resend"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: /*#__PURE__*/React.createElement(I3.Check, {
      size: 16
    })
  }, "Convert to contract"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.55fr 1fr',
      gap: 16,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Alert, {
    variant: "info",
    title: "Quote sent \u2014 awaiting decision"
  }, "Emailed to David Mills 2 hours ago. Follow-up task due in 3 days."), /*#__PURE__*/React.createElement(Card, {
    padding: 0,
    header: "Quote lines"
  }, /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: 'desc',
      header: 'Description',
      wrap: true,
      render: r => /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--text-strong)'
        }
      }, r.desc)
    }, {
      key: 'qty',
      header: 'Qty',
      align: 'center',
      width: 60
    }, {
      key: 'unit',
      header: 'Unit',
      align: 'right',
      width: 100,
      render: r => /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--font-mono)'
        }
      }, r.unit)
    }, {
      key: 'total',
      header: 'Total',
      align: 'right',
      width: 110,
      render: r => /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: 'var(--text-strong)'
        }
      }, r.total)
    }],
    rows: D.quoteLines,
    style: {
      border: 'none',
      borderRadius: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '16px 20px',
      borderTop: '1px solid var(--border-hairline)',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Subtotal",
    value: "\xA38,740.00"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "VAT (20%)",
    value: "\xA31,748.00"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 40,
      alignItems: 'baseline',
      paddingTop: 8,
      borderTop: '1px solid var(--border-hairline)',
      width: 260,
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, "Total"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)'
    }
  }, "\xA310,488.00"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    header: "Deal"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Owner",
    value: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: "Sarah Kelly",
      size: 22,
      color: "blue"
    }), "Sarah Kelly")
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Type",
    value: "Windows & doors"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Source",
    value: "Website enquiry"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Est. value",
    value: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        color: 'var(--text-strong)'
      }
    }, "\xA312,400")
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-muted)',
      marginBottom: 7
    }
  }, "Progress to close"), /*#__PURE__*/React.createElement(ProgressBar, {
    value: 60,
    showValue: true
  })))), /*#__PURE__*/React.createElement(Card, {
    header: "Activity"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, D.activity.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(ActivityIcon, {
    kind: a.kind
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'var(--text-body)',
      lineHeight: 1.45
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-strong)',
      fontWeight: 600
    }
  }, a.who), " ", a.act, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-strong)',
      fontWeight: 500
    }
  }, a.target)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-subtle)',
      marginTop: 2
    }
  }, a.when)))))))));
}
function Row({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 40,
      justifyContent: 'space-between',
      width: 260
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13.5,
      color: 'var(--text-body)'
    }
  }, value));
}
function Field({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: 'var(--text-body)',
      fontWeight: 500
    }
  }, value));
}
window.LeadDetail = LeadDetail;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/vision-app/LeadDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/vision-app/Leads.jsx
try { (() => {
const {
  Card,
  Table,
  Badge,
  Button,
  Tabs,
  Avatar,
  Tag,
  Input,
  IconButton
} = window.VisionDesignSystem_7d86eb;
const I2 = window.VIcons;
function Leads({
  onOpenLead
}) {
  const D = window.VData;
  const [tab, setTab] = React.useState('all');
  const [q, setQ] = React.useState('');
  let rows = D.leads;
  if (tab === 'open') rows = rows.filter(r => !['Won', 'Lost'].includes(r.stage));
  if (tab === 'won') rows = rows.filter(r => r.stage === 'Won');
  if (q) rows = rows.filter(r => (r.name + r.contact + r.city).toLowerCase().includes(q.toLowerCase()));
  const cols = [{
    key: 'id',
    header: 'Ref',
    width: 78,
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: 'var(--text-muted)'
      }
    }, "#", r.id)
  }, {
    key: 'name',
    header: 'Customer',
    render: r => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        color: 'var(--text-strong)'
      }
    }, r.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--text-muted)'
      }
    }, r.contact, " \xB7 ", r.city))
  }, {
    key: 'type',
    header: 'Type',
    render: r => /*#__PURE__*/React.createElement(Tag, null, r.type)
  }, {
    key: 'owner',
    header: 'Owner',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: r.owner,
      size: 24
    }), r.owner)
  }, {
    key: 'stage',
    header: 'Stage',
    render: r => /*#__PURE__*/React.createElement(Badge, {
      variant: r.sv,
      dot: true
    }, r.stage)
  }, {
    key: 'value',
    header: 'Value',
    align: 'right',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        color: 'var(--text-strong)'
      }
    }, r.value)
  }, {
    key: 'updated',
    header: 'Updated',
    align: 'right',
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--text-muted)'
      }
    }, r.updated)
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '26px 28px',
      maxWidth: 1180,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(PageHead, {
    eyebrow: "Sales",
    title: "Leads",
    sub: "Every enquiry from first contact to won or lost.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: /*#__PURE__*/React.createElement(I2.Filter, {
        size: 16
      })
    }, "Filters"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: /*#__PURE__*/React.createElement(I2.Plus, {
        size: 16
      })
    }, "New lead"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    tabs: [{
      label: 'All',
      value: 'all',
      count: 128
    }, {
      label: 'Open',
      value: 'open',
      count: 42
    }, {
      label: 'Won',
      value: 'won',
      count: 7
    }, {
      label: 'Lost',
      value: 'lost'
    }],
    value: tab,
    onChange: setTab,
    style: {
      border: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 260
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search leads\u2026",
    leadingIcon: /*#__PURE__*/React.createElement(I2.Search, {
      size: 16
    }),
    size: "sm",
    value: q,
    onChange: e => setQ(e.target.value)
  }))), /*#__PURE__*/React.createElement(Table, {
    columns: cols,
    rows: rows,
    onRowClick: () => onOpenLead && onOpenLead()
  }));
}
window.Leads = Leads;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/vision-app/Leads.jsx", error: String((e && e.message) || e) }); }

// ui_kits/vision-app/data.js
try { (() => {
// Vision app — fake data for the UI kit. Exported to window.VData.
window.VData = {
  user: {
    name: 'Sarah Kelly',
    role: 'Sales manager',
    company: 'Northgate Installations'
  },
  kpis: [{
    label: 'Open pipeline',
    value: '£248k',
    delta: '+12%',
    trend: 'up'
  }, {
    label: 'Won this month',
    value: '£86k',
    delta: '+8%',
    trend: 'up'
  }, {
    label: 'Installs booked',
    value: '34',
    delta: '+6',
    trend: 'up'
  }, {
    label: 'Overdue tasks',
    value: '3',
    delta: '-2',
    trend: 'down'
  }],
  pipeline: [{
    stage: 'New lead',
    count: 42,
    value: '£96k',
    pct: 100
  }, {
    stage: 'Qualified',
    count: 28,
    value: '£71k',
    pct: 72
  }, {
    stage: 'Quoted',
    count: 19,
    value: '£54k',
    pct: 52
  }, {
    stage: 'Survey booked',
    count: 11,
    value: '£38k',
    pct: 34
  }, {
    stage: 'Won',
    count: 7,
    value: '£28k',
    pct: 20
  }],
  leads: [{
    id: 1042,
    name: 'Northgate Windows',
    contact: 'David Mills',
    owner: 'Sarah Kelly',
    stage: 'Quoted',
    sv: 'blue',
    value: '£12,400',
    type: 'Windows',
    updated: '2h ago',
    city: 'Leeds'
  }, {
    id: 1041,
    name: 'Baywater Roofing',
    contact: 'Angela Poole',
    owner: 'Tom Reid',
    stage: 'Won',
    sv: 'success',
    value: '£28,900',
    type: 'Roofing',
    updated: 'Yesterday',
    city: 'Bristol'
  }, {
    id: 1040,
    name: 'Elm Conservatories',
    contact: 'Priya Shah',
    owner: 'Jo Blake',
    stage: 'Survey booked',
    sv: 'warning',
    value: '£9,150',
    type: 'Conservatory',
    updated: 'Yesterday',
    city: 'York'
  }, {
    id: 1039,
    name: 'Harbour Living Rooms',
    contact: 'Mark Ellison',
    owner: 'Sarah Kelly',
    stage: 'New lead',
    sv: 'neutral',
    value: '£4,600',
    type: 'Living space',
    updated: '2 days ago',
    city: 'Hull'
  }, {
    id: 1038,
    name: 'Fenwick Doors & Glazing',
    contact: 'Sofia Grant',
    owner: 'Tom Reid',
    stage: 'Qualified',
    sv: 'neutral',
    value: '£7,300',
    type: 'Doors',
    updated: '3 days ago',
    city: 'Leeds'
  }, {
    id: 1037,
    name: 'Meadow View Windows',
    contact: 'Ryan Docherty',
    owner: 'Jo Blake',
    stage: 'Quoted',
    sv: 'blue',
    value: '£15,750',
    type: 'Windows',
    updated: '3 days ago',
    city: 'Sheffield'
  }, {
    id: 1036,
    name: 'Castleford Roofline',
    contact: 'Nadia Rahman',
    owner: 'Sarah Kelly',
    stage: 'Lost',
    sv: 'danger',
    value: '£6,200',
    type: 'Roofing',
    updated: '4 days ago',
    city: 'Wakefield'
  }, {
    id: 1035,
    name: 'Aspen Garden Rooms',
    contact: 'Paul Hendry',
    owner: 'Tom Reid',
    stage: 'Won',
    sv: 'success',
    value: '£22,100',
    type: 'Living space',
    updated: '5 days ago',
    city: 'Harrogate'
  }],
  installs: [{
    time: '08:00',
    title: 'Survey — Elm Conservatories',
    who: 'Jo Blake',
    where: 'York',
    tag: 'Survey',
    tv: 'warning'
  }, {
    time: '10:30',
    title: 'Install — Baywater Roofing',
    who: 'Fit team A',
    where: 'Bristol',
    tag: 'Install',
    tv: 'blue'
  }, {
    time: '13:00',
    title: 'Measure — Meadow View',
    who: 'Ryan Docherty',
    where: 'Sheffield',
    tag: 'Survey',
    tv: 'warning'
  }, {
    time: '15:30',
    title: 'Sign-off — Aspen Garden Rooms',
    who: 'Fit team B',
    where: 'Harrogate',
    tag: 'Sign-off',
    tv: 'success'
  }],
  quoteLines: [{
    desc: 'Aluminium casement window — anthracite grey, 1200×1050',
    qty: 6,
    unit: '£640.00',
    total: '£3,840.00'
  }, {
    desc: 'Composite front door — Chartwell green, with sidelight',
    qty: 1,
    unit: '£1,980.00',
    total: '£1,980.00'
  }, {
    desc: 'Triple-glazed sealed units — argon filled',
    qty: 6,
    unit: '£220.00',
    total: '£1,320.00'
  }, {
    desc: 'Supply & fit labour — 3 fitter days',
    qty: 3,
    unit: '£420.00',
    total: '£1,260.00'
  }, {
    desc: 'Waste removal & making good',
    qty: 1,
    unit: '£340.00',
    total: '£340.00'
  }],
  activity: [{
    who: 'Sarah Kelly',
    act: 'moved this lead to',
    target: 'Quoted',
    when: '2h ago',
    kind: 'stage'
  }, {
    who: 'System',
    act: 'emailed quote QUOTE-1042 to',
    target: 'David Mills',
    when: '2h ago',
    kind: 'mail'
  }, {
    who: 'Tom Reid',
    act: 'logged a call —',
    target: '“Wants survey next week”',
    when: 'Yesterday',
    kind: 'call'
  }, {
    who: 'Sarah Kelly',
    act: 'created the lead from',
    target: 'website enquiry',
    when: '3 days ago',
    kind: 'plus'
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/vision-app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/vision-app/icons.js
try { (() => {
// Vision app — icon set (lucide-style, 24px stroke 2). Exported to window.VIcons.
(function () {
  const React = window.React;
  const mk = (paths, opts) => function Icon(props) {
    const {
      size = 20,
      ...rest
    } = props || {};
    return React.createElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ...(opts || {}),
      ...rest
    }, paths.map((d, i) => React.createElement('path', {
      key: i,
      d
    })));
  };
  const mkEl = els => function Icon(props) {
    const {
      size = 20,
      ...rest
    } = props || {};
    return React.createElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ...rest
    }, els(React));
  };
  window.VIcons = {
    Dashboard: mk(['M3 3v18h18', 'm19 9-5 5-4-4-3 3']),
    Leads: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'
    }), R.createElement('circle', {
      key: 1,
      cx: 9,
      cy: 7,
      r: 4
    })]),
    Quotes: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
    }), R.createElement('path', {
      key: 1,
      d: 'M14 2v6h6'
    }), R.createElement('path', {
      key: 2,
      d: 'M8 13h8M8 17h5'
    })]),
    Contracts: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M9 12h6M9 16h4'
    }), R.createElement('path', {
      key: 1,
      d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z'
    }), R.createElement('path', {
      key: 2,
      d: 'M14 2v5h5'
    })]),
    Diary: mkEl(R => [R.createElement('rect', {
      key: 0,
      x: 3,
      y: 4,
      width: 18,
      height: 18,
      rx: 2
    }), R.createElement('path', {
      key: 1,
      d: 'M16 2v4M8 2v4M3 10h18'
    })]),
    Stock: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z'
    }), R.createElement('path', {
      key: 1,
      d: 'm3.3 7 8.7 5 8.7-5M12 22V12'
    })]),
    Finance: mkEl(R => [R.createElement('line', {
      key: 0,
      x1: 12,
      y1: 2,
      x2: 12,
      y2: 22
    }), R.createElement('path', {
      key: 1,
      d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'
    })]),
    Comms: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z'
    })]),
    Workflows: mkEl(R => [R.createElement('rect', {
      key: 0,
      x: 3,
      y: 3,
      width: 6,
      height: 6,
      rx: 1
    }), R.createElement('rect', {
      key: 1,
      x: 15,
      y: 15,
      width: 6,
      height: 6,
      rx: 1
    }), R.createElement('path', {
      key: 2,
      d: 'M9 6h6a2 2 0 0 1 2 2v7'
    })]),
    Settings: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'
    }), R.createElement('circle', {
      key: 1,
      cx: 12,
      cy: 12,
      r: 3
    })]),
    Search: mkEl(R => [R.createElement('circle', {
      key: 0,
      cx: 11,
      cy: 11,
      r: 8
    }), R.createElement('path', {
      key: 1,
      d: 'm21 21-4.3-4.3'
    })]),
    Bell: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'
    }), R.createElement('path', {
      key: 1,
      d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0'
    })]),
    Plus: mk(['M5 12h14', 'M12 5v14']),
    ChevronDown: mk(['m6 9 6 6 6-6']),
    ChevronRight: mk(['m9 18 6-6-6-6']),
    More: mkEl(R => [R.createElement('circle', {
      key: 0,
      cx: 12,
      cy: 12,
      r: 1
    }), R.createElement('circle', {
      key: 1,
      cx: 19,
      cy: 12,
      r: 1
    }), R.createElement('circle', {
      key: 2,
      cx: 5,
      cy: 12,
      r: 1
    })]),
    Filter: mk(['M22 3H2l8 9.46V19l4 2v-8.54Z']),
    Calendar: mkEl(R => [R.createElement('rect', {
      key: 0,
      x: 3,
      y: 4,
      width: 18,
      height: 18,
      rx: 2
    }), R.createElement('path', {
      key: 1,
      d: 'M16 2v4M8 2v4M3 10h18'
    })]),
    Phone: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'
    })]),
    Mail: mkEl(R => [R.createElement('rect', {
      key: 0,
      x: 2,
      y: 4,
      width: 20,
      height: 16,
      rx: 2
    }), R.createElement('path', {
      key: 1,
      d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'
    })]),
    Check: mk(['M20 6 9 17l-5-5']),
    ArrowRight: mk(['M5 12h14', 'm12 5 7 7-7 7']),
    MapPin: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'
    }), R.createElement('circle', {
      key: 1,
      cx: 12,
      cy: 10,
      r: 3
    })]),
    Clock: mkEl(R => [R.createElement('circle', {
      key: 0,
      cx: 12,
      cy: 12,
      r: 10
    }), R.createElement('path', {
      key: 1,
      d: 'M12 6v6l4 2'
    })]),
    Download: mk(['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3']),
    Send: mkEl(R => [R.createElement('path', {
      key: 0,
      d: 'M14.54 2.24 3.16 5.88a1 1 0 0 0-.05 1.88l4.9 1.94 1.94 4.9a1 1 0 0 0 1.88-.05l3.64-11.38a1 1 0 0 0-1.26-1.26Z'
    }), R.createElement('path', {
      key: 1,
      d: 'm9 15 3-3'
    })])
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/vision-app/icons.js", error: String((e && e.message) || e) }); }

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Breadcrumb = __ds_scope.Breadcrumb;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Dialog = __ds_scope.Dialog;

})();
