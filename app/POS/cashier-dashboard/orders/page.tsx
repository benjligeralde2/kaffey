"use client";

import { Check, ChefHat, ChevronLeft, ChevronRight, Clock3, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
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

function isSameLocalDay(time: string, day: Date) {
  const placedAt = new Date(time);
  if (Number.isNaN(placedAt.getTime())) return false;
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return placedAt >= start && placedAt < end;
}

function peso(amount: number) {
  return `₱${amount.toFixed(2)}`;
}

function StatusFilters({ statusFilter, onStatusFilter }: { statusFilter: StatusFilter; onStatusFilter: (status: StatusFilter) => void }) {
  return (
    <div className="order-status-filters" role="tablist" aria-label="Order status">
      <button type="button" role="tab" aria-selected={statusFilter === "all"} className={statusFilter === "all" ? "active" : undefined} onClick={() => onStatusFilter("all")}>All</button>
      {ORDER_STATUSES.map((status) => (
        <button key={status} type="button" role="tab" aria-selected={statusFilter === status} className={statusFilter === status ? "active" : undefined} onClick={() => onStatusFilter(status)}>{status}</button>
      ))}
    </div>
  );
}

function OrderSearchCard({ search, onSearch, currentTime, statusFilter, onStatusFilter }: { search: string; onSearch: (value: string) => void; currentTime: Date | null; statusFilter: StatusFilter; onStatusFilter: (status: StatusFilter) => void }) {
  return (
    <div className="orders-dashboard-card menu-header-card">
      <div className="orders-dashboard-content">
        <div className="orders-dashboard-heading">
          <div>
            <p>Order</p>
            <span>{currentTime?.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
        <StatusFilters statusFilter={statusFilter} onStatusFilter={onStatusFilter} />
        <div className="menu-search-wrap">
          <label className="pos-search orders-search" htmlFor="order-search">
            <Search size={16} />
            <input id="order-search" type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search orders" />
          </label>
        </div>
        <time className="orders-digital-clock" dateTime={currentTime?.toISOString()}>{currentTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
      </div>
    </div>
  );
}

function OrderList({ items, selectedId, onSelect, page, totalPages, onPageChange }: { items: Order[]; selectedId: string | null; onSelect: (id: string) => void; page: number; totalPages: number; onPageChange: (page: number) => void }) {
  return (
    <Card className="orders-list-card rounded-none">
      <CardContent className="orders-list-content px-0">
        {items.length ? (
          <table className="history-table orders-recent-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer name</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Time</th>
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
                    <td>{order.id}</td>
                    <td>{order.name}</td>
                    <td>{order.items}</td>
                    <td>{peso(order.amount)}</td>
                    <td><span className={`status-pill ${statusClass(order.status)}`}><i aria-hidden="true" />{order.status}</span></td>
                    <td>{stamp.clock}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="products-empty-state orders-empty-state">
            <div className="products-empty-art"><img src="/coffees/teacup.png" alt="" /></div>
            <strong>No orders found</strong>
            <p>Orders placed today will show up here.</p>
          </div>
        )}
      </CardContent>
      {totalPages > 1 && (
        <nav className="orders-pagination" aria-label="Order pages">
          <button type="button" aria-label="Previous order page" disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))}><ChevronLeft size={16} /></button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" aria-label="Next order page" disabled={page === totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}><ChevronRight size={16} /></button>
        </nav>
      )}
    </Card>
  );
}

function StatusIcon({ status }: { status: OrderStatus }) {
  if (status === "On process") return <ChefHat size={12} aria-hidden="true" />;
  if (status === "Finished") return <Check size={12} aria-hidden="true" />;
  return <Clock3 size={12} aria-hidden="true" />;
}

function OrderStatusGuide({ status }: { status?: OrderStatus }) {
  const currentIndex = status ? Math.max(0, ORDER_STATUSES.indexOf(status)) : -1;
  return (
    <ol className="order-status-guide" aria-label="Kitchen status">
      {ORDER_STATUSES.map((step, index) => {
        const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "";
        return (
          <li className={`order-status-guide-step${state ? ` ${state}` : ""}`} key={step} aria-current={index === currentIndex ? "step" : undefined}>
            <span>{index < currentIndex ? <Check size={12} aria-hidden="true" /> : <StatusIcon status={step} />}</span>
            <div>
              <strong>{step}</strong>
              <small>{STATUS_COPY[step].hint}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function OrderDetails({ order }: { order?: Order }) {
  if (!order) {
    return (
      <div className="order-tracking-card order-detail-empty" aria-label="Select an order to track">
        <div className="products-empty-state orders-empty-state">
          <div className="products-empty-art"><img src="/coffees/teacup.png" alt="" /></div>
          <strong>No orders found</strong>
          <p>Today's orders will appear here for tracking.</p>
        </div>
      </div>
    );
  }
  const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
  return (
    <article className={`order-tracking-card is-${statusClass(order.status)}`} aria-label="Order tracking">
      <OrderStatusGuide status={order.status} />
      <header className="order-tracking-head">
        <div>
          <p className="order-tracking-kicker">Order tracking</p>
          <h2>{order.name}</h2>
        </div>
        <span className={`status-pill ${statusClass(order.status)}`}><i aria-hidden="true" />{order.status}</span>
      </header>
      <div className="order-tracking-body">
        {lineItems.length ? (
          <div className="order-tracking-items">
            {lineItems.map((item, index) => (
              <div className="order-tracking-item" key={`${item.name}-${index}`}>
                <b>{item.quantity}×</b>
                <span>
                  <strong>{item.name}</strong>
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
      </div>
      <footer className="order-tracking-foot">
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
  const ordersPerPage = 7;
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
  const todayKey = currentTime
    ? `${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()}`
    : "";
  const filteredOrders = useMemo(() => {
    const [year, month, date] = todayKey.split("-").map(Number);
    const day = todayKey ? new Date(year, month, date) : new Date();
    return orders.filter((order) => {
      if (!isSameLocalDay(order.time, day)) return false;
      const query = search.toLowerCase().trim();
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!query) return true;
      return `${order.id} ${order.name} ${order.items} ${order.status}`.toLowerCase().includes(query);
    });
  }, [orders, search, statusFilter, todayKey]);
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
  return (
    <section className="pos-catalog orders-page" aria-label="Order records">
      <OrderSearchCard search={search} onSearch={changeSearch} currentTime={currentTime} statusFilter={statusFilter} onStatusFilter={changeStatusFilter} />
      <div className="orders-layout">
        <OrderList items={pageOrders} selectedId={selectedId} onSelect={setSelectedId} page={safePage} totalPages={totalPages} onPageChange={setCurrentPage} />
        <OrderDetails order={selectedOrder} />
      </div>
    </section>
  );
}