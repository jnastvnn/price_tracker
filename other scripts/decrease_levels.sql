-- Decrease all levels by 1 in listing_categories table
UPDATE listing_categories 
SET level = level - 1 
WHERE level > 0; 