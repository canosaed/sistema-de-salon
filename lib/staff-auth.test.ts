import assert from 'node:assert/strict'
import test from 'node:test'
import { adminRoles, isSalonRoleAllowed, panelRoles } from '@/lib/role-policy'

test('admin has panel and administrator access', () => {
  assert.equal(isSalonRoleAllowed('admin', panelRoles), true)
  assert.equal(isSalonRoleAllowed('admin', adminRoles), true)
})

test('reception can use the panel but cannot perform administrator actions', () => {
  assert.equal(isSalonRoleAllowed('receptionist', panelRoles), true)
  assert.equal(isSalonRoleAllowed('receptionist', adminRoles), false)
})

test('professionals and unknown roles cannot access the current panel', () => {
  assert.equal(isSalonRoleAllowed('professional', panelRoles), false)
  assert.equal(isSalonRoleAllowed('unknown', panelRoles), false)
})
