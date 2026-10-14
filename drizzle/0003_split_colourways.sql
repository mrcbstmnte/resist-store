-- Colour is no longer a variant option: each colourway is its own product.
-- Existing multi-colour products are split, not deleted. The first colourway
-- stays on the original product (same id and slug, so links keep working);
-- each other colourway becomes a new product, and its variants move with it.
-- Moving variants keeps their stock, stock history and past order items.
DROP INDEX "variants_product_size_color";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "color_hex" text DEFAULT '#888888' NOT NULL;--> statement-breakpoint
DO $$
DECLARE
  p record;
  c record;
  n_colours int;
  new_id int;
  base_slug text;
  new_slug text;
  suffix int;
  first boolean;
BEGIN
  FOR p IN SELECT * FROM products ORDER BY id LOOP
    SELECT count(DISTINCT color) INTO n_colours FROM variants WHERE product_id = p.id;
    first := true;
    FOR c IN
      SELECT color, min(color_hex) AS hex
      FROM variants
      WHERE product_id = p.id
      GROUP BY color
      ORDER BY min(position), color
    LOOP
      IF first THEN
        UPDATE products
        SET color_hex = c.hex,
            name = CASE WHEN n_colours > 1 THEN p.name || ' — ' || c.color ELSE p.name END
        WHERE id = p.id;
        first := false;
      ELSE
        base_slug := p.slug || '-' || trim(BOTH '-' FROM lower(regexp_replace(c.color, '[^a-zA-Z0-9]+', '-', 'g')));
        new_slug := base_slug;
        suffix := 2;
        WHILE EXISTS (SELECT 1 FROM products WHERE slug = new_slug) LOOP
          new_slug := base_slug || '-' || suffix;
          suffix := suffix + 1;
        END LOOP;
        -- No photo carried over: the original photo shows a different colourway.
        INSERT INTO products (slug, name, description, price_cents, silhouette, image_url, color_hex, active, created_at)
        VALUES (new_slug, p.name || ' — ' || c.color, p.description, p.price_cents, p.silhouette, NULL, c.hex, p.active, p.created_at)
        RETURNING id INTO new_id;
        UPDATE variants SET product_id = new_id WHERE product_id = p.id AND color = c.color;
      END IF;
    END LOOP;
  END LOOP;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "variants_product_size" ON "variants" USING btree ("product_id","size");--> statement-breakpoint
ALTER TABLE "variants" DROP COLUMN "color";--> statement-breakpoint
ALTER TABLE "variants" DROP COLUMN "color_hex";
