"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal, Printer, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { subscribeToOrderUpdates } from "@/lib/order-sync-client";

type Order = { id: string; name: string; items: string; amount: number; time: string; channel: string; orderType: "Dine-in"; paymentMethod: "Cash" | "Card" | "GCash"; tableNumber: string; lineItems: { name: string; detail: string; quantity: number; price: number; image?: string }[]; cashierName?: string };

function formatReceiptStamp(time: string) {
  const placedAt = new Date(time);
  if (Number.isNaN(placedAt.getTime())) return { date: time, clock: "" };
  return {
    date: placedAt.toLocaleDateString([], { month: "2-digit", day: "2-digit", year: "numeric" }),
    clock: placedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function peso(amount: number) {
  return `₱${amount.toFixed(2)}`;
}

function ReceiptTicket({ order }: { order: Order }) {
  const stamp = formatReceiptStamp(order.time);
  const itemCount = order.lineItems.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div className="receipt-ticket">
      <div className="receipt-stars">****************************</div>
      <p className="receipt-shop">KAFFEY</p>
      <p className="receipt-tagline">Coffee for the curious</p>
      <p className="receipt-address">243 Wythe Avenue</p>
      <p className="receipt-address">hello@kaffey.coffee</p>
      <div className="receipt-stars">****************************</div>
      <p className="receipt-center">SALES RECEIPT</p>
      <div className="receipt-pairs">
        <p><span>Date</span><span>{stamp.date}</span></p>
        <p><span>Time</span><span>{stamp.clock}</span></p>
        <p><span>Order</span><span>{order.id}</span></p>
        <p><span>Cashier</span><span>{order.cashierName || "Cashier"}</span></p>
        <p><span>Customer</span><span>{order.name}</span></p>
      </div>
      <hr className="receipt-dash" />
      <div className="receipt-cols receipt-cols-head"><span>Qty</span><span>Item</span><span>Amount</span></div>
      {order.lineItems.map((item, index) => (
        <div className="receipt-line" key={`${item.name}-${index}`}>
          <div className="receipt-cols">
            <span>{item.quantity}</span>
            <span>{item.name}</span>
            <span>{peso(item.price * item.quantity)}</span>
          </div>
          <p className="receipt-unit">{item.quantity} @ {peso(item.price)}</p>
        </div>
      ))}
      <hr className="receipt-dash" />
      <div className="receipt-pairs">
        <p><span>Item count</span><span>{itemCount}</span></p>
        <p className="receipt-grand"><span>TOTAL</span><span>{peso(order.amount)}</span></p>
      </div>
      <hr className="receipt-dash" />
      <div className="receipt-pairs">
        <p><span>Payment</span><span>{order.paymentMethod.toUpperCase()}</span></p>
        <p><span>Amount paid</span><span>{peso(order.amount)}</span></p>
        <p><span>Change</span><span>{peso(0)}</span></p>
      </div>
      <hr className="receipt-dash" />
      <p className="receipt-center">Thank you for visiting</p>
      <p className="receipt-center">Please come again</p>
      <p className="receipt-barcode">||| {order.id.replace("#", "")} |||</p>
      <div className="receipt-stars">****************************</div>
    </div>
  );
}
function OrderSearchCard({ search, onSearch, currentTime }: { search: string; onSearch: (value: string) => void; currentTime: Date | null }) {
  return <div className="orders-dashboard-card menu-header-card"><div className="orders-dashboard-content"><div className="orders-dashboard-heading"><div><p>Order</p><span>{currentTime?.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span></div></div><div className="menu-search-wrap"><label className="pos-search orders-search" htmlFor="order-search"><Search size={16} /><input id="order-search" type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search orders" /></label></div><time className="orders-digital-clock" dateTime={currentTime?.toISOString()}>{currentTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div></div>;
}

function OrderList({ items, selectedId, onSelect, page, totalPages, onPageChange }: { items: Order[]; selectedId: string | null; onSelect: (id: string) => void; page: number; totalPages: number; onPageChange: (page: number) => void }) {
  return <Card className="orders-list-card"><CardHeader className="orders-list-header"><div><CardTitle>Recent orders</CardTitle><p className="orders-list-count">{items.length} orders displayed</p></div><button className="orders-more-button" type="button" aria-label="More order options"><MoreHorizontal size={18} /></button></CardHeader><CardContent className="orders-list-content"><div className="orders-list" role="list">{items.length ? items.map((order) => <button className={`order-row${selectedId === order.id ? " selected" : ""}`} key={order.id} type="button" role="listitem" onClick={() => onSelect(order.id)}><span className="order-row-icon"><UserRound size={16} aria-hidden="true" /></span><span className="order-row-copy"><strong>{order.id} <small>{order.time}</small></strong><span>{order.name}</span><small>{order.items}</small></span><span className="order-row-total"><strong>₱{order.amount.toFixed(2)}</strong></span></button>) : <div className="orders-no-results"><Search size={20} /><p>No orders found</p><span>Try another name, number, or item.</span></div>}</div></CardContent><nav className="orders-pagination" aria-label="Order pages"><button type="button" aria-label="Previous order page" disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))}><ChevronLeft size={16} /></button><span>Page {page} of {totalPages}</span><button type="button" aria-label="Next order page" disabled={page === totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}><ChevronRight size={16} /></button></nav></Card>;
}

function OrderDetails({ order }: { order?: Order }) {
  if (!order) {
    return (
      <div className="order-detail-panel order-detail-empty" aria-label="Select an order to view the receipt">
        <div className="receipt-placeholder-frame">
          <p className="receipt-placeholder">
            <strong>RECEIPT</strong>
            <span>displays here</span>
          </p>
          <p className="receipt-placeholder-hint">Select an order from Recent orders to preview and print it.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="order-detail-panel">
      <div className="order-receipt-print">
        <ReceiptTicket order={order} />
      </div>
      <button className="order-action" type="button" onClick={() => window.print()}>
        <Printer size={15} aria-hidden="true" /> Print receipt
      </button>
    </div>
  );
}

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const ordersPerPage = 4;
  useEffect(() => { setCurrentTime(new Date()); const timer = window.setInterval(() => setCurrentTime(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const loadOrders = async () => {
      const ordersResponse = await fetch("/api/orders?mine=true", { cache: "no-store" });
      const ordersPayload = await ordersResponse.json().catch(() => ({}));
      if (ordersResponse.ok && Array.isArray(ordersPayload.orders)) setOrders(ordersPayload.orders);
    };
    const unsubscribe = subscribeToOrderUpdates(() => {
      void loadOrders();
    });
    void loadOrders();
    return unsubscribe;
  }, []);
  const filteredOrders = useMemo(() => orders.filter((order) => `${order.id} ${order.name} ${order.items}`.toLowerCase().includes(search.toLowerCase().trim())), [orders, search]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageOrders = filteredOrders.slice((safePage - 1) * ordersPerPage, safePage * ordersPerPage);
  const selectedOrder = selectedId ? orders.find((order) => order.id === selectedId) : undefined;
  const changeSearch = (value: string) => { setSearch(value); setCurrentPage(1); };
  return <section className="pos-catalog orders-page" aria-label="Order records"><OrderSearchCard search={search} onSearch={changeSearch} currentTime={currentTime} /><div className="orders-layout"><OrderList items={pageOrders} selectedId={selectedId} onSelect={setSelectedId} page={safePage} totalPages={totalPages} onPageChange={setCurrentPage} /><OrderDetails order={selectedOrder} /></div></section>;
}