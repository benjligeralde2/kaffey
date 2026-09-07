"use client";

import { Check, ChefHat, ChevronLeft, ChevronRight, Clock3, MoreHorizontal, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { subscribeToOrderUpdates } from "@/lib/order-sync-client";

import { ORDER_STATUSES, normalizeStatus, statusPillClass, type OrderStatus } from "@/lib/order-status";
type StatusFilter = "all" | OrderStatus;
type Order = {
  id: string;
  recordId: string;
  name: string;
  items: string;
  amount: number;
  time: string;
  channel: string;
  orderType: "Dine-in";
  paymentMethod: "Cash" | "Card" | "GCash";
  tableNumber: string;
  lineItems: { name: string; detail: string; quantity: number; price: number; image?: string }[];
  status: OrderStatus;
  cashierName?: string;
};

const STATUS_COPY: Record<OrderStatus, { hint: string }> = {
  Pending: { hint: "Waiting for the kitchen" },
  "On process": { hint: "Being prepared" },
  Finished: { hint: "Ready for the guest" },
};

function statusClass(status: OrderStatus) {
  return statusPillClass(status);
}

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

function OrderSearchCard({ search, onSearch, currentTime }: { search: string; onSearch: (value: string) => void; currentTime: Date | null }) {
  return <div className="orders-dashboard-card menu-header-card"><div className="orders-dashboard-content"><div className="orders-dashboard-heading"><div><p>Order</p><span>{currentTime?.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span></div></div><div className="menu-search-wrap"><label className="pos-search orders-search" htmlFor="order-search"><Search size={16} /><input id="order-search" type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search orders" /></label></div><time className="orders-digital-clock" dateTime={currentTime?.toISOString()}>{currentTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div></div>;
}

function OrderList({ items, selectedId, onSelect, page, totalPages, onPageChange, statusFilter, onStatusFilter }: { items: Order[]; selectedId: string | null; onSelect: (id: string) => void; page: number; totalPages: number; onPageChange: (page: number) => void; statusFilter: StatusFilter; onStatusFilter: (status: StatusFilter) => void }) {
  return (
    <Card className="orders-list-card">
      <CardHeader className="orders-list-header">
        <div>
          <CardTitle>Recent orders</CardTitle>
          <p className="orders-list-count">{items.length} orders displayed</p>
        </div>
        <button className="orders-more-button" type="button" aria-label="More order options"><MoreHorizontal size={18} /></button>
      </CardHeader>
      <div className="order-status-filters" role="tablist" aria-label="Order status">
        <button type="button" role="tab" aria-selected={statusFilter === "all"} className={statusFilter === "all" ? "active" : undefined} onClick={() => onStatusFilter("all")}>All</button>
        {ORDER_STATUSES.map((status) => (
          <button key={status} type="button" role="tab" aria-selected={statusFilter === status} className={statusFilter === status ? "active" : undefined} onClick={() => onStatusFilter(status)}>{status}</button>
        ))}
      </div>
      <CardContent className="orders-list-content px-0">
        {items.length ? (
          <table className="history-table orders-recent-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Pay</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => {
                const stamp = formatReceiptStamp(order.time);
                return (
                  <tr
                    key={order.id}
                    className={selectedId === order.id ? "selected" : undefined}
                    tabIndex={0}
                    aria-selected={selectedId === order.id}
                    onClick={() => onSelect(order.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(order.id);
                      }
                    }}
                  >
                    <td>{stamp.clock}</td>
                    <td>{order.id}</td>
                    <td>{order.name}</td>
                    <td>{order.items}</td>
                    <td>{order.paymentMethod}</td>
                    <td><span className={`status-pill ${statusClass(order.status)}`}><i aria-hidden="true" />{order.status}</span></td>
                    <td>{peso(order.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="orders-no-results">
            <Search size={20} />
            <p>No orders found</p>
            <span>Try another name, number, or status.</span>
          </div>
        )}
      </CardContent>
      <nav className="orders-pagination" aria-label="Order pages">
        <button type="button" aria-label="Previous order page" disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))}><ChevronLeft size={16} /></button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" aria-label="Next order page" disabled={page === totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}><ChevronRight size={16} /></button>
      </nav>
    </Card>
  );
}

function StatusIcon({ status }: { status: OrderStatus }) {
  if (status === "On process") return <ChefHat size={12} aria-hidden="true" />;
  if (status === "Finished") return <Check size={12} aria-hidden="true" />;
  return <Clock3 size={12} aria-hidden="true" />;
}

function OrderDetails({ order }: { order?: Order }) {
  if (!order) {
    return (
      <div className="order-tracking-card order-detail-empty" aria-label="Select an order to track">
        <div className="order-tracking-empty-mark" aria-hidden="true"><Search size={18} /></div>
        <p className="receipt-placeholder">
          <strong>TRACKING</strong>
          <span>displays here</span>
        </p>
        <p className="receipt-placeholder-hint">Select an order from Recent orders to follow its kitchen status.</p>
      </div>
    );
  }
  const currentIndex = Math.max(0, ORDER_STATUSES.indexOf(order.status));
  const progress = ((currentIndex + 1) / ORDER_STATUSES.length) * 100;
  const stamp = formatReceiptStamp(order.time);
  const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
  const itemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <article className={`order-tracking-card is-${statusClass(order.status)}`} aria-label="Order tracking">
      <header className="order-tracking-head">
        <div>
          <p className="order-tracking-kicker">Order tracking</p>
          <h2>{order.id}</h2>
          <span>{order.name}</span>
        </div>
        <span className={`status-pill ${statusClass(order.status)}`}><i aria-hidden="true" />{order.status}</span>
      </header>
      <div className="order-tracking-meta">
        <span>{order.orderType}{order.tableNumber ? ` · Table ${order.tableNumber}` : ""}</span>
        <span>{order.paymentMethod}</span>
        <span>{stamp.clock || stamp.date}</span>
      </div>
      <div className="order-progress" role="progressbar" aria-valuemin={1} aria-valuemax={ORDER_STATUSES.length} aria-valuenow={currentIndex + 1} aria-label="Kitchen progress">
        <div className="order-progress-track"><i style={{ width: `${progress}%` }} /></div>
        <small>{STATUS_COPY[order.status].hint}</small>
      </div>
      <ol className="order-timeline">
        {ORDER_STATUSES.map((status, index) => {
          const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "";
          return (
            <li className={`timeline-step${state ? ` ${state}` : ""}`} key={status} aria-current={index === currentIndex ? "step" : undefined}>
              <span>{index < currentIndex ? <Check size={12} aria-hidden="true" /> : <StatusIcon status={status} />}</span>
              <div>
                <strong>{status}</strong>
                <small>{STATUS_COPY[status].hint}</small>
              </div>
            </li>
          );
        })}
      </ol>
      {lineItems.length ? (
        <div className="order-tracking-items">
          <p className="detail-section-label"><span>Items</span><span>{itemCount}</span></p>
          {lineItems.map((item, index) => (
            <div className="order-tracking-item" key={`${item.name}-${index}`}>
              <b>{item.quantity}×</b>
              <span>
                <strong>{item.name}</strong>
                {item.detail ? <small>{item.detail}</small> : null}
              </span>
              <em>{peso(item.price * item.quantity)}</em>
            </div>
          ))}
        </div>
      ) : (
        <div className="order-tracking-summary">
          <p><span>Items</span><strong>{order.items || "—"}</strong></p>
        </div>
      )}
      <footer className="order-tracking-foot">
        <p className="order-tracking-done">{order.status === "Finished" ? "Ready for the guest." : "Kitchen updates this order live."}</p>
        <p className="order-tracking-total"><span>Total</span><strong>{peso(order.amount)}</strong></p>
      </footer>
    </article>
  );
}

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const ordersPerPage = 8;
  useEffect(() => { setCurrentTime(new Date()); const timer = window.setInterval(() => setCurrentTime(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const loadOrders = async () => {
      const ordersResponse = await fetch("/api/orders?mine=true", { cache: "no-store" });
      const ordersPayload = await ordersResponse.json().catch(() => ({}));
      if (ordersResponse.ok && Array.isArray(ordersPayload.orders)) {
        setOrders(ordersPayload.orders.map((order: Order) => ({
          ...order,
          recordId: order.recordId || "",
          status: normalizeStatus(order.status),
        })));
      }
    };
    const unsubscribe = subscribeToOrderUpdates(() => {
      void loadOrders();
    });
    void loadOrders();
    return unsubscribe;
  }, []);
  const filteredOrders = useMemo(() => orders.filter((order) => {
    const query = search.toLowerCase().trim();
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (!query) return true;
    return `${order.id} ${order.name} ${order.items} ${order.status}`.toLowerCase().includes(query);
  }), [orders, search, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageOrders = filteredOrders.slice((safePage - 1) * ordersPerPage, safePage * ordersPerPage);
  const selectedOrder = selectedId ? orders.find((order) => order.id === selectedId) : undefined;
  useEffect(() => {
    if (selectedId && pageOrders.some((order) => order.id === selectedId)) return;
    setSelectedId(pageOrders[0]?.id ?? null);
  }, [pageOrders, selectedId]);
  const changeSearch = (value: string) => { setSearch(value); setCurrentPage(1); };
  const changeStatusFilter = (status: StatusFilter) => { setStatusFilter(status); setCurrentPage(1); };
  return <section className="pos-catalog orders-page" aria-label="Order records"><OrderSearchCard search={search} onSearch={changeSearch} currentTime={currentTime} /><div className="orders-layout"><OrderList items={pageOrders} selectedId={selectedId} onSelect={setSelectedId} page={safePage} totalPages={totalPages} onPageChange={setCurrentPage} statusFilter={statusFilter} onStatusFilter={changeStatusFilter} /><OrderDetails order={selectedOrder} /></div></section>;
}