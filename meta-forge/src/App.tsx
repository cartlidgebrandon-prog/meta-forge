import React, { useEffect, useMemo, useReducer, useState, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ==============================================
// Meta Forge — Pro MTG Team & Store (TypeScript + React, single file)
// ==============================================
// - Tailwind CSS utility classes
// - Hash-based routing (works in any static host)
// - Products intentionally empty (we'll add later)
// - Team roster placeholder (send real players and I will drop them in)

// ---------------- Types ----------------
type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  rating?: number;
  colors?: string[];
  image?: string;
  blurb?: string;
  features?: string[];
  stock?: number;
};

type TeamLinks = { twitch?: string; x?: string; website?: string };

type TeamMember = {
  gamerTag: string;
  name: string;
  role: string;
  avatar: string;
  bio?: string;
  links?: TeamLinks;
};

type TourEvent = { date: string; title: string; desc: string };

// ---------------- Brand / Config ----------------
const BRAND = {
  name: "Meta Forge",
  tagline: "We Don't Play the Meta. We Create It.",
  colors: { primary: "#6b21a8", accent: "#f59e0b", dark: "#0b0613" },
  socials: [
    { label: "Twitter/X", href: "https://x.com" },
    { label: "Twitch", href: "https://twitch.tv" },
    { label: "YouTube", href: "https://youtube.com" },
    { label: "Discord", href: "https://discord.gg" },
  ],
};

// ---- Logo fallbacks (compact, valid, and properly closed strings) ----
// Inline SVG so we always render something if no logo asset is present.
const DEFAULT_LOGO_DATA =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='120'>" +
  "<rect width='100%' height='100%' fill='%230b0613'/>" +
  "<text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='%23f59e0b' font-size='28' font-family='system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif'>META%20FORGE</text>" +
  "</svg>";
const DEFAULT_FAVICON_DATA =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>" +
  "<rect width='64' height='64' rx='10' fill='%230b0613'/>" +
  "<circle cx='32' cy='32' r='14' fill='%23f59e0b'/>" +
  "</svg>";

// Allow external injection of assets/products
declare global {
  interface Window { PRODUCTS?: Product[]; logoUrl?: string }
}

// ---------------- Catalog ----------------
const CATEGORIES = [
  { id: "sleeves", name: "Card Sleeves" },
  { id: "deckboxes", name: "Deck Boxes" },
  { id: "playmats", name: "Playmats" },
  { id: "accessories", name: "Accessories" },
  { id: "apparel", name: "Apparel" },
];

// Roster & Events placeholders (send real players to populate)
const TEAM: TeamMember[] = [];
const EVENTS: TourEvent[] = [
  { date: "2025-10-25", title: "Grand Championship – Las Vegas", desc: "Feature match stage + signing at booth #12." },
  { date: "2025-11-14", title: "Regional Qualifier – Seattle", desc: "Team meet & greet." },
  { date: "2025-12-05", title: "Pro Series – Austin", desc: "Merch pop-up." },
];

// ---------------- Utilities ----------------
const fmt = (n: number): string => `$${n.toFixed(2)}`;

function getProducts(): Product[] {
  try {
    const injected = (typeof window !== 'undefined' && (window as any).PRODUCTS) as Product[] | undefined;
    return Array.isArray(injected) ? injected : [];
  } catch {
    return [];
  }
}

function getLogoUrl(): string {
  try {
    return (typeof window !== 'undefined' && (window as any).logoUrl) || DEFAULT_LOGO_DATA;
  } catch {
    return DEFAULT_LOGO_DATA;
  }
}

// ---------------- Cart State ----------------
type CartItem = Product & { qty: number; color?: string };

type CartState = { items: CartItem[] };

type CartAction =
  | { type: "add"; item: Product; qty: number; color?: string }
  | { type: "remove"; id: string; color?: string }
  | { type: "qty"; id: string; color?: string; qty: number }
  | { type: "clear" };

const CartContext = createContext<{ state: CartState; dispatch: React.Dispatch<CartAction> } | null>(null);

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const existing = state.items.find((i) => i.id === action.item.id && i.color === action.color);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) => (i === existing ? { ...i, qty: Math.min(i.qty + action.qty, 99) } : i)),
        };
      }
      return { ...state, items: [...state.items, { ...action.item, qty: action.qty, color: action.color }] };
    }
    case "remove": {
      return { ...state, items: state.items.filter((i) => !(i.id === action.id && i.color === action.color)) };
    }
    case "qty": {
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id && i.color === action.color ? { ...i, qty: Math.max(1, Math.min(99, action.qty)) } : i)),
      };
    }
    case "clear":
      return { items: [] };
    default:
      return state;
  }
}

function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartContext.Provider");
  return ctx;
}

// ---------------- App ----------------
export default function MetaForgeSite(): JSX.Element {
  const [state, dispatch] = useReducer(cartReducer, { items: [] } as CartState);
  const [route, setRoute] = useState<string>("/");
  const [query, setQuery] = useState<string>("");
  const [filters, setFilters] = useState<{ category: string; sort: string }>({ category: "all", sort: "popular" });
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    const applyHash = () => setRoute(location.hash.replace("#", "") || "/");
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // Try to auto-detect a real logo asset placed in common public paths
  useEffect(() => {
    if (typeof window === 'undefined' || (window as any).logoUrl) return;
    const candidates = [
      '/assets/meta-forge-logo.png',
      '/meta-forge-logo.png',
      '/metaforge-logo.png',
      '/images/meta-forge-logo.png',
      '/logo.png'
    ];
    (async () => {
      for (const src of candidates) {
        try {
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('not found'));
            img.src = src + '?t=' + Date.now();
          });
          (window as any).logoUrl = src; // cache globally
          break;
        } catch {}
      }
    })();
  }, []);

  useEffect(() => {
    // Favicon & OG image: prefer dedicated favicon file, else fall back gracefully
    try {
      const setIcon = (href: string) => {
        const link = (document.querySelector("link[rel='icon']") as HTMLLinkElement) || document.createElement('link');
        link.setAttribute('rel','icon');
        link.setAttribute('type','image/png');
        link.setAttribute('href', href);
        document.head.appendChild(link);
      };
      const setOG = (href: string) => {
        const og = (document.querySelector("meta[property='og:image']") as HTMLMetaElement) || document.createElement('meta');
        og.setAttribute('property','og:image');
        og.setAttribute('content', href);
        document.head.appendChild(og);
      };

      const favCandidate = '/assets/meta-forge-favicon.png';
      const probe = new Image();
      probe.onload = () => { setIcon(favCandidate); setOG(getLogoUrl()); };
      probe.onerror = () => { setIcon(DEFAULT_FAVICON_DATA); setOG(getLogoUrl()); };
      probe.src = favCandidate + '?t=' + Date.now();
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    let list = getProducts().filter((p) => (filters.category === "all" || p.category === filters.category) && (query ? (p.name + (p.blurb || "")).toLowerCase().includes(query.toLowerCase()) : true));
    if (filters.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (filters.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (filters.sort === "popular") list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return list;
  }, [filters, query]);

  // ---- Dev sanity tests (non-fatal) ----
  useEffect(() => {
    try {
      // cart reducer
      const s1 = cartReducer({ items: [] }, { type: 'add', item: { id: 't', name: 'Test', price: 1, category: 'x' }, qty: 2 });
      console.assert(s1.items.length === 1 && s1.items[0].qty === 2, 'cart add failed');
      const s2 = cartReducer(s1, { type: 'qty', id: 't', qty: 5 });
      console.assert(s2.items[0].qty === 5, 'cart qty failed');
      const s3 = cartReducer(s2, { type: 'remove', id: 't' });
      console.assert(s3.items.length === 0, 'cart remove failed');

      // logo helper
      const prev = (window as any).logoUrl;
      delete (window as any).logoUrl;
      console.assert(getLogoUrl() === DEFAULT_LOGO_DATA, 'getLogoUrl default failed');
      (window as any).logoUrl = '/__fake__/logo.png';
      console.assert(getLogoUrl() === '/__fake__/logo.png', 'getLogoUrl window override failed');
      if (prev) (window as any).logoUrl = prev; else delete (window as any).logoUrl;
    } catch {}
  }, []);

  return (
    <CartContext.Provider value={{ state, dispatch }}>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-[#130a1e] to-black text-zinc-100">
        <Header />
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AnimatePresence mode="wait">
            {route === "/" && (
              <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Hero />
                <HomeFeatures />
                <section className="mt-12">
                  <SectionTitle title="Featured Gear" subtitle="Tournament-ready equipment forged for the meta." />
                  <ProductGrid products={getProducts().slice(0, 4)} onSelect={setSelected} />
                </section>
                <TeamPreview />
                <Events />
              </motion.div>
            )}
            {route === "/shop" && (
              <motion.div key="shop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SectionTitle title="Shop" subtitle="Premium gear for competitive play." />
                <ShopControls query={query} setQuery={setQuery} filters={filters} setFilters={setFilters} />
                <ProductGrid products={filtered} onSelect={setSelected} />
              </motion.div>
            )}
            {route === "/team" && (
              <motion.div key="team" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TeamPage />
              </motion.div>
            )}
            {route === "/about" && (
              <motion.div key="about" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <About />
              </motion.div>
            )}
            {route === "/faq" && (
              <motion.div key="faq" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <FAQ />
              </motion.div>
            )}
            {route === "/contact" && (
              <motion.div key="contact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Contact />
              </motion.div>
            )}
            {route === "/cart" && (
              <motion.div key="cart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Cart />
              </motion.div>
            )}
            {route === "/checkout" && (
              <motion.div key="checkout" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Checkout />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <Footer />

        <AnimatePresence>{selected && <ProductModal product={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
      </div>
    </CartContext.Provider>
  );
}

// ---------------- UI Sections ----------------
function Header(): JSX.Element {
  const { state } = useCart();
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-black/40 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-3">
        <a href="#/" className="flex items-center gap-3 group">
          <img src={getLogoUrl()} alt="Meta Forge logo" className="h-10 w-auto drop-shadow" />
          <div className="leading-tight">
            <div className="text-xl font-extrabold tracking-wide" style={{ color: BRAND.colors.accent }}>META FORGE</div>
            <div className="text-[10px] uppercase opacity-70">Pro Team & Outfitter</div>
          </div>
        </a>
        <div className="flex items-center gap-4">
          <SearchMini />
          <a href="#/cart" className="relative inline-flex items-center px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 transition">
            <span className="material-symbols-outlined align-[-3px]">shopping_cart</span>
            <span className="ml-2 text-sm">Cart</span>
            {state.items.length > 0 && (
              <span className="ml-2 text-xs rounded-md bg-amber-500 text-black font-bold px-1.5">{state.items.reduce((a, b) => a + b.qty, 0)}</span>
            )}
          </a>
        </div>
      </div>
    </header>
  );
}

function Nav(): JSX.Element {
  const items = [
    { href: "#/shop", label: "Shop" },
    { href: "#/team", label: "Team" },
    { href: "#/about", label: "About" },
    { href: "#/faq", label: "FAQ" },
    { href: "#/contact", label: "Contact" },
  ];
  return (
    <nav className="border-b border-white/10 bg-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex gap-1 py-2">
          {items.map((it) => (
            <li key={it.href}>
              <a href={it.href} className="px-3 py-1.5 rounded-lg text-sm hover:bg-white/10">
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function Hero(): JSX.Element {
  return (
    <section className="relative overflow-hidden rounded-3xl p-8 sm:p-12 bg-gradient-to-b from-indigo-900/40 via-purple-900/30 to-black border border-white/10 shadow-2xl">
      <div className="relative z-10 max-w-3xl">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Forge the <span style={{ color: BRAND.colors.accent }}>Meta</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-4 text-zinc-300">
          {BRAND.tagline}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-6 flex gap-3">
          <a href="#/shop" className="px-5 py-2 rounded-xl bg-amber-500 text-black font-semibold shadow hover:shadow-lg transition">Shop Gear</a>
          <a href="#/team" className="px-5 py-2 rounded-xl border border-white/20 hover:bg-white/5 transition">Meet the Team</a>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 0.25, scale: 1 }} transition={{ duration: 1 }} className="absolute inset-0 bg-[radial-gradient(80%_50%_at_70%_0%,_rgba(245,158,11,0.35),_transparent)]" />
      <img src={getLogoUrl()} alt="Meta Forge emblem" className="absolute right-6 bottom-6 h-40 opacity-20 pointer-events-none select-none" />
    </section>
  );
}

function HomeFeatures(): JSX.Element {
  const feats = [
    { title: "Tournament Grade", desc: "Battle-tested gear engineered with pros.", icon: "verified" },
    { title: "Free US Shipping $60+", desc: "Fast dispatch from our Nevada hub.", icon: "local_shipping" },
    { title: "Designed for Shuffle Feel", desc: "Texture tuned for consistent play.", icon: "gesture" },
  ];
  return (
    <div className="grid sm:grid-cols-3 gap-4 mt-8">
      {feats.map((f) => (
        <div key={f.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">{f.icon}</span>
            <h3 className="font-semibold">{f.title}</h3>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{f.desc}</p>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }): JSX.Element {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      {subtitle && <p className="text-zinc-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function ProductCard({ p, onSelect }: { p: Product; onSelect: (p: Product) => void }): JSX.Element {
  return (
    <motion.div layout className="rounded-2xl overflow-hidden border border-white/10 bg-zinc-950/70 hover:bg-zinc-900 transition shadow">
      <button onClick={() => onSelect(p)} className="block text-left w-full">
        <div className="aspect-[4/3] overflow-hidden">
          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{p.name}</h3>
            <span className="text-amber-400 font-bold">{fmt(p.price)}</span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">{p.blurb}</p>
          <div className="mt-2 text-xs text-zinc-400">Rating: {(p.rating || 0).toFixed(1)}★</div>
        </div>
      </button>
    </motion.div>
  );
}

function ProductGrid({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }): JSX.Element {
  if (!products || products.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-zinc-300">
        <div className="text-lg font-semibold">Shop launching soon</div>
        <p className="mt-1 text-sm text-zinc-400">Our first drop is being forged. Check back shortly or follow us for updates.</p>
        <img src={getLogoUrl()} alt="Meta Forge" className="h-14 mx-auto mt-4 opacity-90" />
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} onSelect={onSelect} />
      ))}
    </div>
  );
}

function ShopControls({ query, setQuery, filters, setFilters }: { query: string; setQuery: (s: string) => void; filters: { category: string; sort: string }; setFilters: (f: { category: string; sort: string }) => void }): JSX.Element {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end mb-6">
      <div className="flex-1">
        <label className="block text-xs mb-1 text-zinc-400">Search</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 outline-none focus:border-amber-500" />
      </div>
      <div>
        <label className="block text-xs mb-1 text-zinc-400">Category</label>
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10">
          <option value="all">All</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs mb-1 text-zinc-400">Sort</label>
        <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10">
          <option value="popular">Most Popular</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
}

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }): JSX.Element {
  const { dispatch } = useCart();
  const [qty, setQty] = useState<number>(1);
  const [color, setColor] = useState<string>((product.colors && product.colors[0]) || "Standard");
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div onClick={onClose} className="absolute inset-0 bg-black/60" />
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="relative max-w-3xl w-full rounded-3xl overflow-hidden border border-white/10 bg-zinc-950">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 p-2 rounded-lg bg-black/40 hover:bg-black/60">✕</button>
        <div className="grid md:grid-cols-2">
          <div className="aspect-square overflow-hidden">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="p-6">
            <h3 className="text-2xl font-bold">{product.name}</h3>
            <div className="mt-1 text-amber-400 font-bold">{fmt(product.price)}</div>
            <p className="mt-3 text-zinc-300">{product.blurb}</p>
            {product.features && product.features.length > 0 && (
              <ul className="mt-4 list-disc list-inside text-sm text-zinc-300 space-y-1">
                {product.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-3 items-end">
              <div>
                <label className="block text-xs mb-1 text-zinc-400">Color</label>
                <select value={color} onChange={(e) => setColor(e.target.value)} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10">
                  {(product.colors || ["Standard"]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1 text-zinc-400">Qty</label>
                <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} className="w-24 px-3 py-2 rounded-xl bg-black/40 border border-white/10" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { dispatch({ type: "add", item: product, qty, color }); onClose(); location.hash = "#/cart"; }} className="px-5 py-2 rounded-xl bg-amber-500 text-black font-semibold">
                Add to Cart
              </button>
              <button onClick={() => dispatch({ type: "add", item: product, qty, color })} className="px-5 py-2 rounded-xl border border-white/20 hover:bg-white/5">
                Add & Continue
              </button>
            </div>
            {typeof product.stock === "number" && <div className="mt-6 text-xs text-zinc-400">In stock: {product.stock}</div>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TeamPreview(): JSX.Element {
  return (
    <section className="mt-14">
      <SectionTitle title="The Team" subtitle="Pros who live on the feature match table." />
      {TEAM.length ? (
        <div className="grid sm:grid-cols-3 gap-4">
          {TEAM.map((m) => (
            <div key={m.gamerTag} className="rounded-2xl overflow-hidden border border-white/10 bg-black/30">
              <div className="aspect-[4/3] overflow-hidden"><img src={m.avatar} alt={m.name} className="w-full h-full object-cover" /></div>
              <div className="p-4">
                <div className="font-semibold">{m.gamerTag}</div>
                <div className="text-sm text-zinc-400">{m.role}</div>
                <a href="#/team" className="mt-3 inline-block text-amber-400 hover:underline">Roster -&gt;</a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-zinc-300">
          <div className="text-lg font-semibold">Roster reveal soon</div>
          <p className="mt-1 text-sm text-zinc-400">We're finalizing the Meta Forge lineup. Check back for the official announcement.</p>
        </div>
      )}
    </section>
  );
}

function Events(): JSX.Element {
  return (
    <section className="mt-14">
      <SectionTitle title="Upcoming Events" subtitle="Catch Meta Forge on tour." />
      <div className="grid sm:grid-cols-3 gap-4">
        {EVENTS.map((e) => (
          <div key={e.title} className="rounded-2xl p-4 border border-white/10 bg-black/30">
            <div className="text-sm text-zinc-400">{new Date(e.date).toLocaleDateString()}</div>
            <div className="font-semibold mt-1">{e.title}</div>
            <p className="text-sm text-zinc-300 mt-2">{e.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamPage(): JSX.Element {
  if (!TEAM.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/30 p-8 text-center">
        <h3 className="text-xl font-bold">Roster coming soon</h3>
        <p className="mt-2 text-zinc-300">Send your players' details and I'll wire them in immediately.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-2"><img src={getLogoUrl()} alt="Meta Forge" className="h-8" /></div>
      <SectionTitle title="Meta Forge Roster" subtitle="Intimidating. Competitive. Precise." />
      <div className="grid md:grid-cols-3 gap-6">
        {TEAM.map((m) => (
          <div key={m.gamerTag} className="rounded-3xl overflow-hidden border border-white/10 bg-black/30">
            <img src={m.avatar} alt={m.name} className="w-full aspect-[4/3] object-cover" />
            <div className="p-5">
              <div className="text-amber-400 font-bold">{m.gamerTag}</div>
              <div className="text-lg font-semibold">{m.name}</div>
              <div className="text-sm text-zinc-400">{m.role}</div>
              {m.bio && <p className="mt-3 text-sm text-zinc-300">{m.bio}</p>}
              <div className="mt-4 flex gap-3 text-sm">
                {m.links?.twitch && <a className="hover:underline" href={m.links.twitch}>Twitch</a>}
                {m.links?.x && <a className="hover:underline" href={m.links.x}>X</a>}
                {m.links?.website && <a className="hover:underline" href={m.links.website}>Website</a>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function About(): JSX.Element {
  return (
    <div className="prose prose-invert max-w-none">
      <h2>About Meta Forge</h2>
      <p>
        Meta Forge is a professional Magic: The Gathering team and gear brand based in the USA. Our mission is simple: combine ruthless competitive discipline with equipment that removes friction between decision and execution.
      </p>
      <p>
        We design sleeves, deck boxes, and playmats that feel great, last long, and photograph beautifully on coverage. Every product is tested in-house by our roster—if it doesn't survive tournament weekends, it doesn't ship.
      </p>
      <h3>Wholesale & Partnerships</h3>
      <p>
        Interested in stocking Meta Forge gear or sponsoring the team? Email <a href="mailto:sales@metaforge.gg">sales@metaforge.gg</a>.
      </p>
    </div>
  );
}

function FAQ(): JSX.Element {
  const faqs = [
    { q: "Do you ship internationally?", a: "Yes. Duties/taxes shown at checkout where supported." },
    { q: "What sleeve size?", a: "Standard 66×91mm for MTG—Japanese size coming soon." },
    { q: "Are products tournament legal?", a: "Yes, designed to meet typical event policies (always check organizer rules)." },
  ];
  return (
    <div className="grid gap-3">
      {faqs.map((f) => (
        <details key={f.q} className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <summary className="cursor-pointer font-medium">{f.q}</summary>
          <p className="mt-2 text-zinc-300">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

function Contact(): JSX.Element {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <h3 className="text-xl font-bold">Contact Us</h3>
        <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); alert("Thanks! We'll be in touch."); }}>
          <input required placeholder="Name" className="px-3 py-2 rounded-xl bg-black/40 border border-white/10" />
          <input required type="email" placeholder="Email" className="px-3 py-2 rounded-xl bg-black/40 border border-white/10" />
          <textarea required placeholder="Message" rows={4} className="px-3 py-2 rounded-xl bg-black/40 border border-white/10" />
          <button className="px-5 py-2 rounded-xl bg-amber-500 text-black font-semibold w-max">Send</button>
        </form>
      </div>
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <h3 className="text-xl font-bold">Wholesale & Media</h3>
        <p className="text-zinc-300 mt-2">For bulk orders, sponsorships, or press, email:</p>
        <a href="mailto:sales@metaforge.gg" className="text-amber-400 hover:underline">sales@metaforge.gg</a>
      </div>
    </div>
  );
}

function Cart(): JSX.Element {
  const { state, dispatch } = useCart();
  const subtotal = state.items.reduce((a, b) => a + b.price * b.qty, 0);
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-black/30">
        <div className="p-5 border-b border-white/10 font-semibold">Your Cart</div>
        <div>
          {state.items.length === 0 && <div className="p-5 text-zinc-400">Cart is empty. <a className="text-amber-400 hover:underline" href="#/shop">Shop now</a>.</div>}
          {state.items.map((i) => (
            <div key={i.id + (i.color || "")} className="p-5 border-b border-white/10 flex items-center gap-4">
              <img src={i.image} alt="" className="w-20 h-20 rounded-xl object-cover" />
              <div className="flex-1">
                <div className="font-medium">{i.name}</div>
                <div className="text-xs text-zinc-400">{i.color}</div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="number" min={1} max={99} value={i.qty} onChange={(e) => dispatch({ type: "qty", id: i.id, color: i.color, qty: Number(e.target.value) || 1 })} className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-white/10" />
                  <button onClick={() => dispatch({ type: "remove", id: i.id, color: i.color })} className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/5">Remove</button>
                </div>
              </div>
              <div className="font-semibold">{fmt(i.price * i.qty)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-black/30 p-5 h-max">
        <div className="font-semibold">Summary</div>
        <div className="mt-3 flex justify-between text-sm"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
        <div className="mt-1 flex justify-between text-sm text-zinc-400"><span>Shipping</span><span>Calculated at checkout</span></div>
        <button onClick={() => { location.hash = "#/checkout"; }} disabled={!state.items.length} className="mt-4 w-full px-5 py-2 rounded-xl bg-amber-500 text-black font-semibold disabled:opacity-50">Checkout</button>
        <button onClick={() => dispatch({ type: "clear" })} className="mt-2 w-full px-5 py-2 rounded-xl border border-white/20 hover:bg-white/5">Clear Cart</button>
      </div>
    </div>
  );
}

function Checkout(): JSX.Element {
  const { state, dispatch } = useCart();
  const subtotal = state.items.reduce((a, b) => a + b.price * b.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax + (subtotal > 60 ? 0 : 7);
  return (
    <div className="max-w-3xl mx-auto">
      <SectionTitle title="Checkout" subtitle="Demo checkout — connect to Stripe/Shopify for production." />
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <input placeholder="Full name" className="px-3 py-2 rounded-xl bg-black/40 border border-white/10" />
          <input placeholder="Email" className="px-3 py-2 rounded-xl bg-black/40 border border-white/10" />
          <input placeholder="Address" className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 sm:col-span-2" />
          <input placeholder="City" className="px-3 py-2 rounded-xl bg-black/40 border border-white/10" />
          <input placeholder="Postal Code" className="px-3 py-2 rounded-xl bg-black/40 border border-white/10" />
        </div>
        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="flex justify-between text-sm text-zinc-400"><span>Shipping</span><span>{subtotal > 60 ? "FREE" : "$7.00"}</span></div>
          <div className="flex justify-between text-sm text-zinc-400"><span>Tax (est)</span><span>{fmt(tax)}</span></div>
          <div className="flex justify-between font-bold mt-1"><span>Total</span><span>{fmt(total)}</span></div>
        </div>
        <button onClick={() => { alert("Order placed (demo). Connect Stripe/Shopify for production."); dispatch({ type: "clear" }); location.hash = "#/"; }} className="mt-4 w-full px-5 py-2 rounded-xl bg-amber-500 text-black font-semibold">Place Order</button>
      </div>
    </div>
  );
}

function Footer(): JSX.Element {
  return (
    <footer className="mt-20 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid sm:grid-cols-4 gap-6 text-sm">
        <div className="sm:col-span-2">
          <img src={getLogoUrl()} alt="logo" className="h-10 w-auto" />
          <p className="mt-3 text-zinc-400 max-w-prose">{BRAND.tagline}</p>
        </div>
        <div>
          <div className="font-semibold">Company</div>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:underline" href="#/about">About</a></li>
            <li><a className="hover:underline" href="#/team">Team</a></li>
            <li><a className="hover:underline" href="#/faq">FAQ</a></li>
            <li><a className="hover:underline" href="#/contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold">Follow</div>
          <ul className="mt-2 space-y-1">
            {BRAND.socials.map((s) => (
              <li key={s.label}><a className="hover:underline" href={s.href}>{s.label}</a></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="text-center text-xs text-zinc-500 py-6">© {new Date().getFullYear()} Meta Forge. All rights reserved.</div>
    </footer>
  );
}

function SearchMini(): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  return (
    <div>
      <button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-sm">Search</button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60" />
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="relative max-w-xl w-full rounded-2xl overflow-hidden border border-white/10 bg-zinc-950">
              <button onClick={() => setOpen(false)} className="absolute right-2 top-2 p-2 rounded-lg bg-black/40">✕</button>
              <div className="p-4 border-b border-white/10 font-semibold">Search the shop</div>
              <div className="p-4">
                <input autoFocus placeholder="Sleeves, deck boxes, playmats…" className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10" onKeyDown={(e) => { if (e.key === "Enter") { location.hash = "#/shop"; setOpen(false); } }} />
                <p className="mt-2 text-xs text-zinc-500">Press Enter to view results.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
