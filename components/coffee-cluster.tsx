export const coffeeGroup = [
  { src: encodeURI("/coffees/CASTLE101__️_ICE_CREAM_-removebg-preview.png"), label: "Chocolate coffee cream", place: "left" },
  { src: "/coffees/Iced_Coffee_With_Milk_Splash_And_Ice_Cubes_PNG___TopPNG-removebg-preview.png", label: "Iced coffee with milk", place: "center" },
  { src: "/coffees/download-removebg-preview.png", label: "House coffee", place: "right" },
] as const;

export function CoffeeCluster() {
  return (
    <div className="hero-product" aria-label="Featured drinks">
      <div className="hero-product-cluster">
        <span className="hero-sparkle hero-sparkle-one" aria-hidden="true" />
        <span className="hero-sparkle hero-sparkle-two" aria-hidden="true" />
        <span className="hero-sparkle hero-sparkle-three" aria-hidden="true" />
        {coffeeGroup.map((coffee) => (
          <img
            key={coffee.src}
            className={`hero-product-image hero-product-image-${coffee.place}`}
            src={coffee.src}
            alt={coffee.label}
          />
        ))}
      </div>
    </div>
  );
}
