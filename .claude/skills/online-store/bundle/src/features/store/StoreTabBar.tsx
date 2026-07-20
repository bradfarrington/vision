import { useLocation, Link } from 'react-router-dom';
import {
  Package,
  FolderOpen,
  BarChart3,
  Gift,
  Percent,
  Truck,
  Search,
  Globe,
  LayoutTemplate,
  History,
} from 'lucide-react';

const storeTabs = [
  { label: 'Products', path: '/store', icon: Package },
  { label: 'Collections', path: '/store/collections', icon: FolderOpen },
  { label: 'Inventory', path: '/store/inventory', icon: BarChart3 },
  { label: 'Stock History', path: '/store/stock-movements', icon: History },
  { label: 'Gift Cards', path: '/store/gift-cards', icon: Gift },
  { label: 'Discounts', path: '/store/discounts', icon: Percent },
  { label: 'Shipping', path: '/store/shipping', icon: Truck },
  { label: 'SEO', path: '/store/seo', icon: Search },
  { label: 'Domain', path: '/store/domain', icon: Globe },
  { label: 'Builder', path: '/store/builder', icon: LayoutTemplate },
];

export function StoreTabBar() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/store') return location.pathname === '/store';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="store-tab-bar">
      {storeTabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.path);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`store-tab ${active ? 'active' : ''}`}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
