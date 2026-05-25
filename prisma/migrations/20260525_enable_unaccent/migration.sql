-- Habilita a extensão unaccent para buscas accent-insensitive em pt-BR.
-- Aditiva, idempotente — pode rodar várias vezes sem efeito.
--
-- Usada nas tools do assistente (getStockByProduct, searchProducts) via
-- $queryRaw: `unaccent(name) ILIKE unaccent($query)` casa "iogurte" com
-- "Iogúrte" e "Sabonete Líquido" com "sabonete liquido".
--
-- Neon habilita extensions sob demanda; em Postgres self-hosted o role
-- precisa de permissão para CREATE EXTENSION (geralmente superuser).
CREATE EXTENSION IF NOT EXISTS unaccent;
