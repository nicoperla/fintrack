-- Contract step of 20260925072923_households_and_currencies: the app now always writes
-- household_id and base_amount itself, so the transitional triggers for the old code can go.

DROP TRIGGER IF EXISTS "users_personal_household" ON "users";
DROP TRIGGER IF EXISTS "accounts_default_household" ON "accounts";
DROP TRIGGER IF EXISTS "budgets_default_household" ON "budgets";
DROP TRIGGER IF EXISTS "categories_default_household" ON "categories";
DROP TRIGGER IF EXISTS "debts_default_household" ON "debts";
DROP TRIGGER IF EXISTS "goals_default_household" ON "goals";
DROP TRIGGER IF EXISTS "transactions_default_household" ON "transactions";
DROP TRIGGER IF EXISTS "transactions_default_base_amount" ON "transactions";

DROP FUNCTION IF EXISTS "fintrack_personal_household"();
DROP FUNCTION IF EXISTS "fintrack_default_household"();
DROP FUNCTION IF EXISTS "fintrack_default_base_amount"();
