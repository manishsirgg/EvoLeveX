/**
 * Restricted database executor admission: deny all production mutation until
 * the SQL layer can independently authenticate the operator and verify signed
 * proof. The current owner-only atomic RPC relies on auth.uid() session GUCs;
 * this is NOT adequate to authorize a newly granted worker database role.
 */
export type StoreDatabaseExecutorCapabilities=Readonly<{
 isolatedWorkerIdentityVerified:boolean
 operatorProofVerifiedInDatabase:boolean
 operatorRoleRecheckedInTransaction:boolean
 atomicNonceEnforced:boolean
 providerEvidenceVerified:boolean
 restrictedDatabaseGrantReviewed:boolean
}>
export function assertStoreDatabaseExecutorSafeToConnect(
 capabilities:StoreDatabaseExecutorCapabilities,
):never{
 // Deliberately not an enable switch. A future audited security migration
 // must replace this sentinel after integrating each actual guarantee.
 void capabilities
 throw new Error('STORE_DATABASE_EXECUTOR_NOT_AUTHORIZED')
}
