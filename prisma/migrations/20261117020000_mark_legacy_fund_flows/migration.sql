-- Existing flow rows have no verifiable source or amount unit.
-- Preserve them under legacy levels so they cannot enter provider-backed rankings.
UPDATE FundFlow SET level = 'legacy_' || level
WHERE level IN ('stock', 'stock_inflow', 'stock_outflow', 'sector', 'market');
