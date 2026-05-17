-- Fix: tambah 'cod' ke ENUM payment_method di tabel orders
ALTER TABLE orders MODIFY payment_method ENUM('cod','gopay','ovo','dana','shopee_pay','bca_virtual','mandiri_virtual') NOT NULL;
