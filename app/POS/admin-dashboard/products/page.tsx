"use client";

import { Coffee, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
	const [formData, setFormData] = useState({ name: "", category: "Coffee" as ProductCategory, description: "", price: "", image: "", tag: "" });

	useEffect(() => {
		const loadProducts = async () => {
			try {
				const response = await fetch("/api/products");
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(payload.error || "Unable to load saved products.");
				const savedProducts = Array.isArray(payload.products) ? payload.products : [];
				setProducts(savedProducts);
			} catch (error) {
				setSubmitError(error instanceof Error ? error.message : "Unable to load saved products.");
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

	const handleFormChange = (field: keyof typeof formData, value: string) => setFormData((current) => ({ ...current, [field]: value }));
	const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") handleFormChange("image", reader.result);
		};
		reader.readAsDataURL(file);
	};

	const openEditProduct = (product: Product) => {
		setSelectedProduct(product);
		setFormData({ name: product.name, category: product.category, description: product.description, price: String(product.price), image: product.image, tag: product.tag || "" });
		setSubmitError("");
		setIsModalOpen(true);
	};

	const openAddProduct = () => {
		setSelectedProduct(null);
		setSubmitError("");
		setFormData({ name: "", category: "Coffee", description: "", price: "", image: "", tag: "" });
		setIsModalOpen(true);
	};

	const handleAddProduct = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const price = Number(formData.price);
		if (!formData.name.trim() || !formData.description.trim() || !formData.image || !Number.isFinite(price) || price < 0) return;
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
			}
			setFormData({ name: "", category: "Coffee", description: "", price: "", image: "", tag: "" });
			setSelectedProduct(null);
			setIsModalOpen(false);
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : "Unable to save product.");
		}
	};

	return (
		<section className="pos-catalog products-page" aria-labelledby="products-title">
			<div className="pos-page-heading products-heading"><div><p className="pos-kicker">Catalog</p><h1 id="products-title">Product List</h1></div><span className="products-count">{products.length} products</span></div>
			<div className="products-toolbar"><label className="accounts-search"><Search size={16} aria-hidden="true" /><input aria-label="Search products" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search products" /></label><button type="button" className="accounts-create-button" onClick={openAddProduct}><Plus size={15} aria-hidden="true" /><span>Add Product</span></button></div>
			<nav className="products-categories" aria-label="Product categories">{categories.map((category) => <button key={category} type="button" className={activeCategory === category ? "active" : undefined} aria-pressed={activeCategory === category} onClick={() => { setActiveCategory(category); if (category === "All") setSearchQuery(""); }}>{category}</button>)}</nav>
			<div className="products-list" role="list" aria-label="Products">{isLoadingProducts ? <p className="accounts-empty">Loading products...</p> : filteredProducts.length ? filteredProducts.map((product) => <article className="admin-product-row" key={product.id} role="listitem"><div className="admin-product-image"><img src={product.image} alt="" /></div><div className="admin-product-details"><div className="admin-product-name"><strong>{product.name}</strong>{product.tag && <span>{product.tag}</span>}</div><p>{product.description}</p></div><span className="admin-product-category">{product.category}</span><strong className="admin-product-price">₱{product.price.toFixed(2)}</strong><button type="button" className="product-edit-button" aria-label={`Edit ${product.name}`} onClick={() => openEditProduct(product)}><MoreHorizontal size={17} aria-hidden="true" /></button></article>) : <p className="accounts-empty">No products match your search.</p>}</div>

			{isModalOpen && <div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }}><div className="charge-modal create-account-modal product-modal" role="dialog" aria-modal="true" aria-labelledby="add-product-title"><div className="account-modal-header"><div><p className="pos-kicker">Catalog update</p><h2 id="add-product-title">{selectedProduct ? "Edit product" : "Add product"}</h2></div><button type="button" className="charge-modal-close" aria-label="Close product form" onClick={() => setIsModalOpen(false)}><X size={16} aria-hidden="true" /></button></div><form className="account-modal-form" onSubmit={handleAddProduct}><label><span>Product name</span><input type="text" value={formData.name} onChange={(event) => handleFormChange("name", event.target.value)} placeholder="e.g. Iced latte" required /></label><div className="product-form-grid"><label><span>Category</span><select value={formData.category} onChange={(event) => handleFormChange("category", event.target.value)}><option value="Coffee">Coffee</option><option value="Tea">Tea</option><option value="Refreshers">Refreshers</option></select></label><label><span>Price</span><input type="number" value={formData.price} onChange={(event) => handleFormChange("price", event.target.value)} placeholder="0.00" min="0" step="0.01" required /></label></div><label><span>Description</span><input type="text" value={formData.description} onChange={(event) => handleFormChange("description", event.target.value)} placeholder="Short product description" required /></label><label className="product-upload-field"><span>Product image</span><input type="file" accept="image/*" onChange={handleImageChange} required={!formData.image} /><small>Choose an image from this device</small>{formData.image && <img className="product-upload-preview" src={formData.image} alt="Selected product preview" />}</label><label><span>Tag <small>(optional)</small></span><input type="text" value={formData.tag} onChange={(event) => handleFormChange("tag", event.target.value)} placeholder="New or Popular" /></label>{submitError ? <p className="account-modal-error" role="alert">{submitError}</p> : null}<div className="account-modal-footer"><button type="button" className="account-modal-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button><button type="submit" className="account-modal-primary"><Coffee size={14} /> {selectedProduct ? "Save changes" : "Add product"}</button></div></form></div></div>}
		</section>
	);
}
