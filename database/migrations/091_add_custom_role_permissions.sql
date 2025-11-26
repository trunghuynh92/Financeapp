-- Migration: Add custom role permissions system
-- Purpose: Allow customizing permissions for each role per entity

-- ==============================================================================
-- TABLE: role_permissions
-- Stores custom permission overrides for roles per entity
-- ==============================================================================

CREATE TABLE role_permissions (
  permission_id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role user_role NOT NULL,

  -- Transaction permissions
  can_view_transactions BOOLEAN DEFAULT NULL,
  can_create_transactions BOOLEAN DEFAULT NULL,
  can_edit_transactions BOOLEAN DEFAULT NULL,
  can_delete_transactions BOOLEAN DEFAULT NULL,
  can_categorize_transactions BOOLEAN DEFAULT NULL,
  can_split_transactions BOOLEAN DEFAULT NULL,
  can_add_notes BOOLEAN DEFAULT NULL,
  can_import_transactions BOOLEAN DEFAULT NULL,

  -- Reports & Analytics permissions
  can_view_reports BOOLEAN DEFAULT NULL,
  can_view_cash_flow BOOLEAN DEFAULT NULL,
  can_view_analytics BOOLEAN DEFAULT NULL,
  can_export_data BOOLEAN DEFAULT NULL,

  -- Account permissions
  can_view_accounts BOOLEAN DEFAULT NULL,
  can_create_accounts BOOLEAN DEFAULT NULL,
  can_edit_accounts BOOLEAN DEFAULT NULL,
  can_delete_accounts BOOLEAN DEFAULT NULL,

  -- Team management permissions
  can_view_team BOOLEAN DEFAULT NULL,
  can_invite_users BOOLEAN DEFAULT NULL,
  can_remove_users BOOLEAN DEFAULT NULL,
  can_change_roles BOOLEAN DEFAULT NULL,

  -- Settings permissions
  can_manage_categories BOOLEAN DEFAULT NULL,
  can_manage_settings BOOLEAN DEFAULT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Only one permission override per role per entity
  UNIQUE(entity_id, role)
);

-- Index for faster lookups
CREATE INDEX idx_role_permissions_entity_role ON role_permissions(entity_id, role);

-- RLS Policies
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Only owners can view role permissions
CREATE POLICY "Owners can view role permissions"
  ON role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entity_users
      WHERE entity_users.entity_id = role_permissions.entity_id
        AND entity_users.user_id = auth.uid()
        AND entity_users.role = 'owner'
    )
  );

-- Only owners can modify role permissions
CREATE POLICY "Owners can modify role permissions"
  ON role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM entity_users
      WHERE entity_users.entity_id = role_permissions.entity_id
        AND entity_users.user_id = auth.uid()
        AND entity_users.role = 'owner'
    )
  );

-- Updated timestamp trigger
CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE role_permissions IS
'Stores custom permission overrides for roles. NULL values mean use default permission from code.
TRUE/FALSE values override the default behavior.';
