"use client";

import { ChevronLeft, ChevronRight, CreditCard, MoreHorizontal, Receipt, Search, UserRound, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Order = { id: string; name: string; items: string; amount: number; time: string; channel: string; orderType: "Dine-in"; paymentMethod: "Cash" | "Card" | "GCash"; tableNumber: string; lineItems: { name: string; detail: string; quantity: number; price: number; image?: string }[] };

const coffeeImage = "/coffees/Iced_Coffee_With_Milk_Splash_And_Ice_Cubes_PNG___TopPNG-removebg-preview.png";
const menuImages: Record<string, string> = { "Iced latte": coffeeImage, "Matcha cloud": "/coffees/CASTLE101__%EF%B8%8F-removebg-preview.png", "Blueberry cream": "/coffees/download-removebg-preview.png", "Vanilla cold brew": coffeeImage, "Berry fizz": "/coffees/download-removebg-preview.png", "Citrus matcha": "/coffees/CASTLE101__%EF%B8%8F-removebg-preview.png", "Hazelnut tonic": coffeeImage };
function OrderSearchCard({ search, onSearch, currentTime }: { search: string; onSearch: (value: string) => void; currentTime: Date | null }) {
  return <Card className="orders-dashboard-card"><div className="orders-dashboard-content"><div className="orders-dashboard-heading"><div><p>Order</p><span>{currentTime?.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span></div></div><label className="pos-search orders-search" htmlFor="order-search"><Search size={16} /><input id="order-search" type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search orders" /></label><time className="orders-digital-clock" dateTime={currentTime?.toISOString()}>{currentTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div></Card>;
}

function OrderList({ items, selectedId, onSelect, page, totalPages, onPageChange }: { items: Order[]; selectedId: string | null; onSelect: (id: string) => void; page: number; totalPages: number; onPageChange: (page: number) => void }) {
  return <Card className="orders-list-card"><CardHeader className="orders-list-header"><div><CardTitle>Recent orders</CardTitle><p className="orders-list-count">{items.length} orders displayed</p></div><button className="orders-more-button" type="button" aria-label="More order options"><MoreHorizontal size={18} /></button></CardHeader><CardContent className="orders-list-content"><div className="orders-list" role="list">{items.length ? items.map((order) => <button className={`order-row${selectedId === order.id ? " selected" : ""}`} key={order.id} type="button" role="listitem" onClick={() => onSelect(order.id)}><span className="order-row-icon"><UserRound size={16} aria-hidden="true" /></span><span className="order-row-copy"><strong>{order.id} <small>{order.time}</small></strong><span>{order.name}</span><small>{order.items}</small></span><span className="order-row-total"><strong>₱{order.amount.toFixed(2)}</strong></span></button>) : <div className="orders-no-results"><Search size={20} /><p>No orders found</p><span>Try another name, number, or item.</span></div>}</div></CardContent><nav className="orders-pagination" aria-label="Order pages"><button type="button" aria-label="Previous order page" disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))}><ChevronLeft size={16} /></button><span>Page {page} of {totalPages}</span><button type="button" aria-label="Next order page" disabled={page === totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}><ChevronRight size={16} /></button></nav></Card>;
}

function OrderDetails({ order }: { order?: Order }) {
  if (!order) return <Card className="order-detail-card order-detail-empty" aria-label="Select an order to view details" />;
  return <Card className="order-detail-card"><CardHeader className="order-detail-header"><div><p className="pos-kicker">Customer details</p><CardTitle>{order.name}</CardTitle><small>{order.id} · Placed {order.time}</small></div><button className="orders-more-button" type="button" aria-label="More customer options"><MoreHorizontal size={18} /></button></CardHeader><CardContent className="order-detail-content"><div className="order-customer-line"><span className="customer-avatar"><UserRound size={15} /></span><span><strong>{order.name}</strong><small>Dine-in customer</small></span></div><div className="order-meta-grid"><span><Utensils size={14} /><small>Service</small><strong>{order.orderType}</strong></span><span><CreditCard size={14} /><small>Payment</small><strong>{order.paymentMethod}</strong></span><span><Receipt size={14} /><small>Table</small><strong>{order.tableNumber}</strong></span></div><div className="detail-items"><div className="detail-section-label"><span>Order items</span><span>{order.lineItems.length} items</span></div>{order.lineItems.map((item) => <div className="detail-item" key={item.name}><span className="detail-item-art"><img src={menuImages[item.name]} alt="" /></span><span><strong>{item.name}</strong><small>{item.quantity} × {item.detail}</small></span><b>₱{(item.price * item.quantity).toFixed(2)}</b></div>)}</div><div className="detail-total"><span>Total paid</span><strong>₱{order.amount.toFixed(2)}</strong></div></CardContent></Card>;
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
      const [ordersResponse, productsResponse] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/products", { cache: "no-store" }),
      ]);
      const ordersPayload = await ordersResponse.json().catch(() => ({}));
      const productsPayload = await productsResponse.json().catch(() => ({}));
      if (productsResponse.ok && Array.isArray(productsPayload.products)) {
        productsPayload.products.forEach((product: { name: string; image: string }) => {
          menuImages[product.name] = product.image;
        });
      }
      if (ordersResponse.ok && Array.isArray(ordersPayload.orders)) {
        ordersPayload.orders.forEach((order: Order) => order.lineItems.forEach((item) => {
          if (item.image) menuImages[item.name] = item.image;
        }));
        setOrders(ordersPayload.orders);
      }
    };
    const orderBroadcast = "BroadcastChannel" in window ? new BroadcastChannel("kaffey-orders") : null;
    const handleOrderRecorded = () => void loadOrders();
    orderBroadcast?.addEventListener("message", handleOrderRecorded);
    void loadOrders();
    return () => {
      orderBroadcast?.removeEventListener("message", handleOrderRecorded);
      orderBroadcast?.close();
    };
  }, []);
  const filteredOrders = useMemo(() => orders.filter((order) => `${order.id} ${order.name} ${order.items}`.toLowerCase().includes(search.toLowerCase().trim())), [orders, search]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageOrders = filteredOrders.slice((safePage - 1) * ordersPerPage, safePage * ordersPerPage);
  const selectedOrder = selectedId ? orders.find((order) => order.id === selectedId) : undefined;
  const changeSearch = (value: string) => { setSearch(value); setCurrentPage(1); };
  return <section className="pos-catalog orders-page" aria-label="Order records"><OrderSearchCard search={search} onSearch={changeSearch} currentTime={currentTime} /><div className="orders-layout"><OrderList items={pageOrders} selectedId={selectedId} onSelect={setSelectedId} page={safePage} totalPages={totalPages} onPageChange={setCurrentPage} /><OrderDetails order={selectedOrder} /></div></section>;
}