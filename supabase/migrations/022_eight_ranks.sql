-- 022_eight_ranks.sql
--
-- Relax rank_position CHECK on config_ranks and config_salary_tiers from
-- BETWEEN 1 AND 7 → BETWEEN 1 AND 8. The official Loveli Luxury IBO comp
-- plan defines 8 ranks (Starter, Team Builder, Builder, Manager, Senior
-- Manager, Director, Senior Director, President). The 7-level commission
-- depth (distributor_tree.depth) is unchanged — only the rank count grows.
--
-- After applying, the seed data for all 8 ranks + salary tiers is loaded
-- via two versioned-write SQL blocks (run separately in the SQL editor —
-- see Block 2 / Block 3 in chat transcript or PR description).
--
-- Additive + idempotent — safe to re-run.

ALTER TABLE config_ranks
  DROP CONSTRAINT IF EXISTS config_ranks_rank_position_check;
ALTER TABLE config_ranks
  ADD CONSTRAINT config_ranks_rank_position_check
  CHECK (rank_position BETWEEN 1 AND 8);

ALTER TABLE config_salary_tiers
  DROP CONSTRAINT IF EXISTS config_salary_tiers_rank_position_check;
ALTER TABLE config_salary_tiers
  ADD CONSTRAINT config_salary_tiers_rank_position_check
  CHECK (rank_position BETWEEN 1 AND 8);

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '022_eight_ranks',
  jsonb_build_object(
    'description',
    'Relaxed rank_position CHECK on config_ranks + config_salary_tiers to 1..8 so President (rank 8) can be added.'
  )
);
