"use client";

import { Coffee, Image as ImageIcon, MoreHorizontal, Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { useFileUpload } from "@/hooks/use-file-upload";
import { createClient } from "@/lib/supabase/client";

type ProductCategory = "Coffee" | "Tea" | "Refreshers";

type Product = {
	id: string;
	name: string;
	category: ProductCategory;
	description: string;
	price: number;
	image: string;
	tag?: string;
};

const categories = ["All", "Coffee", "Tea", "Refreshers"] as const;

export default function AdminProductsPage() {
	const [products, setProducts] = useState<Product[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isLoadingProducts, setIsLoadingProducts] = useState(true);
	const [submitError, setSubmitError] = useState("");
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [productPendingDelete, setProductPendingDelete] = useState<Product | null>(null);
	const [isDeletingProduct, setIsDeletingProduct] = useState(false);
	const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
	const [currentDate, setCurrentDate] = useState<Date | null>(null);
	const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
	const [formData, setFormData] = useState({ name: "", category: "Coffee" as ProductCategory, description: "", price: "", image: "", tag: "" });
	const handleFormChange = (field: keyof typeof formData, value: string) => setFormData((current) => ({ ...current, [field]: value }));
	const [{ files, isDragging, errors }, { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, removeFile, getInputProps }] = useFileUpload({
		accept: "image/svg+xml,image/png,image/jpeg,image/jpg,image/gif",
		maxSize: 5 * 1024 * 1024,
		onFilesChange: (nextFiles) => {
			const file = nextFiles[0]?.file;
			if (!file) {
				handleFormChange("image", "");
				return;
			}
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === "string") handleFormChange("image", reader.result);
			};
			reader.readAsDataURL(file);
		},
	});

	useEffect(() => {
		const timer = window.setTimeout(() => setCurrentDate(new Date()), 0);
		return () => window.clearTimeout(timer);
	}, []);

	useEffect(() => {
		const loadProducts = async () => {
			try {
				const response = await fetch("/api/products");
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(payload.error || "Unable to load saved products.");
				const savedProducts = Array.isArray(payload.products) ? payload.products : [];
				setProducts(savedProducts);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unable to load saved products.";
				setSubmitError(message);
				toastError(message);
			} finally {
				setIsLoadingProducts(false);
			}
		};

		void loadProducts();
	}, []);

	const filteredProducts = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		const categoryProducts = activeCategory === "All" ? products : products.filter((product) => product.category === activeCategory);
		return categoryProducts.filter((product) => `${product.name} ${product.description}`.toLowerCase().includes(query));
	}, [activeCategory, products, searchQuery]);


	const openEditProduct = (product: Product) => {
		setSelectedProduct(product);
		setFormData({ name: product.name, category: product.category, description: product.description, price: String(product.price), image: product.image, tag: product.tag || "" });
		setSubmitError("");
		setOpenActionMenuId(null);
		setIsModalOpen(true);
	};

	const notifyCashiers = (notification: { action: "added" | "updated" | "deleted"; productName: string; details: string }) => {
		const payload = { source: "admin-product-save" as const, timestamp: Date.now(), ...notification };
		window.localStorage.setItem("kaffey-product-notification", JSON.stringify(payload));
		if ("BroadcastChannel" in window) {
			const channel = new BroadcastChannel("kaffey-product-notifications");
			channel.postMessage(payload);
			channel.close();
		}
		const supabase = createClient();
		const productChannel = supabase.channel("cashier-product-notifications");
		productChannel.subscribe(async (status) => {
			if (status !== "SUBSCRIBED") return;
			await productChannel.send({ type: "broadcast", event: "product-updated", payload });
			await supabase.removeChannel(productChannel);
		});
	};

	const openAddProduct = () => {
		setSelectedProduct(null);
		setSubmitError("");
		setFormData({ name: "", category: "Coffee", description: "", price: "", image: "", tag: "" });
		setIsModalOpen(true);
	};

	const openDeleteProduct = (product: Product) => {
		setProductPendingDelete(product);
		setSubmitError("");
		setOpenActionMenuId(null);
	};

	const handleDeleteProduct = async () => {
		if (!productPendingDelete) return;
		setSubmitError("");
		setIsDeletingProduct(true);
		try {
			const response = await fetch("/api/products", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: productPendingDelete.id }),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload.error || "Unable to delete product.");
			setProducts((current) => current.filter((product) => product.id !== productPendingDelete.id));
			setPreviewProduct((current) => current?.id === productPendingDelete.id ? null : current);
			notifyCashiers({
				action: "deleted",
				productName: productPendingDelete.name,
				details: `${productPendingDelete.category} · ₱${productPendingDelete.price.toFixed(2)}`,
			});
			setProductPendingDelete(null);
			toastSuccess("Product deleted.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to delete product.";
			setSubmitError(message);
			toastError(message);
		} finally {
			setIsDeletingProduct(false);
		}
	};

	const handleAddProduct = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const price = Number(formData.price);
		if (!formData.name.trim() || !formData.description.trim() || !formData.image || !Number.isFinite(price) || price < 0) {
			toastError("Fill in the product details to continue.");
			return;
		}
		setSubmitError("");
		try {
			const response = await fetch("/api/products", {
				method: selectedProduct ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...formData, id: selectedProduct?.id, price, tag: formData.tag.trim() || undefined }),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload.error || "Unable to save product.");
			if (payload.product) {
				setProducts((current) => selectedProduct ? current.map((product) => product.id === selectedProduct.id ? payload.product : product) : [payload.product, ...current]);
				const changedFields = selectedProduct ? [
					selectedProduct.name !== payload.product.name && `Name: ${selectedProduct.name} -> ${payload.product.name}`,
					selectedProduct.category !== payload.product.category && `Category: ${selectedProduct.category} -> ${payload.product.category}`,
					selectedProduct.description !== payload.product.description && `Description: ${selectedProduct.description} -> ${payload.product.description}`,
					selectedProduct.price !== payload.product.price && `Price: ₱${selectedProduct.price.toFixed(2)} -> ₱${payload.product.price.toFixed(2)}`,
					selectedProduct.image !== payload.product.image && "Image: previous image -> new image",
					selectedProduct.tag !== payload.product.tag && `Tag: ${selectedProduct.tag || "none"} -> ${payload.product.tag || "none"}`,
				].filter(Boolean).join(" | ") : "new menu item";
				notifyCashiers({
					action: selectedProduct ? "updated" : "added",
					productName: payload.product.name,
					details: selectedProduct ? changedFields || "Product details unchanged" : `${payload.product.category} · ₱${payload.product.price.toFixed(2)} · ${payload.product.description}`,
				});
			}
			setFormData({ name: "", category: "Coffee", description: "", price: "", image: "", tag: "" });
			setSelectedProduct(null);
			setIsModalOpen(false);
			toastSuccess(selectedProduct ? "Product updated." : "Product added.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to save product.";
			setSubmitError(message);
			toastError(message);
		}
	};

	return (
		<section className="pos-catalog products-page" aria-labelledby="products-title">
			<div className="orders-dashboard-card menu-header-card accounts-header-card">
				<div className="orders-dashboard-content">
					<div className="orders-dashboard-heading">
						<div>
							<h1 id="products-title" className="accounts-header-accessible-title">Product List</h1>
							<p aria-hidden="true">Product List</p>
							<span>{currentDate?.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
						</div>
					</div>
					<label className="pos-search orders-search accounts-search" htmlFor="products-search">
						<Search size={16} aria-hidden="true" />
						<input id="products-search" type="search" aria-label="Search products" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search products" />
					</label>
					<button type="button" className="accounts-create-button accounts-header-action" onClick={openAddProduct}>
						<Coffee size={15} aria-hidden="true" />
						<span>Add Product</span>
					</button>
				</div>
			</div>
			<nav className="products-categories" aria-label="Product categories">{categories.map((category) => <button key={category} type="button" className={activeCategory === category ? "active" : undefined} aria-pressed={activeCategory === category} onClick={() => { setActiveCategory(category); if (category === "All") setSearchQuery(""); }}>{category}</button>)}</nav>
			<div className={`products-workspace${!isLoadingProducts && filteredProducts.length === 0 ? " products-workspace-empty" : ""}`}>
				<div className="products-main-pane">
					<div className="products-list" role="list" aria-label="Products">
						{!isLoadingProducts && filteredProducts.length > 0 && <div className="products-table-header" aria-hidden="true"><span>Product</span><span>Category</span><span>Price</span><span /></div>}
						{isLoadingProducts ? <p className="accounts-empty">Loading products...</p> : filteredProducts.length ? filteredProducts.map((product) => <article className={`admin-product-row${previewProduct?.id === product.id ? " selected" : ""}`} key={product.id} role="listitem" tabIndex={0} onClick={() => setPreviewProduct(product)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setPreviewProduct(product); } }}><strong className="admin-product-list-name">{product.name}</strong><span className="admin-product-category">{product.category}</span><strong className="admin-product-price">₱{product.price.toFixed(2)}</strong><div className="account-menu-wrap" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><button type="button" className="product-edit-button" aria-label={`Open actions for ${product.name}`} onClick={() => setOpenActionMenuId((current) => current === product.id ? null : product.id)}><MoreHorizontal size={17} aria-hidden="true" /></button>{openActionMenuId === product.id && <div className="account-menu"><button type="button" onClick={() => openEditProduct(product)}>Edit details</button><button type="button" className="account-menu-danger" onClick={() => openDeleteProduct(product)}>Delete product</button></div>}</div></article>) : <div className="products-empty-state"><div className="products-empty-art"><img src="/coffees/teacup.png" alt="" /></div><strong>No coffee found</strong><p>Try another search or choose a different category.</p></div>}
					</div>
				</div>
				{!isLoadingProducts && filteredProducts.length > 0 && <aside className="product-preview" aria-label="Product details preview">
					{previewProduct ? (
						<>
							<div className="product-preview-heading">
								<p className="pos-kicker">Selected product</p>
								<span>{previewProduct.category}</span>
							</div>
							<div className="product-preview-identity">
								<div className="product-preview-image"><img src={previewProduct.image} alt="" /></div>
								<div><h2>{previewProduct.name}</h2><p>{previewProduct.description}</p></div>
							</div>
							<dl className="product-preview-details">
								<div><dt>Category</dt><dd>{previewProduct.category}</dd></div>
								<div><dt>Price</dt><dd>₱{previewProduct.price.toFixed(2)}</dd></div>
								{previewProduct.tag && <div><dt>Tag</dt><dd>{previewProduct.tag}</dd></div>}
							</dl>
						</>
					) : (
						<div className="product-preview-empty"><Coffee size={24} aria-hidden="true" /><strong>Preview product details</strong><p>Select a product from the list to review its information.</p></div>
					)}
				</aside>}
			</div>

			{isModalOpen && <div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }}><div className="charge-modal create-account-modal product-modal" role="dialog" aria-modal="true" aria-labelledby="add-product-title"><div className="account-modal-header"><div><p className="pos-kicker">Catalog update</p><h2 id="add-product-title">{selectedProduct ? "Edit product" : "Add product"}</h2></div><button type="button" className="charge-modal-close" aria-label="Close product form" onClick={() => setIsModalOpen(false)}><X size={16} aria-hidden="true" /></button></div><form className="account-modal-form" onSubmit={handleAddProduct}><label><span>Product name</span><input type="text" value={formData.name} onChange={(event) => handleFormChange("name", event.target.value)} placeholder="e.g. Iced latte" required /></label><div className="product-form-grid"><label><span>Category</span><select value={formData.category} onChange={(event) => handleFormChange("category", event.target.value)}><option value="Coffee">Coffee</option><option value="Tea">Tea</option><option value="Refreshers">Refreshers</option></select></label><label><span>Price</span><input type="number" value={formData.price} onChange={(event) => handleFormChange("price", event.target.value)} placeholder="0.00" min="0" step="0.01" required /></label></div><label><span>Description</span><input type="text" value={formData.description} onChange={(event) => handleFormChange("description", event.target.value)} placeholder="Short product description" required /></label><div className={`product-upload-field${isDragging ? " is-dragging" : ""}`} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}><Input id="product-image-upload" {...getInputProps()} className="product-upload-input" aria-label="Upload image file" />{files[0]?.preview || formData.image ? <div className="product-upload-preview-wrap"><img className="product-upload-preview" src={files[0]?.preview || formData.image} alt={files[0]?.file.name || "Uploaded product image"} /><button type="button" className="product-upload-remove" aria-label="Remove image" onClick={() => removeFile(files[0]?.id)}>Remove</button></div> : <><div className="product-upload-icon"><ImageIcon aria-hidden="true" /></div><strong>Drop your image here</strong><small>SVG, PNG, JPG or GIF (max. 5MB)</small><Button type="button" className="product-upload-button" onClick={openFileDialog} variant="outline" size="sm"><Upload aria-hidden="true" /> Select image</Button></>}{errors.length > 0 && <p className="product-upload-error" role="alert">{errors[0]}</p>}</div><label><span>Tag <small>(optional)</small></span><input type="text" value={formData.tag} onChange={(event) => handleFormChange("tag", event.target.value)} placeholder="New or Popular" /></label>{submitError ? <p className="account-modal-error" role="alert">{submitError}</p> : null}<div className="account-modal-footer"><button type="button" className="account-modal-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button><button type="submit" className="account-modal-primary"><Coffee size={14} /> {selectedProduct ? "Save changes" : "Add product"}</button></div></form></div></div>}
			{productPendingDelete && <div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeletingProduct) setProductPendingDelete(null); }}><div className="charge-modal create-account-modal" role="dialog" aria-modal="true" aria-labelledby="delete-product-title"><div className="account-modal-header"><div><p className="pos-kicker">Destructive action</p><h2 id="delete-product-title">Delete product</h2></div><button type="button" className="charge-modal-close" aria-label="Close delete product" onClick={() => { if (!isDeletingProduct) setProductPendingDelete(null); }}><X size={16} aria-hidden="true" /></button></div><div className="account-modal-form"><p>Remove {productPendingDelete.name} from the catalog? This cannot be undone.</p>{submitError ? <p className="account-modal-error" role="alert">{submitError}</p> : null}<div className="account-modal-footer"><button type="button" className="account-modal-secondary" onClick={() => setProductPendingDelete(null)} disabled={isDeletingProduct}>Cancel</button><button type="button" className="account-modal-primary" onClick={() => void handleDeleteProduct()} disabled={isDeletingProduct}>{isDeletingProduct ? "Deleting..." : "Delete product"}</button></div></div></div></div>}
		</section>
	);
}
