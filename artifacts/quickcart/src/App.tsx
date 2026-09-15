import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Activity, ArrowRight, BadgeDollarSign, BarChart3, Bike, Box, Check,
  CircleAlert, Clock3, Edit3, Menu,
  Minus, PackageCheck, Plus, RefreshCw, Search, Settings2, ShoppingBag, ShoppingCart,
  Store, TrendingUp, Truck, Users, X, Zap,
} from 'lucide-react';
import {
  getGetAdminAnalyticsQueryKey, getGetOrderQueryKey, getGetPartnerSummaryQueryKey,
  getListCatalogItemsQueryKey, getListCategoriesQueryKey, getListDeliveryZonesQueryKey,
  getListOrdersQueryKey, useCreateDeliveryZone, useCreateOrder, useGetAdminAnalytics,
  useGetOrder, useGetPartnerSummary, useListCatalogItems, useListCategories,
  useListDeliveryZones, useListOrders, useUpdateCatalogItem, useUpdateDeliveryZone,
  useUpdateOrderStatus,
} from '@workspace/api-client-react';
import type { CatalogItem, DeliveryZone, Order, OrderItem } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import NotFound from '@/pages/not-found';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient();
const steps = [
  { key: 'placed', label: 'Placed', icon: Check },
  { key: 'packing', label: 'Packing', icon: Box },
  { key: 'out_for_delivery', label: 'Out for delivery', icon: Bike },
  { key: 'delivered', label: 'Delivered', icon: PackageCheck },
] as const;
const money = (value: number) => `$${value.toFixed(2)}`;
const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

function Button({ children, className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' }) {
  return <button className={cn('qc-button', `qc-button-${variant}`, className)} {...props}>{children}</button>;
}

function Logo() {
  return <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-sm"><Zap size={19} strokeWidth={3} /></span>
    <span className="font-display text-lg font-bold tracking-tight">quick<span className="text-[hsl(var(--accent))]">cart</span></span>
  </Link>;
}

function TopNav({ compact = false }: { compact?: boolean }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  return <header className={cn('sticky top-0 z-40 border-b border-[hsl(var(--border)/.8)] bg-[hsl(var(--background)/.92)] backdrop-blur-xl', compact && 'lg:hidden')}>
    <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <Logo />
      <nav className="hidden items-center gap-1 lg:flex">
        {[
          ['/', 'Shop', ShoppingBag], ['/orders', 'Orders', Clock3], ['/partner', 'Partner', Store], ['/admin', 'Admin', BarChart3],
        ].map(([href, label, Icon]) => <Link key={href as string} href={href as string} data-testid={`link-nav-${label as string}`} className={cn('flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-[hsl(var(--muted))]', location === href && 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]')}><Icon size={16} />{label as string}</Link>)}
      </nav>
      <div className="hidden items-center gap-3 sm:flex">
        <span className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))]"><span className="h-2 w-2 rounded-full bg-emerald-500 pulse-soft" />Delivering in your area</span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--secondary))] font-display text-xs font-bold text-[hsl(var(--secondary-foreground))]">MC</span>
      </div>
      <Button variant="ghost" className="px-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={21} /></Button>
    </div>
    {open && <div className="border-t border-[hsl(var(--border))] px-4 pb-4 lg:hidden">
      <div className="grid gap-1 pt-2">{[['/', 'Shop'], ['/orders', 'Orders'], ['/partner', 'Partner'], ['/admin', 'Admin']].map(([href, label]) => <Link onClick={() => setOpen(false)} key={href} href={href} className="rounded-xl px-3 py-3 text-sm font-semibold hover:bg-[hsl(var(--muted))]" data-testid={`link-mobile-${label}`}>{label}</Link>)}</div>
    </div>}
  </header>;
}

function Shell({ children, eyebrow = 'QuickCart / Customer' }: { children: ReactNode; eyebrow?: string }) {
  return <div className="app-grain min-h-[100dvh] bg-[hsl(var(--background))]"><TopNav /><main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</main><footer className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-8 text-xs text-[hsl(var(--muted-foreground))] sm:px-6 lg:px-8"><span className="font-display font-semibold text-[hsl(var(--foreground))]">quickcart</span><span>{eyebrow} · local delivery, made clear</span></footer></div>;
}

function LoadingBlocks({ rows = 4 }: { rows?: number }) {
  return <div className="grid gap-3" aria-label="Loading"><div className="skeleton h-24 rounded-2xl" />{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>;
}

function QueryState({ error, onRetry, children }: { error?: boolean; onRetry: () => void; children: ReactNode }) {
  if (error) return <div className="qc-state"><CircleAlert size={26} className="text-[hsl(var(--accent))]" /><h3>That didn’t load</h3><p>We couldn’t reach the local catalog. Try once more.</p><Button variant="soft" onClick={onRetry} data-testid="button-retry"><RefreshCw size={15} />Try again</Button></div>;
  return <>{children}</>;
}

function StatCard({ label, value, detail, icon: Icon, tone = 'teal' }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: string }) {
  return <div className="qc-card animate-rise p-5">
    <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</p></div><span className={cn('grid h-10 w-10 place-items-center rounded-xl', tone === 'orange' ? 'bg-orange-100 text-orange-700' : tone === 'blue' ? 'bg-sky-100 text-sky-700' : 'bg-teal-100 text-teal-800')}><Icon size={19} /></span></div><p className="mt-4 text-xs font-medium text-[hsl(var(--muted-foreground))]">{detail}</p>
  </div>;
}

type CartLine = CatalogItem & { quantity: number };

function HomePage() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [address, setAddress] = useState('18 Juniper Street, Apt 4B');
  const params = useMemo(() => ({ search: search || undefined, category: category === 'all' ? undefined : category }), [search, category]);
  const categories = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const items = useListCatalogItems(params, { query: { queryKey: getListCatalogItemsQueryKey(params) } });
  const activeOrders = useListOrders({ role: 'customer' }, { query: { queryKey: getListOrdersQueryKey({ role: 'customer' }) } });
  const createOrder = useCreateOrder();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const activeOrder = activeOrders.data?.find((order) => order.status !== 'delivered');
  const add = (item: CatalogItem) => setCart((current) => current.some((line) => line.id === item.id) ? current.map((line) => line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { ...item, quantity: 1 }]);
  const changeQty = (id: number, delta: number) => setCart((current) => current.map((line) => line.id === id ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0));
  const checkout = () => {
    if (!cart.length || !address.trim()) return;
    const orderItems: OrderItem[] = cart.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price, unit: item.unit, emoji: item.emoji }));
    createOrder.mutate({ data: { items: orderItems, address } }, {
      onSuccess: (order) => { setCart([]); setCartOpen(false); qc.invalidateQueries({ queryKey: getListOrdersQueryKey({ role: 'customer' }) }); toast.success(`Order #${order.id} is on its way`); setLocation(`/track/${order.id}`); },
      onError: () => toast.error('We couldn’t place that order. Please try again.'),
    });
  };
  const data = items.data ?? [];
  return <Shell>
    <section className="hero-mesh relative overflow-hidden rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-8 sm:px-9 sm:py-11">
      <div className="relative z-10 max-w-2xl animate-rise"><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[hsl(var(--primary))]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />Fresh around the corner</div><h1 className="font-display text-4xl font-bold leading-[.98] tracking-[-.05em] sm:text-6xl">Your next grocery run,<br /><span className="text-[hsl(var(--primary))]">already handled.</span></h1><p className="mt-5 max-w-lg text-base leading-7 text-[hsl(var(--muted-foreground))]">Everyday essentials from trusted local stores, picked carefully and at your door before your list gets cold.</p><div className="mt-7 flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 rounded-full bg-[hsl(var(--card)/.8)] px-3 py-2 text-xs font-semibold"><Clock3 size={15} className="text-[hsl(var(--accent))]" />20–35 min delivery</div><div className="flex items-center gap-2 rounded-full bg-[hsl(var(--card)/.8)] px-3 py-2 text-xs font-semibold"><PackageCheck size={15} className="text-[hsl(var(--primary))]" />Packed with care</div></div></div>
      <div className="pointer-events-none absolute -right-8 -top-12 hidden h-72 w-72 rounded-full border-[28px] border-[hsl(var(--accent)/.25)] sm:block" /><div className="pointer-events-none absolute -bottom-16 right-24 hidden h-52 w-52 rounded-full border-[22px] border-[hsl(var(--primary)/.14)] sm:block" />
    </section>
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px]">
      <section>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">The neighborhood shelf</p><h2 className="mt-1 font-display text-2xl font-bold tracking-tight">What do you need today?</h2></div><label className="flex h-11 w-full items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm sm:max-w-xs"><Search size={17} className="text-[hsl(var(--muted-foreground))]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search milk, bananas, snacks..." className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[hsl(var(--muted-foreground))]" data-testid="input-search-catalog" /></label></div>
        <div className="scroll-thin mb-6 flex gap-2 overflow-x-auto pb-1"><button className={cn('category-pill', category === 'all' && 'category-pill-active')} onClick={() => setCategory('all')} data-testid="button-category-all">All items</button>{(categories.data ?? []).map((cat) => <button key={cat.id} className={cn('category-pill', category === cat.name && 'category-pill-active')} onClick={() => setCategory(cat.name)} data-testid={`button-category-${cat.id}`}>{cat.name}<span>{cat.itemCount}</span></button>)}</div>
        <QueryState error={items.isError} onRetry={() => items.refetch()}>{items.isLoading ? <LoadingBlocks rows={3} /> : data.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.map((item, i) => <ProductCard key={item.id} item={item} index={i} onAdd={() => add(item)} />)}</div> : <div className="qc-state min-h-[260px]"><Search size={26} /><h3>Nothing in that aisle</h3><p>Try a broader search or pick another category.</p><Button variant="soft" onClick={() => { setSearch(''); setCategory('all'); }} data-testid="button-clear-search">Clear filters</Button></div>}</QueryState>
      </section>
      <aside className={cn('lg:block', cartOpen ? 'fixed inset-0 z-50 block bg-[hsl(var(--foreground)/.25)] p-4 lg:static lg:bg-transparent lg:p-0' : 'hidden')}>
        <div className="qc-card soft-shadow sticky top-[96px] flex max-h-[calc(100dvh-120px)] flex-col overflow-hidden lg:max-h-[calc(100dvh-120px)]"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-5"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Your basket</p><h2 className="mt-1 font-display text-xl font-bold">{totalItems ? `${totalItems} item${totalItems > 1 ? 's' : ''}` : 'Ready when you are'}</h2></div><button onClick={() => setCartOpen(false)} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] lg:hidden" data-testid="button-close-cart"><X size={18} /></button></div>
          <div className="scroll-thin flex-1 overflow-y-auto p-5">{cart.length ? <div className="grid gap-3">{cart.map((line) => <div key={line.id} className="flex items-center gap-3" data-testid={`cart-line-${line.id}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-xl">{line.emoji}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{line.name}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{money(line.price)} · {line.unit}</p></div><div className="flex items-center gap-1 rounded-lg bg-[hsl(var(--muted))] p-1"><button onClick={() => changeQty(line.id, -1)} className="grid h-6 w-6 place-items-center rounded-md hover:bg-[hsl(var(--card))]" data-testid={`button-decrease-${line.id}`}><Minus size={13} /></button><span className="w-5 text-center text-xs font-bold">{line.quantity}</span><button onClick={() => changeQty(line.id, 1)} className="grid h-6 w-6 place-items-center rounded-md hover:bg-[hsl(var(--card))]" data-testid={`button-increase-${line.id}`}><Plus size={13} /></button></div></div>)}</div> : <div className="flex min-h-[190px] flex-col items-center justify-center text-center"><span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))]"><ShoppingCart size={24} className="text-[hsl(var(--primary))]" /></span><p className="font-semibold">Your basket is a blank slate.</p><p className="mt-1 max-w-[220px] text-xs leading-5 text-[hsl(var(--muted-foreground))]">Add a few favorites and we’ll get them moving.</p></div>}</div>
          {cart.length > 0 && <div className="border-t border-[hsl(var(--border))] p-5"><div className="mb-3 flex justify-between text-sm"><span className="text-[hsl(var(--muted-foreground))]">Subtotal</span><b>{money(subtotal)}</b></div><label className="mb-3 block text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Drop-off address<input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm font-normal normal-case tracking-normal outline-none focus:ring-2 focus:ring-[hsl(var(--ring)/.3)]" data-testid="input-delivery-address" /></label><Button className="w-full justify-center" onClick={checkout} disabled={createOrder.isPending} data-testid="button-checkout">{createOrder.isPending ? 'Placing order…' : <>Checkout · {money(subtotal + 3.99)}</>}</Button></div>}</div>
      </aside>
    </div>
    {activeOrder && <Link href={`/track/${activeOrder.id}`} className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[hsl(var(--sidebar))] px-4 py-3 text-[hsl(var(--sidebar-foreground))] shadow-2xl transition-transform hover:-translate-y-1" data-testid="link-active-order"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><Truck size={17} /></span><span><span className="block text-xs text-[hsl(var(--sidebar-foreground)/.7)]">Order #{activeOrder.id} · {activeOrder.statusLabel}</span><b className="block text-sm">Arriving {activeOrder.eta}</b></span><ArrowRight size={17} className="ml-2" /></Link>}
    <button onClick={() => setCartOpen(true)} className="fixed bottom-5 right-5 z-20 grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-xl lg:hidden" data-testid="button-open-cart"><ShoppingCart size={21} /><span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(var(--accent))] px-1 text-[10px] font-bold text-[hsl(var(--accent-foreground))]">{totalItems}</span></button>
  </Shell>;
}

function ProductCard({ item, onAdd, index }: { item: CatalogItem; onAdd: () => void; index: number }) {
  return <article className={cn('qc-card group flex flex-col p-3 animate-rise', `delay-${Math.min(index + 1, 4)}`)} data-testid={`card-product-${item.id}`}><div className="relative flex h-32 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--secondary)/.55)]"><span className="text-6xl transition-transform duration-300 group-hover:scale-110">{item.emoji}</span>{item.badge && <span className="absolute left-2 top-2 rounded-full bg-[hsl(var(--accent))] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--accent-foreground))]">{item.badge}</span>}{item.stock < 5 && <span className="absolute bottom-2 right-2 rounded-full bg-[hsl(var(--card)/.85)] px-2 py-1 text-[10px] font-bold text-[hsl(var(--destructive))]">Only {item.stock} left</span>}</div><div className="flex flex-1 flex-col px-1 pb-1 pt-3"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold leading-tight">{item.name}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.unit}</p></div><p className="font-display text-lg font-bold">{money(item.price)}</p></div><div className="mt-4 flex items-center justify-between gap-2"><span className="text-[11px] text-[hsl(var(--muted-foreground))]">{item.compareAtPrice > item.price ? <><s>{money(item.compareAtPrice)}</s> <span className="font-semibold text-[hsl(var(--primary))]">save {money(item.compareAtPrice - item.price)}</span></> : 'Local pick'}</span><Button className="h-9 px-3 text-xs" onClick={onAdd} disabled={item.stock < 1} data-testid={`button-add-${item.id}`}><Plus size={15} />Add</Button></div></div></article>;
}

function OrdersPage() {
  const orders = useListOrders({ role: 'customer' }, { query: { queryKey: getListOrdersQueryKey({ role: 'customer' }) } });
  return <Shell><PageHeading eyebrow="Your account / Orders" title="Past runs, neatly logged" description="Reorder in a glance, or follow the one that’s currently making its way to you." /><QueryState error={orders.isError} onRetry={() => orders.refetch()}>{orders.isLoading ? <LoadingBlocks rows={4} /> : orders.data?.length ? <div className="grid gap-3">{orders.data.map((order, i) => <OrderRow key={order.id} order={order} index={i} />)}</div> : <EmptyOrders />}</QueryState></Shell>;
}

function OrderRow({ order, index = 0 }: { order: Order; index?: number }) {
  return <article className={cn('qc-card flex flex-col gap-4 p-5 animate-rise sm:flex-row sm:items-center sm:justify-between', `delay-${Math.min(index + 1, 4)}`)} data-testid={`row-order-${order.id}`}><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))]"><ShoppingBag size={20} className="text-[hsl(var(--primary))]" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display font-bold">Order #{order.id}</h3><StatusPill status={order.status} label={order.statusLabel} /></div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{order.items.length} items · {order.address} · {order.createdAt}</p></div></div><div className="flex items-center justify-between gap-5 sm:justify-end"><div><p className="text-right font-display text-lg font-bold">{money(order.total)}</p><p className="text-right text-xs text-[hsl(var(--muted-foreground))]">{order.status === 'delivered' ? 'Delivered' : `ETA ${order.eta}`}</p></div><Link href={`/track/${order.id}`} className="qc-button qc-button-soft" data-testid={`link-order-details-${order.id}`}>{order.status === 'delivered' ? 'View' : 'Track'}<ArrowRight size={15} /></Link></div></article>;
}

function EmptyOrders() { return <div className="qc-state min-h-[360px]"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))]"><ReceiptIcon /></span><h3>No grocery runs yet</h3><p>Your first quickcart order will show up here.</p><Link href="/" className="qc-button qc-button-primary" data-testid="link-start-shopping">Start shopping<ArrowRight size={15} /></Link></div>; }
function ReceiptIcon() { return <ShoppingBag size={24} className="text-[hsl(var(--primary))]" />; }
function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="mb-8 animate-rise"><p className="text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">{eyebrow}</p><h1 className="mt-2 font-display text-4xl font-bold tracking-[-.04em]">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p></div>; }
function StatusPill({ status, label }: { status: string; label: string }) { return <span className={cn('status-pill', status === 'delivered' && 'status-done', status === 'out_for_delivery' && 'status-moving', status === 'packing' && 'status-packing')}>{label}</span>; }

function TrackPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const order = useGetOrder(id, { query: { enabled: Boolean(id), queryKey: getGetOrderQueryKey(id), refetchInterval: 15000 } });
  const current = order.data;
  const currentIndex = current ? steps.findIndex((step) => step.key === current.status) : 0;
  return <Shell><div className="mx-auto max-w-3xl"><Link href="/orders" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-orders">← Back to orders</Link><QueryState error={order.isError} onRetry={() => order.refetch()}>{order.isLoading ? <LoadingBlocks rows={3} /> : current ? <><div className="mb-5 animate-rise"><p className="text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Live order / #{current.id}</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-4xl font-bold tracking-[-.04em]">{current.statusLabel}</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{current.status === 'delivered' ? 'Thanks for letting us handle the run.' : `A careful handoff is expected by ${current.eta}.`}</p></div><StatusPill status={current.status} label={current.statusLabel} /></div></div><div className="qc-card overflow-hidden p-6 sm:p-8"><div className="mb-9 flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]"><Activity size={15} className="text-[hsl(var(--accent))]" />Live updates</span><span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">REFRESH 15S</span></div><div className="relative grid gap-7 sm:grid-cols-4 sm:gap-3">{steps.map((step, index) => { const done = index <= currentIndex; const Icon = step.icon; return <div key={step.key} className="relative flex items-center gap-3 sm:block sm:text-center"><div className={cn('relative z-10 mx-0 grid h-11 w-11 place-items-center rounded-2xl border-2 transition-colors sm:mx-auto', done ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]')}>{done && index < currentIndex ? <Check size={18} /> : <Icon size={18} />}</div><p className={cn('mt-0 text-sm font-semibold sm:mt-3', done ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]')}>{step.label}</p>{index < steps.length - 1 && <span className={cn('absolute left-[21px] top-11 h-7 w-0.5 sm:left-[calc(50%+22px)] sm:top-[22px] sm:h-0.5 sm:w-[calc(100%-44px)]', index < currentIndex ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]')} />}</div>; })}</div></div><div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr]"><div className="qc-card p-5"><p className="section-label">Delivery to</p><p className="mt-2 text-sm font-semibold">{current.address}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Customer: {current.customerName}</p></div><div className="qc-card p-5"><p className="section-label">Your basket</p><div className="mt-2 grid gap-2">{current.items.map((item) => <div key={item.id} className="flex items-center justify-between text-sm"><span className="flex min-w-0 items-center gap-2"><span>{item.emoji}</span><span className="truncate">{item.quantity} × {item.name}</span></span><b>{money(item.price * item.quantity)}</b></div>)}</div><div className="mt-3 flex justify-between border-t border-[hsl(var(--border))] pt-3 text-sm font-bold"><span>Total</span><span>{money(current.total)}</span></div></div></div></> : <div className="qc-state"><CircleAlert size={25} /><h3>Order not found</h3><p>That tracking link may have expired.</p></div>}</QueryState></div></Shell>;
}

function PartnerPage() {
  const qc = useQueryClient();
  const summary = useGetPartnerSummary({ query: { queryKey: getGetPartnerSummaryQueryKey() } });
  const orders = useListOrders({ role: 'partner' }, { query: { queryKey: getListOrdersQueryKey({ role: 'partner' }) } });
  const catalog = useListCatalogItems(undefined, { query: { queryKey: getListCatalogItemsQueryKey() } });
  const updateStatus = useUpdateOrderStatus();
  const updateItem = useUpdateCatalogItem();
  const [inventoryEdit, setInventoryEdit] = useState<number | null>(null);
  const [stock, setStock] = useState('');
  const pending = orders.data?.filter((o) => o.status !== 'delivered') ?? [];
  const setStatus = (id: number, status: 'placed' | 'packing' | 'out_for_delivery' | 'delivered') => updateStatus.mutate({ id, data: { status } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListOrdersQueryKey({ role: 'partner' }) }); qc.invalidateQueries({ queryKey: getGetPartnerSummaryQueryKey() }); toast.success('Order status updated'); }, onError: () => toast.error('Status update failed') });
  const saveStock = (item: CatalogItem) => updateItem.mutate({ id: item.id, data: { stock: Number(stock) } }, { onSuccess: () => { setInventoryEdit(null); qc.invalidateQueries({ queryKey: getListCatalogItemsQueryKey() }); qc.invalidateQueries({ queryKey: getGetPartnerSummaryQueryKey() }); toast.success(`${item.name} inventory saved`); }, onError: () => toast.error('Inventory update failed') });
  return <Shell eyebrow="QuickCart / Store partner"><PageHeading eyebrow="Store partner / Morning shift" title="Make every handoff count." description="A clear view of what needs attention now, what is moving, and what’s getting low." /><QueryState error={summary.isError || orders.isError} onRetry={() => { summary.refetch(); orders.refetch(); }}>{summary.isLoading ? <LoadingBlocks rows={3} /> : <><div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Orders today" value={String(summary.data?.ordersToday ?? 0)} detail="Across your local storefront" icon={ShoppingBag} /><StatCard label="Pending now" value={String(summary.data?.pendingOrders ?? 0)} detail="Keep the queue moving" icon={Clock3} tone="orange" /><StatCard label="Low stock" value={String(summary.data?.lowStockItems ?? 0)} detail="Needs a shelf check" icon={CircleAlert} tone="orange" /><StatCard label="Today’s revenue" value={money(summary.data?.todayRevenue ?? 0)} detail="Before platform fees" icon={BadgeDollarSign} tone="blue" /></div><div className="grid gap-8 lg:grid-cols-[1.25fr_.75fr]"><section><div className="mb-4 flex items-center justify-between"><div><p className="section-label">Fulfillment queue</p><h2 className="mt-1 font-display text-2xl font-bold">Orders needing a hand</h2></div><span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs font-bold">{pending.length} open</span></div><div className="grid gap-3">{pending.length ? pending.map((order) => <PartnerOrder key={order.id} order={order} busy={updateStatus.isPending} onStatus={setStatus} />) : <div className="qc-state min-h-[260px]"><PackageCheck size={27} /><h3>Queue is clear</h3><p>Every order is accounted for right now.</p></div>}</div></section><section><div className="mb-4"><p className="section-label">Shelf signals</p><h2 className="mt-1 font-display text-2xl font-bold">Inventory watch</h2></div><div className="qc-card divide-y divide-[hsl(var(--border))] overflow-hidden">{(catalog.data ?? []).slice(0, 7).map((item) => <div key={item.id} className="flex items-center gap-3 p-4" data-testid={`row-inventory-${item.id}`}><span className="grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--secondary))] text-lg">{item.emoji}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{money(item.price)} · {item.unit}</p></div>{inventoryEdit === item.id ? <div className="flex items-center gap-1"><input autoFocus value={stock} onChange={(e) => setStock(e.target.value)} className="h-8 w-14 rounded-lg border bg-[hsl(var(--background))] px-2 text-sm outline-none" data-testid={`input-stock-${item.id}`} /><button onClick={() => saveStock(item)} className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" data-testid={`button-save-stock-${item.id}`}><Check size={14} /></button></div> : <button onClick={() => { setInventoryEdit(item.id); setStock(String(item.stock)); }} className={cn('rounded-full px-2.5 py-1 text-xs font-bold', item.stock < 5 ? 'bg-orange-100 text-orange-800' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')} data-testid={`button-edit-stock-${item.id}`}>{item.stock} left <Edit3 size={11} className="ml-1 inline" /></button>}</div>)}{!catalog.data?.length && <div className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No inventory to display.</div>}</div></section></div></>}</QueryState></Shell>;
}

function PartnerOrder({ order, onStatus, busy }: { order: Order; onStatus: (id: number, status: 'placed' | 'packing' | 'out_for_delivery' | 'delivered') => void; busy: boolean }) {
  const next = order.status === 'placed' ? { key: 'packing' as const, label: 'Start packing' } : order.status === 'packing' ? { key: 'out_for_delivery' as const, label: 'Hand to courier' } : { key: 'delivered' as const, label: 'Mark delivered' };
  return <article className="qc-card p-5" data-testid={`card-pending-order-${order.id}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-display font-bold">Order #{order.id}</h3><StatusPill status={order.status} label={order.statusLabel} /></div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{order.customerName} · {order.address}</p></div><Button onClick={() => onStatus(order.id, next.key)} disabled={busy} className="text-xs" data-testid={`button-advance-order-${order.id}`}>{next.label}<ArrowRight size={14} /></Button></div><div className="mt-4 flex flex-wrap gap-2">{order.items.map((item) => <span key={item.id} className="rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1.5 text-xs font-medium">{item.quantity} × {item.name}</span>)}</div></article>;
}

function AdminPage() {
  const qc = useQueryClient();
  const analytics = useGetAdminAnalytics({ query: { queryKey: getGetAdminAnalyticsQueryKey() } });
  const zones = useListDeliveryZones({ query: { queryKey: getListDeliveryZonesQueryKey() } });
  const createZone = useCreateDeliveryZone();
  const updateZone = useUpdateDeliveryZone();
  const [zoneForm, setZoneForm] = useState({ name: '', eta: '25–35 min', fee: '3.99' });
  const [showForm, setShowForm] = useState(false);
  const submitZone = () => { if (!zoneForm.name.trim()) return; createZone.mutate({ data: { name: zoneForm.name, eta: zoneForm.eta, fee: Number(zoneForm.fee) } }, { onSuccess: () => { setZoneForm({ name: '', eta: '25–35 min', fee: '3.99' }); setShowForm(false); qc.invalidateQueries({ queryKey: getListDeliveryZonesQueryKey() }); toast.success('Delivery zone created'); }, onError: () => toast.error('Could not create zone') }); };
  const toggleZone = (zone: DeliveryZone) => updateZone.mutate({ id: zone.id, data: { name: zone.name, eta: zone.eta, fee: zone.fee } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListDeliveryZonesQueryKey() }); toast.success(`${zone.name} settings saved`); }, onError: () => toast.error('Could not update zone') });
  return <Shell eyebrow="QuickCart / Admin"><PageHeading eyebrow="Platform control / Overview" title="The whole route, at a glance." description="Sales pulse, customer reach, and delivery coverage for the team making local commerce move." /><QueryState error={analytics.isError || zones.isError} onRetry={() => { analytics.refetch(); zones.refetch(); }}>{analytics.isLoading ? <LoadingBlocks rows={3} /> : <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Total sales" value={money(analytics.data?.totalSales ?? 0)} detail="Gross merchandise value" icon={TrendingUp} /><StatCard label="Platform revenue" value={money(analytics.data?.platformRevenue ?? 0)} detail="Net platform earnings" icon={BadgeDollarSign} tone="orange" /><StatCard label="Active customers" value={String(analytics.data?.activeCustomers ?? 0)} detail="Shopping this week" icon={Users} tone="blue" /><StatCard label="Orders today" value={String(analytics.data?.ordersToday ?? 0)} detail="Across every zone" icon={ShoppingBag} /></div><div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_.75fr]"><section className="qc-card p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="section-label">Seven-day pulse</p><h2 className="mt-1 font-display text-2xl font-bold">Sales, without the fog</h2></div><span className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">Live</span></div><SalesChart data={analytics.data?.dailySales ?? []} /></section><section><div className="mb-4 flex items-center justify-between"><div><p className="section-label">Coverage</p><h2 className="mt-1 font-display text-2xl font-bold">Delivery zones</h2></div><Button variant="soft" className="h-9 px-3 text-xs" onClick={() => setShowForm(!showForm)} data-testid="button-add-zone"><Plus size={15} />Add zone</Button></div>{showForm && <div className="qc-card mb-3 grid gap-3 p-4 animate-rise"><input value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Zone name" className="qc-input" data-testid="input-zone-name" /><div className="grid grid-cols-2 gap-2"><input value={zoneForm.eta} onChange={(e) => setZoneForm({ ...zoneForm, eta: e.target.value })} placeholder="ETA, e.g. 20–30 min" className="qc-input" data-testid="input-zone-eta" /><input type="number" value={zoneForm.fee} onChange={(e) => setZoneForm({ ...zoneForm, fee: e.target.value })} placeholder="Fee" className="qc-input" data-testid="input-zone-fee" /></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowForm(false)} data-testid="button-cancel-zone">Cancel</Button><Button onClick={submitZone} disabled={createZone.isPending} data-testid="button-save-zone">{createZone.isPending ? 'Saving…' : 'Save zone'}</Button></div></div>}<div className="qc-card divide-y divide-[hsl(var(--border))] overflow-hidden">{(zones.data ?? []).map((zone) => <div key={zone.id} className="flex items-center gap-3 p-4" data-testid={`row-zone-${zone.id}`}><span className={cn('grid h-9 w-9 place-items-center rounded-lg', zone.active ? 'bg-teal-100 text-teal-800' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}><Truck size={16} /></span><div className="min-w-0 flex-1"><p className="font-semibold">{zone.name}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{zone.eta} · {money(zone.fee)} · {zone.orderCount} orders</p></div><button onClick={() => toggleZone(zone)} className={cn('relative h-6 w-11 rounded-full transition-colors', zone.active ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]')} data-testid={`button-toggle-zone-${zone.id}`}><span className={cn('absolute top-1 h-4 w-4 rounded-full bg-[hsl(var(--card))] transition-transform', zone.active ? 'left-6' : 'left-1')} /></button></div>)}{!zones.data?.length && <div className="qc-state min-h-[180px]"><MapPinIcon /><p>No delivery zones yet.</p></div>}</div></section></div></>}</QueryState></Shell>;
}

function SalesChart({ data }: { data: Array<{ day: string; sales: number; orders: number }> }) {
  const max = Math.max(...data.map((item) => item.sales), 1);
  if (!data.length) return <div className="qc-state my-8 min-h-[180px]"><BarChart3 size={24} /><p>Sales data will appear here.</p></div>;
  return <div className="mt-8 flex h-56 items-end gap-2 border-b border-l border-[hsl(var(--border))] px-2 pb-0 sm:gap-4">{data.map((item) => <div key={item.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="pointer-events-none rounded bg-[hsl(var(--sidebar))] px-2 py-1 text-[10px] font-bold text-[hsl(var(--sidebar-foreground))] opacity-0 transition-opacity group-hover:opacity-100">{money(item.sales)}</span><div className="w-full max-w-10 rounded-t-lg bg-[hsl(var(--primary))] transition-[height] duration-500 group-hover:bg-[hsl(var(--accent))]" style={{ height: `${Math.max(7, (item.sales / max) * 78)}%` }} /><span className="pb-2 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{item.day}</span></div>)}</div>;
}
function MapPinIcon() { return <Settings2 size={23} className="text-[hsl(var(--muted-foreground))]" />; }

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={HomePage} /><Route path="/track/:id" component={TrackPage} /><Route path="/orders" component={OrdersPage} /><Route path="/partner" component={PartnerPage} /><Route path="/admin" component={AdminPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></QueryClientProvider>;
}

export default App;